const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

// ボックス・フォーメーション買いの組み合わせ生成
function generateCombinationsForPayout(horses, betType, betFormat) {
  const combinations = [];
  
  if (betFormat === 'box') {
    // ボックス買い: すべての組み合わせを生成
    const horseArray = horses.split(',').map(h => h.trim());
    
    if (betType === 'umaren' || betType === 'wide') {
      // 2頭の組み合わせ（順不同、ソート済み）
      for (let i = 0; i < horseArray.length; i++) {
        for (let j = i + 1; j < horseArray.length; j++) {
          combinations.push([horseArray[i], horseArray[j]].sort((a, b) => parseInt(a) - parseInt(b)).join(','));
        }
      }
    } else if (betType === 'umatan') {
      // 馬単: 順序あり2頭
      for (let i = 0; i < horseArray.length; i++) {
        for (let j = 0; j < horseArray.length; j++) {
          if (i !== j) {
            combinations.push(`${horseArray[i]},${horseArray[j]}`);
          }
        }
      }
    } else if (betType === 'sanrenpuku') {
      // 3連複: 3頭の組み合わせ（順不同、ソート済み）
      for (let i = 0; i < horseArray.length; i++) {
        for (let j = i + 1; j < horseArray.length; j++) {
          for (let k = j + 1; k < horseArray.length; k++) {
            combinations.push([horseArray[i], horseArray[j], horseArray[k]].sort((a, b) => parseInt(a) - parseInt(b)).join(','));
          }
        }
      }
    } else if (betType === 'sanrentan') {
      // 3連単: 順序あり3頭
      for (let i = 0; i < horseArray.length; i++) {
        for (let j = 0; j < horseArray.length; j++) {
          if (i !== j) {
            for (let k = 0; k < horseArray.length; k++) {
              if (k !== i && k !== j) {
                combinations.push(`${horseArray[i]},${horseArray[j]},${horseArray[k]}`);
              }
            }
          }
        }
      }
    }
  } else if (betFormat === 'formation') {
    // フォーメーション買い: '>'で区切られた形式
    const groups = horses.split('>').map(g => g.split(',').map(h => h.trim()));
    
    if (betType === 'sanrentan' && groups.length === 3) {
      // 3連単フォーメーション
      for (const first of groups[0]) {
        for (const second of groups[1]) {
          if (second !== first) {
            for (const third of groups[2]) {
              if (third !== first && third !== second) {
                combinations.push(`${first},${second},${third}`);
              }
            }
          }
        }
      }
    } else if (betType === 'sanrenpuku' && groups.length === 3) {
      // 3連複フォーメーション
      for (const first of groups[0]) {
        for (const second of groups[1]) {
          for (const third of groups[2]) {
            const combo = [first, second, third].sort((a, b) => parseInt(a) - parseInt(b));
            // 重複チェック
            if (combo[0] !== combo[1] && combo[1] !== combo[2] && combo[0] !== combo[2]) {
              const comboStr = combo.join(',');
              if (!combinations.includes(comboStr)) {
                combinations.push(comboStr);
              }
            }
          }
        }
      }
    }
  }
  
  return combinations;
}

// レース一覧（直近2週間のみ）
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, COUNT(h.id) as horse_count 
      FROM races r 
      LEFT JOIN horses h ON r.race_id = h.race_id 
      WHERE r.race_date >= CURRENT_DATE - INTERVAL '14 days'
      GROUP BY r.id 
      ORDER BY r.race_date DESC, r.race_time DESC
    `);
    
    // 各レースの状態を判定
    const now = new Date();
    const racesWithStatus = result.rows.map(race => {
      const raceDateTime = new Date(race.race_date);
      const [hours, minutes] = race.race_time.split(':');
      raceDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const diffMinutes = (raceDateTime - now) / (1000 * 60);
      
      let status, statusClass, statusIcon;
      if (diffMinutes > 30) {
        status = '予想可能';
        statusClass = 'status-available';
        statusIcon = '🟢';
      } else if (diffMinutes > 0) {
        status = 'まもなく発走';
        statusClass = 'status-soon';
        statusIcon = '⏰';
      } else {
        status = '終了';
        statusClass = 'status-finished';
        statusIcon = '⏹️';
      }
      
      return { ...race, status, statusClass, statusIcon };
    });
    
    res.render('races/index', { 
      races: racesWithStatus,
      user: req.session.user || null
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('エラーが発生しました');
  }
});

// 過去レース一覧（全期間）
router.get('/archive', async (req, res) => {
  try {
    // シーズン一覧を取得
    const seasonsResult = await pool.query('SELECT * FROM seasons ORDER BY start_date DESC');
    
    // 選択されたシーズンまたは期間
    const seasonId = req.query.season_id;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    
    let whereClause = '';
    let params = [];
    let selectedSeason = null;
    let customPeriod = null;
    
    if (seasonId) {
      // シーズン選択の場合
      const seasonResult = await pool.query('SELECT * FROM seasons WHERE id = $1', [seasonId]);
      selectedSeason = seasonResult.rows[0];
      whereClause = 'WHERE r.race_date BETWEEN $1 AND $2';
      params = [selectedSeason.start_date, selectedSeason.end_date];
    } else if (startDate && endDate) {
      // カスタム期間の場合
      customPeriod = { start_date: startDate, end_date: endDate };
      whereClause = 'WHERE r.race_date BETWEEN $1 AND $2';
      params = [startDate, endDate];
    }
    // 何も選択されていない場合は全期間
    
    const query = `
      SELECT r.*, COUNT(h.id) as horse_count 
      FROM races r 
      LEFT JOIN horses h ON r.race_id = h.race_id 
      ${whereClause}
      GROUP BY r.id 
      ORDER BY r.race_date DESC, r.race_time DESC
    `;
    
    const result = await pool.query(query, params);
    
    // 各レースの状態を判定
    const now = new Date();
    const racesWithStatus = result.rows.map(race => {
      const raceDateTime = new Date(race.race_date);
      const [hours, minutes] = race.race_time.split(':');
      raceDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const diffMinutes = (raceDateTime - now) / (1000 * 60);
      
      let status, statusClass, statusIcon;
      if (diffMinutes > 30) {
        status = '予想可能';
        statusClass = 'status-available';
        statusIcon = '🟢';
      } else if (diffMinutes > 0) {
        status = 'まもなく発走';
        statusClass = 'status-soon';
        statusIcon = '⏰';
      } else {
        status = '終了';
        statusClass = 'status-finished';
        statusIcon = '⏹️';
      }
      
      return { ...race, status, statusClass, statusIcon };
    });
    
    res.render('races/archive', {
      races: racesWithStatus,
      seasons: seasonsResult.rows,
      selectedSeason: selectedSeason,
      customPeriod: customPeriod,
      user: req.session.user
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('エラーが発生しました');
  }
});

// レース詳細
router.get('/:race_id', async (req, res) => {
  try {
    const raceResult = await pool.query(
      'SELECT * FROM races WHERE race_id = $1',
      [req.params.race_id]
    );
    
    const horsesResult = await pool.query(
      'SELECT * FROM horses WHERE race_id = $1 ORDER BY umaban',
      [req.params.race_id]
    );
    
    // 全ユーザーの馬券購入状況を取得
    const betsResult = await pool.query(
      `SELECT b.*, u.display_name 
       FROM bets b 
       JOIN users u ON b.user_id = u.id 
       WHERE b.race_id = $1 
       ORDER BY u.display_name, b.bet_type`,
      [req.params.race_id]
    );
    
    // 全ユーザーの予想（印）を取得
    const predictionsResult = await pool.query(
      `SELECT p.*, u.display_name, u.username
       FROM predictions p
       JOIN users u ON p.user_id = u.id
       WHERE p.race_id = $1
       ORDER BY u.display_name, p.umaban`,
      [req.params.race_id]
    );
    
    if (raceResult.rows.length === 0) {
      return res.status(404).send('レースが見つかりません');
    }
    
    res.render('races/detail', {
      race: raceResult.rows[0],
      horses: horsesResult.rows,
      horses_data: horsesResult.rows,
      allBets: betsResult.rows,
      predictions: predictionsResult.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('エラーが発生しました');
  }
});

// レース結果表示
router.get('/:race_id/result', async (req, res) => {
  try {
    const raceResult = await pool.query('SELECT * FROM races WHERE race_id = $1', [req.params.race_id]);
    
    // 全頭を表示するため、horsesテーブルをベースにLEFT JOIN resultsテーブル
    const resultsResult = await pool.query(
      `SELECT h.umaban, h.horse_name, h.jockey, h.waku, r.rank, r.result_time
       FROM horses h
       LEFT JOIN results r ON h.race_id = r.race_id AND h.umaban = r.umaban
       WHERE h.race_id = $1
       ORDER BY 
         CASE WHEN r.rank IS NULL THEN 1 ELSE 0 END,
         r.rank NULLS LAST,
         h.umaban`,
      [req.params.race_id]
    );
    
    const payoutsResult = await pool.query('SELECT * FROM race_payouts WHERE race_id = $1 ORDER BY bet_type', [req.params.race_id]);
    
    // 全ユーザーの馬券購入状況を取得
    const betsResult = await pool.query(
      `SELECT b.*, u.display_name, p.payout_amount 
       FROM bets b 
       JOIN users u ON b.user_id = u.id 
       LEFT JOIN payouts p ON b.id = p.bet_id 
       WHERE b.race_id = $1 
       ORDER BY u.display_name, b.bet_type`,
      [req.params.race_id]
    );
    
    // 全ユーザーの予想（印）を取得
    const predictionsResult = await pool.query(
      `SELECT p.*, u.display_name, u.username
       FROM predictions p
       JOIN users u ON p.user_id = u.id
       WHERE p.race_id = $1
       ORDER BY u.display_name, p.umaban`,
      [req.params.race_id]
    );
    
    // 馬名データを取得（馬券表示用）
    const horsesDataResult = await pool.query(
      'SELECT umaban, horse_name FROM horses WHERE race_id = $1',
      [req.params.race_id]
    );
    
    if (raceResult.rows.length === 0) {
      return res.status(404).send('レースが見つかりません');
    }
    
    res.render('races/result', {
      race: raceResult.rows[0],
      results: resultsResult.rows,
      payouts: payoutsResult.rows,
      allBets: betsResult.rows,
      predictions: predictionsResult.rows,
      horses_data: horsesDataResult.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('エラーが発生しました');
  }
});

// 配当を計算
router.post('/:race_id/calculate-payouts', async (req, res) => {
  try {
    const raceId = req.params.race_id;
    
    console.log('=== 配当計算開始 ===');
    console.log('レースID:', raceId);
    
    const betsResult = await pool.query('SELECT * FROM bets WHERE race_id = $1', [raceId]);
    const payoutsResult = await pool.query('SELECT * FROM race_payouts WHERE race_id = $1', [raceId]);
    
    console.log('馬券数:', betsResult.rows.length);
    console.log('払戻金データ数:', payoutsResult.rows.length);
    
    // 払戻金をマップに変換（高速検索用）
    const payoutMap = {};
    payoutsResult.rows.forEach(p => {
      const key = `${p.bet_type}-${p.combination}`;
      payoutMap[key] = p.payout;
      console.log('払戻マップ:', key, '→', p.payout);
    });
    
    let calculatedCount = 0;
    
    for (const bet of betsResult.rows) {
      const betFormat = bet.bet_format || 'single';
      let isHit = false;
      let hitPayout = 0;
      
      if (betFormat === 'box' || betFormat === 'formation') {
        // ボックス・フォーメーション買い: 組み合わせを生成して的中判定
        const combinations = generateCombinationsForPayout(bet.horses, bet.bet_type, betFormat);
        console.log(`${betFormat}買い判定: ${bet.horses} → ${combinations.length}通り`);
        
        // いずれかの組み合わせが的中しているかチェック
        for (const combo of combinations) {
          const key = `${bet.bet_type}-${combo}`;
          const payout = payoutMap[key];
          
          if (payout) {
            isHit = true;
            hitPayout = payout;
            console.log(`  的中! ${combo} → ${payout}円/100円`);
            break; // 1つでも的中していればOK
          }
        }
        
        if (isHit) {
          // 的中した場合: 1点あたりの配当 × 購入単価
          // bet.amountは既に合計金額なので、点数で割って1点あたりの金額を出す
          const perBetAmount = bet.amount / combinations.length;
          const payoutAmount = hitPayout * (perBetAmount / 100);
          
          console.log(`  購入額: ${bet.amount}円 (${combinations.length}点 × ${perBetAmount}円), 払戻: ${hitPayout}円/100円, 配当: ${payoutAmount}円`);
          
          await pool.query(
            `INSERT INTO payouts (bet_id, payout_amount) VALUES ($1, $2)
             ON CONFLICT (bet_id) DO UPDATE SET payout_amount = EXCLUDED.payout_amount, calculated_at = CURRENT_TIMESTAMP`,
            [bet.id, payoutAmount]
          );
          
          calculatedCount++;
        } else {
          console.log('  不的中');
          await pool.query(
            `INSERT INTO payouts (bet_id, payout_amount) VALUES ($1, 0)
             ON CONFLICT (bet_id) DO UPDATE SET payout_amount = 0, calculated_at = CURRENT_TIMESTAMP`,
            [bet.id]
          );
        }
      } else {
        // 単式: 従来通りの判定
        const key = `${bet.bet_type}-${bet.horses}`;
        const payout = payoutMap[key];
        
        console.log('単式馬券チェック:', key, '→', payout ? '的中' : '不的中');
        
        if (payout) {
          const payoutAmount = payout * (bet.amount / 100);
          
          console.log(`  購入額: ${bet.amount}円, 払戻: ${payout}円/100円, 配当: ${payoutAmount}円`);
          
          await pool.query(
            `INSERT INTO payouts (bet_id, payout_amount) VALUES ($1, $2)
             ON CONFLICT (bet_id) DO UPDATE SET payout_amount = EXCLUDED.payout_amount, calculated_at = CURRENT_TIMESTAMP`,
            [bet.id, payoutAmount]
          );
          
          calculatedCount++;
        } else {
          await pool.query(
            `INSERT INTO payouts (bet_id, payout_amount) VALUES ($1, 0)
             ON CONFLICT (bet_id) DO UPDATE SET payout_amount = 0, calculated_at = CURRENT_TIMESTAMP`,
            [bet.id]
          );
        }
      }
    }
    
    console.log('=== 配当計算完了 ===');
    console.log('的中件数:', calculatedCount, '/ 総件数:', betsResult.rows.length);
    
    res.json({ success: true, calculated: calculatedCount, total: betsResult.rows.length });
  } catch (error) {
    console.error('配当計算エラー:', error);
    res.status(500).json({ error: 'エラーが発生しました: ' + error.message });
  }
});

// 自分の購入馬券を一括削除
router.post('/:race_id/delete-my-bets', async (req, res) => {
  const { race_id } = req.params;
  const userId = req.session.user?.id;
  
  // ログインチェック
  if (!userId) {
    return res.status(401).send('ログインが必要です');
  }
  
  try {
    console.log(`馬券削除開始: race_id=${race_id}, user_id=${userId}`);
    
    // レース情報を取得して時刻チェック
    const raceInfo = await pool.query('SELECT race_date, race_time FROM races WHERE race_id = $1', [race_id]);
    
    if (raceInfo.rows.length === 0) {
      return res.status(404).send('レースが見つかりません');
    }
    
    const race = raceInfo.rows[0];
    const now = new Date();
    const raceDateTime = new Date(race.race_date);
    const [hours, minutes] = race.race_time.split(':');
    raceDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    console.log('=== 馬券削除の時刻チェック ===');
    console.log('現在時刻:', now);
    console.log('発走時刻:', raceDateTime);
    console.log('テストモード:', process.env.TEST_MODE === 'true' ? 'ON（時刻制限なし）' : 'OFF');
    console.log('========================');
    
    // テストモードでない場合のみ時刻チェック
    const isTestMode = process.env.TEST_MODE === 'true';
    if (!isTestMode && now >= raceDateTime) {
      return res.status(400).send('レース開始時刻を過ぎているため、馬券を削除できません');
    }
    
    // このユーザーの馬券数を確認
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM bets WHERE race_id = $1 AND user_id = $2',
      [race_id, userId]
    );
    
    const betCount = parseInt(countResult.rows[0].count);
    
    if (betCount === 0) {
      return res.status(404).send('削除する馬券がありません');
    }
    
    // 1. 払い戻し情報を削除
    await pool.query(
      'DELETE FROM payouts WHERE bet_id IN (SELECT id FROM bets WHERE race_id = $1 AND user_id = $2)',
      [race_id, userId]
    );
    console.log('✓ 払い戻し情報を削除');
    
    // 2. 馬券を削除
    await pool.query(
      'DELETE FROM bets WHERE race_id = $1 AND user_id = $2',
      [race_id, userId]
    );
    console.log('✓ 馬券を削除');
    
    res.send(`成功: ${betCount}件の馬券を削除しました`);
    
  } catch (error) {
    console.error('=== Error deleting bets ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('===========================');
    res.status(500).send('エラーが発生しました: ' + error.message);
  }
});

// 個別の馬券を削除
router.delete('/bets/:bet_id', async (req, res) => {
  // ログインチェック
  if (!req.session.user) {
    return res.status(401).send('ログインが必要です');
  }

  const { bet_id } = req.params;
  const userId = req.session.user.id;

  try {
    // 馬券の所有者を確認
    const betResult = await pool.query(
      'SELECT * FROM bets WHERE id = $1',
      [bet_id]
    );

    if (betResult.rows.length === 0) {
      return res.status(404).send('馬券が見つかりません');
    }

    const bet = betResult.rows[0];

    // 自分の馬券かチェック
    if (bet.user_id !== userId) {
      return res.status(403).send('他のユーザーの馬券は削除できません');
    }

    // レースの発走時刻を確認
    const raceResult = await pool.query(
      'SELECT * FROM races WHERE race_id = $1',
      [bet.race_id]
    );

    if (raceResult.rows.length === 0) {
      return res.status(404).send('レースが見つかりません');
    }

    const race = raceResult.rows[0];
    const now = new Date();
    const raceDateTime = new Date(race.race_date);
    const [hours, minutes] = race.race_time.split(':');
    raceDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // テストモードでない限り、発走後は削除不可
    const isTestMode = process.env.TEST_MODE === 'true';
    if (!isTestMode && now >= raceDateTime) {
      return res.status(403).send('レース発走後は馬券を削除できません');
    }

    // 払い戻し情報を削除
    await pool.query(
      'DELETE FROM payouts WHERE bet_id = $1',
      [bet_id]
    );

    // 馬券を削除
    await pool.query(
      'DELETE FROM bets WHERE id = $1',
      [bet_id]
    );

    res.send('馬券を削除しました');

  } catch (error) {
    console.error('Error deleting single bet:', error);
    res.status(500).send('エラーが発生しました: ' + error.message);
  }
});

module.exports = router;
