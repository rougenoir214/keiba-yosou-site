const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { queryWithRetry } = require('../db/connection');
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
    const existing = await queryWithRetry(
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
    const result = await queryWithRetry(
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
    
    res.redirect('/races');
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
    const result = await queryWithRetry(
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
    
    res.redirect('/races');
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

  const { username, display_name, current_password, new_password, new_password_confirm } = req.body;
  const userId = req.session.user.id;

  try {
    // 現在のユーザー情報を取得してパスワード確認
    const userResult = await queryWithRetry(
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
    const passwordMatch = await bcrypt.compare(current_password, user.password_hash);

    if (!passwordMatch) {
      return res.render('auth/settings', {
        user: req.session.user,
        error: '現在のパスワードが正しくありません',
        success: null
      });
    }

    // パスワード変更のチェック（入力されている場合のみ）
    if (new_password || new_password_confirm) {
      if (new_password !== new_password_confirm) {
        return res.render('auth/settings', {
          user: req.session.user,
          error: '新しいパスワードと確認用パスワードが一致しません',
          success: null
        });
      }

      if (new_password.length < 6) {
        return res.render('auth/settings', {
          user: req.session.user,
          error: '新しいパスワードは6文字以上にしてください',
          success: null
        });
      }
    }

    // ユーザー名が変更されている場合、重複チェック
    if (username !== user.username) {
      const duplicateCheck = await queryWithRetry(
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

    // パスワードも変更する場合
    if (new_password) {
      const new_password_hash = await bcrypt.hash(new_password, 10);
      await queryWithRetry(
        'UPDATE users SET username = $1, display_name = $2, password_hash = $3 WHERE id = $4',
        [username, display_name, new_password_hash, userId]
      );
    } else {
      // パスワードは変更しない
      await queryWithRetry(
        'UPDATE users SET username = $1, display_name = $2 WHERE id = $3',
        [username, display_name, userId]
      );
    }

    // セッション情報も更新
    req.session.user.username = username;
    req.session.user.display_name = display_name;

    const successMessage = new_password 
      ? '✅ ユーザー情報とパスワードを更新しました' 
      : '✅ ユーザー情報を更新しました';

    res.render('auth/settings', {
      user: req.session.user,
      error: null,
      success: successMessage
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
