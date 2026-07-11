(() => {
  'use strict';

  const STYLE = "\n    :host{display:block;\n      --blue:#075f9f;--blue2:#0a78ba;--navy:#0b3553;--cyan:#e9f6fd;\n      --bg:#f3f7fa;--white:#fff;--text:#17212b;--muted:#62717d;--line:#d8e2e8;\n      --red:#ba1a1a;--redbg:#fff0f0;--orange:#a34f00;--orangebg:#fff5e8;\n      --yellow:#7a5b00;--yellowbg:#fff9df;--green:#137149;--greenbg:#eaf8f1;\n      --shadow:0 10px 28px rgba(10,57,86,.10)\n    }\n    *{box-sizing:border-box}\n    .pv-root{margin:0;background:var(--bg);color:var(--text);font-family:Arial,\"Segoe UI\",sans-serif;line-height:1.48;padding-bottom:70px}\n    button,input,select{font:inherit}\n    a{color:var(--blue)}\n    .topbar{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.97);border-bottom:1px solid var(--line);backdrop-filter:blur(10px)}\n    .topbar-in{max-width:1440px;margin:auto;padding:10px 18px;display:flex;justify-content:space-between;align-items:center;gap:12px}\n    .brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--navy)}\n    .brand-mark{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,var(--blue),#31a6d7);display:grid;place-items:center;color:#fff;font-weight:900;font-size:20px;box-shadow:0 5px 14px rgba(7,95,159,.22)}\n    .brand strong{display:block;font-size:16px}.brand small{display:block;color:var(--muted);font-size:12px}\n    .btn{border:0;border-radius:11px;padding:10px 14px;font-weight:800;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:7px}\n    .btn-primary{background:var(--blue);color:#fff}.btn-soft{background:var(--cyan);color:var(--blue)}.btn-outline{background:#fff;border:1px solid #b8d4e5;color:var(--blue)}\n    .wrap{max-width:1440px;margin:auto;padding:18px}\n    .hero{background:linear-gradient(135deg,#064f85,#0879b9 62%,#38a6d5);color:#fff;border-radius:22px;padding:24px;box-shadow:var(--shadow);display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center}\n    .hero h1{margin:3px 0 8px;font-size:30px;line-height:1.15}.hero p{margin:0;max-width:940px;color:#e9f8ff}.eyebrow{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.09em;color:#cceeff}\n    .hero-badge{min-width:230px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.30);border-radius:17px;padding:15px;text-align:center}.hero-badge b{display:block;font-size:24px}.hero-badge small{color:#e9f8ff}\n    .notice{margin-top:14px;background:#fff;border-left:6px solid var(--blue);border-radius:13px;padding:12px 15px;box-shadow:0 5px 18px rgba(10,57,86,.06)}\n    .notice b{color:var(--blue)}\n    .toolbar{margin-top:16px;background:#fff;border:1px solid var(--line);border-radius:17px;padding:14px;box-shadow:0 5px 18px rgba(10,57,86,.05)}\n    .search-row{display:grid;grid-template-columns:minmax(280px,1.8fr) repeat(3,minmax(150px,.7fr)) auto;gap:10px}\n    .field{width:100%;border:1px solid #c9d7df;border-radius:11px;padding:11px 12px;background:#fff;color:var(--text);outline:none}.field:focus{border-color:#4ba2d1;box-shadow:0 0 0 3px rgba(45,148,202,.12)}\n    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}.stat{background:#f8fbfd;border:1px solid var(--line);border-radius:12px;padding:10px 12px}.stat b{display:block;font-size:20px;color:var(--navy)}.stat span{font-size:12px;color:var(--muted)}\n    .layout{display:grid;grid-template-columns:250px minmax(0,1fr);gap:16px;margin-top:16px;align-items:start}\n    .side{position:sticky;top:78px;background:#fff;border:1px solid var(--line);border-radius:17px;padding:14px;box-shadow:0 5px 18px rgba(10,57,86,.05)}\n    .side h3{margin:0 0 10px;color:var(--navy);font-size:16px}.side button{width:100%;text-align:left;border:0;background:#fff;border-radius:10px;padding:9px 10px;margin:2px 0;cursor:pointer;color:#33434f}.side button:hover,.side button.active{background:var(--cyan);color:var(--blue);font-weight:800}.side hr{border:0;border-top:1px solid var(--line);margin:12px 0}.legend{display:flex;align-items:center;gap:8px;font-size:13px;margin:8px 0}.dot{width:11px;height:11px;border-radius:50%;flex:0 0 auto}.dot.red{background:var(--red)}.dot.orange{background:#d76b00}.dot.yellow{background:#c89b00}.dot.green{background:var(--green)}\n    .main-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:10px}.main-head h2{margin:0;color:var(--navy);font-size:21px}.main-head p{margin:3px 0 0;color:var(--muted);font-size:13px}.result-count{font-weight:800;color:var(--blue);white-space:nowrap}\n    .cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}\n    .card{background:#fff;border:1px solid var(--line);border-radius:17px;overflow:hidden;box-shadow:0 5px 18px rgba(10,57,86,.05);display:flex;flex-direction:column;min-height:285px}.card-top{height:5px}.card-top.red{background:var(--red)}.card-top.orange{background:#d76b00}.card-top.yellow{background:#c89b00}.card-top.green{background:var(--green)}\n    .card-body{padding:15px;display:flex;flex-direction:column;height:100%}.meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px}.pill{border-radius:999px;padding:4px 8px;font-size:11px;font-weight:900}.pill.red{background:var(--redbg);color:var(--red)}.pill.orange{background:var(--orangebg);color:var(--orange)}.pill.yellow{background:var(--yellowbg);color:var(--yellow)}.pill.green{background:var(--greenbg);color:var(--green)}.pill.gray{background:#eef3f6;color:#566671}\n    .card h3{margin:0 0 7px;font-size:18px;line-height:1.3;color:#102f45}.drug{font-size:13px;color:var(--blue);font-weight:800;margin-bottom:8px}.summary{font-size:14px;color:#364650;margin:0 0 11px}.quick{background:#f7fafc;border-radius:11px;padding:9px 10px;font-size:13px;margin-bottom:12px}.quick b{color:var(--navy)}\n    .card-foot{margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:9px;border-top:1px solid #e5ecef;padding-top:10px}.date{font-size:12px;color:var(--muted)}.detail-btn{border:0;background:var(--cyan);color:var(--blue);font-weight:900;border-radius:10px;padding:8px 10px;cursor:pointer}\n    .empty{background:#fff;border:1px dashed #adc1cc;border-radius:16px;padding:35px;text-align:center;color:var(--muted);grid-column:1/-1}\n    .modal{position:fixed;inset:0;background:rgba(7,28,42,.58);z-index:100;display:none;align-items:center;justify-content:center;padding:18px}.modal.open{display:flex}.modal-panel{background:#fff;border-radius:20px;max-width:980px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 24px 70px rgba(0,0,0,.28)}\n    .modal-head{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--line);padding:15px 18px;display:flex;justify-content:space-between;gap:15px;align-items:flex-start;z-index:2}.modal-head h2{margin:4px 0 0;font-size:23px;line-height:1.25;color:var(--navy)}.close{width:38px;height:38px;border-radius:50%;border:0;background:#edf3f6;cursor:pointer;font-size:20px}\n    .modal-body{padding:18px}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.box{border:1px solid var(--line);border-radius:14px;padding:13px;background:#fff}.box h4{margin:0 0 8px;color:var(--navy)}.box ul{margin:0;padding-left:20px}.box li{margin:5px 0}.box.full{grid-column:1/-1}.alert-box{border-left:5px solid var(--red);background:var(--redbg)}.source-box{background:#f6fafc}.source-link{word-break:break-word}.source-link a{font-weight:800}\n    .fixed-note{position:fixed;left:0;right:0;bottom:0;z-index:90;background:#fff7f7;border-top:2px solid #d43c3c;padding:9px 16px;text-align:center;color:#7b1c1c;font-size:13px;font-weight:800;box-shadow:0 -4px 14px rgba(80,0,0,.08)}\n    @media(max-width:1050px){.search-row{grid-template-columns:1fr 1fr}.search-row .search{grid-column:1/-1}.layout{grid-template-columns:1fr}.side{position:static}.side .category-list{display:flex;overflow:auto;gap:5px}.side button{width:auto;white-space:nowrap}.cards{grid-template-columns:1fr 1fr}}\n    @media(max-width:760px){.wrap{padding:10px}.hero{grid-template-columns:1fr;padding:18px}.hero h1{font-size:24px}.hero-badge{min-width:0}.search-row{grid-template-columns:1fr}.search-row .search{grid-column:auto}.stats{grid-template-columns:1fr 1fr}.cards{grid-template-columns:1fr}.detail-grid{grid-template-columns:1fr}.box.full{grid-column:auto}.topbar-in{padding:8px 10px}.brand small{display:none}.fixed-note{font-size:11px;padding:7px 9px}}\n  ";
  const TEMPLATE = "<div class=\"pv-root\"><main class=\"wrap\">\n<section class=\"hero\">\n<div>\n<div class=\"eyebrow\">Thông tin thuốc và cảnh giác dược</div>\n<h1>Cảnh báo dược về sử dụng thuốc</h1>\n<p>Tra cứu cảnh báo an toàn thuốc cập nhật đến 11/07/2026: phản ứng có hại, tương tác, thuốc nguy cơ cao, sai sót sử dụng, theo dõi xét nghiệm, thai kỳ và biện pháp giảm thiểu nguy cơ.</p>\n</div>\n<div class=\"hero-badge\"><b id=\"heroCount\">0 cảnh báo</b><small>Cập nhật đến 11/07/2026</small></div>\n</section>\n<div class=\"notice\"><b>Phạm vi:</b> Đây là thư viện thông tin cảnh báo dược, không phải biểu mẫu báo cáo ADR. Nội dung ưu tiên nguồn của Trung tâm DI &amp; ADR Quốc gia và cơ quan quản lý dược.</div>\n<section aria-label=\"Công cụ tìm kiếm\" class=\"toolbar\">\n<div class=\"search-row\">\n<input autocomplete=\"off\" class=\"field search\" id=\"searchInput\" placeholder=\"Tìm theo hoạt chất, nhóm thuốc, ADR, dấu hiệu hoặc tương tác...\" type=\"search\"/>\n<select aria-label=\"Lọc theo mức độ\" class=\"field\" id=\"levelFilter\">\n<option value=\"\">Tất cả mức độ</option><option value=\"red\">Khẩn cấp</option><option value=\"orange\">Quan trọng</option><option value=\"yellow\">Theo dõi</option><option value=\"green\">Thông tin</option>\n</select>\n<select aria-label=\"Lọc theo hệ cơ quan\" class=\"field\" id=\"systemFilter\"><option value=\"\">Tất cả hệ cơ quan</option></select>\n<select aria-label=\"Lọc theo năm\" class=\"field\" id=\"yearFilter\"><option value=\"\">Tất cả năm</option><option value=\"2026\">2026</option><option value=\"2025\">2025</option></select>\n<button class=\"btn btn-soft\" id=\"resetBtn\" type=\"button\">Đặt lại</button>\n</div>\n<div class=\"stats\">\n<div class=\"stat\"><b id=\"totalStat\">0</b><span>Tổng cảnh báo</span></div>\n<div class=\"stat\"><b id=\"redStat\">0</b><span>Mức khẩn cấp</span></div>\n<div class=\"stat\"><b id=\"interactionStat\">0</b><span>Cảnh báo tương tác</span></div>\n<div class=\"stat\"><b id=\"latestStat\">0</b><span>Cập nhật năm 2026</span></div>\n</div>\n</section>\n<section class=\"layout\">\n<aside class=\"side\">\n<h3>Nhóm cảnh báo</h3>\n<div class=\"category-list\" id=\"categoryList\"></div>\n<hr/>\n<h3>Mức ưu tiên</h3>\n<div class=\"legend\"><span class=\"dot red\"></span><span><b>Khẩn cấp:</b> nguy cơ đe dọa tính mạng hoặc cần xử trí ngay</span></div>\n<div class=\"legend\"><span class=\"dot orange\"></span><span><b>Quan trọng:</b> cần rà soát sớm, chỉnh thuốc hoặc tăng theo dõi</span></div>\n<div class=\"legend\"><span class=\"dot yellow\"></span><span><b>Theo dõi:</b> tiếp tục sử dụng có giám sát phù hợp</span></div>\n<div class=\"legend\"><span class=\"dot green\"></span><span><b>Thông tin:</b> lưu ý thực hành và tư vấn người bệnh</span></div>\n</aside>\n<section>\n<div class=\"main-head\">\n<div><h2>Các cảnh báo đang hiển thị</h2><p>Nhấn “Xem chi tiết” để đọc dấu hiệu nhận biết, đối tượng nguy cơ và hành động cần xem xét.</p></div>\n<div class=\"result-count\" id=\"resultCount\"></div>\n</div>\n<div class=\"cards\" id=\"cards\"></div>\n</section>\n</section>\n</main><div aria-labelledby=\"modalTitle\" aria-modal=\"true\" class=\"modal\" id=\"modal\" role=\"dialog\">\n<div class=\"modal-panel\">\n<div class=\"modal-head\"><div><div class=\"meta\" id=\"modalMeta\"></div><h2 id=\"modalTitle\"></h2></div><button aria-label=\"Đóng\" class=\"close\" id=\"closeModal\" type=\"button\">×</button></div>\n<div class=\"modal-body\" id=\"modalBody\"></div>\n</div>\n</div><div class=\"fixed-note\">Thông tin chỉ nhằm hỗ trợ tra cứu và rà soát an toàn thuốc; không thay thế tờ hướng dẫn sử dụng được phê duyệt, chẩn đoán, xử trí cấp cứu hoặc quyết định chuyên môn của bác sĩ.</div></div>";
  const DATA_URL = 'assets/pharmacovigilance_alerts.json?v=20260711';
  const VIEW_NAME = 'pharmacovigilance';

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  class VpmedPharmacovigilance extends HTMLElement {
    constructor() {
      super();
      this.alerts = [];
      this.activeCategory = 'Tất cả';
    }

    connectedCallback() {
      if (this.shadowRoot) return;
      const shadow = this.attachShadow({ mode: 'open' });
      shadow.innerHTML = `<style>${STYLE}</style>${TEMPLATE}`;
      this.init().catch((error) => {
        console.error('[VPMED Cảnh báo dược]', error);
        const cards = shadow.querySelector('#cards');
        if (cards) cards.innerHTML = '<div class="empty"><b>Không tải được dữ liệu cảnh báo.</b><br>Hãy tải lại trang hoặc kiểm tra file assets/pharmacovigilance_alerts.json.</div>';
      });
    }

    $(selector) { return this.shadowRoot.querySelector(selector); }
    $$(selector) { return [...this.shadowRoot.querySelectorAll(selector)]; }
    normalize(value) {
      return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    async init() {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Dữ liệu cảnh báo không hợp lệ');
      this.alerts = data;
      this.bindEvents();
      this.fillFilters();
      this.updateStats();
      this.render();
    }

    bindEvents() {
      ['searchInput', 'levelFilter', 'systemFilter', 'yearFilter'].forEach((id) => {
        const element = this.$('#' + id);
        element?.addEventListener(id === 'searchInput' ? 'input' : 'change', () => this.render());
      });
      this.$('#resetBtn')?.addEventListener('click', () => {
        this.$('#searchInput').value = '';
        this.$('#levelFilter').value = '';
        this.$('#systemFilter').value = '';
        this.$('#yearFilter').value = '';
        this.activeCategory = 'Tất cả';
        this.$$('#categoryList button').forEach((button, index) => button.classList.toggle('active', index === 0));
        this.render();
      });
      this.$('#closeModal')?.addEventListener('click', () => this.closeModal());
      this.$('#modal')?.addEventListener('click', (event) => {
        if (event.target === this.$('#modal')) this.closeModal();
      });
      this._escapeHandler = (event) => { if (event.key === 'Escape') this.closeModal(); };
      document.addEventListener('keydown', this._escapeHandler);
    }

    disconnectedCallback() {
      if (this._escapeHandler) document.removeEventListener('keydown', this._escapeHandler);
    }

    fillFilters() {
      const systems = [...new Set(this.alerts.flatMap((item) => String(item.system || '').split(' · ')).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'vi'));
      this.$('#systemFilter').insertAdjacentHTML('beforeend', systems.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join(''));
      const categories = ['Tất cả', ...new Set(this.alerts.map((item) => item.category).filter(Boolean))];
      this.$('#categoryList').innerHTML = categories.map((category, index) =>
        `<button type="button" data-category="${escapeHtml(category)}" class="${index === 0 ? 'active' : ''}">${escapeHtml(category)}</button>`
      ).join('');
      this.$('#categoryList').addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        this.activeCategory = button.dataset.category;
        this.$$('#categoryList button').forEach((item) => item.classList.toggle('active', item === button));
        this.render();
      });
    }

    getFiltered() {
      const query = this.normalize(this.$('#searchInput').value);
      const level = this.$('#levelFilter').value;
      const system = this.$('#systemFilter').value;
      const year = this.$('#yearFilter').value;
      return this.alerts.filter((item) => {
        const haystack = this.normalize([
          item.title, item.drugs, item.summary, item.quick, item.category, item.system,
          ...(item.risk || []), ...(item.signs || []), ...(item.action || []), ...(item.monitor || [])
        ].join(' '));
        return (!query || haystack.includes(query)) &&
          (!level || item.level === level) &&
          (!system || String(item.system || '').includes(system)) &&
          (!year || item.year === year) &&
          (this.activeCategory === 'Tất cả' || item.category === this.activeCategory);
      }).sort((a, b) => {
        const [da, ma, ya] = String(a.date).split('/').map(Number);
        const [db, mb, yb] = String(b.date).split('/').map(Number);
        return new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da);
      });
    }

    render() {
      const levelNames = { red: 'Khẩn cấp', orange: 'Quan trọng', yellow: 'Theo dõi', green: 'Thông tin' };
      const list = this.getFiltered();
      this.$('#resultCount').textContent = `${list.length}/${this.alerts.length} cảnh báo`;
      this.$('#cards').innerHTML = list.length ? list.map((item) => `
        <article class="card">
          <div class="card-top ${escapeHtml(item.level)}"></div>
          <div class="card-body">
            <div class="meta"><span class="pill ${escapeHtml(item.level)}">${escapeHtml(levelNames[item.level] || item.level)}</span><span class="pill gray">${escapeHtml(item.category)}</span>${item.interaction ? '<span class="pill gray">Tương tác</span>' : ''}</div>
            <h3>${escapeHtml(item.title)}</h3><div class="drug">${escapeHtml(item.drugs)}</div><p class="summary">${escapeHtml(item.summary)}</p>
            <div class="quick"><b>Điểm cần nhớ:</b> ${escapeHtml(item.quick)}</div>
            <div class="card-foot"><span class="date">${escapeHtml(item.date)} · ${escapeHtml(item.source)}</span><button class="detail-btn" data-id="${escapeHtml(item.id)}" type="button">Xem chi tiết</button></div>
          </div>
        </article>`).join('') : '<div class="empty"><b>Không tìm thấy cảnh báo phù hợp.</b><br>Hãy đổi từ khóa hoặc đặt lại bộ lọc.</div>';
      this.$$('.detail-btn').forEach((button) => button.addEventListener('click', () => this.openDetail(button.dataset.id)));
    }

    listHtml(items) {
      return `<ul>${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    }

    openDetail(id) {
      const item = this.alerts.find((entry) => entry.id === id);
      if (!item) return;
      const levelNames = { red: 'Khẩn cấp', orange: 'Quan trọng', yellow: 'Theo dõi', green: 'Thông tin' };
      this.$('#modalMeta').innerHTML = `<span class="pill ${escapeHtml(item.level)}">${escapeHtml(levelNames[item.level] || item.level)}</span><span class="pill gray">${escapeHtml(item.category)}</span><span class="pill gray">Cập nhật ${escapeHtml(item.date)}</span>`;
      this.$('#modalTitle').textContent = item.title;
      this.$('#modalBody').innerHTML = `
        <div class="detail-grid">
          <div class="box full alert-box"><h4>Thông tin cảnh báo</h4><p><b>Thuốc/nhóm thuốc:</b> ${escapeHtml(item.drugs)}</p><p>${escapeHtml(item.summary)}</p><p><b>Điểm cần nhớ:</b> ${escapeHtml(item.quick)}</p></div>
          <div class="box"><h4>Đối tượng và yếu tố nguy cơ</h4>${this.listHtml(item.risk)}</div>
          <div class="box"><h4>Dấu hiệu cần nhận biết</h4>${this.listHtml(item.signs)}</div>
          <div class="box"><h4>Hành động cần xem xét</h4>${this.listHtml(item.action)}</div>
          <div class="box"><h4>Nội dung cần theo dõi</h4>${this.listHtml(item.monitor)}</div>
          <div class="box full source-box"><h4>Nguồn thông tin</h4><p><b>${escapeHtml(item.source)}</b></p><p class="source-link"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Mở nội dung gốc từ nguồn tham khảo ↗</a></p><p><small>Nội dung trên trang đã được tóm tắt để hỗ trợ tra cứu nhanh. Khi áp dụng cho người bệnh cụ thể, cần đối chiếu tờ hướng dẫn sử dụng được phê duyệt, phác đồ điều trị và dữ liệu lâm sàng hiện có.</small></p></div>
        </div>`;
      this.$('#modal').classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    closeModal() {
      this.$('#modal')?.classList.remove('open');
      document.body.style.overflow = '';
    }

    updateStats() {
      this.$('#heroCount').textContent = `${this.alerts.length} cảnh báo`;
      this.$('#totalStat').textContent = this.alerts.length;
      this.$('#redStat').textContent = this.alerts.filter((item) => item.level === 'red').length;
      this.$('#interactionStat').textContent = this.alerts.filter((item) => item.interaction).length;
      this.$('#latestStat').textContent = this.alerts.filter((item) => item.year === '2026').length;
    }
  }

  function showView(name) {
    document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
    document.getElementById('view-' + name)?.classList.add('active');
    document.querySelectorAll('.main-nav button').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
    history.replaceState(null, '', '#' + name);
    document.getElementById('mainNav')?.classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function install() {
    if (!customElements.get('vpmed-pharmacovigilance')) {
      customElements.define('vpmed-pharmacovigilance', VpmedPharmacovigilance);
    }

    const grid = document.querySelector('#view-home .feature-grid') || document.querySelector('.feature-grid');
    if (grid && !grid.querySelector('[data-open="pharmacovigilance"]')) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'feature-card pharmacovigilance-feature';
      card.dataset.open = VIEW_NAME;
      card.innerHTML = '<span class="feature-icon">⚕️</span><b>Cảnh báo dược về sử dụng thuốc</b><small>Tra cứu 42 cảnh báo an toàn thuốc, ADR, tương tác, dấu hiệu nhận biết và biện pháp giảm thiểu nguy cơ.</small><em>Cập nhật 11/07/2026</em>';
      const sourceCard = grid.querySelector('[data-open="sources"]');
      if (sourceCard) grid.insertBefore(card, sourceCard); else grid.appendChild(card);
      card.addEventListener('click', () => showView(VIEW_NAME));
    }

    const heroList = document.getElementById('heroFeatureList');
    if (heroList && !heroList.querySelector('[data-pv-intro]')) {
      const item = document.createElement('li');
      item.dataset.pvIntro = 'true';
      item.innerHTML = '<strong>Cảnh báo dược về sử dụng thuốc:</strong> Tra cứu nhanh cảnh báo an toàn thuốc, ADR và tương tác quan trọng.';
      heroList.appendChild(item);
    }

    let section = document.getElementById('view-' + VIEW_NAME);
    if (!section) {
      section = document.createElement('section');
      section.className = 'view';
      section.id = 'view-' + VIEW_NAME;
      section.innerHTML = '<div class="back-home-wrap"><button type="button" class="back-home-btn" aria-label="Quay lại Trang chủ"><span aria-hidden="true">←</span> Quay lại Trang chủ</button></div><vpmed-pharmacovigilance></vpmed-pharmacovigilance>';
      const appShell = document.querySelector('.app-shell') || document.querySelector('main');
      const sourceView = document.getElementById('view-sources');
      if (sourceView?.parentNode) sourceView.parentNode.insertBefore(section, sourceView); else appShell?.appendChild(section);
      section.querySelector('.back-home-btn')?.addEventListener('click', () => showView('home'));
    }

    if (location.hash === '#pharmacovigilance') showView(VIEW_NAME);
    window.addEventListener('hashchange', () => {
      if (location.hash === '#pharmacovigilance') showView(VIEW_NAME);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
