const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db/connection');

// 新規登録ページ
router.get('/register', (req, res) => {
  res.render('auth/register', { error: null });
});

// 新規登録処理
router.post('/register', async (req, res) => {
  const { username, password, display_name } = req.body;
  
  try {
    // ユーザー名の重複チェック
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    
    if (existing.rows.length > 0) {
      return res.render('auth/register', { 
        error: 'このユーザー名は既に使用されています' 
      });
    }
    
    // パスワードをハッシュ化
    const password_hash = await bcrypt.hash(password, 10);
    
    // ユーザー登録
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id',
      [username, password_hash, display_name]
    );
    
    // セッションに保存
    req.session.user = {
      id: result.rows[0].id,
      username: username,
      display_name: display_name
    };
    
    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.render('auth/register', { 
      error: '登録中にエラーが発生しました' 
    });
  }
});

// ログインページ
router.get('/login', (req, res) => {
  res.render('auth/login', { error: null });
});

// ログイン処理
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.render('auth/login', { 
        error: 'ユーザー名またはパスワードが間違っています' 
      });
    }
    
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    
    if (!match) {
      return res.render('auth/login', { 
        error: 'ユーザー名またはパスワードが間違っています' 
      });
    }
    
    // セッションに保存
    req.session.user = {
      id: user.id,
      username: user.username,
      display_name: user.display_name
    };
    
    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.render('auth/login', { 
      error: 'ログイン中にエラーが発生しました' 
    });
  }
});

// ログアウト
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
