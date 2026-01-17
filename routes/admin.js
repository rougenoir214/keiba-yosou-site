const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const pool = require('../db/connection');

// アップロード設定
const upload = multer({ dest: 'uploads/' });

// CSVインポートページ
router.get('/import', (req, res) => {
  res.render('import');
});

// CSVアップロード処理
router.post('/import', upload.single('csvfile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('ファイルがアップロードされていません');
  }

  const results = [];
  const races = new Map();

  // CSVを読み込み
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        // BOM除去用のヘルパー関数
        const normalizeKey = (key) => key.replace(/^\uFEFF/, '').trim();
        const getValue = (obj, key) => {
          for (const [k, v] of Object.entries(obj)) {
            if (normalizeKey(k) === key) return v;
          }
          return null;
        };
        
        // レース情報をグループ化
        results.forEach(row => {
          const raceId = getValue(row, 'race_id');
          if (!raceId) {
            console.error('race_idが見つかりません:', row);
            return;
          }
          if (!races.has(raceId)) {
            races.set(raceId, []);
          }
          races.get(raceId).push(row);
        });

        // データベースに保存
        for (const [raceId, horses] of races) {
          // レース情報を保存（CSVからレース名、日付、競馬場を取得）
          const firstHorse = horses[0];
          
          console.log('=== レース情報デバッグ ===');
          console.log('raceId:', raceId);
          console.log('firstHorseのキー:', Object.keys(firstHorse));
          
          const raceName = getValue(firstHorse, 'レース名') || `レース${raceId}`;
          const venue = getValue(firstHorse, '競馬場') || '未設定';
          
          // CSVから日付を取得（優先）、なければrace_idから抽出
          let raceDate = getValue(firstHorse, 'レース日付');
          
          if (!raceDate && raceId.length >= 8) {
            // フォールバック: race_idから推測（正確ではない）
            const year = raceId.substring(0, 4);
            const month = raceId.substring(4, 6);
            const day = raceId.substring(6, 8);
            raceDate = `${year}-${month}-${day}`;
            console.log('[警告] CSVに日付がないため、race_idから推測しました（不正確）');
          }
          
          if (!raceDate) {
            raceDate = new Date().toISOString().split('T')[0]; // 最終フォールバック
          }
          
          console.log('取得したレース名:', raceName);
          console.log('取得したレース日付:', raceDate);
          console.log('取得した競馬場:', venue);
          console.log('=======================');
          
          await pool.query(
            `INSERT INTO races (race_id, race_name, race_date, race_time, venue) 
             VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT (race_id) DO UPDATE SET
               race_name = EXCLUDED.race_name,
               race_date = EXCLUDED.race_date,
               race_time = EXCLUDED.race_time,
               venue = EXCLUDED.venue`,
            [raceId, raceName, raceDate, '23:59', venue]
          );

          // 出走馬情報を保存
          for (const horse of horses) {
            // デバッグ: CSVヘッダーを確認
            console.log('CSVの列名:', Object.keys(horse));
            console.log('馬データ:', horse);
            
            const waku = parseInt(getValue(horse, '枠番'));
            const umaban = parseInt(getValue(horse, '馬番'));
            const weight = parseFloat(getValue(horse, '斤量'));
            
            if (isNaN(waku) || isNaN(umaban)) {
              console.error('エラー: 枠番または馬番が不正です', horse);
              continue; // スキップ
            }
            
            await pool.query(
              `INSERT INTO horses (race_id, waku, umaban, horse_name, age_sex, weight_load, jockey, stable, horse_weight)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (race_id, umaban) DO UPDATE SET
                 horse_name = EXCLUDED.horse_name,
                 age_sex = EXCLUDED.age_sex,
                 weight_load = EXCLUDED.weight_load,
                 jockey = EXCLUDED.jockey,
                 stable = EXCLUDED.stable,
                 horse_weight = EXCLUDED.horse_weight`,
              [
                raceId,
                waku,
                umaban,
                getValue(horse, '馬名'),
                getValue(horse, '性齢'),
                isNaN(weight) ? 0 : weight,
                getValue(horse, '騎手'),
                getValue(horse, '厩舎'),
                getValue(horse, '馬体重') || ''
              ]
            );
          }
        }

        // 一時ファイル削除
        fs.unlinkSync(req.file.path);

        res.send(`成功: ${races.size}レース、${results.length}頭のデータをインポートしました`);
      } catch (error) {
        console.error(error);
        res.status(500).send('エラーが発生しました: ' + error.message);
      }
    });
});

module.exports = router;
// 結果インポートページ
router.get('/import-results', (req, res) => {
  res.render('import-results');
});

// 結果CSVアップロード処理
router.post('/import-results', upload.single('resultsfile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('ファイルがアップロードされていません');
  }

  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        const getValue = (obj, key) => {
          for (const [k, v] of Object.entries(obj)) {
            const cleanKey = k.replace(/^\uFEFF/, '').trim();
            if (cleanKey === key) return v;
          }
          return null;
        };

        let successCount = 0;

        for (const row of results) {
          const raceId = getValue(row, 'race_id');
          const rank = parseInt(getValue(row, '着順'));
          const umaban = parseInt(getValue(row, '馬番'));
          const resultTime = getValue(row, 'タイム') || '';

          if (!raceId || isNaN(rank) || isNaN(umaban)) {
            console.error('無効なデータ:', row);
            continue;
          }

          await pool.query(
            `INSERT INTO results (race_id, umaban, rank, result_time)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (race_id, umaban) DO UPDATE SET
               rank = EXCLUDED.rank,
               result_time = EXCLUDED.result_time,
               updated_at = CURRENT_TIMESTAMP`,
            [raceId, umaban, rank, resultTime]
          );

          successCount++;
        }

        fs.unlinkSync(req.file.path);
        res.send(`成功: ${successCount}件のレース結果をインポートしました`);
      } catch (error) {
        console.error(error);
        res.status(500).send('エラーが発生しました: ' + error.message);
      }
    });
});

// 払戻金CSVアップロード処理
router.post('/import-payouts', upload.single('payoutsfile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('ファイルがアップロードされていません');
  }

  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        const getValue = (obj, key) => {
          for (const [k, v] of Object.entries(obj)) {
            const cleanKey = k.replace(/^\uFEFF/, '').trim();
            if (cleanKey === key) return v;
          }
          return null;
        };

        let successCount = 0;

        for (const row of results) {
          const raceId = getValue(row, 'race_id');
          const betType = getValue(row, '馬券種別');
          const combination = getValue(row, '組み合わせ');
          const payout = parseInt(getValue(row, '払戻金'));

          if (!raceId || !betType || !combination || isNaN(payout)) {
            console.error('無効なデータ:', row);
            continue;
          }

          await pool.query(
            `INSERT INTO race_payouts (race_id, bet_type, combination, payout)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (race_id, bet_type, combination) DO UPDATE SET
               payout = EXCLUDED.payout`,
            [raceId, betType, combination, payout]
          );

          successCount++;
        }

        fs.unlinkSync(req.file.path);
        res.send(`成功: ${successCount}件の払戻金をインポートしました`);
      } catch (error) {
        console.error(error);
        res.status(500).send('エラーが発生しました: ' + error.message);
      }
    });
});

// レース時刻を一括更新（15:00 → 23:59）
router.post('/update-race-times', async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE races 
      SET race_time = '23:59' 
      WHERE race_time = '15:00'
      RETURNING race_id, race_name, race_date, race_time
    `);
    
    res.send(`成功: ${result.rows.length}件のレース時刻を更新しました（15:00 → 23:59）`);
  } catch (error) {
    console.error(error);
    res.status(500).send('エラーが発生しました: ' + error.message);
  }
});

// netkeibaからレース結果を自動取得
router.post('/fetch-result/:race_id', async (req, res) => {
  const axios = require('axios');
  const cheerio = require('cheerio');
  const { race_id } = req.params;
  
  try {
    // netkeibaのURLを構築
    const url = `https://race.netkeiba.com/race/result.html?race_id=${race_id}`;
    console.log('Fetching from:', url);
    
    // HTMLを取得
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // HTMLをパース
    const $ = cheerio.load(response.data);
    
    // 結果テーブルを取得（複数のセレクタを試す）
    let $table = $('.RaceTable01 tbody tr');
    if ($table.length === 0) {
      $table = $('.Result_Table_01 tbody tr');
    }
    if ($table.length === 0) {
      $table = $('.Shutuba_Table tbody tr');
    }
    
    // 結果テーブルを取得
    const results = [];
    $table.each((index, element) => {
      const $row = $(element);
      
      // 着順（1列目）
      const rankText = $row.find('td:nth-child(1)').text().trim();
      const rank = parseInt(rankText);
      
      // 馬番（3列目）※2列目は枠番
      const umaban = parseInt($row.find('td:nth-child(3)').text().trim());
      
      // タイム（8列目）
      const timeText = $row.find('td:nth-child(8)').text().trim();
      
      if (!isNaN(rank) && !isNaN(umaban)) {
        results.push({
          rank: rank,
          umaban: umaban,
          result_time: timeText || null
        });
      }
    });
    
    if (results.length === 0) {
      return res.status(404).send('レース結果が見つかりませんでした。race_idを確認してください。');
    }
    
    console.log('取得した結果:', results.length, '頭');
    
    // 重複チェック：同じ馬番は1回だけ
    const uniqueResults = [];
    const seenUmaban = new Set();
    
    for (const result of results) {
      if (!seenUmaban.has(result.umaban)) {
        uniqueResults.push(result);
        seenUmaban.add(result.umaban);
      } else {
        console.warn(`重複した馬番をスキップ: 馬番${result.umaban} (着順${result.rank})`);
      }
    }
    
    console.log('重複除去後:', uniqueResults.length, '頭');
    
    // データベースに保存（既存データは削除）
    await pool.query('DELETE FROM results WHERE race_id = $1', [race_id]);
    
    for (const result of uniqueResults) {
      await pool.query(
        'INSERT INTO results (race_id, umaban, rank, result_time) VALUES ($1, $2, $3, $4) ON CONFLICT (race_id, umaban) DO UPDATE SET rank = EXCLUDED.rank, result_time = EXCLUDED.result_time',
        [race_id, result.umaban, result.rank, result.result_time]
      );
    }
    
    res.send(`成功: ${uniqueResults.length}頭の結果を取得しました`);
    
  } catch (error) {
    console.error('Error fetching results:', error.message);
    res.status(500).send('エラーが発生しました: ' + error.message);
  }
});

// netkeibaからレース情報と出走馬を自動取得・登録
router.post('/fetch-race/:race_id', async (req, res) => {
  const axios = require('axios');
  const cheerio = require('cheerio');
  const { race_id } = req.params;
  
  try {
    // netkeibaのURLを構築（出馬表ページ）
    const url = `https://race.netkeiba.com/race/shutuba.html?race_id=${race_id}`;
    console.log('Fetching race data from:', url);
    
    // HTMLを取得
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // HTMLをパース
    const $ = cheerio.load(response.data);
    
    // レース名を取得
    const raceName = $('.RaceName').text().trim() || 
                     $('h1').first().text().trim() ||
                     'レース名取得失敗';
    
    // 開催日を取得（race_idから抽出）
    const year = race_id.substring(0, 4);
    const month = race_id.substring(4, 6);
    const day = race_id.substring(8, 10);
    const raceDate = `${year}-${month}-${day}`;
    
    // 競馬場を取得（race_idから判定）
    const venueCode = race_id.substring(6, 8);
    const venueMap = {
      '01': '札幌', '02': '函館', '03': '福島', '04': '新潟',
      '05': '東京', '06': '中山', '07': '中京', '08': '京都',
      '09': '阪神', '10': '小倉'
    };
    const venue = venueMap[venueCode] || '不明';
    
    console.log('レース情報:', { raceName, raceDate, venue });
    
    // 出走馬テーブルを取得
    const horses = [];
    $('.Shutuba_Table tbody tr, .RaceTable01 tbody tr').each((index, element) => {
      const $row = $(element);
      
      // 枠番（1列目）
      const waku = parseInt($row.find('td:nth-child(1)').text().trim());
      
      // 馬番（2列目）
      const umaban = parseInt($row.find('td:nth-child(2)').text().trim());
      
      // 馬名（3列目のリンク）
      const horseName = $row.find('td:nth-child(3) a').text().trim() ||
                        $row.find('td:nth-child(3)').text().trim();
      
      // 性齢（4列目）
      const sexAge = $row.find('td:nth-child(4)').text().trim();
      
      // 斤量（5列目）
      const weight = $row.find('td:nth-child(5)').text().trim();
      
      // 騎手（6列目）
      const jockey = $row.find('td:nth-child(6) a').text().trim() ||
                     $row.find('td:nth-child(6)').text().trim();
      
      // 厩舎（7列目）
      const trainer = $row.find('td:nth-child(7) a').text().trim() ||
                      $row.find('td:nth-child(7)').text().trim();
      
      // 馬体重（8列目）
      const horseWeight = $row.find('td:nth-child(8)').text().trim();
      
      if (!isNaN(waku) && !isNaN(umaban) && horseName) {
        horses.push({
          waku,
          umaban,
          horse_name: horseName,
          sex_age: sexAge,
          weight,
          jockey,
          trainer,
          horse_weight: horseWeight
        });
      }
    });
    
    if (horses.length === 0) {
      return res.status(404).send('出走馬情報が見つかりませんでした。race_idを確認してください。');
    }
    
    console.log('取得した出走馬:', horses.length, '頭');
    
    // データベースに保存
    // レース情報を保存
    await pool.query(
      `INSERT INTO races (race_id, race_name, race_date, race_time, venue) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (race_id) DO UPDATE SET
         race_name = EXCLUDED.race_name,
         race_date = EXCLUDED.race_date,
         race_time = EXCLUDED.race_time,
         venue = EXCLUDED.venue`,
      [race_id, raceName, raceDate, '23:59', venue]
    );
    
    // 既存の出走馬データを削除
    await pool.query('DELETE FROM horses WHERE race_id = $1', [race_id]);
    
    // 出走馬を保存
    for (const horse of horses) {
      const weightLoad = parseFloat(horse.weight) || null;
      
      await pool.query(
        `INSERT INTO horses (race_id, waku, umaban, horse_name, age_sex, weight_load, jockey, stable, horse_weight) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          race_id, 
          horse.waku, 
          horse.umaban, 
          horse.horse_name, 
          horse.sex_age || '',
          weightLoad,
          horse.jockey, 
          horse.trainer,  // trainerはstableカラムに対応
          horse.horse_weight || ''
        ]
      );
    }
    
    res.send(`成功: ${raceName} (${horses.length}頭) を登録しました`);
    
  } catch (error) {
    console.error('Error fetching race data:', error.message);
    res.status(500).send('エラーが発生しました: ' + error.message);
  }
});

module.exports = router;
