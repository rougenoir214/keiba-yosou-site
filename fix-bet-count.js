/**
 * 既存馬券データのbet_countを正確に再計算するスクリプト
 * 
 * 使い方:
 * node fix-bet-count.js
 */

const { queryWithRetry } = require('./db/connection');
const pool = require('./db/connection');

// generateCombinations関数（predictions.jsから抜粋）
function generateCombinations(horses, betType, buyMethod, axisHorses, partnerHorses) {
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
    // フォーメーション: horses = "1,3-5,7" または "1,3>5,7" または "1,3>5,7>9,11"
    // "-"または">"で分割
    const delimiter = horses.includes('>') ? '>' : '-';
    const parts = horses.split(delimiter);
    
    if (betType === 'umaren' || betType === 'wide') {
      const axisArray = parts[0] ? parts[0].split(',').map(h => h.trim()) : [];
      const partnerArray = parts[1] ? parts[1].split(',').map(h => h.trim()) : [];
      
      const seen = new Set();
      
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
      const firstArray = parts[0] ? parts[0].split(',').map(h => h.trim()) : [];
      const secondArray = parts[1] ? parts[1].split(',').map(h => h.trim()) : [];
      const thirdArray = parts[2] ? parts[2].split(',').map(h => h.trim()) : [];
      
      if (betType === 'sanrenpuku') {
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
    }
  } else if (buyMethod === 'nagashi') {
    // 流し: horses = "1>5,7,9"
    const parts = horses.split('>');
    const axisArray = parts[0] ? parts[0].split(',').map(h => h.trim()) : [];
    const partnerArray = parts[1] ? parts[1].split(',').map(h => h.trim()) : [];
    
    if (betType === 'umaren' || betType === 'wide') {
      const seen = new Set();
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
      axisArray.forEach(a => {
        partnerArray.forEach(p => {
          if (a !== p) {
            combinations.push(`${a},${p}`);
          }
        });
      });
    }
  }
  
  return combinations;
}

async function fixBetCount() {
  try {
    console.log('=== bet_count修正スクリプト開始 ===\n');
    
    // 全馬券データを取得
    const result = await queryWithRetry('SELECT * FROM bets ORDER BY id');
    const bets = result.rows;
    
    console.log(`対象馬券数: ${bets.length}件\n`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const bet of bets) {
      try {
        let correctBetCount;
        
        if (!bet.bet_format || bet.bet_format === 'single') {
          // 単式は常に1点
          correctBetCount = 1;
        } else {
          // BOX、フォーメーション、流しの場合は組み合わせを生成
          const combinations = generateCombinations(
            bet.horses,
            bet.bet_type,
            bet.bet_format,
            null,
            null
          );
          correctBetCount = combinations.length;
        }
        
        // 現在のbet_countと比較
        if (bet.bet_count !== correctBetCount) {
          console.log(`[更新] ID: ${bet.id}`);
          console.log(`  種別: ${bet.bet_type} (${bet.bet_format})`);
          console.log(`  馬番: ${bet.horses}`);
          console.log(`  現在: ${bet.bet_count}点 → 正解: ${correctBetCount}点`);
          
          // 更新
          await queryWithRetry(
            'UPDATE bets SET bet_count = $1 WHERE id = $2',
            [correctBetCount, bet.id]
          );
          
          updatedCount++;
        }
      } catch (error) {
        console.error(`[エラー] ID: ${bet.id} - ${error.message}`);
        errorCount++;
      }
    }
    
    console.log('\n=== 修正完了 ===');
    console.log(`更新件数: ${updatedCount}件`);
    console.log(`エラー件数: ${errorCount}件`);
    console.log(`変更なし: ${bets.length - updatedCount - errorCount}件`);
    
    process.exit(0);
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

fixBetCount();
