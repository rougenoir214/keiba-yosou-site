const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// プロキシ信頼設定（Render.com用）
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ミドルウェア設定
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// キャッシュ無効化（開発環境での問題回避）
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24時間
  }
}));

// ビューエンジン設定
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ルート
const adminRoutes = require('./routes/admin');
const racesRoutes = require('./routes/races');
const authRoutes = require('./routes/auth');
const predictionsRoutes = require('./routes/predictions');
const rankingRoutes = require('./routes/ranking');
const pushRoutes = require('./routes/push');
app.use('/admin', adminRoutes);
app.use('/races', racesRoutes);
app.use('/auth', authRoutes);
app.use('/predictions', predictionsRoutes);
app.use('/ranking', rankingRoutes);
app.use('/api/push', pushRoutes);

app.get('/', (req, res) => {
  // ログイン済みなら/racesにリダイレクト
  if (req.session.user) {
    return res.redirect('/races');
  }
  res.render('index', { user: req.session.user });
});

// ヘルスチェックエンドポイント（keep-alive用）
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
  
  // Render.com スリープ対策（本番環境のみ）
  if (process.env.NODE_ENV === 'production') {
    const RENDER_URL = process.env.RENDER_URL || 'https://keiba-yosou-site.onrender.com';
    const INTERVAL = 14 * 60 * 1000; // 14分ごと
    
    console.log('Keep-alive機能を開始します（14分間隔）');
    
    setInterval(async () => {
      try {
        const https = require('https');
        const url = `${RENDER_URL}/health`;
        
        https.get(url, (res) => {
          console.log(`Keep-alive ping送信: ${url} - Status: ${res.statusCode}`);
        }).on('error', (err) => {
          console.error('Keep-alive ping失敗:', err.message);
        });
      } catch (error) {
        console.error('Keep-alive エラー:', error.message);
      }
    }, INTERVAL);
    
    // 初回は30秒後に実行
    setTimeout(() => {
      try {
        const https = require('https');
        const url = `${RENDER_URL}/health`;
        
        https.get(url, (res) => {
          console.log(`初回 Keep-alive ping送信: ${url} - Status: ${res.statusCode}`);
        }).on('error', (err) => {
          console.error('初回 Keep-alive ping失敗:', err.message);
        });
      } catch (error) {
        console.error('初回 Keep-alive エラー:', error.message);
      }
    }, 30000);
  }
  
  // レース通知スケジューラーを起動（本番環境のみ）
  if (process.env.NODE_ENV === 'production') {
    console.log('レース通知スケジューラーを起動します...');
    require('./race-notification-scheduler');
  }
});
