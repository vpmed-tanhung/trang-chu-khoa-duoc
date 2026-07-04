/* VPMED Clinical Update Module
   Drop-in module for GitHub Pages. It does not overwrite existing features.
   It adds: clinical-practice orientation, source dashboard, update workflow,
   local drug database editor, JSON import/export.
*/
(function(){
  'use strict';
  const STORAGE_KEY = 'vpmed_clinical_drug_db_v20260704';
  const LOG_KEY = 'vpmed_clinical_update_log_v20260704';
  const SOURCES_URL = './data/clinical_sources.json';
  const TEMPLATE_URL = './data/clinical_drug_template.json';
  const LOGIN_KEY = 'vpmed_clinical_admin_session_v20260704';
  /*
    Lưu ý bảo mật: GitHub Pages là web tĩnh nên phần mật khẩu dưới đây chỉ là khóa giao diện để tránh truy cập nhầm,
    không phải phân quyền bảo mật tuyệt đối. Muốn phân quyền thật cần Google Apps Script/backend.
    Có thể đổi mã truy cập trong ADMIN_USERS rồi push lại GitHub.
  */
  const ADMIN_USERS = [
    {role:'admin', name:'Quản trị Khoa Dược', code:'vpmed-admin-2026'},
    {role:'editor', name:'Dược sĩ cập nhật dữ liệu', code:'vpmed-dsls-2026'},
    {role:'reviewer', name:'Người rà soát dữ liệu', code:'vpmed-review-2026'}
  ];
  const isAdminPage = () => /cap-nhat-du-lieu\.html$/i.test(location.pathname) || !!document.getElementById('clinical-admin');

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const esc = (s='') => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const today = () => new Date().toISOString().slice(0,10);

  function normalizeVN(s=''){
    return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9+./ -]/g,' ').replace(/\s+/g,' ').trim();
  }

  function loadLocal(key, fallback){
    try{ return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e){ return fallback; }
  }
  function saveLocal(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

  function statusLabel(s){
    return {
      draft:'Bản nháp', reviewed:'Đã rà soát', approved:'Đã duyệt', outdated:'Cần cập nhật', reference:'Tham khảo'
    }[s] || s || 'Bản nháp';
  }

  async function fetchJson(url, fallback){
    try{
      const res = await fetch(url, {cache:'no-store'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      return await res.json();
    }catch(e){ return fallback; }
  }

  function addStyles(){
    const css = `
      .clinical-admin-wrap{max-width:1180px;margin:24px auto;padding:0 16px;color:#0f172a;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
      .clinical-hero{background:linear-gradient(135deg,#e8f5f3,#f8fbff);border:1px solid #dbeafe;border-radius:22px;padding:22px;margin-bottom:18px;box-shadow:0 10px 28px rgba(15,23,42,.08)}
      .clinical-hero h2{margin:0 0 8px;font-size:26px;color:#0f766e}.clinical-hero p{margin:7px 0;line-height:1.55;color:#334155}
      .clinical-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.clinical-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px;box-shadow:0 8px 20px rgba(15,23,42,.055)}
      .clinical-card h3{margin:0 0 8px;color:#0f766e;font-size:18px}.clinical-card p,.clinical-card li{color:#475569;line-height:1.52}.clinical-card ul{padding-left:20px;margin:8px 0}
      .clinical-actions{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}.clinical-btn{border:0;border-radius:12px;padding:11px 14px;font-weight:800;cursor:pointer;background:#0f766e;color:white}.clinical-btn.secondary{background:#eaf2fb;color:#075985}.clinical-btn.danger{background:#fee2e2;color:#991b1b}
      .clinical-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.clinical-form label{font-weight:800;color:#334155;font-size:13px}.clinical-form input,.clinical-form select,.clinical-form textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:12px;padding:10px;font-size:15px;background:#fff}.clinical-form textarea{min-height:84px;resize:vertical}.clinical-wide{grid-column:1/-1}
      .clinical-table{width:100%;border-collapse:separate;border-spacing:0 8px}.clinical-table th{font-size:12px;text-transform:uppercase;letter-spacing:.03em;color:#64748b;text-align:left;padding:0 8px}.clinical-table td{background:#fff;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;padding:10px 8px;vertical-align:top}.clinical-table td:first-child{border-left:1px solid #e2e8f0;border-radius:12px 0 0 12px}.clinical-table td:last-child{border-right:1px solid #e2e8f0;border-radius:0 12px 12px 0}.clinical-badge{display:inline-block;border-radius:999px;padding:4px 9px;font-weight:800;font-size:12px;background:#e0f2fe;color:#075985}.clinical-badge.draft{background:#fef3c7;color:#92400e}.clinical-badge.approved{background:#dcfce7;color:#166534}.clinical-badge.outdated{background:#fee2e2;color:#991b1b}.clinical-small{font-size:12px;color:#64748b}.clinical-source-list a{color:#0f766e;font-weight:800}.clinical-alert{border-left:5px solid #0f766e;background:#f0fdfa;padding:12px;border-radius:12px;color:#134e4a}.clinical-filter{margin:8px 0 12px;display:flex;gap:10px;flex-wrap:wrap}.clinical-filter input,.clinical-filter select{border:1px solid #cbd5e1;border-radius:12px;padding:10px;min-width:220px}

      .vpmed-admin-tile{display:flex!important;align-items:flex-start;gap:14px;text-decoration:none!important;color:inherit!important;background:linear-gradient(135deg,#f0fdfa 0%,#eff6ff 55%,#ffffff 100%);border:1px solid #bfe7e1;border-radius:22px;padding:18px;box-shadow:0 14px 34px rgba(15,118,110,.10);min-height:150px;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;box-sizing:border-box;position:relative;overflow:hidden}
      .vpmed-admin-tile:before{content:"";position:absolute;right:-36px;top:-36px;width:120px;height:120px;border-radius:999px;background:rgba(15,118,110,.08)}
      .vpmed-admin-tile:hover{transform:translateY(-3px);box-shadow:0 18px 42px rgba(15,118,110,.18);border-color:#14b8a6}.vpmed-admin-icon{width:52px;height:52px;border-radius:18px;background:#0f766e;color:white;display:grid;place-items:center;font-size:25px;box-shadow:0 10px 20px rgba(15,118,110,.22);flex:0 0 auto}.vpmed-admin-body{position:relative;z-index:1}.vpmed-admin-title{font-size:17px;font-weight:900;color:#075985;margin-bottom:7px;line-height:1.25}.vpmed-admin-desc{font-size:13px;line-height:1.5;color:#475569;margin-bottom:12px}.vpmed-admin-pill{display:inline-flex;align-items:center;border-radius:999px;background:#dcfce7;color:#166534;border:1px solid #86efac;padding:6px 10px;font-size:12px;font-weight:900}.vpmed-admin-entry-wrap{max-width:1180px;margin:22px auto;padding:0 16px}.vpmed-admin-grid-host .vpmed-admin-tile{margin:0}
      @media(max-width:720px){.vpmed-admin-tile{min-height:auto;padding:15px}.vpmed-admin-icon{width:44px;height:44px;border-radius:15px;font-size:22px}}
      @media(max-width:860px){.clinical-grid,.clinical-form{grid-template-columns:1fr}.clinical-admin-wrap{padding:0 10px}.clinical-table{font-size:13px}.clinical-hero h2{font-size:22px}}
    `;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  }

  function createNavHook(){
    if(document.getElementById('clinicalAdminEntry')) return;
    addStyles();
    const href = 'cap-nhat-du-lieu.html';
    const card = document.createElement('a');
    card.id = 'clinicalAdminEntry';
    card.href = href;
    card.className = 'vpmed-admin-tile';
    card.innerHTML = `
      <div class="vpmed-admin-icon">🛡️</div>
      <div class="vpmed-admin-body">
        <div class="vpmed-admin-title">Cập nhật dữ liệu chuyên môn</div>
        <div class="vpmed-admin-desc">Phân quyền Khoa Dược · thuốc mới · nguồn Bộ Y tế · nhật ký rà soát</div>
        <span class="vpmed-admin-pill">Khu vực quản trị</span>
      </div>`;

    const looksLikeHeader = el => {
      const txt = (el?.className || '') + ' ' + (el?.id || '') + ' ' + (el?.tagName || '');
      return /header|top|navbar|nav|menu/i.test(txt) || el?.tagName?.toLowerCase()==='nav';
    };
    const candidates = Array.from(document.querySelectorAll('.app-grid,.apps-grid,.tools-grid,.tool-grid,.module-grid,.home-grid,.cards,.grid'))
      .filter(el => !looksLikeHeader(el) && el.offsetParent !== null);
    let target = candidates.find(el => el.children.length >= 2) || candidates[0];

    if(!target){
      const headings = Array.from(document.querySelectorAll('h1,h2,h3'));
      const h = headings.find(x => /chọn công cụ|ứng dụng chính|công cụ cần sử dụng/i.test(x.textContent||''));
      if(h){
        const section = h.closest('section, .section, .container, main') || h.parentElement;
        target = section?.querySelector('.grid,.cards,.app-grid,.apps-grid,.tools-grid,.module-grid');
      }
    }

    if(target){
      target.appendChild(card);
      target.classList.add('vpmed-admin-grid-host');
    }else{
      const box = document.createElement('section');
      box.className = 'vpmed-admin-entry-wrap';
      box.appendChild(card);
      const main = document.querySelector('main') || document.querySelector('.container') || document.body;
      main.appendChild(box);
    }
  }

  function getSession(){ return loadLocal(LOGIN_KEY, null); }
  function clearSession(){ localStorage.removeItem(LOGIN_KEY); sessionStorage.removeItem(LOGIN_KEY); }
  function setSession(user){ localStorage.setItem(LOGIN_KEY, JSON.stringify({role:user.role,name:user.name,loginAt:new Date().toISOString()})); }

  function renderLoginGate(root){
    addStyles();
    root.className = 'clinical-admin-wrap';
    root.innerHTML = `
      <div class="clinical-hero">
        <h2>Cập nhật dữ liệu chuyên môn</h2>
        <p><strong>Khu vực phân quyền.</strong> Chỉ người được giao nhiệm vụ mới truy cập để thêm/sửa dữ liệu thuốc, nguồn Bộ Y tế, ADR, tương tác và nhật ký cập nhật.</p>
        <p class="clinical-small">Lưu ý: đây là khóa giao diện cho GitHub Pages. Phân quyền bảo mật thật cần kết nối Google Apps Script hoặc backend.</p>
      </div>
      <div class="clinical-card" style="max-width:520px;margin:18px auto">
        <h3>Đăng nhập quản trị</h3>
        <label style="font-weight:800;color:#334155">Mã truy cập</label>
        <input id="clinicalAccessCode" type="password" placeholder="Nhập mã truy cập" style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:12px;padding:12px;margin:8px 0 12px;font-size:16px">
        <div class="clinical-actions"><button id="clinicalLoginBtn" class="clinical-btn">Đăng nhập</button><a class="clinical-btn secondary" href="./">Quay lại trang chủ</a></div>
        <div id="clinicalLoginMsg" class="clinical-small"></div>
      </div>`;
    const code = $('#clinicalAccessCode');
    const msg = $('#clinicalLoginMsg');
    const login = () => {
      const user = ADMIN_USERS.find(u => u.code === code.value.trim());
      if(!user){ msg.textContent = 'Mã truy cập không đúng.'; code.focus(); return; }
      setSession(user); renderModule();
    };
    $('#clinicalLoginBtn').onclick = login;
    code.addEventListener('keydown', e => { if(e.key === 'Enter') login(); });
  }

  async function renderModule(){
    addStyles();
    const session = getSession();
    const rootExisting = $('#clinical-admin');
    if(!session){ renderLoginGate(rootExisting || document.body.appendChild(Object.assign(document.createElement('section'), {id:'clinical-admin'}))); return; }
    const sources = await fetchJson(SOURCES_URL, []);
    const template = await fetchJson(TEMPLATE_URL, []);
    if(!localStorage.getItem(STORAGE_KEY)) saveLocal(STORAGE_KEY, template);
    if(!localStorage.getItem(LOG_KEY)) saveLocal(LOG_KEY, [{date:today(),module:'Khởi tạo',change:'Tạo dữ liệu cục bộ cho module cập nhật chuyên môn.',source:'Nguồn Bộ Y tế và dữ liệu nội bộ',status:'draft',updatedBy:'Khoa Dược'}]);

    let root = $('#clinical-admin');
    if(!root){
      root = document.createElement('section'); root.id='clinical-admin'; root.className='clinical-admin-wrap'; document.body.appendChild(root);
    }
    root.innerHTML = `
      <div class="clinical-hero">
        <h2>Quản trị dữ liệu thực hành lâm sàng</h2>
        <p><strong>Mục tiêu:</strong> cập nhật thuốc, liều dùng, cảnh báo an toàn, tương tác, ADR và nguồn dữ liệu theo hướng thực hành lâm sàng; mỗi nội dung có nguồn, ngày rà soát và trạng thái phê duyệt.</p>
        <p class="clinical-small">Dữ liệu nhập tại đây được lưu trên thiết bị hiện tại. Để công bố lên GitHub Pages, dùng nút <strong>Xuất JSON</strong>, đưa file vào thư mục <code>data/</code>, rồi commit lên GitHub.</p>
        <div class="clinical-actions"><span class="clinical-badge approved">Đang đăng nhập: ${esc(session.name)} · ${esc(session.role)}</span><button class="clinical-btn secondary" type="button" id="clinicalLogout">Đăng xuất</button><a class="clinical-btn secondary" href="./">Quay lại trang chủ</a></div>
      </div>
      <div class="clinical-grid">
        <div class="clinical-card"><h3>1. Công cụ lâm sàng</h3><ul><li>Tính CrCl/eGFR và liều theo bệnh nhân.</li><li>Cảnh báo thận, gan, ADR, tương tác.</li><li>Hiển thị nguồn ngay tại dòng dữ liệu.</li></ul></div>
        <div class="clinical-card"><h3>2. Hồ sơ thuốc</h3><ul><li>Mỗi biệt dược là một hồ sơ riêng.</li><li>Có liều chuẩn, CrCl, HD, CRRT, pha truyền, TDM.</li><li>Có trạng thái: nháp, rà soát, duyệt, cần cập nhật.</li></ul></div>
        <div class="clinical-card"><h3>3. Quy trình duyệt</h3><ul><li>Dược sĩ nhập dữ liệu.</li><li>DSLS rà soát nguồn.</li><li>Trưởng khoa/HĐT&ĐT duyệt trước áp dụng chính thức.</li></ul></div>
      </div>
      <div class="clinical-card" style="margin-top:14px"><h3>Nguồn chính thức đang dùng</h3><div id="clinicalSources" class="clinical-source-list"></div></div>
      <div class="clinical-card" style="margin-top:14px">
        <h3>Thêm / cập nhật hồ sơ thuốc</h3>
        <div class="clinical-alert">Không nhập dữ liệu nếu chưa đối chiếu đúng chế phẩm, hàm lượng, dạng bào chế và nguồn. Thông tin chưa duyệt chỉ dùng ở trạng thái tham khảo nội bộ.</div>
        <form id="clinicalDrugForm" class="clinical-form" style="margin-top:12px">
          <div><label>Tên thuốc / biệt dược</label><input id="cBrand" required placeholder="Ví dụ: Ceftriaxone 1g"></div>
          <div><label>Hoạt chất</label><input id="cActive" required placeholder="Ví dụ: Ceftriaxone"></div>
          <div><label>Hàm lượng</label><input id="cStrength" placeholder="Ví dụ: 1g"></div>
          <div><label>Dạng bào chế / đường dùng</label><input id="cRoute" placeholder="Ví dụ: bột pha tiêm IV/IM"></div>
          <div><label>Nhóm thuốc</label><input id="cGroup" placeholder="Ví dụ: Cephalosporin thế hệ 3"></div>
          <div><label>Trạng thái</label><select id="cStatus"><option value="draft">Bản nháp</option><option value="reviewed">Đã rà soát</option><option value="approved">Đã duyệt</option><option value="outdated">Cần cập nhật</option><option value="reference">Tham khảo</option></select></div>
          <div class="clinical-wide"><label>Liều người lớn thông thường</label><textarea id="cDose" placeholder="Ghi liều theo chỉ định chính; nếu phụ thuộc bệnh lý, nêu rõ từng trường hợp."></textarea></div>
          <div><label>CrCl ≥50</label><textarea id="cR50"></textarea></div><div><label>CrCl 30–49</label><textarea id="cR30"></textarea></div>
          <div><label>CrCl 15–29</label><textarea id="cR15"></textarea></div><div><label>CrCl &lt;15 / HD / CRRT</label><textarea id="cRhd" placeholder="Ghi riêng <15, HD, CRRT nếu có."></textarea></div>
          <div class="clinical-wide"><label>Cảnh báo độc gan / độc thận / ADR / tương tác / chống chỉ định</label><textarea id="cWarnings" placeholder="Nêu ngưỡng theo dõi, dấu hiệu cần báo bác sĩ, chống chỉ định, tương tác cần tránh."></textarea></div>
          <div class="clinical-wide"><label>Nguồn đối chiếu</label><textarea id="cSources" placeholder="Ví dụ: Tờ HDSD Cục Quản lý Dược, Quyết định BYT, Dược thư Quốc gia, ngày tra cứu..."></textarea></div>
          <div class="clinical-actions clinical-wide"><button class="clinical-btn" type="submit">Lưu hồ sơ thuốc</button><button class="clinical-btn secondary" type="button" id="clinicalClearForm">Xóa form</button></div>
        </form>
      </div>
      <div class="clinical-card" style="margin-top:14px">
        <h3>Danh sách dữ liệu đã nhập</h3>
        <div class="clinical-filter"><input id="clinicalSearch" placeholder="Tìm thuốc, hoạt chất, nhóm..."><select id="clinicalStatusFilter"><option value="">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="reviewed">Đã rà soát</option><option value="approved">Đã duyệt</option><option value="outdated">Cần cập nhật</option><option value="reference">Tham khảo</option></select></div>
        <div class="clinical-actions"><button class="clinical-btn secondary" id="clinicalExport">Xuất JSON</button><label class="clinical-btn secondary" style="cursor:pointer">Nhập JSON<input type="file" id="clinicalImport" accept=".json,application/json" hidden></label><button class="clinical-btn danger" id="clinicalReset">Xóa dữ liệu cục bộ</button></div>
        <div id="clinicalDrugList"></div>
      </div>
      <div class="clinical-card" style="margin-top:14px"><h3>Nhật ký cập nhật</h3><div id="clinicalLog"></div></div>
    `;
    renderSources(sources);
    bindEvents();
    renderDrugList();
    renderLog();
  }

  function renderSources(sources){
    const box = $('#clinicalSources');
    if(!box) return;
    box.innerHTML = sources.map(s => `<div class="clinical-card" style="box-shadow:none;margin:8px 0;background:#fbfdff">
      <div><span class="clinical-badge">Ưu tiên ${esc(s.priority)}</span> <strong>${esc(s.name)}</strong></div>
      <div class="clinical-small">Phạm vi: ${esc((s.scope||[]).join(', '))}</div>
      <div>${esc(s.note||'')}</div>
      <div><a href="${esc(s.url)}" target="_blank" rel="noopener">Mở nguồn</a> · Rà soát: ${esc(s.reviewedDate||'')}</div>
    </div>`).join('') || '<p>Chưa tải được danh sách nguồn. Kiểm tra thư mục data/clinical_sources.json.</p>';
  }

  function drugFromForm(){
    const warnings = $('#cWarnings').value.trim();
    return {
      localId: 'drug-' + Date.now(),
      brandName: $('#cBrand').value.trim(), activeIngredient: $('#cActive').value.trim(), strength: $('#cStrength').value.trim(),
      dosageForm: '', route: $('#cRoute').value.trim(), clinicalGroup: $('#cGroup').value.trim(), adultDose: $('#cDose').value.trim(),
      renalDose: {crcl_ge_50:$('#cR50').value.trim(), crcl_30_49:$('#cR30').value.trim(), crcl_15_29:$('#cR15').value.trim(), crcl_lt_15:$('#cRhd').value.trim(), hd:$('#cRhd').value.trim(), crrt:$('#cRhd').value.trim()},
      preparation: '', tdm: '', contraindications: [], majorInteractions: [], importantAdr: warnings ? [warnings] : [], hepaticRisk: warnings, renalRisk: warnings, clinicalNotes: warnings,
      sources: [{sourceId:'manual', title:$('#cSources').value.trim(), url:'', checkedDate:today(), appliesTo:['hồ sơ thuốc']}],
      review:{status:$('#cStatus').value, updatedBy:'Khoa Dược', reviewedBy:'', lastUpdated:today(), approvedDate:$('#cStatus').value==='approved'?today():''}
    };
  }

  function bindEvents(){
    const logoutBtn = $('#clinicalLogout');
    if(logoutBtn) logoutBtn.onclick = () => { clearSession(); location.href='cap-nhat-du-lieu.html'; };
    $('#clinicalDrugForm').addEventListener('submit', e => {
      e.preventDefault();
      const d = drugFromForm();
      if(!d.brandName || !d.activeIngredient){ alert('Cần nhập tên thuốc và hoạt chất.'); return; }
      const db = loadLocal(STORAGE_KEY, []);
      db.unshift(d); saveLocal(STORAGE_KEY, db);
      const log = loadLocal(LOG_KEY, []); log.unshift({date:today(),module:'Hồ sơ thuốc',change:`Thêm/cập nhật ${d.brandName} (${d.activeIngredient})`,source:(d.sources[0]?.title||'Chưa ghi nguồn'),status:d.review.status,updatedBy:'Khoa Dược'}); saveLocal(LOG_KEY, log);
      e.target.reset(); renderDrugList(); renderLog(); alert('Đã lưu vào dữ liệu cục bộ. Xuất JSON để đưa lên GitHub Pages.');
    });
    $('#clinicalClearForm').onclick = () => $('#clinicalDrugForm').reset();
    $('#clinicalSearch').oninput = renderDrugList; $('#clinicalStatusFilter').onchange = renderDrugList;
    $('#clinicalExport').onclick = () => downloadJson('vpmed-clinical-drugs.json', loadLocal(STORAGE_KEY, []));
    $('#clinicalImport').onchange = async e => {
      const file = e.target.files[0]; if(!file) return;
      try{ const data = JSON.parse(await file.text()); if(!Array.isArray(data)) throw new Error('File phải là mảng JSON.'); saveLocal(STORAGE_KEY, data); renderDrugList(); alert('Đã nhập JSON.'); }catch(err){ alert('Không đọc được file JSON: '+err.message); }
    };
    $('#clinicalReset').onclick = () => { if(confirm('Xóa toàn bộ dữ liệu cục bộ trên thiết bị này?')){ localStorage.removeItem(STORAGE_KEY); renderDrugList(); } };
  }

  function renderDrugList(){
    const box = $('#clinicalDrugList'); if(!box) return;
    const q = normalizeVN($('#clinicalSearch')?.value || ''); const sf = $('#clinicalStatusFilter')?.value || '';
    let db = loadLocal(STORAGE_KEY, []);
    db = db.filter(d => (!sf || d.review?.status === sf) && (!q || [d.brandName,d.activeIngredient,d.clinicalGroup,d.adultDose,d.clinicalNotes].some(x => normalizeVN(x).includes(q))));
    if(!db.length){ box.innerHTML = '<p class="clinical-small">Chưa có dữ liệu phù hợp.</p>'; return; }
    box.innerHTML = `<table class="clinical-table"><thead><tr><th>Thuốc</th><th>Liều/thận</th><th>Cảnh báo</th><th>Nguồn</th><th>Trạng thái</th></tr></thead><tbody>${db.map(d => `<tr>
      <td><strong>${esc(d.brandName||'Chưa đặt tên')}</strong><div class="clinical-small">${esc(d.activeIngredient||'')} · ${esc(d.strength||'')} · ${esc(d.route||'')}</div><div>${esc(d.clinicalGroup||'')}</div></td>
      <td><div><strong>Liều chuẩn:</strong> ${esc(d.adultDose||'Chưa nhập')}</div><div class="clinical-small"><strong>CrCl ≥50:</strong> ${esc(d.renalDose?.crcl_ge_50||'—')}</div><div class="clinical-small"><strong>30–49:</strong> ${esc(d.renalDose?.crcl_30_49||'—')} · <strong>15–29:</strong> ${esc(d.renalDose?.crcl_15_29||'—')}</div><div class="clinical-small"><strong>&lt;15/HD/CRRT:</strong> ${esc(d.renalDose?.crcl_lt_15||'—')}</div></td>
      <td>${esc(d.clinicalNotes || d.hepaticRisk || (d.importantAdr||[]).join('; ') || 'Chưa nhập')}</td>
      <td class="clinical-small">${esc((d.sources||[]).map(s=>s.title||s.sourceId).join('; ') || 'Chưa ghi nguồn')}<br>Rà soát: ${esc(d.review?.lastUpdated||'')}</td>
      <td><span class="clinical-badge ${esc(d.review?.status||'draft')}">${esc(statusLabel(d.review?.status))}</span></td>
    </tr>`).join('')}</tbody></table>`;
  }

  function renderLog(){
    const box = $('#clinicalLog'); if(!box) return;
    const logs = loadLocal(LOG_KEY, []);
    box.innerHTML = logs.map(l => `<div class="clinical-card" style="box-shadow:none;margin:8px 0;background:#fbfdff"><strong>${esc(l.date)} · ${esc(l.module)}</strong><div>${esc(l.change)}</div><div class="clinical-small">Nguồn: ${esc(l.source)} · Trạng thái: ${esc(statusLabel(l.status))} · Người cập nhật: ${esc(l.updatedBy)}</div></div>`).join('') || '<p>Chưa có nhật ký.</p>';
  }

  function downloadJson(filename, obj){
    const blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},1000);
  }

  function initClinicalModule(){
    if(isAdminPage()) renderModule();
    else { addStyles(); createNavHook(); }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initClinicalModule); else initClinicalModule();
})();
