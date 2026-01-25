const express = require('express');
const router = express.Router();

// ヘルプページ
router.get('/', (req, res) => {
  res.render('help', {
    user: req.session.user || null
  });
});

module.exports = router;
