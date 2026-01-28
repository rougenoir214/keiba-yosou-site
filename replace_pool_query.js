const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, 'routes', 'admin.js'),
  path.join(__dirname, 'routes', 'auth.js')
];

files.forEach(filePath => {
  // ファイルを読み込む
  let content = fs.readFileSync(filePath, 'utf8');
  
  // ファイルの冒頭に queryWithRetry のインポートを追加（まだなければ）
  if (!content.includes('queryWithRetry')) {
    // pool のインポート行を探す
    content = content.replace(
      /const pool = require\('\.\.\/db\/connection'\);/,
      "const { queryWithRetry } = require('../db/connection');\nconst pool = require('../db/connection');"
    );
  }
  
  // pool.query を queryWithRetry に置換（awaitがある場合のみ）
  content = content.replace(/await pool\.query\(/g, 'await queryWithRetry(');
  
  // ファイルに書き込む
  fs.writeFileSync(filePath, content, 'utf8');
  
  console.log(`✅ ${path.basename(filePath)} の置換完了`);
});

console.log('\n全ファイルの置換完了！');
