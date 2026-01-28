// 初回ウェルカムガイドの表示制御

// ウェルカムガイドを表示する関数
function showWelcomeGuide() {
  // モーダルが既に存在する場合は表示するだけ
  let modal = document.getElementById('welcome-guide-modal');
  if (modal) {
    modal.style.display = 'flex';
    showSlide(0);
    return;
  }

  // モーダルHTMLを作成
  const modalHTML = `
    <div id="welcome-guide-modal" style="
      display: flex;
      position: fixed;
      z-index: 10000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.7);
      align-items: center;
      justify-content: center;
    ">
      <div style="
        background: white;
        border-radius: 20px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      ">
        <!-- スライド1 -->
        <div class="welcome-slide" data-slide="0" style="padding: 40px; text-align: center;">
          <div style="font-size: 4rem; margin-bottom: 20px;">🏇</div>
          <h2 style="color: #333; margin-bottom: 15px; font-size: 24px;">ようこそ！</h2>
          <p style="color: #666; line-height: 1.8; font-size: 16px;">
            競馬予想サイトへようこそ<br>
            このサイトでは仮想の馬券で予想を楽しめます
          </p>
        </div>

        <!-- スライド2 -->
        <div class="welcome-slide" data-slide="1" style="padding: 40px; text-align: center; display: none;">
          <div style="font-size: 4rem; margin-bottom: 20px;">📝</div>
          <h2 style="color: #333; margin-bottom: 15px; font-size: 24px;">予想の付け方</h2>
          <p style="color: #666; line-height: 1.8; font-size: 16px;">
            レースを選んで印を付けよう<br>
            <strong style="color: #667eea;">◎本命 ○対抗 ▲単穴 △連下 ☆注目</strong><br>
            発走前なら何度でも変更可能
          </p>
        </div>

        <!-- スライド3 -->
        <div class="welcome-slide" data-slide="2" style="padding: 40px; text-align: center; display: none;">
          <div style="font-size: 4rem; margin-bottom: 20px;">🔔</div>
          <h2 style="color: #333; margin-bottom: 15px; font-size: 24px;">プッシュ通知</h2>
          <p style="color: #666; line-height: 1.8; font-size: 16px;">
            レース締切前に通知でお知らせ<br>
            設定ページから有効にできます<br>
            ※スマホはホーム画面に追加してね
          </p>
        </div>

        <!-- スライド4 -->
        <div class="welcome-slide" data-slide="3" style="padding: 40px; text-align: center; display: none;">
          <div style="font-size: 4rem; margin-bottom: 20px;">🎯</div>
          <h2 style="color: #333; margin-bottom: 15px; font-size: 24px;">さあ始めよう！</h2>
          <p style="color: #666; line-height: 1.8; font-size: 16px;">
            今日のレースで予想してみましょう<br>
            ヘルプはいつでも見られます
          </p>
        </div>

        <!-- ナビゲーションボタン -->
        <div style="padding: 0 40px 40px 40px; display: flex; justify-content: space-between; align-items: center;">
          <button id="welcome-prev-btn" onclick="prevSlide()" style="
            padding: 12px 24px;
            background: #e0e0e0;
            color: #666;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            font-size: 16px;
            display: none;
          ">← 戻る</button>
          
          <div id="welcome-dots" style="display: flex; gap: 8px;">
            <span class="welcome-dot" data-dot="0" style="width: 12px; height: 12px; border-radius: 50%; background: #667eea;"></span>
            <span class="welcome-dot" data-dot="1" style="width: 12px; height: 12px; border-radius: 50%; background: #ddd;"></span>
            <span class="welcome-dot" data-dot="2" style="width: 12px; height: 12px; border-radius: 50%; background: #ddd;"></span>
            <span class="welcome-dot" data-dot="3" style="width: 12px; height: 12px; border-radius: 50%; background: #ddd;"></span>
          </div>

          <button id="welcome-next-btn" onclick="nextSlide()" style="
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            font-size: 16px;
          ">次へ →</button>
        </div>
      </div>
    </div>
  `;

  // bodyに追加
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  modal = document.getElementById('welcome-guide-modal');
  
  // 初回表示時はlocalStorageにフラグを設定
  localStorage.setItem('welcomeGuideShown', 'true');
  
  showSlide(0);
}

// スライドを表示
let currentSlide = 0;

function showSlide(index) {
  currentSlide = index;
  const slides = document.querySelectorAll('.welcome-slide');
  const dots = document.querySelectorAll('.welcome-dot');
  const prevBtn = document.getElementById('welcome-prev-btn');
  const nextBtn = document.getElementById('welcome-next-btn');

  // すべてのスライドを非表示
  slides.forEach(slide => {
    slide.style.display = 'none';
  });

  // 現在のスライドを表示
  slides[index].style.display = 'block';

  // ドットの更新
  dots.forEach((dot, i) => {
    dot.style.background = i === index ? '#667eea' : '#ddd';
  });

  // ボタンの表示切り替え
  prevBtn.style.display = index === 0 ? 'none' : 'block';
  
  if (index === slides.length - 1) {
    nextBtn.textContent = '完了';
    nextBtn.onclick = closeWelcomeGuide;
  } else {
    nextBtn.textContent = '次へ →';
    nextBtn.onclick = nextSlide;
  }
}

function nextSlide() {
  const slides = document.querySelectorAll('.welcome-slide');
  if (currentSlide < slides.length - 1) {
    showSlide(currentSlide + 1);
  }
}

function prevSlide() {
  if (currentSlide > 0) {
    showSlide(currentSlide - 1);
  }
}

function closeWelcomeGuide() {
  const modal = document.getElementById('welcome-guide-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// ページ読み込み時に初回訪問かチェック
document.addEventListener('DOMContentLoaded', () => {
  const hasShown = localStorage.getItem('welcomeGuideShown');
  
  // 初回訪問の場合のみ表示（ログインページ以外）
  if (!hasShown && window.location.pathname !== '/auth/login' && window.location.pathname !== '/auth/register') {
    // 少し遅延させて表示（ページが完全に読み込まれてから）
    setTimeout(() => {
      showWelcomeGuide();
    }, 500);
  }
});
