(function () {
  'use strict';

  const MODULE_ID = 'antibiotic-consultation';
  const SOURCE_5631 = 'https://canhgiacduoc.org.vn/SiteData/3/UserFiles/Q%C4%90%205631%20BYT%20Huong%20dan%20thuc%20hien%20quan%20ly%20su%20dung%20khang%20sinh%20trong%20benh%20vien%2031_12_2020.PDF';
  const SOURCE_2115 = 'https://benhvienquynhon.gov.vn/wp-content/uploads/2023/06/So-tay-huong-dan-thuc-hien-chuong-trinh-quan-ly-su-dung-khang-sinh-danh-cho-benh-vien-tuyen-huyen-Quyet-dinh-so-2115.BYT-11.05.2023-.pdf';

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const norm = value => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const priorityRules = [
    {
      key: 'carbapenem',
      names: ['imipenem', 'meropenem', 'doripenem'],
      label: 'Carbapenem ưu tiên quản lý',
      basis: 'Imipenem, meropenem và doripenem thuộc Nhóm 1 tại Phụ lục 2 Quyết định 5631/QĐ-BYT.'
    },
    {
      key: 'colistin',
      names: ['colistin'],
      label: 'Kháng sinh dự trữ',
      basis: 'Colistin thuộc Nhóm 1 tại Phụ lục 2 Quyết định 5631/QĐ-BYT.'
    },
    {
      key: 'fosfomycin-iv',
      names: ['fosfomycin'],
      label: 'Fosfomycin đường tiêm',
      basis: 'Fosfomycin truyền tĩnh mạch thuộc Nhóm 1 tại Phụ lục 2 Quyết định 5631/QĐ-BYT.',
      routeTest: route => !norm(route).includes('uong')
    },
    {
      key: 'vancomycin',
      names: ['vancomycin'],
      label: 'Glycopeptid ưu tiên quản lý',
      basis: 'Vancomycin truyền tĩnh mạch được liệt kê tại Nhóm 1; phạm vi áp dụng cần xác định theo hạng bệnh viện và quy định nội bộ.'
    }
  ];

  const monitoringRules = [
    {
      key: 'aminoglycoside',
      names: ['amikacin', 'gentamicin', 'tobramycin', 'netilmicin', 'neltimicin'],
      label: 'Aminoglycosid',
      basis: 'Thuộc Nhóm 2 cần theo dõi, giám sát sử dụng theo Phụ lục 2 Quyết định 5631/QĐ-BYT.'
    },
    {
      key: 'fluoroquinolone',
      names: ['ciprofloxacin', 'levofloxacin', 'lomefloxacin', 'moxifloxacin', 'norfloxacin', 'ofloxacin', 'pefloxacin', 'sparfloxacin'],
      label: 'Fluoroquinolon',
      basis: 'Thuộc Nhóm 2 cần theo dõi, giám sát sử dụng theo Phụ lục 2 Quyết định 5631/QĐ-BYT.'
    }
  ];

  function matchesRule(drug, rule) {
    const active = norm(drug.active).replace(/ hydrochloride\b/g, '');
    const nameMatch = rule.names.some(name => active.includes(norm(name)));
    return nameMatch && (!rule.routeTest || rule.routeTest(drug.route));
  }

  function classifyDrug(drug) {
    const priority = priorityRules.find(rule => matchesRule(drug, rule));
    if (priority) return { ...drug, consultationGroup: 'priority', consultationRule: priority };
    const monitoring = monitoringRules.find(rule => matchesRule(drug, rule));
    if (monitoring) return { ...drug, consultationGroup: 'monitoring', consultationRule: monitoring };
    return null;
  }

  function openView(name) {
    if (typeof window.showView === 'function') {
      window.showView(name);
      return;
    }
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    const target = document.getElementById('view-' + name);
    if (target) target.classList.add('active');
    history.replaceState(null, '', '#' + name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function installStyles() {
    if (document.getElementById('antibiotic-consultation-styles')) return;
    const style = document.createElement('style');
    style.id = 'antibiotic-consultation-styles';
    style.textContent = `
      .consultation-feature{border-color:#f0c985;background:linear-gradient(180deg,#fff 0%,#fff9ee 100%)}
      .consultation-feature em{background:#fff0cf;color:#875506}
      .consultation-status{margin-bottom:14px;border-left:5px solid #d58a0b;background:#fff8e8;color:#5d430f}
      .consultation-status strong{color:#7a4a00}
      .consultation-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}
      .consultation-summary article{border:1px solid var(--line);border-radius:14px;background:#fff;padding:14px;box-shadow:0 4px 14px rgba(31,74,108,.05)}
      .consultation-summary strong{display:block;color:#075d98;font-size:25px;line-height:1.1}
      .consultation-summary span{display:block;color:var(--muted);font-size:12px;margin-top:6px;line-height:1.4}
      .consultation-filters{display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-bottom:15px}
      .consultation-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .consultation-drug{border:1px solid var(--line);border-radius:15px;background:#fff;padding:15px;box-shadow:0 4px 14px rgba(31,74,108,.05)}
      .consultation-drug.priority{border-left:5px solid #d97706}
      .consultation-drug.monitoring{border-left:5px solid #0b79bb}
      .consultation-drug-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .consultation-drug h3{margin:0;color:#075d98;font-size:18px}
      .consultation-drug p{margin:7px 0;color:#415a6b;line-height:1.5}
      .consultation-drug small{color:var(--muted);line-height:1.45}
      .consultation-badge{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:800;white-space:nowrap}
      .consultation-badge.priority{background:#fff0cf;color:#875506}
      .consultation-badge.monitoring{background:#e8f5fc;color:#075d98}
      .consultation-meta{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}
      .consultation-meta span{border:1px solid #dce8ef;border-radius:999px;background:#f8fbfd;padding:5px 8px;color:#486477;font-size:11px;font-weight:700}
      .consultation-requirement{margin-top:10px;border-radius:10px;padding:10px 11px;font-size:13px;line-height:1.45}
      .consultation-drug.priority .consultation-requirement{background:#fff8e8;color:#6f4b0a}
      .consultation-drug.monitoring .consultation-requirement{background:#edf7fd;color:#315d79}
      .consultation-workflow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px;counter-reset:consult-step}
      .consultation-workflow article{position:relative;border:1px solid var(--line);border-radius:13px;background:#fff;padding:14px 12px 12px 45px;min-height:92px;line-height:1.45}
      .consultation-workflow article:before{counter-increment:consult-step;content:counter(consult-step);position:absolute;left:12px;top:13px;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#0b79bb;color:#fff;font-weight:800;font-size:12px}
      .consultation-workflow b{display:block;color:#075d98;margin-bottom:4px}
      .consultation-source-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}
      .consultation-source{border:1px solid var(--line);border-radius:13px;background:#fbfdff;padding:14px}
      .consultation-source h3{margin:0 0 7px;color:#075d98;font-size:16px}
      .consultation-source p{margin:0 0 10px;color:var(--muted);font-size:13px;line-height:1.5}
      .consultation-empty{grid-column:1/-1;border:1px dashed #bad4e5;border-radius:13px;padding:22px;text-align:center;color:var(--muted)}
      @media(max-width:900px){.consultation-workflow{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:720px){
        .consultation-summary,.consultation-filters,.consultation-list,.consultation-source-grid,.consultation-workflow{grid-template-columns:1fr}
        .consultation-summary{gap:8px}
        .consultation-summary article{display:flex;align-items:center;gap:12px}
        .consultation-summary span{margin-top:0}
        .consultation-drug-head{display:block}
        .consultation-badge{margin-top:8px;white-space:normal}
      }
    `;
    document.head.appendChild(style);
  }

  function installFeatureCard() {
    const grid = document.querySelector('#view-home .feature-grid');
    if (!grid || grid.querySelector('[data-open="' + MODULE_ID + '"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'feature-card consultation-feature';
    button.dataset.open = MODULE_ID;
    button.innerHTML = '<span class="feature-icon">👥</span><b>Kháng sinh cần hội chẩn khi dùng</b><small>Tra cứu thuốc ưu tiên quản lý cần hội chẩn/phê duyệt và nhóm cần theo dõi, giám sát sử dụng.</small><em>Danh mục dự thảo nội bộ</em>';
    const anchor = grid.querySelector('[data-open="interactions"]');
    grid.insertBefore(button, anchor || null);
    button.addEventListener('click', () => openView(MODULE_ID));
  }

  function installView() {
    if (document.getElementById('view-' + MODULE_ID)) return;
    const view = document.createElement('section');
    view.className = 'view';
    view.id = 'view-' + MODULE_ID;
    view.innerHTML = `
      <div class="back-home-wrap">
        <button type="button" class="back-home-btn consultation-back" aria-label="Quay lại Trang chủ"><span aria-hidden="true">←</span> Quay lại Trang chủ</button>
      </div>
      <div class="page-title"><div>
        <span class="kicker">Quản lý sử dụng kháng sinh</span>
        <h1>Danh mục kháng sinh cần hội chẩn khi sử dụng</h1>
        <p>Đối chiếu tự động với từng biệt dược trong danh mục kháng sinh nội trú của Bệnh viện VPMED Tân Hưng.</p>
      </div></div>
      <section class="section-card consultation-status">
        <strong>Trạng thái: Dự thảo danh mục nội bộ.</strong> Danh sách và quy trình hội chẩn chỉ được áp dụng chính thức sau khi Ban quản lý sử dụng kháng sinh, Hội đồng Thuốc và Điều trị và Giám đốc bệnh viện phê duyệt. Không dùng mục này để tự động cấp quyền sử dụng thuốc.
      </section>
      <section class="section-card compact">
        <div class="consultation-summary">
          <article><strong id="consultationPriorityCount">0</strong><span>biệt dược dự thảo cần hội chẩn/phê duyệt</span></article>
          <article><strong id="consultationMonitoringCount">0</strong><span>biệt dược thuộc nhóm cần theo dõi, giám sát</span></article>
          <article><strong id="consultationTotalCount">0</strong><span>kháng sinh nội trú đã được đối chiếu</span></article>
        </div>
        <div class="consultation-filters">
          <label>Tìm biệt dược hoặc hoạt chất<input id="consultationQ" placeholder="Ví dụ: Meropenem, Vancomycin..."></label>
          <label>Phân loại<select id="consultationGroup"><option value="priority">Cần hội chẩn/phê duyệt</option><option value="monitoring">Cần theo dõi, giám sát</option><option value="all">Tất cả nhóm quản lý</option></select></label>
        </div>
        <div class="consultation-list" id="consultationList"></div>
      </section>
      <section class="section-card">
        <div class="section-heading"><div><span class="kicker">Quy trình đề xuất</span><h2>Các bước trước và sau khi sử dụng</h2></div></div>
        <div class="consultation-workflow">
          <article><b>1. Hoàn thành thông tin</b>Ghi chẩn đoán, chỉ định, phác đồ trước đó, chức năng thận, vi sinh và lý do chọn kháng sinh.</article>
          <article><b>2. Hội chẩn/phê duyệt</b>Thực hiện trước khi dùng. Cấp cứu hoặc ngoài giờ: hoàn thiện phê duyệt trong vòng 24–48 giờ.</article>
          <article><b>3. Đánh giá lại</b>Rà soát đáp ứng lâm sàng và kết quả vi sinh sau 48–72 giờ; xuống thang hoặc ngừng khi phù hợp.</article>
          <article><b>4. Duyệt tiếp nếu cần</b>Mỗi lần duyệt không quá 14 ngày; đánh giá lại trước khi tiếp tục điều trị.</article>
        </div>
        <div class="alert" style="margin-top:14px"><b>Người duyệt:</b> do Ban quản lý sử dụng kháng sinh phân công bằng văn bản; ưu tiên dược sĩ làm công tác dược lâm sàng, bác sĩ hồi sức tích cực hoặc bác sĩ có kinh nghiệm điều trị nhiễm trùng và sử dụng kháng sinh hợp lý.</div>
      </section>
      <section class="section-card">
        <div class="section-heading"><div><span class="kicker">Nguồn đối chiếu</span><h2>Căn cứ xây dựng danh mục</h2></div></div>
        <div class="consultation-source-grid">
          <article class="consultation-source"><h3>Quyết định 5631/QĐ-BYT</h3><p>Hướng dẫn thực hiện quản lý sử dụng kháng sinh trong bệnh viện; Phụ lục 2 quy định Nhóm 1 ưu tiên quản lý và Nhóm 2 cần theo dõi, giám sát.</p><a class="btn btn-soft" target="_blank" rel="noopener" href="${SOURCE_5631}">Mở văn bản</a></article>
          <article class="consultation-source"><h3>Quyết định 2115/QĐ-BYT năm 2023</h3><p>Sổ tay hướng dẫn triển khai chương trình quản lý sử dụng kháng sinh dành cho bệnh viện tuyến huyện; có quy trình, phiếu và tiêu chí phê duyệt tham khảo.</p><a class="btn btn-soft" target="_blank" rel="noopener" href="${SOURCE_2115}">Mở sổ tay</a></article>
        </div>
        <div class="source-note"><b>Ngày đối chiếu:</b> 13/07/2026. Danh mục thuốc hiển thị được lấy trực tiếp từ dữ liệu kháng sinh nội trú đang có trên website; khi danh mục nội trú thay đổi, hệ thống tự nhận diện các hoạt chất phù hợp với quy tắc quản lý nêu trên.</div>
      </section>
    `;
    const anchor = document.getElementById('view-interactions');
    const main = document.querySelector('main');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(view, anchor);
    else if (main) main.appendChild(view);
    view.querySelector('.consultation-back').addEventListener('click', () => openView('home'));
  }

  function render() {
    const drugs = (window.VPMED_DRUGS || []).map(classifyDrug).filter(Boolean);
    const priority = drugs.filter(drug => drug.consultationGroup === 'priority');
    const monitoring = drugs.filter(drug => drug.consultationGroup === 'monitoring');
    const total = (window.VPMED_DRUGS || []).length;
    const priorityCount = document.getElementById('consultationPriorityCount');
    const monitoringCount = document.getElementById('consultationMonitoringCount');
    const totalCount = document.getElementById('consultationTotalCount');
    if (priorityCount) priorityCount.textContent = priority.length;
    if (monitoringCount) monitoringCount.textContent = monitoring.length;
    if (totalCount) totalCount.textContent = total;

    const input = document.getElementById('consultationQ');
    const select = document.getElementById('consultationGroup');
    const list = document.getElementById('consultationList');
    if (!input || !select || !list) return;

    const draw = () => {
      const query = norm(input.value);
      const group = select.value;
      const filtered = drugs.filter(drug => {
        const matchesGroup = group === 'all' || drug.consultationGroup === group;
        const searchable = norm([drug.brand, drug.active, drug.strength, drug.route, drug.consultationRule.label].join(' '));
        return matchesGroup && (!query || searchable.includes(query));
      });
      list.innerHTML = filtered.map((drug, index) => {
        const isPriority = drug.consultationGroup === 'priority';
        const badge = isPriority ? 'Cần hội chẩn/phê duyệt' : 'Theo dõi, giám sát';
        const requirement = isPriority
          ? '<b>Yêu cầu dự thảo:</b> Hội chẩn/phê duyệt trước khi sử dụng; trường hợp cấp cứu/ngoài giờ hoàn thiện trong 24–48 giờ.'
          : '<b>Yêu cầu:</b> Theo dõi tiêu thụ, tính hợp lý, độc tính và đề kháng; không mặc định đồng nghĩa bắt buộc hội chẩn.';
        return `
          <article class="consultation-drug ${drug.consultationGroup}">
            <div class="consultation-drug-head"><div><small>STT ${index + 1}</small><h3>${esc(drug.brand)}</h3></div><span class="consultation-badge ${drug.consultationGroup}">${badge}</span></div>
            <p><b>Hoạt chất:</b> ${esc(drug.active)}</p>
            <div class="consultation-meta"><span>${esc(drug.strength)}</span><span>${esc(drug.route)}</span><span>${esc(drug.consultationRule.label)}</span></div>
            <small>${esc(drug.consultationRule.basis)}</small>
            <div class="consultation-requirement">${requirement}</div>
          </article>`;
      }).join('') || '<div class="consultation-empty">Không tìm thấy kháng sinh phù hợp trong danh mục nội trú hiện tại.</div>';
    };
    input.addEventListener('input', draw);
    select.addEventListener('change', draw);
    draw();
  }

  function init() {
    if (document.getElementById('view-' + MODULE_ID)) return;
    installStyles();
    installFeatureCard();
    installView();
    render();
    if (location.hash === '#' + MODULE_ID) openView(MODULE_ID);
    window.addEventListener('hashchange', () => {
      if (location.hash === '#' + MODULE_ID) openView(MODULE_ID);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
