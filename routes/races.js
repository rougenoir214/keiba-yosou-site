const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

// レース一覧
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, COUNT(h.id) as horse_count 
      FROM races r 
      LEFT JOIN horses h ON r.race_id = h.race_id 
      GROUP BY r.id 
      ORDER BY r.race_date DESC, r.race_time DESC
    `);
    
    res.render('races/index', { races: result.rows });
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
    
    if (raceResult.rows.length === 0) {
      return res.status(404).send('レースが見つかりません');
    }
    
    res.render('races/detail', {
      race: raceResult.rows[0],
      horses: horsesResult.rows,
      allBets: betsResult.rows,
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
    const resultsResult = await pool.query(
      'SELECT r.*, h.horse_name, h.jockey FROM results r JOIN horses h ON r.race_id = h.race_id AND r.umaban = h.umaban WHERE r.race_id = $1 ORDER BY r.rank',
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
    
    if (raceResult.rows.length === 0) {
      return res.status(404).send('レースが見つかりません');
    }
    
    res.render('races/result', {
      race: raceResult.rows[0],
      results: resultsResult.rows,
      payouts: payoutsResult.rows,
      allBets: betsResult.rows,
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
      const key = `${bet.bet_type}-${bet.horses}`;
      const payout = payoutMap[key];
      
      console.log('馬券チェック:', key, '→', payout ? '的中' : '不的中');
      
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
    
    console.log('=== 配当計算完了 ===');
    console.log('的中件数:', calculatedCount, '/ 総件数:', betsResult.rows.length);
    
    res.json({ success: true, calculated: calculatedCount, total: betsResult.rows.length });
  } catch (error) {
    console.error('配当計算エラー:', error);
    res.status(500).json({ error: 'エラーが発生しました: ' + error.message });
  }
});

module.exports = router;
