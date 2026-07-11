(() => {
  'use strict';

  const VIEW_NAME = 'pharmacovigilance';
  const STATIC_DATA_URL = 'assets/pharmacovigilance_alerts.json';
  const AUTO_DATA_URL = 'assets/pharmacovigilance_auto.json';
  const LEVEL_NAMES = {
    red: 'Khẩn cấp',
    orange: 'Quan trọng',
    yellow: 'Theo dõi',
    green: 'Thông tin'
  };

  const STYLE = `
    :host{display:block;--blue:#075f9f;--navy:#0b3553;--cyan:#e9f6fd;--bg:#f3f7fa;
      --white:#fff;--text:#17212b;--muted:#62717d;--line:#d8e2e8;--red:#ba1a1a;
      --redbg:#fff0f0;--orange:#a34f00;--orangebg:#fff5e8;--yellow:#7a5b00;
      --yellowbg:#fff9df;--green:#137149;--greenbg:#eaf8f1;--shadow:0 10px 28px rgba(10,57,86,.10)}
    *{box-sizing:border-box}.pv-root{margin:0;background:var(--bg);color:var(--text);font-family:Arial,"Segoe UI",sans-serif;line-height:1.48;padding-bottom:64px}
    button,input,select{font:inherit}a{color:var(--blue)}.wrap{max-width:1440px;margin:auto;padding:18px}
    .hero{background:linear-gradient(135deg,#064f85,#0879b9 62%,#38a6d5);color:#fff;border-radius:22px;padding:24px;box-shadow:var(--shadow);display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center}
    .hero h1{margin:3px 0 8px;font-size:30px;line-height:1.15}.hero p{margin:0;max-width:880px;color:#e9f8ff}.eyebrow{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.09em;color:#cceeff}
    .hero-badge{min-width:220px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.30);border-radius:17px;padding:15px;text-align:center}.hero-badge b{display:block;font-size:24px}.hero-badge small{color:#e9f8ff}
    .notice{margin-top:14px;background:#fff;border-left:6px solid var(--blue);border-radius:13px;padding:12px 15px;box-shadow:0 5px 18px rgba(10,57,86,.06)}.notice b{color:var(--blue)}.sync-note{display:block;margin-top:5px;color:var(--muted);font-size:12px}
    .toolbar{margin-top:16px;background:#fff;border:1px solid var(--line);border-radius:17px;padding:14px;box-shadow:0 5px 18px rgba(10,57,86,.05)}
    .search-row{display:grid;grid-template-columns:minmax(280px,1.8fr) repeat(3,minmax(150px,.7fr)) auto;gap:10px}.field{width:100%;border:1px solid #c9d7df;border-radius:11px;padding:11px 12px;background:#fff;color:var(--text);outline:none}.field:focus{border-color:#4ba2d1;box-shadow:0 0 0 3px rgba(45,148,202,.12)}
    .btn{border:0;border-radius:11px;padding:10px 14px;font-weight:800;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:7px}.btn-soft{background:var(--cyan);color:var(--blue)}
    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}.stat{background:#f8fbfd;border:1px solid var(--line);border-radius:12px;padding:10px 12px}.stat b{display:block;font-size:20px;color:var(--navy)}.stat span{font-size:12px;color:var(--muted)}
    .layout{display:grid;grid-template-columns:250px minmax(0,1fr);gap:16px;margin-top:16px;align-items:start}.side{position:sticky;top:78px;background:#fff;border:1px solid var(--line);border-radius:17px;padding:14px;box-shadow:0 5px 18px rgba(10,57,86,.05)}
    .side h3{margin:0 0 10px;color:var(--navy);font-size:16px}.side button{width:100%;text-align:left;border:0;background:#fff;border-radius:10px;padding:9px 10px;margin:2px 0;cursor:pointer;color:#33434f}.side button:hover,.side button.active{background:var(--cyan);color:var(--blue);font-weight:800}.side hr{border:0;border-top:1px solid var(--line);margin:12px 0}
    .legend{display:flex;align-items:flex-start;gap:8px;font-size:13px;margin:8px 0}.dot{width:11px;height:11px;border-radius:50%;flex:0 0 auto;margin-top:4px}.dot.red{background:var(--red)}.dot.orange{background:#d76b00}.dot.yellow{background:#c89b00}.dot.green{background:var(--green)}
    .main-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:10px}.main-head h2{margin:0;color:var(--navy);font-size:21px}.main-head p{margin:3px 0 0;color:var(--muted);font-size:13px}.result-count{font-weight:800;color:var(--blue);white-space:nowrap}
    .cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.card{background:#fff;border:1px solid var(--line);border-radius:17px;overflow:hidden;box-shadow:0 5px 18px rgba(10,57,86,.05);display:flex;flex-direction:column;min-height:282px}.card-top{height:5px}.card-top.red{background:var(--red)}.card-top.orange{background:#d76b00}.card-top.yellow{background:#c89b00}.card-top.green{background:var(--green)}
    .card-body{padding:15px;display:flex;flex-direction:column;height:100%}.meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px}.pill{border-radius:999px;padding:4px 8px;font-size:11px;font-weight:900}.pill.red{background:var(--redbg);color:var(--red)}.pill.orange{background:var(--orangebg);color:var(--orange)}.pill.yellow{background:var(--yellowbg);color:var(--yellow)}.pill.green{background:var(--greenbg);color:var(--green)}.pill.gray{background:#eef3f6;color:#566671}.pill.auto{background:#e8f3ff;color:#075f9f;border:1px solid #bddcf0}
    .card h3{margin:0 0 7px;font-size:18px;line-height:1.3;color:#102f45}.drug{font-size:13px;color:var(--blue);font-weight:800;margin-bottom:8px}.summary{font-size:14px;color:#364650;margin:0 0 11px}.quick{background:#f7fafc;border-radius:11px;padding:9px 10px;font-size:13px;margin-bottom:12px}.quick b{color:var(--navy)}
    .card-foot{margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:9px;border-top:1px solid #e5ecef;padding-top:10px}.date{font-size:12px;color:var(--muted)}.detail-btn{border:0;background:var(--cyan);color:var(--blue);font-weight:900;border-radius:10px;padding:8px 10px;cursor:pointer}.empty{background:#fff;border:1px dashed #adc1cc;border-radius:16px;padding:35px;text-align:center;color:var(--muted);grid-column:1/-1}
    .modal{position:fixed;inset:0;background:rgba(7,28,42,.58);z-index:100;display:none;align-items:center;justify-content:center;padding:18px}.modal.open{display:flex}.modal-panel{background:#fff;border-radius:20px;max-width:980px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 24px 70px rgba(0,0,0,.28)}
    .modal-head{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--line);padding:15px 18px;display:flex;justify-content:space-between;gap:15px;align-items:flex-start;z-index:2}.modal-head h2{margin:4px 0 0;font-size:23px;line-height:1.25;color:var(--navy)}.close{width:38px;height:38px;border-radius:50%;border:0;background:#edf3f6;cursor:pointer;font-size:20px}
    .modal-body{padding:18px}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.box{border:1px solid var(--line);border-radius:14px;padding:13px;background:#fff}.box h4{margin:0 0 8px;color:var(--navy)}.box p{margin:6px 0}.box ul{margin:0;padding-left:20px}.box li{margin:5px 0}.box.full{grid-column:1/-1}.alert-box{border-left:5px solid var(--red);background:var(--redbg)}.auto-box{border-left-color:var(--blue);background:#f1f8fd}.source-box{background:#f6fafc}.source-link{word-break:break-word}.source-link a{font-weight:800}
    .fixed-note{position:fixed;left:0;right:0;bottom:0;z-index:90;background:#fff7f7;border-top:2px solid #d43c3c;padding:9px 16px;text-align:center;color:#7b1c1c;font-size:13px;font-weight:800;box-shadow:0 -4px 14px rgba(80,0,0,.08)}
    @media(max-width:1050px){.search-row{grid-template-columns:1fr 1fr}.search-row .search{grid-column:1/-1}.layout{grid-template-columns:1fr}.side{position:static}.side .category-list{display:flex;overflow:auto;gap:5px}.side button{width:auto;white-space:nowrap}.cards{grid-template-columns:1fr 1fr}}
    @media(max-width:760px){.wrap{padding:10px}.hero{grid-template-columns:1fr;padding:18px}.hero h1{font-size:24px}.hero-badge{min-width:0}.search-row{grid-template-columns:1fr}.search-row .search{grid-column:auto}.stats{grid-template-columns:1fr 1fr}.cards{grid-template-columns:1fr}.detail-grid{grid-template-columns:1fr}.box.full{grid-column:auto}.main-head{align-items:flex-start;flex-direction:column}.fixed-note{font-size:11px;padding:7px 9px}}
  `;

  const TEMPLATE = `
    <div class="pv-root">
      <main class="wrap">
        <section class="hero">
          <div>
            <div class="eyebrow">Thông tin thuốc và cảnh giác dược</div>
            <h1>Cảnh báo dược về sử dụng thuốc</h1>
            <p>Tra cứu cảnh báo an toàn thuốc, ADR, tương tác và các bản tin mới từ nguồn chính thức.</p>
          </div>
          <div class="hero-badge"><b id="heroCount">Đang tải…</b><small id="latestDate">Đang kiểm tra dữ liệu</small></div>
        </section>
        <div class="notice">
          <b>Phạm vi:</b> Thư viện hỗ trợ tra cứu và rà soát an toàn thuốc, không phải biểu mẫu báo cáo ADR.
          <span class="sync-note" id="syncNote">Dữ liệu biên tập được giữ nguyên; bản tin mới được kiểm tra tự động và gắn nhãn riêng.</span>
        </div>
        <section class="toolbar" aria-label="Công cụ tìm kiếm">
          <div class="search-row">
            <input id="searchInput" class="field search" type="search" placeholder="Tìm theo thuốc, ADR, tương tác hoặc dấu hiệu…" autocomplete="off">
            <select id="levelFilter" class="field" aria-label="Lọc theo mức độ">
              <option value="">Tất cả mức độ</option><option value="red">Khẩn cấp</option><option value="orange">Quan trọng</option><option value="yellow">Theo dõi</option><option value="green">Thông tin</option>
            </select>
            <select id="systemFilter" class="field" aria-label="Lọc theo hệ cơ quan"><option value="">Tất cả hệ cơ quan</option></select>
            <select id="yearFilter" class="field" aria-label="Lọc theo năm"><option value="">Tất cả năm</option></select>
            <button id="resetBtn" class="btn btn-soft" type="button">Đặt lại</button>
          </div>
          <div class="stats">
            <div class="stat"><b id="totalStat">0</b><span>Tổng cảnh báo</span></div>
            <div class="stat"><b id="redStat">0</b><span>Mức khẩn cấp</span></div>
            <div class="stat"><b id="interactionStat">0</b><span>Cảnh báo tương tác</span></div>
            <div class="stat"><b id="latestStat">0</b><span id="latestStatLabel">Bản tin mới nhất</span></div>
          </div>
        </section>
        <section class="layout">
          <aside class="side">
            <h3>Nhóm cảnh báo</h3><div id="categoryList" class="category-list"></div><hr>
            <h3>Mức ưu tiên</h3>
            <div class="legend"><span class="dot red"></span><span><b>Khẩn cấp:</b> cần đánh giá hoặc xử trí ngay</span></div>
            <div class="legend"><span class="dot orange"></span><span><b>Quan trọng:</b> cần rà soát sớm</span></div>
            <div class="legend"><span class="dot yellow"></span><span><b>Theo dõi:</b> cần giám sát phù hợp</span></div>
            <div class="legend"><span class="dot green"></span><span><b>Thông tin:</b> lưu ý thực hành</span></div>
          </aside>
          <section>
            <div class="main-head"><div><h2>Các cảnh báo đang hiển thị</h2><p>Nhấn “Xem chi tiết” để mở nội dung và nguồn gốc.</p></div><div id="resultCount" class="result-count"></div></div>
            <div id="cards" class="cards"><div class="empty">Đang tải dữ liệu…</div></div>
          </section>
        </section>
      </main>
      <div id="modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-panel"><div class="modal-head"><div><div id="modalMeta" class="meta"></div><h2 id="modalTitle"></h2></div><button id="closeModal" class="close" type="button" aria-label="Đóng">×</button></div><div id="modalBody" class="modal-body"></div></div>
      </div>
      <div class="fixed-note">Thông tin chỉ hỗ trợ tra cứu; không thay thế tờ hướng dẫn sử dụng được phê duyệt, chẩn đoán, xử trí cấp cứu hoặc quyết định chuyên môn của bác sĩ.</div>
    </div>`;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));

  function unwrapAlerts(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.alerts)) return payload.alerts;
    return [];
  }

  function parseDate(value) {
    const match = String(value || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!match) return new Date(0);
    return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  }

  function normalizeUrl(value) {
    return String(value || '').trim().replace(/^http:/i, 'https:').replace(/\/$/, '').toLowerCase();
  }

  function mergeAlerts(staticAlerts, autoAlerts) {
    const merged = [];
    const seenIds = new Set();
    const seenUrls = new Set();
    const seenTitles = new Set();
    [...staticAlerts, ...autoAlerts].forEach((raw) => {
      if (!raw || typeof raw !== 'object') return;
      const item = { ...raw };
      const id = String(item.id || '').trim();
      const url = normalizeUrl(item.url);
      const title = String(item.title || '').trim().toLowerCase();
      if ((id && seenIds.has(id)) || (url && seenUrls.has(url)) || (title && seenTitles.has(title))) return;
      item.level = ['red', 'orange', 'yellow', 'green'].includes(item.level) ? item.level : 'green';
      item.category = item.category || 'Bản tin mới từ nguồn chính thức';
      item.system = item.system || 'Chưa phân loại';
      item.year = String(item.year || (parseDate(item.date).getFullYear() || ''));
      item.risk = Array.isArray(item.risk) ? item.risk : [];
      item.signs = Array.isArray(item.signs) ? item.signs : [];
      item.action = Array.isArray(item.action) ? item.action : [];
      item.monitor = Array.isArray(item.monitor) ? item.monitor : [];
      item.auto = Boolean(item.auto || item.reviewed === false);
      if (id) seenIds.add(id);
      if (url) seenUrls.add(url);
      if (title) seenTitles.add(title);
      merged.push(item);
    });
    return merged.sort((a, b) => parseDate(b.date) - parseDate(a.date));
  }

  class VpmedPharmacovigilance extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.alerts = [];
      this.activeCategory = 'Tất cả';
      this.abortController = null;
    }

    connectedCallback() {
      this.shadowRoot.innerHTML = `<style>${STYLE}</style>${TEMPLATE}`;
      this.bindEvents();
      this.loadData();
    }

    disconnectedCallback() {
      this.abortController?.abort();
    }

    $(selector) { return this.shadowRoot.querySelector(selector); }
    $$(selector) { return Array.from(this.shadowRoot.querySelectorAll(selector)); }
    normalize(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

    async fetchJson(url, required = false) {
      try {
        const response = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store', signal: this.abortController.signal });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return await response.json();
      } catch (error) {
        if (required) throw error;
        return null;
      }
    }

    async loadData() {
      this.abortController = new AbortController();
      try {
        const [staticPayload, autoPayload] = await Promise.all([
          this.fetchJson(STATIC_DATA_URL, true),
          this.fetchJson(AUTO_DATA_URL, false)
        ]);
        const staticAlerts = unwrapAlerts(staticPayload);
        const autoAlerts = unwrapAlerts(autoPayload);
        this.alerts = mergeAlerts(staticAlerts, autoAlerts);
        if (!this.alerts.length) throw new Error('Không có dữ liệu cảnh báo');
        this.populateFilters();
        this.renderCategories();
        this.updateStats();
        this.render();
        const autoCount = this.alerts.filter((item) => item.auto).length;
        this.$('#syncNote').textContent = autoPayload
          ? `Đã kết hợp ${staticAlerts.length} cảnh báo biên tập và ${autoCount} bản tin tự động từ nguồn chính thức.`
          : 'Dữ liệu biên tập đang hoạt động; tệp bản tin tự động chưa được tạo hoặc tạm thời chưa tải được.';
        this.updateFeatureCard();
      } catch (error) {
        this.$('#cards').innerHTML = '<div class="empty"><b>Không tải được dữ liệu cảnh báo.</b><br>Vui lòng tải lại trang hoặc kiểm tra các tệp dữ liệu trong thư mục assets.</div>';
        this.$('#syncNote').textContent = `Lỗi tải dữ liệu: ${error.message}`;
      }
    }

    bindEvents() {
      ['searchInput', 'levelFilter', 'systemFilter', 'yearFilter'].forEach((id) => {
        const eventName = id === 'searchInput' ? 'input' : 'change';
        this.$(`#${id}`).addEventListener(eventName, () => this.render());
      });
      this.$('#resetBtn').addEventListener('click', () => {
        this.$('#searchInput').value = '';
        this.$('#levelFilter').value = '';
        this.$('#systemFilter').value = '';
        this.$('#yearFilter').value = '';
        this.activeCategory = 'Tất cả';
        this.renderCategories();
        this.render();
      });
      this.$('#closeModal').addEventListener('click', () => this.closeModal());
      this.$('#modal').addEventListener('click', (event) => { if (event.target === this.$('#modal')) this.closeModal(); });
      this.onKeydown = (event) => { if (event.key === 'Escape') this.closeModal(); };
      document.addEventListener('keydown', this.onKeydown);
    }

    populateFilters() {
      const systems = [...new Set(this.alerts.flatMap((item) => String(item.system || '').split('·').map((value) => value.trim())).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
      this.$('#systemFilter').innerHTML = '<option value="">Tất cả hệ cơ quan</option>' + systems.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
      const years = [...new Set(this.alerts.map((item) => String(item.year || '')).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
      this.$('#yearFilter').innerHTML = '<option value="">Tất cả năm</option>' + years.map((year) => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`).join('');
    }

    renderCategories() {
      const categories = ['Tất cả', ...new Set(this.alerts.map((item) => item.category).filter(Boolean))];
      this.$('#categoryList').innerHTML = categories.map((category) => `<button type="button" class="${category === this.activeCategory ? 'active' : ''}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('');
      this.$$('#categoryList button').forEach((button) => button.addEventListener('click', () => {
        this.activeCategory = button.dataset.category;
        this.renderCategories();
        this.render();
      }));
    }

    getFiltered() {
      const query = this.normalize(this.$('#searchInput').value);
      const level = this.$('#levelFilter').value;
      const system = this.$('#systemFilter').value;
      const year = this.$('#yearFilter').value;
      return this.alerts.filter((item) => {
        const haystack = this.normalize([item.title, item.drugs, item.summary, item.quick, item.category, item.system, ...(item.risk || []), ...(item.signs || []), ...(item.action || []), ...(item.monitor || [])].join(' '));
        return (!query || haystack.includes(query)) && (!level || item.level === level) && (!system || String(item.system || '').includes(system)) && (!year || String(item.year) === year) && (this.activeCategory === 'Tất cả' || item.category === this.activeCategory);
      });
    }

    render() {
      const list = this.getFiltered();
      this.$('#resultCount').textContent = `${list.length}/${this.alerts.length} cảnh báo`;
      this.$('#cards').innerHTML = list.length ? list.map((item) => `
        <article class="card"><div class="card-top ${escapeHtml(item.level)}"></div><div class="card-body">
          <div class="meta"><span class="pill ${escapeHtml(item.level)}">${escapeHtml(LEVEL_NAMES[item.level] || item.level)}</span><span class="pill gray">${escapeHtml(item.category)}</span>${item.interaction ? '<span class="pill gray">Tương tác</span>' : ''}${item.auto ? '<span class="pill auto">Tự động từ nguồn</span>' : ''}</div>
          <h3>${escapeHtml(item.title)}</h3><div class="drug">${escapeHtml(item.drugs || 'Xem nguồn gốc để xác định thuốc/nhóm thuốc')}</div><p class="summary">${escapeHtml(item.summary || '')}</p>
          <div class="quick"><b>${item.auto ? 'Trạng thái:' : 'Điểm cần nhớ:'}</b> ${escapeHtml(item.quick || '')}</div>
          <div class="card-foot"><span class="date">${escapeHtml(item.date || 'Chưa rõ ngày')} · ${escapeHtml(item.source || '')}</span><button class="detail-btn" data-id="${escapeHtml(item.id)}" type="button">Xem chi tiết</button></div>
        </div></article>`).join('') : '<div class="empty"><b>Không tìm thấy cảnh báo phù hợp.</b><br>Hãy đổi từ khóa hoặc đặt lại bộ lọc.</div>';
      this.$$('.detail-btn').forEach((button) => button.addEventListener('click', () => this.openDetail(button.dataset.id)));
    }

    listHtml(items, emptyText) {
      const safeItems = Array.isArray(items) && items.length ? items : [emptyText];
      return `<ul>${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    }

    openDetail(id) {
      const item = this.alerts.find((entry) => entry.id === id);
      if (!item) return;
      this.$('#modalMeta').innerHTML = `<span class="pill ${escapeHtml(item.level)}">${escapeHtml(LEVEL_NAMES[item.level] || item.level)}</span><span class="pill gray">${escapeHtml(item.category)}</span><span class="pill gray">${escapeHtml(item.date || 'Chưa rõ ngày')}</span>${item.auto ? '<span class="pill auto">Tự động từ nguồn · Chưa biên tập</span>' : ''}`;
      this.$('#modalTitle').textContent = item.title;
      const autoNotice = item.auto ? '<div class="box full alert-box auto-box"><h4>Bản tin tự động – chưa biên tập chuyên môn</h4><p>Nội dung này được ghi nhận tự động từ nguồn chính thức. Dược sĩ cần mở bài gốc, rà soát và biên tập trước khi sử dụng làm nội dung chuyên môn hoặc hỗ trợ quyết định lâm sàng.</p></div>' : '';
      this.$('#modalBody').innerHTML = `<div class="detail-grid">
        ${autoNotice}
        <div class="box full alert-box"><h4>Thông tin cảnh báo</h4><p><b>Thuốc/nhóm thuốc:</b> ${escapeHtml(item.drugs || 'Chưa biên tập')}</p><p>${escapeHtml(item.summary || '')}</p><p><b>${item.auto ? 'Trạng thái:' : 'Điểm cần nhớ:'}</b> ${escapeHtml(item.quick || '')}</p></div>
        <div class="box"><h4>Đối tượng và yếu tố nguy cơ</h4>${this.listHtml(item.risk, 'Chưa được phân loại trong bản tin tự động.')}</div>
        <div class="box"><h4>Dấu hiệu cần nhận biết</h4>${this.listHtml(item.signs, 'Mở nguồn gốc để đọc nội dung đầy đủ.')}</div>
        <div class="box"><h4>Hành động cần xem xét</h4>${this.listHtml(item.action, 'Dược sĩ rà soát trước khi đưa ra khuyến nghị.')}</div>
        <div class="box"><h4>Nội dung cần theo dõi</h4>${this.listHtml(item.monitor, 'Chưa được biên tập.')}</div>
        <div class="box full source-box"><h4>Nguồn thông tin</h4><p><b>${escapeHtml(item.source || 'Nguồn chính thức')}</b></p><p class="source-link"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Mở nội dung gốc ↗</a></p></div>
      </div>`;
      this.$('#modal').classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    closeModal() {
      this.$('#modal')?.classList.remove('open');
      document.body.style.overflow = '';
    }

    latestDateText() {
      const latest = this.alerts.reduce((best, item) => parseDate(item.date) > parseDate(best?.date) ? item : best, null);
      return latest?.date || 'Chưa rõ ngày';
    }

    updateStats() {
      const latest = this.alerts[0];
      const latestYear = latest?.year || '';
      this.$('#heroCount').textContent = `${this.alerts.length} cảnh báo`;
      this.$('#latestDate').textContent = `Cập nhật đến ${this.latestDateText()}`;
      this.$('#totalStat').textContent = this.alerts.length;
      this.$('#redStat').textContent = this.alerts.filter((item) => item.level === 'red').length;
      this.$('#interactionStat').textContent = this.alerts.filter((item) => item.interaction).length;
      this.$('#latestStat').textContent = latestYear ? this.alerts.filter((item) => String(item.year) === String(latestYear)).length : 0;
      this.$('#latestStatLabel').textContent = latestYear ? `Cập nhật năm ${latestYear}` : 'Bản tin mới nhất';
    }

    updateFeatureCard() {
      const card = document.querySelector('[data-open="pharmacovigilance"]');
      if (!card) return;
      const small = card.querySelector('small');
      const em = card.querySelector('em');
      if (small) small.textContent = `Tra cứu ${this.alerts.length} cảnh báo an toàn thuốc, ADR, tương tác và bản tin mới.`;
      if (em) em.textContent = `Cập nhật ${this.latestDateText()}`;
    }
  }

  function showView(name) {
    const target = document.getElementById(`view-${name}`);
    if (!target) return;
    document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
    target.classList.add('active');
    document.querySelectorAll('.main-nav button').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
    history.replaceState(null, '', `#${name}`);
    document.getElementById('mainNav')?.classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function install() {
    if (!customElements.get('vpmed-pharmacovigilance')) customElements.define('vpmed-pharmacovigilance', VpmedPharmacovigilance);

    const grid = document.querySelector('#view-home .feature-grid') || document.querySelector('.feature-grid');
    if (grid && !grid.querySelector('[data-open="pharmacovigilance"]')) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'feature-card pharmacovigilance-feature';
      card.dataset.open = VIEW_NAME;
      card.dataset.introExclude = 'true';
      card.innerHTML = '<span class="feature-icon">⚕️</span><b>Cảnh báo dược về sử dụng thuốc</b><small>Tra cứu cảnh báo an toàn thuốc, ADR, tương tác và bản tin mới từ nguồn chính thức.</small><em>Cập nhật tự động</em>';
      const sourceCard = grid.querySelector('[data-open="sources"]');
      if (sourceCard) grid.insertBefore(card, sourceCard); else grid.appendChild(card);
      card.addEventListener('click', () => showView(VIEW_NAME));
    }

    let section = document.getElementById(`view-${VIEW_NAME}`);
    if (!section) {
      section = document.createElement('section');
      section.className = 'view';
      section.id = `view-${VIEW_NAME}`;
      section.innerHTML = '<div class="back-home-wrap"><button type="button" class="back-home-btn" aria-label="Quay lại Trang chủ"><span aria-hidden="true">←</span> Quay lại Trang chủ</button></div><vpmed-pharmacovigilance></vpmed-pharmacovigilance>';
      const appShell = document.querySelector('.app-shell') || document.querySelector('main');
      const sourceView = document.getElementById('view-sources');
      if (sourceView?.parentNode) sourceView.parentNode.insertBefore(section, sourceView); else appShell?.appendChild(section);
      section.querySelector('.back-home-btn')?.addEventListener('click', () => showView('home'));
    }

    if (location.hash === `#${VIEW_NAME}`) showView(VIEW_NAME);
    window.addEventListener('hashchange', () => { if (location.hash === `#${VIEW_NAME}`) showView(VIEW_NAME); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
