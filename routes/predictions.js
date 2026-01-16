const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
}

function generateCombinations(horses, betType, buyMethod, axisHorses, partnerHorses, first, second, third) {
  const combinations = [];
  
  if (buyMethod === 'normal') {
    combinations.push(horses);
  } else if (buyMethod === 'box') {
    const horseArray = horses.split(',').map(h => h.trim());
    if (betType === 'umaren' || betType === 'wide') {
      for (let i = 0; i < horseArray.length; i++) {
        for (let j = i + 1; j < horseArray.length; j++) {
          combinations.push(`${horseArray[i]},${horseArray[j]}`);
        }
      }
    } else if (betType === 'umatan') {
      for (let i = 0; i < horseArray.length; i++) {
        for (let j = 0; j < horseArray.length; j++) {
          if (i !== j) {
            combinations.push(`${horseArray[i]},${horseArray[j]}`);
          }
        }
      }
    } else if (betType === 'sanrenpuku') {
      for (let i = 0; i < horseArray.length; i++) {
        for (let j = i + 1; j < horseArray.length; j++) {
          for (let k = j + 1; k < horseArray.length; k++) {
            combinations.push(`${horseArray[i]},${horseArray[j]},${horseArray[k]}`);
          }
        }
      }
    } else if (betType === 'sanrentan') {
      for (let i = 0; i < horseArray.length; i++) {
        for (let j = 0; j < horseArray.length; j++) {
          for (let k = 0; k < horseArray.length; k++) {
            if (i !== j && i !== k && j !== k) {
              combinations.push(`${horseArray[i]},${horseArray[j]},${horseArray[k]}`);
            }
          }
        }
      }
    }
  } else if (buyMethod === 'formation') {
    if (betType === 'umatan') {
      // 馬単フォーメーション：1着→2着
      const firstArray = first.split(',').map(h => h.trim());
      const secondArray = second.split(',').map(h => h.trim());
      
      firstArray.forEach(f => {
        secondArray.forEach(s => {
          if (f !== s) {
            combinations.push(`${f},${s}`);
          }
        });
      });
    } else if (betType === 'sanrenpuku' || betType === 'sanrentan') {
      const firstArray = first.split(',').map(h => h.trim());
      const secondArray = second.split(',').map(h => h.trim());
      const thirdArray = third.split(',').map(h => h.trim());
      
      if (betType === 'sanrenpuku') {
        firstArray.forEach(f => {
          secondArray.forEach(s => {
            thirdArray.forEach(t => {
              if (f !== s && f !== t && s !== t) {
                const sorted = [f, s, t].sort((a, b) => parseInt(a) - parseInt(b));
                const combo = sorted.join(',');
                if (!combinations.includes(combo)) {
                  combinations.push(combo);
                }
              }
            });
          });
        });
      } else {
        firstArray.forEach(f => {
          secondArray.forEach(s => {
            thirdArray.forEach(t => {
              if (f !== s && f !== t && s !== t) {
                combinations.push(`${f},${s},${t}`);
              }
            });
          });
        });
      }
    } else {
      const axis = axisHorses.split(',').map(h => h.trim());
      const partners = partnerHorses.split(',').map(h => h.trim());
      
      if (betType === 'umaren' || betType === 'wide') {
        for (let i = 0; i < axis.length; i++) {
          for (let j = i + 1; j < axis.length; j++) {
            combinations.push(`${axis[i]},${axis[j]}`);
          }
        }
        axis.forEach(a => {
          partners.forEach(p => {
            if (a !== p) {
              combinations.push(`${a},${p}`);
            }
          });
        });
      } else if (betType === 'umatan') {
        for (let i = 0; i < axis.length; i++) {
          for (let j = 0; j < axis.length; j++) {
            if (i !== j) {
              combinations.push(`${axis[i]},${axis[j]}`);
            }
          }
        }
        axis.forEach(a => {
          partners.forEach(p => {
            if (a !== p) {
              combinations.push(`${a},${p}`);
            }
          });
        });
      }
    }
  }
  
  return combinations;
}

router.get('/:race_id', requireAuth, async (req, res) => {
  try {
    const raceResult = await pool.query('SELECT * FROM races WHERE race_id = $1', [req.params.race_id]);
    const horsesResult = await pool.query('SELECT * FROM horses WHERE race_id = $1 ORDER BY umaban', [req.params.race_id]);
    
    if (raceResult.rows.length === 0) {
      return res.status(404).send('レースが見つかりません');
    }
    
    const predictionsResult = await pool.query('SELECT * FROM predictions WHERE user_id = $1 AND race_id = $2', [req.session.user.id, req.params.race_id]);
    const betsResult = await pool.query('SELECT * FROM bets WHERE user_id = $1 AND race_id = $2 ORDER BY id DESC', [req.session.user.id, req.params.race_id]);
    
    res.render('predictions/input', {
      race: raceResult.rows[0],
      horses: horsesResult.rows,
      predictions: predictionsResult.rows,
      bets: betsResult.rows,
      user: req.session.user
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('エラーが発生しました');
  }
});

router.post('/:race_id/marks', requireAuth, async (req, res) => {
  const { marks } = req.body;
  try {
    await pool.query('DELETE FROM predictions WHERE user_id = $1 AND race_id = $2', [req.session.user.id, req.params.race_id]);
    for (const [umaban, mark] of Object.entries(marks)) {
      if (mark) {
        await pool.query('INSERT INTO predictions (user_id, race_id, umaban, mark) VALUES ($1, $2, $3, $4)', [req.session.user.id, req.params.race_id, parseInt(umaban), mark]);
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'エラーが発生しました' });
  }
});

router.post('/:race_id/bets', requireAuth, async (req, res) => {
  const { bet_type, horses, amount, buy_method, axis_horses, partner_horses, first, second, third } = req.body;
  
  try {
    const existingBets = await pool.query('SELECT SUM(amount) as total FROM bets WHERE user_id = $1 AND race_id = $2', [req.session.user.id, req.params.race_id]);
    const currentTotal = parseInt(existingBets.rows[0].total) || 0;
    const combinations = generateCombinations(horses, bet_type, buy_method, axis_horses, partner_horses, first, second, third);
    const totalCost = combinations.length * parseInt(amount);
    const newTotal = currentTotal + totalCost;
    
    if (newTotal > 10000) {
      return res.status(400).json({ error: `購入金額の上限（10,000円）を超えています。残り: ${10000 - currentTotal}円。${combinations.length}点 × ${amount}円 = ${totalCost}円` });
    }
    
    for (const combo of combinations) {
      await pool.query('INSERT INTO bets (user_id, race_id, bet_type, horses, amount) VALUES ($1, $2, $3, $4, $5)', [req.session.user.id, req.params.race_id, bet_type, combo, parseInt(amount)]);
    }
    
    res.json({ success: true, remaining: 10000 - newTotal, count: combinations.length, total: totalCost });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'エラーが発生しました' });
  }
});

router.delete('/:race_id/bets/:bet_id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM bets WHERE id = $1 AND user_id = $2', [req.params.bet_id, req.session.user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'エラーが発生しました' });
  }
});

module.exports = router;
