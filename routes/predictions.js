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
    // 新しいフォーマット: horses = "1,3-5,7" または "1,3-5,7-9,11"
    // "-"で分割して各部分を取得
    const parts = horses.split('-');
    
    if (betType === 'umaren' || betType === 'wide') {
      // 馬連・ワイドフォーメーション：軸馬-相手馬
      const axisArray = parts[0] ? parts[0].split(',').map(h => h.trim()) : [];
      const partnerArray = parts[1] ? parts[1].split(',').map(h => h.trim()) : [];
      
      const seen = new Set();
      
      // 軸馬×相手馬の組み合わせのみ（軸馬同士は除外）
      axisArray.forEach(a => {
        partnerArray.forEach(p => {
          if (a !== p) {
            const sorted = [a, p].sort((a, b) => parseInt(a) - parseInt(b));
            const combo = sorted.join(',');
            if (!seen.has(combo)) {
              seen.add(combo);
              combinations.push(combo);
            }
          }
        });
      });
    } else if (betType === 'umatan') {
      // 馬単フォーメーション：1着-2着
      const firstArray = parts[0] ? parts[0].split(',').map(h => h.trim()) : [];
      const secondArray = parts[1] ? parts[1].split(',').map(h => h.trim()) : [];
      
      firstArray.forEach(f => {
        secondArray.forEach(s => {
          if (f !== s) {
            combinations.push(`${f},${s}`);
          }
        });
      });
    } else if (betType === 'sanrenpuku' || betType === 'sanrentan') {
      // 3連複/3連単フォーメーション：1着-2着-3着
      const firstArray = parts[0] ? parts[0].split(',').map(h => h.trim()) : [];
      const secondArray = parts[1] ? parts[1].split(',').map(h => h.trim()) : [];
      const thirdArray = parts[2] ? parts[2].split(',').map(h => h.trim()) : [];
      
      if (betType === 'sanrenpuku') {
        // 3連複：順序関係なし、重複を除く
        const seen = new Set();
        firstArray.forEach(f => {
          secondArray.forEach(s => {
            thirdArray.forEach(t => {
              if (f !== s && f !== t && s !== t) {
                const sorted = [f, s, t].sort((a, b) => parseInt(a) - parseInt(b));
                const combo = sorted.join(',');
                if (!seen.has(combo)) {
                  seen.add(combo);
                  combinations.push(combo);
                }
              }
            });
          });
        });
      } else {
        // 3連単：順序あり
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
    } else if (betType === 'umaren' || betType === 'wide') {
      // 馬連・ワイドの軸流し（古い形式との互換性）
      if (axisHorses && partnerHorses) {
        const axis = axisHorses.split(',').map(h => h.trim());
        const partners = partnerHorses.split(',').map(h => h.trim());
        
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
    // レース情報を取得
    const raceInfo = await pool.query('SELECT race_date, race_time FROM races WHERE race_id = $1', [req.params.race_id]);
    
    if (raceInfo.rows.length === 0) {
      return res.status(404).json({ error: 'レースが見つかりません' });
    }
    
    const race = raceInfo.rows[0];
    
    // 現在時刻（日本時間）
    const now = new Date();
    
    // レース開始時刻を作成
    const raceDateTime = new Date(race.race_date);
    const [hours, minutes] = race.race_time.split(':');
    raceDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    console.log('=== 印の時刻チェック ===');
    console.log('現在時刻:', now);
    console.log('発走時刻:', raceDateTime);
    console.log('判定:', now < raceDateTime ? '購入可能' : '購入不可');
    console.log('テストモード:', process.env.TEST_MODE === 'true' ? 'ON（時刻制限なし）' : 'OFF');
    console.log('========================');
    
    // テストモードでない場合のみ時刻チェック
    const isTestMode = process.env.TEST_MODE === 'true';
    if (!isTestMode && now >= raceDateTime) {
      return res.status(400).json({ error: 'レース開始時刻を過ぎているため、予想を入力できません' });
    }
    
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
    // レース情報を取得
    const raceInfo = await pool.query('SELECT race_date, race_time FROM races WHERE race_id = $1', [req.params.race_id]);
    
    if (raceInfo.rows.length === 0) {
      return res.status(404).json({ error: 'レースが見つかりません' });
    }
    
    const race = raceInfo.rows[0];
    
    // 現在時刻
    const now = new Date();
    
    // レース開始時刻を作成
    const raceDateTime = new Date(race.race_date);
    const [hours, minutes] = race.race_time.split(':');
    raceDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    console.log('=== 馬券購入の時刻チェック ===');
    console.log('現在時刻:', now);
    console.log('発走時刻:', raceDateTime);
    console.log('判定:', now < raceDateTime ? '購入可能' : '購入不可');
    console.log('テストモード:', process.env.TEST_MODE === 'true' ? 'ON（時刻制限なし）' : 'OFF');
    console.log('========================');
    
    // テストモードでない場合のみ時刻チェック
    const isTestMode = process.env.TEST_MODE === 'true';
    if (!isTestMode && now >= raceDateTime) {
      return res.status(400).json({ error: 'レース開始時刻を過ぎているため、馬券を購入できません' });
    }
    
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

// おまかせ購入（印から自動生成）
router.post('/:race_id/auto-bet', requireAuth, async (req, res) => {
  try {
    // 現在の予想印を取得
    const predictionsResult = await pool.query(
      'SELECT * FROM predictions WHERE user_id = $1 AND race_id = $2',
      [req.session.user.id, req.params.race_id]
    );
    
    const predictions = predictionsResult.rows;
    
    if (predictions.length === 0) {
      return res.status(400).json({ error: '予想印を先に入力してください' });
    }
    
    // 印の重さでソート（◎→○→▲→△→☆）
    const markOrder = { '◎': 1, '○': 2, '▲': 3, '△': 4, '☆': 5 };
    predictions.sort((a, b) => markOrder[a.mark] - markOrder[b.mark]);
    
    const horses = predictions.map(p => p.umaban);
    const markCount = horses.length;
    
    // 既存の馬券をチェック
    const existingBets = await pool.query(
      'SELECT SUM(amount) as total FROM bets WHERE user_id = $1 AND race_id = $2',
      [req.session.user.id, req.params.race_id]
    );
    const currentTotal = parseInt(existingBets.rows[0].total) || 0;
    
    if (currentTotal > 0) {
      return res.status(400).json({ 
        error: `既に${currentTotal.toLocaleString()}円分の馬券を購入済みです。おまかせ購入を使用する場合は、既存の馬券を削除してから実行してください。` 
      });
    }
    
    const betsToInsert = [];
    
    // 購入パターンを決定
    if (markCount === 1) {
      // ①印1個：単勝10,000円
      betsToInsert.push({ bet_type: 'tansho', horses: horses[0].toString(), amount: 10000 });
      
    } else if (markCount === 2) {
      // ②印2個：重い馬の単勝5,000円 + 2頭の馬連5,000円
      betsToInsert.push({ bet_type: 'tansho', horses: horses[0].toString(), amount: 5000 });
      betsToInsert.push({ bet_type: 'umaren', horses: `${horses[0]},${horses[1]}`, amount: 5000 });
      
    } else if (markCount === 3) {
      // ③印3個：単勝3,000円 + 馬連ボックス2,000円×3点 + 3連複1,000円
      betsToInsert.push({ bet_type: 'tansho', horses: horses[0].toString(), amount: 3000 });
      
      // 馬連ボックス（3C2=3点）
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
          betsToInsert.push({ bet_type: 'umaren', horses: `${horses[i]},${horses[j]}`, amount: 2000 });
        }
      }
      
      // 3連複（1点）
      betsToInsert.push({ bet_type: 'sanrenpuku', horses: `${horses[0]},${horses[1]},${horses[2]}`, amount: 1000 });
      
    } else if (markCount === 4) {
      // ④印4個：単勝2,000円 + 上位3頭の馬連ボックス2,000円×3点 + 4頭の3連複ボックス500円×4点
      betsToInsert.push({ bet_type: 'tansho', horses: horses[0].toString(), amount: 2000 });
      
      // 上位3頭の馬連ボックス（3C2=3点）
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
          betsToInsert.push({ bet_type: 'umaren', horses: `${horses[i]},${horses[j]}`, amount: 2000 });
        }
      }
      
      // 4頭の3連複ボックス（4C3=4点）
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          for (let k = j + 1; k < 4; k++) {
            betsToInsert.push({ bet_type: 'sanrenpuku', horses: `${horses[i]},${horses[j]},${horses[k]}`, amount: 500 });
          }
        }
      }
      
    } else if (markCount === 5) {
      // ⑤印5個：単勝2,000円 + 上位3頭の馬連ボックス1,000円×3点 + 5頭の3連複ボックス500円×10点
      betsToInsert.push({ bet_type: 'tansho', horses: horses[0].toString(), amount: 2000 });
      
      // 上位3頭の馬連ボックス（3C2=3点）
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
          betsToInsert.push({ bet_type: 'umaren', horses: `${horses[i]},${horses[j]}`, amount: 1000 });
        }
      }
      
      // 5頭の3連複ボックス（5C3=10点）
      for (let i = 0; i < 5; i++) {
        for (let j = i + 1; j < 5; j++) {
          for (let k = j + 1; k < 5; k++) {
            betsToInsert.push({ bet_type: 'sanrenpuku', horses: `${horses[i]},${horses[j]},${horses[k]}`, amount: 500 });
          }
        }
      }
    }
    
    // 馬券を一括登録
    for (const bet of betsToInsert) {
      await pool.query(
        'INSERT INTO bets (user_id, race_id, bet_type, horses, amount) VALUES ($1, $2, $3, $4, $5)',
        [req.session.user.id, req.params.race_id, bet.bet_type, bet.horses, bet.amount]
      );
    }
    
    const totalAmount = betsToInsert.reduce((sum, bet) => sum + bet.amount, 0);
    
    res.json({ 
      success: true, 
      count: betsToInsert.length, 
      total: totalAmount,
      message: `おまかせ購入完了！${betsToInsert.length}点 ${totalAmount.toLocaleString()}円` 
    });
    
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
