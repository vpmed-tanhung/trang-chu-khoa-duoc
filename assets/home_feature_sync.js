(function () {
  'use strict';

  const STYLE_ID = 'vpmed-home-compact-style';
  const COMPACT_HTML = `
    <p class="vpmed-hero-summary">
      Tra cứu thông tin thuốc, tính liều và rà soát an toàn trong thực hành lâm sàng.
    </p>
    <div class="vpmed-hero-groups" aria-label="Nhóm chức năng chính">
      <span>Tính liều</span>
      <span>Tra cứu thuốc</span>
      <span>An toàn thuốc</span>
      <span>ICD-10 &amp; BHYT</span>
    </div>
    <p class="vpmed-hero-action">
      Chọn công cụ tại mục <strong>Ứng dụng chính</strong> bên dưới.
    </p>`;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #view-home .hero-intro[data-vpmed-compact="true"] {
        max-width: 900px;
        margin-top: 12px;
      }
      #view-home .hero-intro[data-vpmed-compact="true"] .vpmed-hero-summary {
        max-width: 820px;
        margin: 0 0 14px;
        font-size: clamp(16px, 1.6vw, 19px);
        line-height: 1.55;
      }
      #view-home .vpmed-hero-groups {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 0 0 14px;
      }
      #view-home .vpmed-hero-groups span {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        padding: 7px 12px;
        border: 1px solid rgba(255,255,255,.30);
        border-radius: 999px;
        background: rgba(255,255,255,.12);
        color: #fff;
        font-size: 13px;
        font-weight: 800;
        line-height: 1.2;
        white-space: nowrap;
      }
      #view-home .hero-intro[data-vpmed-compact="true"] .vpmed-hero-action {
        margin: 0;
        font-size: 14px;
        color: rgba(255,255,255,.92);
      }
      @media (max-width: 640px) {
        #view-home .hero-intro[data-vpmed-compact="true"] { margin-top: 8px; }
        #view-home .vpmed-hero-groups { gap: 6px; }
        #view-home .vpmed-hero-groups span {
          min-height: 30px;
          padding: 6px 9px;
          font-size: 12px;
        }
      }`;
    document.head.appendChild(style);
  }

  function compactHomeIntroduction() {
    const intro = document.querySelector('#view-home .hero-intro');
    if (!intro) return false;
    ensureStyle();
    if (intro.dataset.vpmedCompact !== 'true' || !intro.querySelector('.vpmed-hero-groups')) {
      intro.innerHTML = COMPACT_HTML;
      intro.dataset.vpmedCompact = 'true';
    }
    return true;
  }

  function init() {
    if (compactHomeIntroduction()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (compactHomeIntroduction() || attempts >= 20) window.clearInterval(timer);
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
