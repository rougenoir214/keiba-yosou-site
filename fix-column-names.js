// post_time を race_time に一括置換するスクリプト
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
    
    // post_time を race_time に置換
    content = content.replace(/post_time/g, 'race_time');
    
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
