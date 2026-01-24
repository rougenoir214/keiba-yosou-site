// VAPIDキーを生成するスクリプト
const webpush = require('web-push');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('=== VAPIDキーが生成されました ===');
console.log('以下の2つの値を .env ファイルに追加してください:');
console.log('');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log('');
console.log('このキーは一度生成したら変更しないでください。');
console.log('変更すると既存のプッシュ購読が無効になります。');
