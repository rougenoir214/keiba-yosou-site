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
app.use('/admin', adminRoutes);
app.use('/races', racesRoutes);
app.use('/auth', authRoutes);
app.use('/predictions', predictionsRoutes);
app.use('/ranking', rankingRoutes);

app.get('/', (req, res) => {
  res.render('index', { user: req.session.user });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
});
