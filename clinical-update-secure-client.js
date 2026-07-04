/* VPMED secure client for GitHub Pages + Apps Script
   Giao diện đã tinh chỉnh: gọn hơn, sạch hơn, không làm vỡ layout trang chủ.
*/
(function(){
  'use strict';

  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwCBsaJ-L0P9NJ4Qc5Wp6NF69Y-nYS0DZTWAREwSYk16PnStauF90T3X0dcI1QkhWLL/exec';
  const TOKEN_KEY = 'vpmed_apps_script_token_v1';
  const USER_KEY = 'vpmed_apps_script_user_v1';

  const $ = (s,r=document)=>r.querySelector(s);
  const esc = (s='')=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const statusLabel = s => ({draft:'Bản nháp',reviewed:'Đã rà soát',approved:'Đã duyệt',outdated:'Cần cập nhật',reference:'Tham khảo'}[s]||s||'Bản nháp');

  function addStyles(){
    if($('#vpmedSecureStyle')) return;
    const css = `
      :root{--vpmed:#006b8f;--vpmed-2:#0f766e;--ink:#0f172a;--muted:#64748b;--line:#dbe7ef;--soft:#f3f8fb;--card:#ffffff;--danger:#b91c1c;--ok:#166534;--warn:#92400e}
      *{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,#e7f6f9 0,#f7fbfd 36%,#eef5f9 100%);color:var(--ink);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}.clinical-admin-wrap{max-width:1200px;margin:0 auto;padding:28px 18px 48px}.clinical-topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}.clinical-brand{display:flex;align-items:center;gap:12px}.clinical-logo-mark{width:48px;height:48px;border-radius:17px;background:linear-gradient(135deg,var(--vpmed),#14b8a6);box-shadow:0 16px 32px rgba(0,107,143,.22);display:grid;place-items:center;color:white;font-weight:1000;font-size:22px}.clinical-brand-title{font-size:20px;font-weight:950;color:#073b4c;line-height:1.15}.clinical-brand-sub{font-size:13px;color:var(--muted);margin-top:3px}.clinical-hero{position:relative;overflow:hidden;background:linear-gradient(135deg,#075985 0%,#0f766e 58%,#14b8a6 100%);color:white;border-radius:28px;padding:28px;box-shadow:0 24px 60px rgba(7,89,133,.22);margin-bottom:18px}.clinical-hero:after{content:"";position:absolute;right:-70px;top:-90px;width:260px;height:260px;border-radius:999px;background:rgba(255,255,255,.14)}.clinical-hero h2{position:relative;z-index:1;margin:0 0 10px;font-size:30px;line-height:1.18;color:white}.clinical-hero p{position:relative;z-index:1;margin:8px 0;max-width:860px;line-height:1.62;color:#e6fffb}.clinical-hero .clinical-actions{position:relative;z-index:1}.clinical-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:16px 0}.clinical-card{background:rgba(255,255,255,.92);border:1px solid rgba(219,231,239,.95);border-radius:22px;padding:18px;box-shadow:0 14px 36px rgba(15,23,42,.075);backdrop-filter:blur(10px);margin-top:16px}.clinical-card h3{margin:0 0 10px;color:#075985;font-size:19px;line-height:1.25}.clinical-card p{line-height:1.58;color:#475569}.clinical-mini-card{min-height:128px}.clinical-mini-card .no{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:12px;background:#e0f2fe;color:#075985;font-weight:1000;margin-bottom:10px}.clinical-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:14px 0}.clinical-btn{border:0;border-radius:999px;padding:11px 15px;font-weight:900;cursor:pointer;background:linear-gradient(135deg,#0f766e,#0e7490);color:white;text-decoration:none;box-shadow:0 10px 24px rgba(15,118,110,.18);font-size:14px}.clinical-btn:hover{filter:brightness(.98);transform:translateY(-1px)}.clinical-btn.secondary{background:#eef7fb;color:#075985;box-shadow:none;border:1px solid #cfe4ee}.clinical-btn.danger{background:#fee2e2;color:#991b1b;box-shadow:none;border:1px solid #fecaca}.clinical-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}.clinical-form label,.loginbox label{display:block;font-weight:900;color:#334155;font-size:13px;margin:0 0 6px}.clinical-form input,.clinical-form select,.clinical-form textarea,.loginbox input{width:100%;border:1px solid #cbd5e1;border-radius:15px;padding:12px 13px;font-size:15px;background:#fbfdff;outline:none}.clinical-form input:focus,.clinical-form select:focus,.clinical-form textarea:focus,.loginbox input:focus{border-color:#0f766e;box-shadow:0 0 0 4px rgba(20,184,166,.12);background:#fff}.clinical-form textarea{min-height:92px;resize:vertical}.clinical-wide{grid-column:1/-1}.clinical-table-wrap{overflow:auto;border-radius:18px;border:1px solid #e2e8f0;background:white}.clinical-table{width:100%;border-collapse:collapse;min-width:920px}.clinical-table th{font-size:12px;text-transform:uppercase;letter-spacing:.035em;color:#64748b;text-align:left;padding:13px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0}.clinical-table td{padding:14px 12px;vertical-align:top;border-bottom:1px solid #edf2f7;color:#334155}.clinical-table tr:hover td{background:#f8fcfd}.clinical-badge{display:inline-flex;align-items:center;border-radius:999px;padding:5px 10px;font-weight:900;font-size:12px;background:#e0f2fe;color:#075985;border:1px solid #bae6fd}.clinical-badge.approved{background:#dcfce7;color:var(--ok);border-color:#bbf7d0}.clinical-badge.reviewed{background:#dbeafe;color:#1d4ed8;border-color:#bfdbfe}.clinical-badge.draft{background:#fef3c7;color:var(--warn);border-color:#fde68a}.clinical-badge.outdated{background:#fee2e2;color:#991b1b;border-color:#fecaca}.clinical-badge.reference{background:#f1f5f9;color:#475569;border-color:#e2e8f0}.clinical-small{font-size:12.5px;color:#64748b;line-height:1.5}.clinical-alert{border:1px solid #b5eee3;background:linear-gradient(135deg,#f0fdfa,#ecfeff);padding:13px 14px;border-radius:16px;color:#134e4a;line-height:1.55}.loginbox{max-width:560px;margin:22px auto!important;padding:24px}.loginbox h3{font-size:24px}.source-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.source-item{border:1px solid #e2e8f0;border-radius:16px;padding:13px;background:#fbfdff}.source-item strong{color:#0f766e}.source-item a{display:inline-flex;margin-top:8px;color:#075985;font-weight:900;text-decoration:none}.log-item{border-bottom:1px solid #e2e8f0;padding:10px 0}.log-item:last-child{border-bottom:0}.empty-state{padding:18px;border-radius:16px;background:#f8fafc;border:1px dashed #cbd5e1;color:#64748b}.field-hint{font-size:12px;color:#64748b;margin-top:5px}.clinical-section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}.clinical-section-title h3{margin:0}.clinical-statusbar{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.clinical-statusbar span{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.24);border-radius:999px;padding:7px 10px;color:white;font-size:12px;font-weight:900}.clinical-save-msg{font-weight:800;margin-top:10px;color:#0f766e}.clinical-hero.compact{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;background:linear-gradient(135deg,#f0fdfa 0%,#e0f2fe 100%);color:var(--ink);box-shadow:0 16px 44px rgba(15,23,42,.08);border:1px solid #cfe9f2}.clinical-hero.compact h2{color:#0f766e}.clinical-hero.compact p{color:#334155;max-width:780px}.clinical-hero.compact:after{background:rgba(14,116,144,.08)}.clinical-dashboard{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;align-items:start}.clinical-primary-card{margin-top:0}.clinical-side .clinical-card:first-child{margin-top:0}.source-grid{grid-template-columns:1fr}.source-item{padding:12px;border-radius:14px}.source-item strong{display:block;font-size:14px;line-height:1.35}.log-item{font-size:12px}.loginbox{margin-top:16px!important}
      @media(max-width:900px){.clinical-grid,.clinical-form,.source-grid,.clinical-dashboard{grid-template-columns:1fr}.clinical-admin-wrap{padding:18px 12px 36px}.clinical-hero{padding:22px;border-radius:22px}.clinical-hero h2{font-size:24px}.clinical-topbar{align-items:flex-start;flex-direction:column}.clinical-btn{width:auto}.clinical-table{min-width:780px}}
    `;
    const st=document.createElement('style');st.id='vpmedSecureStyle';st.textContent=css;document.head.appendChild(st);
  }

  async function api(action, payload={}){
    if(!WEB_APP_URL || WEB_APP_URL.includes('DAN_URL')) throw new Error('Chưa cấu hình WEB_APP_URL trong clinical-update-secure-client.js');
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    const res = await fetch(WEB_APP_URL, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action, token, ...payload})});
    const data = await res.json();
    if(!data.ok) throw new Error(data.message || 'Lỗi Apps Script');
    return data;
  }

  function mount(){
    addStyles();
    const root = $('#clinical-admin') || document.body.appendChild(Object.assign(document.createElement('section'),{id:'clinical-admin'}));
    root.className='clinical-admin-wrap';
    if(!sessionStorage.getItem(TOKEN_KEY)) renderLogin(root); else renderApp(root);
  }

  function renderTopbar(){
    return `<div class="clinical-topbar"><div class="clinical-brand"><div class="clinical-logo-mark">Rx</div><div><div class="clinical-brand-title">VPMED Tân Hưng</div><div class="clinical-brand-sub">Hệ thống hỗ trợ Dược lâm sàng</div></div></div><a class="clinical-btn secondary" href="./">← Quay lại trang chủ</a></div>`;
  }

  function renderLogin(root){
    root.innerHTML = `${renderTopbar()}<div class="clinical-hero compact"><h2>Cập nhật dữ liệu chuyên môn</h2><p>Khu vực dành cho Khoa Dược cập nhật hồ sơ thuốc, liều dùng, cảnh báo an toàn và nguồn tham khảo trước khi công bố trong hệ thống tra cứu lâm sàng.</p></div><div class="clinical-card loginbox"><h3>Đăng nhập</h3><p class="clinical-small">Chỉ tài khoản được phân quyền mới có thể thêm, sửa hoặc duyệt dữ liệu chuyên môn.</p><label>Tài khoản</label><input id="u" placeholder="Nhập tài khoản" autocomplete="username"><br><br><label>Mật khẩu</label><input id="p" type="password" placeholder="Nhập mật khẩu" autocomplete="current-password"><div class="clinical-actions"><button class="clinical-btn" id="login">Đăng nhập</button><a class="clinical-btn secondary" href="./">Quay lại trang chủ</a></div><div id="msg" class="clinical-small"></div></div>`;
    const doLogin = async()=>{
      $('#msg').textContent='Đang đăng nhập...';
      try{ const data = await api('login', {username:$('#u').value.trim(), passcode:$('#p').value.trim()}); sessionStorage.setItem(TOKEN_KEY,data.token); sessionStorage.setItem(USER_KEY,JSON.stringify(data.user)); renderApp(root); }
      catch(e){ $('#msg').textContent=e.message; }
    };
    $('#login').onclick = doLogin;
    $('#p').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
  }

  async function renderApp(root){
    const user = JSON.parse(sessionStorage.getItem(USER_KEY)||'{}');
    root.innerHTML = `${renderTopbar()}<div class="clinical-hero compact"><div><h2>Quản trị dữ liệu thực hành lâm sàng</h2><p>Cập nhật hồ sơ thuốc, hiệu chỉnh liều, cảnh báo an toàn và nguồn tham khảo đã đối chiếu. Dữ liệu chỉ nên công bố khi đã được rà soát nội bộ.</p></div><div class="clinical-actions"><span class="clinical-badge approved">${esc(user.displayName||user.username)} · ${esc(user.role)}</span><button class="clinical-btn secondary" id="logout">Đăng xuất</button></div></div><div class="clinical-dashboard"><div class="clinical-card clinical-primary-card"><div class="clinical-section-title"><h3>Thêm / cập nhật hồ sơ thuốc</h3><span class="clinical-badge draft">Chờ duyệt trước khi công bố</span></div><div class="clinical-alert">Chỉ nhập dữ liệu khi đã đối chiếu đúng tên thuốc, hoạt chất, hàm lượng, dạng bào chế và nguồn. Nên ghi rõ ngày tra cứu và phần thông tin áp dụng.</div><form id="f" class="clinical-form"><div><label>Tên thuốc / biệt dược</label><input id="brand" required placeholder="Ví dụ: Ceftriaxone 1g"></div><div><label>Hoạt chất</label><input id="active" required placeholder="Ví dụ: Ceftriaxone"></div><div><label>Hàm lượng</label><input id="strength" placeholder="Ví dụ: 1g"></div><div><label>Dạng bào chế / đường dùng</label><input id="route" placeholder="Ví dụ: bột pha tiêm IV/IM"></div><div><label>Nhóm thuốc</label><input id="group" placeholder="Ví dụ: Cephalosporin thế hệ 3"></div><div><label>Trạng thái</label><select id="status"><option value="draft">Bản nháp</option><option value="reviewed">Đã rà soát</option><option value="approved">Đã duyệt</option><option value="outdated">Cần cập nhật</option><option value="reference">Tham khảo</option></select></div><div class="clinical-wide"><label>Liều người lớn thông thường</label><textarea id="dose" placeholder="Ghi liều theo chỉ định chính; nêu rõ nếu phụ thuộc bệnh lý hoặc mức độ nhiễm khuẩn."></textarea></div><div><label>CrCl ≥50</label><textarea id="r50" placeholder="Không cần hiệu chỉnh / ghi liều cụ thể nếu có."></textarea></div><div><label>CrCl 30–49</label><textarea id="r30" placeholder="Ghi liều và khoảng cách dùng."></textarea></div><div><label>CrCl 15–29</label><textarea id="r15" placeholder="Ghi liều và khoảng cách dùng."></textarea></div><div><label>CrCl &lt;15 / HD / CRRT</label><textarea id="rhd" placeholder="Tách rõ &lt;15, chạy thận nhân tạo, CRRT nếu có dữ liệu."></textarea></div><div class="clinical-wide"><label>Cảnh báo an toàn</label><textarea id="warn" placeholder="Ghi độc gan, độc thận, ADR quan trọng, tương tác chống chỉ định hoặc lưu ý theo dõi."></textarea></div><div class="clinical-wide"><label>Nguồn đối chiếu</label><textarea id="src" placeholder="Ví dụ: Tờ HDSD được Cục QLD phê duyệt; QĐ 708/QĐ-BYT; QĐ 5948/QĐ-BYT; Dược thư Quốc gia..."></textarea></div><div class="clinical-actions clinical-wide"><button class="clinical-btn" type="submit">Lưu dữ liệu</button><button class="clinical-btn secondary" type="reset">Xóa form</button></div></form><div id="saveMsg" class="clinical-save-msg"></div></div><aside class="clinical-side"><div id="sources" class="clinical-card"><h3>Nguồn tham khảo</h3><p>Đang tải...</p></div><div class="clinical-card"><h3>Nhật ký cập nhật</h3><div id="logs"><p>Đang tải...</p></div></div></aside></div><div class="clinical-card"><div class="clinical-section-title"><h3>Danh sách thuốc</h3><div class="clinical-actions" style="margin:0"><button class="clinical-btn secondary" id="reload">Tải lại</button><button class="clinical-btn secondary" id="exportApproved">Xuất dữ liệu đã duyệt</button></div></div><div id="list"><p>Đang tải...</p></div></div>`;
    $('#logout').onclick=async()=>{try{await api('logout')}catch(e){} sessionStorage.clear(); renderLogin(root);};
    $('#f').onsubmit=saveDrug;
    $('#reload').onclick=loadAll;
    $('#exportApproved').onclick=exportApproved;
    loadAll();
  }

  function formDrug(){
    const today = new Date().toISOString().slice(0,10);
    return { brandName:$('#brand').value.trim(), activeIngredient:$('#active').value.trim(), strength:$('#strength').value.trim(), route:$('#route').value.trim(), clinicalGroup:$('#group').value.trim(), adultDose:$('#dose').value.trim(), renalDose:{crcl_ge_50:$('#r50').value.trim(), crcl_30_49:$('#r30').value.trim(), crcl_15_29:$('#r15').value.trim(), crcl_lt_15:$('#rhd').value.trim(), hd:$('#rhd').value.trim(), crrt:$('#rhd').value.trim()}, clinicalNotes:$('#warn').value.trim(), hepaticRisk:$('#warn').value.trim(), renalRisk:$('#warn').value.trim(), importantAdr:$('#warn').value.trim() ? [$('#warn').value.trim()] : [], sources:[{sourceId:'manual',title:$('#src').value.trim(),checkedDate:today,appliesTo:['hồ sơ thuốc']}], review:{status:$('#status').value,lastUpdated:today} };
  }

  async function saveDrug(e){
    e.preventDefault();
    $('#saveMsg').textContent='Đang lưu...';
    try{ await api('saveDrug',{drug:formDrug()}); $('#saveMsg').textContent='Đã lưu dữ liệu.'; $('#f').reset(); loadAll(); }
    catch(err){ $('#saveMsg').textContent=err.message; }
  }

  async function loadAll(){
    try{
      const [src, drugs, logs] = await Promise.all([api('getSources'), api('listDrugs'), api('getLogs')]);
      const sources = src.sources || [];
      $('#sources').innerHTML = '<div class="clinical-section-title"><h3>Nguồn chính thức</h3><span class="clinical-badge reference">'+sources.length+' nguồn</span></div>' + (sources.length ? '<div class="source-grid">' + sources.map(s=>`<div class="source-item"><strong>${esc(s.name)}</strong><div class="clinical-small">${esc((s.scope||[]).join(', '))}</div><a href="${esc(s.url)}" target="_blank" rel="noopener">Mở nguồn →</a></div>`).join('') + '</div>' : '<div class="empty-state">Chưa có danh sách nguồn.</div>');
      renderList(drugs.drugs||[]);
      $('#logs').innerHTML = (logs.logs||[]).map(l=>`<div class="log-item clinical-small"><strong>${esc(l.time)}</strong> · ${esc(l.user)} · ${esc(l.action)}<br>${esc(l.detail)}</div>`).join('') || '<div class="empty-state">Chưa có nhật ký.</div>';
    }catch(e){ $('#list').innerHTML='<div class="empty-state">'+esc(e.message)+'</div>'; }
  }

  function renderList(drugs){
    if(!drugs.length){ $('#list').innerHTML='<div class="empty-state">Chưa có dữ liệu thuốc.</div>'; return; }
    $('#list').innerHTML = `<div class="clinical-table-wrap"><table class="clinical-table"><thead><tr><th>Thuốc</th><th>Liều/thận</th><th>Nguồn</th><th>Trạng thái</th><th>Duyệt</th></tr></thead><tbody>${drugs.map(d=>`<tr><td><strong>${esc(d.brandName)}</strong><div class="clinical-small">${esc(d.activeIngredient)} · ${esc(d.strength||'')} · ${esc(d.route||'')}</div></td><td><div>${esc(d.adultDose||'')}</div><div class="clinical-small">≥50: ${esc(d.renalDose?.crcl_ge_50||'—')}<br>30–49: ${esc(d.renalDose?.crcl_30_49||'—')}<br>15–29: ${esc(d.renalDose?.crcl_15_29||'—')}</div></td><td class="clinical-small">${esc((d.sources||[]).map(s=>s.title).join('; '))}</td><td><span class="clinical-badge ${esc(d.review?.status||'draft')}">${esc(statusLabel(d.review?.status))}</span></td><td><div class="clinical-actions" style="margin:0"><button class="clinical-btn secondary" data-id="${esc(d.id||d.localId)}" data-status="approved">Duyệt</button><button class="clinical-btn danger" data-id="${esc(d.id||d.localId)}" data-status="outdated">Cần cập nhật</button></div></td></tr>`).join('')}</tbody></table></div>`;
    document.querySelectorAll('[data-status]').forEach(btn=>btn.onclick=async()=>{try{await api('approveDrug',{id:btn.dataset.id,status:btn.dataset.status});loadAll();}catch(e){alert(e.message)}});
  }

  async function exportApproved(){
    try{ const data = await api('exportApproved'); const blob = new Blob([JSON.stringify(data.drugs,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='vpmed-approved-clinical-drugs.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
    catch(e){ alert(e.message); }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
