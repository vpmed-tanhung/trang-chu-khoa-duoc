/* VPMED secure client for GitHub Pages + Apps Script
   Sau khi deploy Apps Script, thay WEB_APP_URL bằng URL /exec.
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
    const css = `.clinical-admin-wrap{max-width:1180px;margin:24px auto;padding:0 16px;color:#0f172a;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}.clinical-hero{background:linear-gradient(135deg,#e8f5f3,#f8fbff);border:1px solid #dbeafe;border-radius:22px;padding:22px;margin-bottom:18px;box-shadow:0 10px 28px rgba(15,23,42,.08)}.clinical-hero h2{margin:0 0 8px;font-size:26px;color:#0f766e}.clinical-hero p{margin:7px 0;line-height:1.55;color:#334155}.clinical-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px;box-shadow:0 8px 20px rgba(15,23,42,.055);margin-top:14px}.clinical-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.clinical-card h3{margin:0 0 8px;color:#0f766e;font-size:18px}.clinical-actions{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}.clinical-btn{border:0;border-radius:12px;padding:11px 14px;font-weight:800;cursor:pointer;background:#0f766e;color:white;text-decoration:none}.clinical-btn.secondary{background:#eaf2fb;color:#075985}.clinical-btn.danger{background:#fee2e2;color:#991b1b}.clinical-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.clinical-form label{font-weight:800;color:#334155;font-size:13px}.clinical-form input,.clinical-form select,.clinical-form textarea,.loginbox input{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:12px;padding:10px;font-size:15px;background:#fff}.clinical-form textarea{min-height:84px;resize:vertical}.clinical-wide{grid-column:1/-1}.clinical-table{width:100%;border-collapse:separate;border-spacing:0 8px}.clinical-table th{font-size:12px;text-transform:uppercase;color:#64748b;text-align:left;padding:0 8px}.clinical-table td{background:#fff;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;padding:10px 8px;vertical-align:top}.clinical-table td:first-child{border-left:1px solid #e2e8f0;border-radius:12px 0 0 12px}.clinical-table td:last-child{border-right:1px solid #e2e8f0;border-radius:0 12px 12px 0}.clinical-badge{display:inline-block;border-radius:999px;padding:4px 9px;font-weight:800;font-size:12px;background:#e0f2fe;color:#075985}.clinical-badge.approved{background:#dcfce7;color:#166534}.clinical-badge.draft{background:#fef3c7;color:#92400e}.clinical-badge.outdated{background:#fee2e2;color:#991b1b}.clinical-small{font-size:12px;color:#64748b}.clinical-alert{border-left:5px solid #0f766e;background:#f0fdfa;padding:12px;border-radius:12px;color:#134e4a}.clinical-filter{margin:8px 0 12px;display:flex;gap:10px;flex-wrap:wrap}.clinical-filter input,.clinical-filter select{border:1px solid #cbd5e1;border-radius:12px;padding:10px;min-width:220px}@media(max-width:860px){.clinical-grid,.clinical-form{grid-template-columns:1fr}.clinical-admin-wrap{padding:0 10px}.clinical-hero h2{font-size:22px}}`;
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

  function renderLogin(root){
    root.innerHTML = `<div class="clinical-hero"><h2>Cập nhật dữ liệu chuyên môn</h2><p><strong>Khu vực phân quyền qua Google Apps Script.</strong> Dữ liệu lưu trên Google Sheet quản trị, không lưu cục bộ trên máy.</p></div><div class="clinical-card loginbox" style="max-width:520px;margin:18px auto"><h3>Đăng nhập</h3><label><strong>Tài khoản</strong></label><input id="u" placeholder="admin / dsls / duyet"><br><br><label><strong>Mã truy cập</strong></label><input id="p" type="password" placeholder="Nhập mã truy cập"><div class="clinical-actions"><button class="clinical-btn" id="login">Đăng nhập</button><a class="clinical-btn secondary" href="./">Quay lại trang chủ</a></div><div id="msg" class="clinical-small"></div></div>`;
    $('#login').onclick = async()=>{
      $('#msg').textContent='Đang đăng nhập...';
      try{ const data = await api('login', {username:$('#u').value.trim(), passcode:$('#p').value.trim()}); sessionStorage.setItem(TOKEN_KEY,data.token); sessionStorage.setItem(USER_KEY,JSON.stringify(data.user)); renderApp(root); }
      catch(e){ $('#msg').textContent=e.message; }
    };
  }

  async function renderApp(root){
    const user = JSON.parse(sessionStorage.getItem(USER_KEY)||'{}');
    root.innerHTML = `<div class="clinical-hero"><h2>Quản trị dữ liệu thực hành lâm sàng</h2><p>Dữ liệu được lưu vào Google Sheet qua Apps Script. Có phân quyền: admin, editor, reviewer.</p><div class="clinical-actions"><span class="clinical-badge approved">${esc(user.displayName||user.username)} · ${esc(user.role)}</span><button class="clinical-btn secondary" id="logout">Đăng xuất</button><a class="clinical-btn secondary" href="./">Quay lại trang chủ</a></div></div><div class="clinical-grid"><div class="clinical-card"><h3>1. Nhập dữ liệu</h3><p>DSLS thêm/sửa hồ sơ thuốc, nguồn, liều, cảnh báo.</p></div><div class="clinical-card"><h3>2. Rà soát</h3><p>Reviewer/Admin duyệt trạng thái trước khi áp dụng.</p></div><div class="clinical-card"><h3>3. Nhật ký</h3><p>Mỗi thao tác được ghi vào Google Sheet LOGS.</p></div></div><div id="sources" class="clinical-card"><h3>Nguồn chính thức</h3><p>Đang tải...</p></div><div class="clinical-card"><h3>Thêm / cập nhật hồ sơ thuốc</h3><div class="clinical-alert">Chỉ công bố chính thức khi đã đối chiếu nguồn và được duyệt.</div><form id="f" class="clinical-form" style="margin-top:12px"><div><label>Tên thuốc / biệt dược</label><input id="brand" required></div><div><label>Hoạt chất</label><input id="active" required></div><div><label>Hàm lượng</label><input id="strength"></div><div><label>Dạng bào chế / đường dùng</label><input id="route"></div><div><label>Nhóm thuốc</label><input id="group"></div><div><label>Trạng thái</label><select id="status"><option value="draft">Bản nháp</option><option value="reviewed">Đã rà soát</option><option value="approved">Đã duyệt</option><option value="outdated">Cần cập nhật</option><option value="reference">Tham khảo</option></select></div><div class="clinical-wide"><label>Liều người lớn thông thường</label><textarea id="dose"></textarea></div><div><label>CrCl ≥50</label><textarea id="r50"></textarea></div><div><label>CrCl 30–49</label><textarea id="r30"></textarea></div><div><label>CrCl 15–29</label><textarea id="r15"></textarea></div><div><label>CrCl <15 / HD / CRRT</label><textarea id="rhd"></textarea></div><div class="clinical-wide"><label>Cảnh báo độc gan / độc thận / ADR / tương tác / chống chỉ định</label><textarea id="warn"></textarea></div><div class="clinical-wide"><label>Nguồn đối chiếu</label><textarea id="src"></textarea></div><div class="clinical-actions clinical-wide"><button class="clinical-btn" type="submit">Lưu lên Google Sheet</button><button class="clinical-btn secondary" type="reset">Xóa form</button></div></form><div id="saveMsg" class="clinical-small"></div></div><div class="clinical-card"><h3>Danh sách thuốc</h3><div class="clinical-actions"><button class="clinical-btn secondary" id="reload">Tải lại</button><button class="clinical-btn secondary" id="exportApproved">Xuất dữ liệu đã duyệt</button></div><div id="list"><p>Đang tải...</p></div></div><div class="clinical-card"><h3>Nhật ký cập nhật</h3><div id="logs"><p>Đang tải...</p></div></div>`;
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
    try{ await api('saveDrug',{drug:formDrug()}); $('#saveMsg').textContent='Đã lưu lên Google Sheet.'; $('#f').reset(); loadAll(); }
    catch(err){ $('#saveMsg').textContent=err.message; }
  }

  async function loadAll(){
    try{
      const [src, drugs, logs] = await Promise.all([api('getSources'), api('listDrugs'), api('getLogs')]);
      $('#sources').innerHTML = '<h3>Nguồn chính thức</h3>' + (src.sources||[]).map(s=>`<div style="margin:8px 0"><strong>${esc(s.name)}</strong><div class="clinical-small">${esc((s.scope||[]).join(', '))}</div><a href="${esc(s.url)}" target="_blank" rel="noopener">Mở nguồn</a></div>`).join('');
      renderList(drugs.drugs||[]);
      $('#logs').innerHTML = (logs.logs||[]).map(l=>`<div class="clinical-small" style="border-bottom:1px solid #e2e8f0;padding:7px 0"><strong>${esc(l.time)}</strong> · ${esc(l.user)} · ${esc(l.action)}<br>${esc(l.detail)}</div>`).join('') || '<p>Chưa có nhật ký.</p>';
    }catch(e){ $('#list').innerHTML='<p>'+esc(e.message)+'</p>'; }
  }

  function renderList(drugs){
    if(!drugs.length){ $('#list').innerHTML='<p>Chưa có dữ liệu thuốc.</p>'; return; }
    $('#list').innerHTML = `<table class="clinical-table"><thead><tr><th>Thuốc</th><th>Liều/thận</th><th>Nguồn</th><th>Trạng thái</th><th>Duyệt</th></tr></thead><tbody>${drugs.map(d=>`<tr><td><strong>${esc(d.brandName)}</strong><div class="clinical-small">${esc(d.activeIngredient)} · ${esc(d.strength||'')} · ${esc(d.route||'')}</div></td><td><div>${esc(d.adultDose||'')}</div><div class="clinical-small">≥50: ${esc(d.renalDose?.crcl_ge_50||'—')} | 30–49: ${esc(d.renalDose?.crcl_30_49||'—')} | 15–29: ${esc(d.renalDose?.crcl_15_29||'—')}</div></td><td class="clinical-small">${esc((d.sources||[]).map(s=>s.title).join('; '))}</td><td><span class="clinical-badge ${esc(d.review?.status||'draft')}">${esc(statusLabel(d.review?.status))}</span></td><td><button class="clinical-btn secondary" data-id="${esc(d.id||d.localId)}" data-status="approved">Duyệt</button> <button class="clinical-btn danger" data-id="${esc(d.id||d.localId)}" data-status="outdated">Cần cập nhật</button></td></tr>`).join('')}</tbody></table>`;
    document.querySelectorAll('[data-status]').forEach(btn=>btn.onclick=async()=>{try{await api('approveDrug',{id:btn.dataset.id,status:btn.dataset.status});loadAll();}catch(e){alert(e.message)}});
  }

  async function exportApproved(){
    try{ const data = await api('exportApproved'); const blob = new Blob([JSON.stringify(data.drugs,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='vpmed-approved-clinical-drugs.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
    catch(e){ alert(e.message); }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
