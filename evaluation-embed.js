(function () {
  'use strict';

  const FORM_URL = 'phieu-danh-gia.html';
  const LINK_SELECTORS = [
    'a.nav-evaluation',
    'a[href*="phieu-danh-gia-khang-sinh"]'
  ];

  function createModal() {
    if (document.getElementById('evaluationEmbedModal')) return;

    const style = document.createElement('style');
    style.textContent = `
      #evaluationEmbedModal{position:fixed;inset:0;z-index:99999;display:none;background:rgba(15,23,42,.62);padding:12px}
      #evaluationEmbedModal.is-open{display:flex;align-items:center;justify-content:center}
      #evaluationEmbedPanel{width:min(980px,100%);height:min(94vh,980px);background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.28);display:flex;flex-direction:column}
      #evaluationEmbedHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-bottom:1px solid #dbe5ef;background:#fff}
      #evaluationEmbedHeader strong{color:#064675;font:700 16px Arial,sans-serif}
      #evaluationEmbedClose{border:0;border-radius:10px;background:#eaf2fb;color:#064675;font:700 15px Arial,sans-serif;padding:9px 13px;cursor:pointer}
      #evaluationEmbedFrame{width:100%;height:100%;border:0;background:#eef5fb}
      @media(max-width:700px){#evaluationEmbedModal{padding:0}#evaluationEmbedPanel{width:100%;height:100vh;border-radius:0}}
    `;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'evaluationEmbedModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Phiếu đánh giá phần mềm');
    modal.innerHTML = `
      <div id="evaluationEmbedPanel">
        <div id="evaluationEmbedHeader">
          <strong>Phiếu đánh giá phần mềm</strong>
          <button type="button" id="evaluationEmbedClose" aria-label="Đóng phiếu đánh giá">Đóng</button>
        </div>
        <iframe id="evaluationEmbedFrame" title="Phiếu đánh giá phần mềm" loading="lazy"></iframe>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    };

    document.getElementById('evaluationEmbedClose').addEventListener('click', close);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) close();
    });
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data && event.data.type === 'close-evaluation-modal') close();
    });
  }

  function openEvaluation(event) {
    event.preventDefault();
    createModal();
    const modal = document.getElementById('evaluationEmbedModal');
    const frame = document.getElementById('evaluationEmbedFrame');
    if (!frame.src) frame.src = FORM_URL;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function bindLinks() {
    const links = document.querySelectorAll(LINK_SELECTORS.join(','));
    links.forEach((link) => {
      if (link.dataset.evaluationEmbedded === '1') return;
      link.dataset.evaluationEmbedded = '1';
      link.removeAttribute('target');
      link.addEventListener('click', openEvaluation);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindLinks);
  } else {
    bindLinks();
  }
})();
