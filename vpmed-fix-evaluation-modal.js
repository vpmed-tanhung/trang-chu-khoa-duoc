/* VPMED - Fix modal đánh giá bị mở nhầm web chính
   Mục tiêu:
   - Khi bấm Đánh giá, chỉ mở đúng file phieu-danh-gia.html.
   - Không nhúng lại index.html / trang chủ trong modal.
   - Không sửa assets/unified.js.
*/
(function () {
  const EVAL_URL = 'https://vpmed-tanhung.github.io/trang-chu-khoa-duoc/phieu-danh-gia.html?embed=1';

  function removeOldEvaluationModals() {
    document.querySelectorAll(
      '#evaluationModal, #evalModal, .evaluation-modal, .eval-modal, [data-evaluation-modal]'
    ).forEach(el => el.remove());
  }

  function ensureStyle() {
    if (document.getElementById('vpmed-eval-modal-fix-style')) return;
    const style = document.createElement('style');
    style.id = 'vpmed-eval-modal-fix-style';
    style.textContent = `
      .vpmed-eval-fix-backdrop{
        position:fixed; inset:0; z-index:99999;
        background:rgba(15,23,42,.58);
        display:flex; align-items:center; justify-content:center;
        padding:18px;
      }
      .vpmed-eval-fix-modal{
        width:min(980px,96vw);
        height:min(900px,92vh);
        background:#fff;
        border-radius:18px;
        overflow:hidden;
        box-shadow:0 28px 80px rgba(15,23,42,.32);
        border:1px solid #dbeafe;
        display:flex;
        flex-direction:column;
      }
      .vpmed-eval-fix-head{
        display:flex; align-items:center; justify-content:space-between;
        gap:12px;
        padding:14px 18px;
        border-bottom:1px solid #dbeafe;
        color:#075985;
        font-weight:900;
        background:#fff;
      }
      .vpmed-eval-fix-close{
        border:0;
        border-radius:12px;
        padding:9px 14px;
        font-weight:900;
        background:#eaf6ff;
        color:#075985;
        cursor:pointer;
      }
      .vpmed-eval-fix-frame{
        width:100%;
        flex:1;
        border:0;
        background:#eef8fc;
      }
      @media(max-width:720px){
        .vpmed-eval-fix-backdrop{padding:0}
        .vpmed-eval-fix-modal{width:100vw;height:100vh;border-radius:0}
      }
    `;
    document.head.appendChild(style);
  }

  function openEvaluationModal() {
    ensureStyle();
    removeOldEvaluationModals();

    const backdrop = document.createElement('div');
    backdrop.className = 'vpmed-eval-fix-backdrop';
    backdrop.dataset.evaluationModal = '1';

    backdrop.innerHTML = `
      <div class="vpmed-eval-fix-modal" role="dialog" aria-modal="true" aria-label="Phiếu đánh giá">
        <div class="vpmed-eval-fix-head">
          <div>Phiếu đánh giá hệ thống hỗ trợ lâm sàng của Khoa Dược</div>
          <button type="button" class="vpmed-eval-fix-close">Đóng</button>
        </div>
        <iframe class="vpmed-eval-fix-frame" src="${EVAL_URL}" title="Phiếu đánh giá"></iframe>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';

    const close = () => {
      backdrop.remove();
      document.body.style.overflow = '';
    };

    backdrop.querySelector('.vpmed-eval-fix-close').addEventListener('click', close);
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) close();
    });
    document.addEventListener('keydown', function esc(ev) {
      if (ev.key === 'Escape') {
        document.removeEventListener('keydown', esc);
        close();
      }
    });
  }

  function isEvaluationTrigger(el) {
    if (!el) return false;

    const href = String(el.getAttribute('href') || '');
    const data = String(el.getAttribute('data-open') || el.getAttribute('data-view') || '');
    const text = String(el.textContent || '').toLowerCase();

    return href.includes('phieu-danh-gia') ||
           href.includes('danh-gia') ||
           data.includes('evaluation') ||
           text.includes('đánh giá') ||
           text.includes('danh gia');
  }

  document.addEventListener('click', function (e) {
    const trigger = e.target.closest('a,button,[data-open],[data-view]');
    if (!isEvaluationTrigger(trigger)) return;

    // Chỉ chặn các nút/link đánh giá. Không chặn nút đóng trong modal mới.
    if (trigger.classList && trigger.classList.contains('vpmed-eval-fix-close')) return;

    e.preventDefault();
    e.stopPropagation();
    openEvaluationModal();
  }, true);

  // Nếu modal cũ đã bị mở nhầm sẵn, phát hiện iframe đang là trang chủ thì sửa src.
  setInterval(function () {
    document.querySelectorAll('iframe').forEach(frame => {
      const src = String(frame.getAttribute('src') || '');
      const looksLikeWrongHome =
        src.endsWith('/trang-chu-khoa-duoc/') ||
        src.includes('/trang-chu-khoa-duoc/#home') ||
        src.includes('/trang-chu-khoa-duoc/index.html');

      if (looksLikeWrongHome) frame.setAttribute('src', EVAL_URL);
    });
  }, 700);
})();
