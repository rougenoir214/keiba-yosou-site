// ウェルカムガイドの表示管理
(function() {
  // ウェルカムガイドの各画面の内容
  const slides = [
    {
      icon: '🏇',
      title: 'ようこそ！',
      text: '競馬予想サイトへようこそ！<br>このサイトでは仮想の馬券で予想を楽しめます。<br>簡単なガイドで使い方をご紹介します。'
    },
    {
      icon: '📝',
      title: '予想の付け方',
      text: 'レースを選んで印を付けましょう<br><br><strong>◎本命 ○対抗 ▲単穴 △連下 ☆注目</strong><br><br>発走前なら何度でも変更できます'
    },
    {
      icon: '🎫',
      title: '馬券を購入',
      text: '仮想の馬券で予想力を磨けます<br><br>単勝・複勝・馬連・馬単・ワイド<br>3連複・3連単から選択<br><br><strong>🎲 おまかせ購入機能</strong><br>印を付けた後、ワンクリックで<br>自動的に馬券を購入できます<br><br><strong>※実際のお金は使いません</strong>'
    },
    {
      icon: '🔔',
      title: 'プッシュ通知',
      text: 'レース締切前に通知でお知らせ<br><br>設定ページから有効にできます<br><br>その日の最初のレース30分前に<br>「本日のレース予想締切まもなく」と通知'
    },
    {
      icon: '🎯',
      title: 'さあ始めよう！',
      text: '今日のレースで予想してみましょう<br><br>ヘルプはいつでも見られます<br>ランキングで他のユーザーと競争！'
    }
  ];

  let currentSlide = 0;

  // 初回訪問チェック
  function isFirstVisit() {
    return !localStorage.getItem('welcome_guide_shown');
  }

  // ウェルカムガイド表示済みフラグを設定
  function markAsShown() {
    localStorage.setItem('welcome_guide_shown', 'true');
  }

  // ウェルカムガイドのHTMLを作成
  function createWelcomeGuide() {
    const overlay = document.createElement('div');
    overlay.className = 'welcome-overlay';
    overlay.id = 'welcome-overlay';

    const modal = document.createElement('div');
    modal.className = 'welcome-modal';

    const content = document.createElement('div');
    content.className = 'welcome-content';
    content.id = 'welcome-content';

    modal.appendChild(content);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    renderSlide();
  }

  // 現在のスライドを表示
  function renderSlide() {
    const content = document.getElementById('welcome-content');
    const slide = slides[currentSlide];
    const isFirst = currentSlide === 0;
    const isLast = currentSlide === slides.length - 1;

    content.innerHTML = `
      <div class="welcome-icon">${slide.icon}</div>
      <h2 class="welcome-title">${slide.title}</h2>
      <p class="welcome-text">${slide.text}</p>

      <div class="welcome-progress">
        ${slides.map((_, index) => `
          <div class="progress-dot ${index === currentSlide ? 'active' : ''}"></div>
        `).join('')}
      </div>

      <div class="welcome-buttons">
        ${!isFirst ? `
          <button class="welcome-btn welcome-btn-secondary" onclick="welcomeGuide.prev()">
            ← 戻る
          </button>
        ` : `
          <button class="welcome-btn welcome-btn-secondary" onclick="welcomeGuide.skip()">
            スキップ
          </button>
        `}
        ${!isLast ? `
          <button class="welcome-btn welcome-btn-primary" onclick="welcomeGuide.next()">
            次へ →
          </button>
        ` : `
          <button class="welcome-btn welcome-btn-primary" onclick="welcomeGuide.finish()">
            完了
          </button>
        `}
      </div>
    `;
  }

  // 次のスライドへ
  function next() {
    if (currentSlide < slides.length - 1) {
      currentSlide++;
      renderSlide();
    }
  }

  // 前のスライドへ
  function prev() {
    if (currentSlide > 0) {
      currentSlide--;
      renderSlide();
    }
  }

  // スキップ
  function skip() {
    finish();
  }

  // 完了
  function finish() {
    markAsShown();
    const overlay = document.getElementById('welcome-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  // 公開API
  window.welcomeGuide = {
    show: function() {
      if (document.getElementById('welcome-overlay')) {
        return; // 既に表示中
      }
      currentSlide = 0;
      createWelcomeGuide();
    },
    next: next,
    prev: prev,
    skip: skip,
    finish: finish
  };

  // ページ読み込み時に初回訪問チェック
  window.addEventListener('DOMContentLoaded', function() {
    // ログイン済みかチェック（userオブジェクトがあるか）
    if (window.user && isFirstVisit()) {
      // 少し遅延させてから表示（ページ読み込み後）
      setTimeout(function() {
        window.welcomeGuide.show();
      }, 500);
    }
  });
})();
