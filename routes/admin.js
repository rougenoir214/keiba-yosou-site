const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const pool = require('../db/connection');

// アップロード設定
const upload = multer({ dest: 'uploads/' });

// 管理者権限チェックミドルウェア
const requireAdmin = (req, res, next) => {
  if (!req.session.user || !req.session.user.is_admin) {
    return res.status(403).send('管理者権限が必要です');
  }
  next();
};

// CSVインポートページ
router.get('/import', requireAdmin, (req, res) => {
  res.render('import', { user: req.session.user });
});

// CSVアップロード処理
router.post('/import', requireAdmin, upload.single('csvfile'), async (req, res) => {
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
router.post('/fetch-result/:race_id', requireAdmin, async (req, res) => {
  const axios = require('axios');
  const cheerio = require('cheerio');
  const iconv = require('iconv-lite');
  const { race_id } = req.params;
  
  try {
    // netkeibaのURLを構築
    const url = `https://race.netkeiba.com/race/result.html?race_id=${race_id}`;
    console.log('Fetching from:', url);
    
    // HTMLを取得（EUC-JPでエンコードされているのでバイナリで取得）
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      responseType: 'arraybuffer',
      timeout: 15000 // 15秒でタイムアウト
    });
    
    // EUC-JPからUTF-8に変換
    const html = iconv.decode(Buffer.from(response.data), 'EUC-JP');
    
    // HTMLをパース
    const $ = cheerio.load(html);
    
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
    
    // 払い戻し情報を取得（Pythonコードと同じロジック）
    const payouts = [];
    
    // Payout_Detail_Tableクラスのテーブルを探す
    const payoutTables = $('table.Payout_Detail_Table');
    
    console.log(`払戻テーブル発見: ${payoutTables.length}個`);
    
    payoutTables.each((tableIdx, table) => {
      const $table = $(table);
      const rows = $table.find('tr');
      
      rows.each((idx, row) => {
        const $row = $(row);
        const cols = $row.find('th, td');
        
        if (cols.length < 3) return;
        
        // 1列目: 馬券種別
        const betTypeText = $(cols[0]).text().trim();
        
        // 馬券種別マッピング
        const betTypeMap = {
          '単勝': 'tansho',
          '複勝': 'fukusho',
          '馬連': 'umaren',
          '馬単': 'umatan',
          'ワイド': 'wide',
          '3連複': 'sanrenpuku',
          '3連単': 'sanrentan'
        };
        
        let betType = null;
        for (const [key, value] of Object.entries(betTypeMap)) {
          if (betTypeText.includes(key)) {
            betType = value;
            break;
          }
        }
        
        if (!betType) return;
        
        // 2列目: 馬番（改行区切りで複数ある場合も）
        const combinationsText = $(cols[1]).text().trim();
        // 3列目: 払戻金（改行区切りで複数ある場合も）
        const payoutsText = $(cols[2]).text().trim();
        
        // 払戻金を「円」で分割して数値部分を抽出
        const payoutParts = [];
        payoutsText.split('円').forEach(part => {
          const cleaned = part.trim().replace(/,/g, '');
          if (cleaned && /^\d+$/.test(cleaned)) {
            payoutParts.push(cleaned);
          }
        });
        
        // 改行で分割（馬番用）
        const combinationParts = combinationsText.split(/[\n\r]+/).filter(c => c.trim());
        
        console.log(`  ${betType}: 組み合わせ=${combinationParts.slice(0, 5)}, 払戻=${payoutParts.slice(0, 5)}`);
        
        // 複勝の処理
        if (betType === 'fukusho') {
          combinationParts.forEach((comb, i) => {
            if (i < payoutParts.length) {
              try {
                const payout = parseInt(payoutParts[i]);
                payouts.push({
                  bet_type: betType,
                  combination: comb,
                  payout: payout
                });
              } catch (e) {
                console.error(`複勝解析エラー: ${comb} ${payoutParts[i]} - ${e}`);
              }
            }
          });
        }
        // ワイドの処理（2つずつペアにする）
        else if (betType === 'wide') {
          const pairs = [];
          let temp = [];
          combinationParts.forEach(part => {
            if (part) {
              temp.push(part);
              if (temp.length === 2) {
                pairs.push(`${temp[0]},${temp[1]}`);
                temp = [];
              }
            }
          });
          
          pairs.forEach((pair, i) => {
            if (i < payoutParts.length) {
              try {
                const payout = parseInt(payoutParts[i]);
                payouts.push({
                  bet_type: betType,
                  combination: pair,
                  payout: payout
                });
              } catch (e) {
                console.error(`ワイド解析エラー: ${pair} ${payoutParts[i]} - ${e}`);
              }
            }
          });
        }
        // その他（単勝、馬連、馬単、3連複、3連単）
        else {
          // 改行で分かれている場合はカンマで連結
          const combination = combinationParts.join(',').replace(/-/g, ',').replace(/→/g, ',');
          
          if (payoutParts.length > 0) {
            try {
              const payout = parseInt(payoutParts[0]);
              payouts.push({
                bet_type: betType,
                combination: combination,
                payout: payout
              });
            } catch (e) {
              console.error(`${betType}解析エラー: ${combination} ${payoutParts[0]} - ${e}`);
            }
          }
        }
      });
    });
    
    console.log('取得した払い戻し:', payouts.length, '件');
    
    // データベースに保存（既存データは削除）
    await pool.query('DELETE FROM results WHERE race_id = $1', [race_id]);
    
    for (const result of uniqueResults) {
      await pool.query(
        'INSERT INTO results (race_id, umaban, rank, result_time) VALUES ($1, $2, $3, $4) ON CONFLICT (race_id, umaban) DO UPDATE SET rank = EXCLUDED.rank, result_time = EXCLUDED.result_time',
        [race_id, result.umaban, result.rank, result.result_time]
      );
    }
    
    // 払い戻し情報を保存（既存データは削除）
    if (payouts.length > 0) {
      await pool.query('DELETE FROM race_payouts WHERE race_id = $1', [race_id]);
      
      for (const payout of payouts) {
        await pool.query(
          'INSERT INTO race_payouts (race_id, bet_type, combination, payout) VALUES ($1, $2, $3, $4) ON CONFLICT (race_id, bet_type, combination) DO UPDATE SET payout = EXCLUDED.payout',
          [race_id, payout.bet_type, payout.combination, payout.payout]
        );
      }
    }
    
    res.send(`成功: ${uniqueResults.length}頭の結果と${payouts.length}件の払い戻し情報を取得しました`);
    
  } catch (error) {
    console.error('=== Error fetching results ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    console.error('==============================');
    res.status(500).send('エラーが発生しました: ' + error.message);
  }
});

// netkeibaからレース情報と出走馬を自動取得・登録
router.post('/fetch-race/:race_id', requireAdmin, async (req, res) => {
  const axios = require('axios');
  const cheerio = require('cheerio');
  const iconv = require('iconv-lite');
  const { race_id } = req.params;
  
  try {
    // netkeibaのURLを構築（出馬表ページ）
    const url = `https://race.netkeiba.com/race/shutuba.html?race_id=${race_id}`;
    console.log('Fetching race data from:', url);
    
    // HTMLを取得（EUC-JPでエンコードされているのでバイナリで取得）
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      responseType: 'arraybuffer',
      timeout: 15000 // 15秒でタイムアウト
    });
    
    // EUC-JPからUTF-8に変換
    const html = iconv.decode(Buffer.from(response.data), 'EUC-JP');
    
    // HTMLをパース
    const $ = cheerio.load(html);
    
    // レース名を取得（h1タグから）
    let raceName = `レース${race_id}`;  // デフォルト値
    
    $('h1').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text && text.length > 2 && !text.includes('発走')) {
        raceName = text;
        console.log('[レース名取得]', raceName);
        return false;  // break
      }
    });
    
    // 開催日を取得（HTMLから）
    let raceDate = '';
    
    // 方法1: dd要素から日付を探す
    $('dd').each((i, elem) => {
      if (raceDate) return;
      const text = $(elem).text().trim();
      const match = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (match) {
        const year = match[1];
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        raceDate = `${year}-${month}-${day}`;
        console.log('[レース日付取得(dd)]', raceDate);
      }
    });
    
    // 方法2: p要素から探す
    if (!raceDate) {
      $('p').each((i, elem) => {
        if (raceDate) return;
        const text = $(elem).text().trim();
        const match = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (match) {
          const year = match[1];
          const month = match[2].padStart(2, '0');
          const day = match[3].padStart(2, '0');
          raceDate = `${year}-${month}-${day}`;
          console.log('[レース日付取得(p)]', raceDate);
        }
      });
    }
    
    // 方法3: div要素から探す
    if (!raceDate) {
      $('div').each((i, elem) => {
        if (raceDate) return;
        const text = $(elem).text().trim();
        if (text.length < 100) {
          const match = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
          if (match) {
            const year = match[1];
            const month = match[2].padStart(2, '0');
            const day = match[3].padStart(2, '0');
            raceDate = `${year}-${month}-${day}`;
            console.log('[レース日付取得(div)]', raceDate);
          }
        }
      });
    }
    
    // 方法4: 全テキストから探す（最終手段・Pythonと同じ）
    if (!raceDate) {
      const fullText = $.text();
      const match = fullText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (match) {
        const year = match[1];
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        raceDate = `${year}-${month}-${day}`;
        console.log('[レース日付取得(全文検索)]', raceDate);
      }
    }
    
    // 日付が取得できなかった場合の処理
    if (!raceDate) {
      console.log('[警告] HTMLから日付が取得できませんでした');
      const year = race_id.substring(0, 4);
      raceDate = `${year}-01-01`;  // フォールバック値
    }
    
    // 発走時刻を取得（HTMLから）
    let raceTime = '15:00';  // デフォルト値
    
    const fullText = $.text();
    
    // パターン1: "15:30発走" 形式（発走の直前の時刻）
    let timeMatch = fullText.match(/(\d{1,2}):(\d{2})\s*発走/);
    
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2];
      // 競馬の時間帯（10:00-18:00）内かチェック
      if (hour >= 10 && hour <= 18) {
        raceTime = `${hour.toString().padStart(2, '0')}:${minute}`;
        console.log('[発走時刻取得(コロン形式)]', raceTime);
      }
    } else {
      // パターン2: "15時30分発走" 形式
      timeMatch = fullText.match(/(\d{1,2})時(\d{2})分\s*発走/);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1]);
        const minute = timeMatch[2];
        // 競馬の時間帯（10:00-18:00）内かチェック
        if (hour >= 10 && hour <= 18) {
          raceTime = `${hour.toString().padStart(2, '0')}:${minute}`;
          console.log('[発走時刻取得(時分形式)]', raceTime);
        }
      }
    }
    
    if (raceTime === '15:00') {
      console.log('[警告] HTMLから発走時刻が取得できませんでした。デフォルト値を使用:', raceTime);
    }
    
    // 競馬場を取得（race_idから判定）
    // race_id構造: YYYYKKDDRRNN
    // KK = 競馬場コード (4-5桁目)
    const venueCode = race_id.substring(4, 6);
    const venueMap = {
      '01': '札幌', '02': '函館', '03': '福島', '04': '新潟',
      '05': '東京', '06': '中山', '07': '中京', '08': '京都',
      '09': '阪神', '10': '小倉'
    };
    const venue = venueMap[venueCode] || '不明';
    
    console.log('レース情報:', { raceName, raceDate, raceTime, venue });
    
    // 出走馬テーブルを取得
    const horses = [];
    $('.Shutuba_Table tbody tr, .RaceTable01 tbody tr').each((index, element) => {
      const $row = $(element);
      const $cols = $row.find('td');
      
      // 列数チェック
      if ($cols.length < 8) return;
      
      // 枠番（1列目）
      const waku = parseInt($cols.eq(0).text().trim());
      
      // 馬番（2列目）
      const umaban = parseInt($cols.eq(1).text().trim());
      
      // 馬名（4列目）※3列目は印マークなのでスキップ
      const horseName = $cols.eq(3).text().trim();
      
      // 性齢（5列目）
      const sexAge = $cols.eq(4).text().trim();
      
      // 斤量（6列目）
      const weight = $cols.eq(5).text().trim();
      
      // 騎手（7列目）
      const jockey = $cols.eq(6).text().trim();
      
      // 厩舎（8列目）
      const trainer = $cols.eq(7).text().trim();
      
      // 馬体重（9列目）
      const horseWeight = $cols.eq(8).text().trim();
      
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
      [race_id, raceName, raceDate, raceTime, venue]
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
    console.error('=== Error fetching race data ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    console.error('================================');
    res.status(500).send('エラーが発生しました: ' + error.message);
  }
});

// レース削除
router.post('/delete-race/:race_id', requireAdmin, async (req, res) => {
  const { race_id } = req.params;
  
  try {
    console.log(`レース削除開始: ${race_id}`);
    
    // 関連データを順番に削除
    // 1. 払い戻し情報
    await pool.query('DELETE FROM payouts WHERE bet_id IN (SELECT id FROM bets WHERE race_id = $1)', [race_id]);
    console.log('✓ 払い戻し情報を削除');
    
    // 2. 馬券購入情報
    await pool.query('DELETE FROM bets WHERE race_id = $1', [race_id]);
    console.log('✓ 馬券購入情報を削除');
    
    // 3. 予想情報
    await pool.query('DELETE FROM predictions WHERE race_id = $1', [race_id]);
    console.log('✓ 予想情報を削除');
    
    // 4. レース結果
    await pool.query('DELETE FROM results WHERE race_id = $1', [race_id]);
    console.log('✓ レース結果を削除');
    
    // 5. レース払戻金
    await pool.query('DELETE FROM race_payouts WHERE race_id = $1', [race_id]);
    console.log('✓ レース払戻金を削除');
    
    // 6. 出走馬情報
    await pool.query('DELETE FROM horses WHERE race_id = $1', [race_id]);
    console.log('✓ 出走馬情報を削除');
    
    // 7. レース情報
    const result = await pool.query('DELETE FROM races WHERE race_id = $1 RETURNING race_name', [race_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).send('レースが見つかりませんでした');
    }
    
    const raceName = result.rows[0].race_name;
    console.log(`✓ レース情報を削除: ${raceName}`);
    
    res.send(`成功: ${raceName} (race_id: ${race_id}) を削除しました`);
    
  } catch (error) {
    console.error('=== Error deleting race ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('===========================');
    res.status(500).send('エラーが発生しました: ' + error.message);
  }
});

// ユーザー一覧ページ
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, display_name, created_at, is_admin FROM users ORDER BY created_at DESC'
    );
    
    res.render('admin/users', { 
      user: req.session.user,
      users: result.rows,
      message: null,
      error: null
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('エラーが発生しました: ' + error.message);
  }
});

// パスワード初期化
router.post('/users/:id/reset-password', requireAdmin, async (req, res) => {
  const userId = req.params.id;
  const DEFAULT_PASSWORD = 'password123'; // 固定の初期パスワード
  
  try {
    const bcrypt = require('bcrypt');
    
    // 対象ユーザーの情報を取得
    const userResult = await pool.query(
      'SELECT username, display_name FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).send('ユーザーが見つかりません');
    }
    
    const targetUser = userResult.rows[0];
    
    // 固定パスワードをハッシュ化
    const password_hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    
    // パスワードを更新
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [password_hash, userId]
    );
    
    console.log(`✓ パスワード初期化: ${targetUser.username} (${targetUser.display_name}) → ${DEFAULT_PASSWORD}`);
    res.send(`成功: ${targetUser.display_name} のパスワードを「${DEFAULT_PASSWORD}」に初期化しました。\n\nユーザーに初期パスワードでログイン後、パスワード変更するよう伝えてください。`);
    
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).send('エラーが発生しました: ' + error.message);
  }
});

module.exports = router;
