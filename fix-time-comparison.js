// 時刻比較のSQLを修正するスクリプト
const fs = require('fs');
const path = require('path');

const files = [
  './race-notification-scheduler.js',
  './test-race-notification.js'
];

files.forEach(filepath => {
  try {
    const fullPath = path.join(__dirname, filepath);
    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;
    
    // race_time を CAST(race_time AS TIME) に変更して型を合わせる
    content = content.replace(
      /AND r\.race_time BETWEEN/g,
      'AND CAST(r.race_time AS TIME) BETWEEN'
    );
    
    // CURRENT_TIME::TIME を使う
    content = content.replace(
      /\(CURRENT_TIME \+ INTERVAL/g,
      '(CURRENT_TIME::TIME + INTERVAL'
    );
    
    // minutes_until の計算も修正
    content = content.replace(
      /EXTRACT\(EPOCH FROM \(r\.race_time - CURRENT_TIME\)\)\/60/g,
      'EXTRACT(EPOCH FROM (CAST(r.race_time AS TIME) - CURRENT_TIME::TIME))/60'
    );
    
    if (content !== originalContent) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ ${filepath} を修正しました`);
    } else {
      console.log(`ℹ️  ${filepath} は既に修正済みです`);
    }
  } catch (error) {
    console.error(`❌ ${filepath} の処理エラー:`, error.message);
  }
});

console.log('\n✅ 置換完了');
