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
      'INSERT INTO users (username, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, is_admin',
      [username, password_hash, display_name]
    );
    
    // セッションに保存
    req.session.user = {
      id: result.rows[0].id,
      username: username,
      display_name: display_name,
      is_admin: result.rows[0].is_admin || false
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
      display_name: user.display_name,
      is_admin: user.is_admin || false
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

// ユーザー設定ページ
router.get('/settings', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  res.render('auth/settings', { 
    user: req.session.user,
    error: null,
    success: null
  });
});

// ユーザー設定更新
router.post('/settings/update', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }

  const { username, display_name, password } = req.body;
  const userId = req.session.user.id;

  try {
    // 現在のユーザー情報を取得してパスワード確認
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.render('auth/settings', {
        user: req.session.user,
        error: 'ユーザーが見つかりません',
        success: null
      });
    }

    const user = userResult.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.render('auth/settings', {
        user: req.session.user,
        error: 'パスワードが正しくありません',
        success: null
      });
    }

    // ユーザー名が変更されている場合、重複チェック
    if (username !== user.username) {
      const duplicateCheck = await pool.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, userId]
      );

      if (duplicateCheck.rows.length > 0) {
        return res.render('auth/settings', {
          user: req.session.user,
          error: 'このユーザー名は既に使用されています',
          success: null
        });
      }
    }

    // ユーザー情報を更新
    await pool.query(
      'UPDATE users SET username = $1, display_name = $2 WHERE id = $3',
      [username, display_name, userId]
    );

    // セッション情報も更新
    req.session.user.username = username;
    req.session.user.display_name = display_name;

    res.render('auth/settings', {
      user: req.session.user,
      error: null,
      success: '✅ ユーザー情報を更新しました'
    });
  } catch (error) {
    console.error(error);
    res.render('auth/settings', {
      user: req.session.user,
      error: '更新中にエラーが発生しました',
      success: null
    });
  }
});

module.exports = router;
