const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

// ランキングページ
router.get('/', async (req, res) => {
  try {
    // 表示モード（monthly or season）
    const mode = req.query.mode || 'season';
    
    // ランキングタイプ（profit, hit_rate, recovery_rate）
    const rankingType = req.query.type || 'profit';
    
    // シーズン一覧を取得
    const seasonsResult = await pool.query('SELECT * FROM seasons ORDER BY start_date DESC');
    
    let dateFilter = '';
    let params = [];
    let selectedSeason = null;
    let currentMonth = null;
    
    if (mode === 'monthly') {
      // 月間ランキング：当月のデータ
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0);
      const endDateStr = `${year}-${String(month).padStart(2, '0')}-${endDate.getDate()}`;
      
      dateFilter = 'AND r.race_date BETWEEN $1 AND $2';
      params = [startDate, endDateStr];
      currentMonth = { year, month, startDate, endDateStr };
    } else {
      // シーズンランキング
      const selectedSeasonId = req.query.season_id || null;
      
      if (selectedSeasonId) {
        const seasonResult = await pool.query('SELECT * FROM seasons WHERE id = $1', [selectedSeasonId]);
        selectedSeason = seasonResult.rows[0];
      } else {
        const activeSeasonResult = await pool.query('SELECT * FROM seasons WHERE is_active = true LIMIT 1');
        selectedSeason = activeSeasonResult.rows[0];
      }
      
      if (selectedSeason) {
        dateFilter = 'AND r.race_date BETWEEN $1 AND $2';
        params = [selectedSeason.start_date, selectedSeason.end_date];
      }
    }
    
    // ランキングタイプに応じてソート順を変更
    let orderBy = 'profit DESC'; // デフォルトは収支降順
    if (rankingType === 'hit_rate') {
      orderBy = 'hit_rate DESC, profit DESC';
    } else if (rankingType === 'recovery_rate') {
      orderBy = 'recovery_rate DESC, profit DESC';
    }
    
    // ユーザー別の統計を計算
    const rankingQuery = `
      SELECT 
        u.id,
        u.display_name,
        COUNT(DISTINCT b.race_id) as race_count,
        SUM(b.amount) as total_bet,
        COALESCE(SUM(p.payout_amount), 0) as total_payout,
        COALESCE(SUM(p.payout_amount), 0) - SUM(b.amount) as profit,
        COUNT(DISTINCT CASE WHEN p.payout_amount > 0 THEN b.race_id END) as hit_race_count,
        COUNT(b.id) as bet_count,
        CASE 
          WHEN COUNT(DISTINCT b.race_id) > 0 
          THEN CAST(COUNT(DISTINCT CASE WHEN p.payout_amount > 0 THEN b.race_id END) * 100.0 / COUNT(DISTINCT b.race_id) AS NUMERIC(10,1))
          ELSE 0 
        END as hit_rate,
        CASE 
          WHEN SUM(b.amount) > 0 
          THEN CAST(COALESCE(SUM(p.payout_amount), 0) * 100.0 / SUM(b.amount) AS NUMERIC(10,1))
          ELSE 0 
        END as recovery_rate
      FROM users u
      LEFT JOIN bets b ON u.id = b.user_id
      LEFT JOIN payouts p ON b.id = p.bet_id
      LEFT JOIN races r ON b.race_id = r.race_id
      WHERE b.id IS NOT NULL
      ${dateFilter}
      GROUP BY u.id, u.display_name
      ORDER BY ${orderBy}
    `;
    
    const rankingResult = await pool.query(rankingQuery, params);
    
    res.render('ranking/index', {
      mode: mode,
      rankingType: rankingType,
      seasons: seasonsResult.rows,
      selectedSeason: selectedSeason,
      currentMonth: currentMonth,
      rankings: rankingResult.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('エラーが発生しました');
  }
});

module.exports = router;
