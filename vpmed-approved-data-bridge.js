/*
  VPMED - Liên kết dữ liệu đã duyệt từ Google Sheet/Apps Script sang web chính.
  Chức năng:
  - Lấy CHỈ dữ liệu thuốc đã duyệt từ Apps Script.
  - Lưu cache cục bộ để web vẫn mở được khi mạng chậm.
  - Gắn danh sách thuốc đã duyệt vào các ô tìm thuốc/kháng sinh hiện có.
  - Bổ sung panel dữ liệu đã duyệt cho: Tính liều, Danh mục kháng sinh, Tương tác, Độc gan, Kháng sinh theo bệnh lý.
*/
(function(){
  'use strict';

  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwCBsaJ-L0P9NJ4Qc5Wp6NF69Y-nYS0DZTWAREwSYk16PnStauF90T3X0dcI1QkhWLL/exec';
  const CACHE_KEY = 'vpmed_approved_clinical_data_v1';
  const CACHE_TIME_KEY = 'vpmed_approved_clinical_data_time_v1';
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const text = el => (el && el.textContent ? el.textContent : '').trim();
  const lower = s => String(s||'').toLowerCase();
  const esc = (s='')=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const norm = s => lower(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'');

  let state = { loaded:false, loading:false, error:'', drugs:[], sources:[], updatedAt:'' };

  function addStyles(){
    if($('#vpmedApprovedBridgeStyle')) return;
    const st=document.createElement('style');
    st.id='vpmedApprovedBridgeStyle';
    st.textContent=`
      .vpmed-approved-panel{margin:18px 0;padding:18px;border:1px solid #cfe4ee;border-radius:20px;background:linear-gradient(180deg,#ffffff,#f6fbfd);box-shadow:0 12px 30px rgba(15,23,42,.06);color:#0f172a}
      .vpmed-approved-panel h3{margin:0 0 8px;color:#075985;font-size:20px;line-height:1.25}.vpmed-approved-panel p{line-height:1.55;color:#475569}.vpmed-approved-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0}.vpmed-approved-toolbar input,.vpmed-approved-toolbar select{border:1px solid #cbd5e1;border-radius:14px;padding:11px 12px;font-size:15px;background:#fff;min-width:220px}.vpmed-approved-btn{border:0;border-radius:999px;padding:10px 14px;font-weight:900;cursor:pointer;background:#0f766e;color:white;text-decoration:none;display:inline-flex;align-items:center;gap:6px}.vpmed-approved-btn.secondary{background:#eef7fb;color:#075985;border:1px solid #cfe4ee}.vpmed-approved-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:12px}.vpmed-approved-item{border:1px solid #e2e8f0;border-radius:17px;background:#fff;padding:14px}.vpmed-approved-item strong{color:#064e3b}.vpmed-approved-small{font-size:13px;color:#64748b;line-height:1.45}.vpmed-approved-badge{display:inline-flex;align-items:center;border-radius:999px;background:#dcfce7;color:#166534;font-weight:900;font-size:12px;padding:5px 9px;margin:3px 4px 3px 0}.vpmed-approved-empty{border:1px dashed #cbd5e1;border-radius:14px;padding:14px;background:#f8fafc;color:#64748b}.vpmed-approved-result{white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:15px;padding:14px;margin-top:10px;line-height:1.55}.vpmed-approved-source{border-left:4px solid #0f766e;padding-left:10px;margin-top:8px;color:#475569;font-size:13px}.vpmed-approved-status{position:fixed;right:14px;bottom:14px;z-index:9999;background:#073b4c;color:#fff;border-radius:999px;padding:9px 12px;font-size:12px;font-weight:900;box-shadow:0 10px 30px rgba(0,0,0,.18);opacity:.92}.vpmed-approved-status.error{background:#991b1b}.vpmed-approved-status.loading{background:#075985}@media(max-width:760px){.vpmed-approved-status{position:static;margin:12px}.vpmed-approved-toolbar input,.vpmed-approved-toolbar select{width:100%;min-width:0}.vpmed-approved-list{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  }

  function apiPublic(){
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), 10000);
    const url = WEB_APP_URL + (WEB_APP_URL.includes('?') ? '&' : '?') + 'action=getApprovedClinicalData';
    return fetch(url, {method:'GET', cache:'no-store', signal:controller.signal})
      .then(r=>r.text())
      .then(text=>{
        let j;
        try{ j = JSON.parse(text); }
        catch(e){ throw new Error('Apps Script chưa trả dữ liệu hợp lệ.'); }
        if(!j.ok) throw new Error(j.message||'Không tải được dữ liệu đã duyệt.');
        return j;
      })
      .finally(()=>clearTimeout(timer));
  }

  function normalizeDrug(d){
    const rd = d.renalDose || {};
    const sources = Array.isArray(d.sources) ? d.sources : [];
    return {
      ...d,
      id: d.id || d.localId || [d.brandName,d.activeIngredient].filter(Boolean).join('-'),
      brandName: d.brandName || d.drugName || d.name || '',
      activeIngredient: d.activeIngredient || d.active || d.ingredient || '',
      strength: d.strength || '',
      route: d.route || d.dosageForm || '',
      clinicalGroup: d.clinicalGroup || d.group || d.antibioticGroup || '',
      adultDose: d.adultDose || d.standardDose || '',
      renalDose:{
        crcl_ge_50: rd.crcl_ge_50 || rd.ge50 || rd['≥50'] || '',
        crcl_30_49: rd.crcl_30_49 || rd['30-49'] || '',
        crcl_15_29: rd.crcl_15_29 || rd['15-29'] || '',
        crcl_lt_15: rd.crcl_lt_15 || rd.lt15 || rd['<15'] || '',
        hd: rd.hd || rd.HD || '',
        crrt: rd.crrt || rd.CRRT || ''
      },
      clinicalNotes: d.clinicalNotes || d.notes || d.warnings || '',
      hepaticRisk: d.hepaticRisk || d.liverRisk || '',
      renalRisk: d.renalRisk || '',
      importantAdr: Array.isArray(d.importantAdr) ? d.importantAdr : (d.importantAdr ? [d.importantAdr] : []),
      sources
    };
  }

  function saveCache(data){
    try{ localStorage.setItem(CACHE_KEY, JSON.stringify(data)); localStorage.setItem(CACHE_TIME_KEY, String(Date.now())); }catch(e){}
  }
  function readCache(){
    try{ const raw=localStorage.getItem(CACHE_KEY); return raw?JSON.parse(raw):null; }catch(e){ return null; }
  }

  async function loadApprovedData(force=false){
    if(state.loading) return state;
    const cached=readCache();
    const t=Number(localStorage.getItem(CACHE_TIME_KEY)||0);
    if(!force && cached && Date.now()-t<CACHE_TTL_MS){
      applyData(cached, 'cache'); return state;
    }
    state.loading=true; renderStatus('Đang tải dữ liệu đã duyệt...', 'loading');
    try{
      const data=await apiPublic();
      applyData(data, 'network'); saveCache(data); renderStatus(`Đã tải ${state.drugs.length} thuốc đã duyệt`, 'ok');
    }catch(e){
      state.error=e.message;
      if(cached){ applyData(cached, 'cache-fallback'); renderStatus(`Dùng dữ liệu lưu tạm: ${state.drugs.length} thuốc`, 'loading'); }
      else renderStatus('Chưa tải được dữ liệu đã duyệt', 'error');
    }finally{ state.loading=false; }
    return state;
  }

  function applyData(data){
    state.loaded=true; state.error=''; state.updatedAt=data.updatedAt||'';
    state.drugs=(data.drugs||[]).map(normalizeDrug).filter(d=>d.brandName||d.activeIngredient);
    state.sources=data.sources||[];
    window.VPMED_APPROVED_DRUGS = state.drugs;
    window.VPMED_APPROVED_SOURCES = state.sources;
    window.VPMED_APPROVED_DATA = {
      getDrugs:()=>state.drugs,
      reload:()=>loadApprovedData(true),
      findDrug,
      doseByCrCl,
      renderAll:ensurePanels
    };
    ensureDatalist();
    attachDrugInputs();
    ensurePanels();
  }

  function renderStatus(msg,type){
    addStyles();
    let el=$('#vpmedApprovedStatus');
    if(!el){ el=document.createElement('div'); el.id='vpmedApprovedStatus'; document.body.appendChild(el); }
    el.className='vpmed-approved-status '+(type||'');
    el.textContent=msg;
    if(type==='ok') setTimeout(()=>{ if(el && el.parentNode) el.remove(); }, 3500);
  }

  function ensureDatalist(){
    let dl=$('#vpmedApprovedDatalist');
    if(!dl){ dl=document.createElement('datalist'); dl.id='vpmedApprovedDatalist'; document.body.appendChild(dl); }
    dl.innerHTML=state.drugs.map(d=>`<option value="${esc(d.brandName)}">${esc(d.activeIngredient)} ${esc(d.strength||'')}</option><option value="${esc(d.activeIngredient)}">${esc(d.brandName)} ${esc(d.strength||'')}</option>`).join('');
  }

  function inputLabel(input){
    const id=input.id; const lab=id?document.querySelector(`label[for="${CSS.escape(id)}"]`):null;
    const parent=input.closest('label') || input.parentElement;
    return [input.placeholder,input.name,input.id, lab?lab.textContent:'', parent?parent.textContent:''].join(' ');
  }

  function attachDrugInputs(){
    $$('input[type="text"],input:not([type]),input[type="search"]').forEach(inp=>{
      const label=norm(inputLabel(inp));
      if(/thuoc|khang sinh|hoat chat|biet duoc|drug|antibiotic/.test(label)){
        inp.setAttribute('list','vpmedApprovedDatalist');
        inp.dataset.vpmedApprovedLinked='1';
        if(!inp.dataset.vpmedApprovedListener){
          inp.dataset.vpmedApprovedListener='1';
          inp.addEventListener('change',()=>showInlineDrugResult(inp));
        }
      }
    });
  }

  function showInlineDrugResult(input){
    const d=findDrug(input.value);
    if(!d) return;
    let box=input.parentElement.querySelector('.vpmed-approved-inline');
    if(!box){ box=document.createElement('div'); box.className='vpmed-approved-result vpmed-approved-inline'; input.parentElement.appendChild(box); }
    box.innerHTML=drugSummaryHtml(d);
  }

  function findDrug(q){
    const nq=norm(q);
    if(!nq) return null;
    return state.drugs.find(d=>norm(d.brandName)===nq || norm(d.activeIngredient)===nq) || state.drugs.find(d=>norm(d.brandName).includes(nq) || norm(d.activeIngredient).includes(nq));
  }

  function doseByCrCl(d, crcl){
    if(!d) return '';
    const r=d.renalDose||{};
    const n=Number(crcl);
    if(Number.isFinite(n)){
      if(n>=50) return r.crcl_ge_50 || d.adultDose || '';
      if(n>=30) return r.crcl_30_49 || '';
      if(n>=15) return r.crcl_15_29 || '';
      return r.crcl_lt_15 || r.hd || r.crrt || '';
    }
    return d.adultDose || r.crcl_ge_50 || '';
  }

  function drugSummaryHtml(d){
    const src=(d.sources||[]).map(s=>s.title||s.name||s.sourceId).filter(Boolean).join('; ');
    return `<strong>${esc(d.brandName)}</strong><div class="vpmed-approved-small">${esc(d.activeIngredient)} · ${esc(d.strength)} · ${esc(d.route)} · ${esc(d.clinicalGroup)}</div><div><span class="vpmed-approved-badge">Đã duyệt</span></div>${d.adultDose?`<p><b>Liều thường dùng:</b> ${esc(d.adultDose)}</p>`:''}<p><b>Hiệu chỉnh thận:</b><br>CrCl ≥50: ${esc(d.renalDose.crcl_ge_50||'—')}<br>CrCl 30–49: ${esc(d.renalDose.crcl_30_49||'—')}<br>CrCl 15–29: ${esc(d.renalDose.crcl_15_29||'—')}<br>CrCl &lt;15/HD/CRRT: ${esc(d.renalDose.crcl_lt_15||d.renalDose.hd||d.renalDose.crrt||'—')}</p>${d.clinicalNotes||d.hepaticRisk?`<p><b>Cảnh báo:</b> ${esc(d.clinicalNotes||d.hepaticRisk)}</p>`:''}${src?`<div class="vpmed-approved-source"><b>Nguồn:</b> ${esc(src)}</div>`:''}`;
  }

  function isAdminPage(){ return /cap-nhat-du-lieu/i.test(location.pathname); }

  function findContainerByTitle(regex){
    const hs=$$('h1,h2,h3,h4,.section-title,.card-title,.tool-title');
    for(const h of hs){
      if(!regex.test(norm(text(h)))) continue;
      const sec=h.closest('section,.section,.module,.tool-panel,.content-card,.card,main,article,div');
      if(sec && sec.offsetParent!==null) return sec;
    }
    return null;
  }

  function panelExists(root,type){ return root && root.querySelector(`[data-vpmed-approved-panel="${type}"]`); }
  function putPanel(root,type,html){
    if(!root || panelExists(root,type)) return;
    const el=document.createElement('div'); el.className='vpmed-approved-panel'; el.dataset.vpmedApprovedPanel=type; el.innerHTML=html;
    root.appendChild(el);
    bindPanel(el,type);
  }

  function ensurePanels(){
    if(isAdminPage() || !state.loaded) return;
    addStyles();
    const renal=findContainerByTitle(/tinh lieu|crcl|egfr|cockcroft|chinh lieu/);
    if(renal) putPanel(renal,'renal',renalPanelHtml());
    const list=findContainerByTitle(/danh muc khang sinh|ho so thuoc|danh sach thuoc/);
    if(list) putPanel(list,'list',listPanelHtml('Danh mục thuốc đã duyệt từ dữ liệu quản trị'));
    const interaction=findContainerByTitle(/tuong tac/);
    if(interaction) putPanel(interaction,'interaction',interactionPanelHtml());
    const liver=findContainerByTitle(/doc gan|gan/);
    if(liver) putPanel(liver,'liver',liverPanelHtml());
    const indication=findContainerByTitle(/benh ly|phac do|chi dinh/);
    if(indication) putPanel(indication,'indication',listPanelHtml('Hồ sơ thuốc đã duyệt để tham khảo theo bệnh lý'));
  }

  function optionsHtml(){ return `<option value="">Chọn thuốc đã duyệt...</option>` + state.drugs.map(d=>`<option value="${esc(d.id)}">${esc(d.brandName)} - ${esc(d.activeIngredient)} ${esc(d.strength||'')}</option>`).join(''); }

  function renalPanelHtml(){
    return `<h3>Dữ liệu liều đã duyệt</h3><p>Chọn thuốc và nhập CrCl để lấy liều tham khảo từ hồ sơ đã được duyệt trong mục quản trị.</p><div class="vpmed-approved-toolbar"><select data-drug-select>${optionsHtml()}</select><input data-crcl-input type="number" min="0" step="0.1" placeholder="Nhập CrCl mL/phút"><button class="vpmed-approved-btn" data-action="dose">Xem liều</button></div><div class="vpmed-approved-result" data-result>Chưa chọn thuốc.</div>`;
  }

  function listPanelHtml(title){
    return `<h3>${esc(title)}</h3><p>Dữ liệu bên dưới được lấy từ Google Sheet/Apps Script và chỉ hiển thị các thuốc ở trạng thái <b>Đã duyệt</b>.</p><div class="vpmed-approved-toolbar"><input data-search placeholder="Tìm tên thuốc, hoạt chất, nhóm..."><button class="vpmed-approved-btn secondary" data-action="reload">Tải lại dữ liệu</button></div><div data-list class="vpmed-approved-list">${drugCardsHtml(state.drugs.slice(0,12))}</div>`;
  }

  function interactionPanelHtml(){
    return `<h3>Dữ liệu tương tác/cảnh báo từ hồ sơ đã duyệt</h3><p>Chọn thuốc để xem cảnh báo an toàn, chống chỉ định hoặc tương tác đã nhập trong hồ sơ thuốc.</p><div class="vpmed-approved-toolbar"><select data-drug-select>${optionsHtml()}</select><button class="vpmed-approved-btn" data-action="warn">Xem cảnh báo</button></div><div class="vpmed-approved-result" data-result>Chưa chọn thuốc.</div>`;
  }

  function liverPanelHtml(){
    const liver=state.drugs.filter(d=>/gan|alt|ast|hepato|bilirubin|vang da|men gan|viem gan/.test(norm([d.hepaticRisk,d.clinicalNotes,d.importantAdr.join(' ')].join(' '))));
    return `<h3>Thuốc có cảnh báo liên quan gan trong dữ liệu đã duyệt</h3><p>Danh sách lọc theo nội dung đã nhập tại trường cảnh báo/độc gan. Chỉ dùng khi hồ sơ thuốc đã có nguồn đối chiếu.</p><div data-list class="vpmed-approved-list">${drugCardsHtml((liver.length?liver:state.drugs).slice(0,12))}</div>`;
  }

  function drugCardsHtml(drugs){
    if(!drugs.length) return '<div class="vpmed-approved-empty">Chưa có thuốc đã duyệt.</div>';
    return drugs.map(d=>`<div class="vpmed-approved-item">${drugSummaryHtml(d)}</div>`).join('');
  }

  function bindPanel(el,type){
    const listBox=$('[data-list]',el);
    const search=$('[data-search]',el);
    if(search && listBox){ search.addEventListener('input',()=>{ const q=norm(search.value); const arr=state.drugs.filter(d=>norm([d.brandName,d.activeIngredient,d.clinicalGroup].join(' ')).includes(q)).slice(0,30); listBox.innerHTML=drugCardsHtml(arr); }); }
    const reload=$('[data-action="reload"]',el);
    if(reload) reload.addEventListener('click',async()=>{ await loadApprovedData(true); if(listBox) listBox.innerHTML=drugCardsHtml(state.drugs.slice(0,30)); });
    const dose=$('[data-action="dose"]',el);
    if(dose) dose.addEventListener('click',()=>{ const d=state.drugs.find(x=>x.id===$('[data-drug-select]',el).value); const cr=$('[data-crcl-input]',el).value; $('[data-result]',el).innerHTML = d ? `<b>Liều theo CrCl ${esc(cr||'chưa nhập')}:</b> ${esc(doseByCrCl(d,cr)||'Chưa có dữ liệu liều cho mức này.')}<hr>${drugSummaryHtml(d)}` : 'Chưa chọn thuốc.'; });
    const warn=$('[data-action="warn"]',el);
    if(warn) warn.addEventListener('click',()=>{ const d=state.drugs.find(x=>x.id===$('[data-drug-select]',el).value); $('[data-result]',el).innerHTML = d ? drugSummaryHtml(d) : 'Chưa chọn thuốc.'; });
  }

  function observe(){
    let timer=null;
    const mo=new MutationObserver(()=>{ clearTimeout(timer); timer=setTimeout(()=>{attachDrugInputs();ensurePanels();},300); });
    mo.observe(document.body,{childList:true,subtree:true});
  }

  function mount(){
    if(isAdminPage()) return;
    addStyles();
    loadApprovedData(false);
    observe();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
