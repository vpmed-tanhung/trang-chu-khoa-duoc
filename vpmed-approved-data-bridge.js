/*
  VPMED - Approved Data Bridge (silent mode)
  Mục tiêu:
  - Lấy dữ liệu thuốc ĐÃ DUYỆT từ Apps Script/Google Sheet.
  - KHÔNG chèn thêm khung/panel vào các mục ứng dụng chính.
  - Chỉ đưa dữ liệu vào biến dùng chung để các chức năng hiện có sử dụng.
*/
(function(){
  'use strict';

  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzNUD8GsDCbDh4ftfjXMVWk1WG7V3N1DPHLvg46Z44KXZGrdG5YbO1wtyKoEoGiqcAL/exec';
  const CACHE_KEY = 'vpmed_approved_clinical_data_v2_silent';
  const CACHE_TIME_KEY = 'vpmed_approved_clinical_data_v2_silent_time';
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9+./ -]/g,' ').replace(/\s+/g,' ').trim();
  const esc = s => String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  let state = {loaded:false, loading:false, drugs:[], sources:[], updatedAt:'', error:''};

  function isAdminPage(){ return /cap-nhat-du-lieu/i.test(location.pathname); }

  function normalizeDrug(d){
    const rd = d.renalDose || {};
    return {
      ...d,
      id: d.id || d.localId || [d.brandName,d.drugName,d.activeIngredient].filter(Boolean).join('-'),
      brandName: d.brandName || d.drugName || d.name || '',
      activeIngredient: d.activeIngredient || d.active || d.ingredient || '',
      strength: d.strength || '',
      route: d.route || d.dosageForm || '',
      clinicalGroup: d.clinicalGroup || d.group || d.antibioticGroup || '',
      adultDose: d.adultDose || d.standardDose || '',
      renalDose: {
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
      sources: Array.isArray(d.sources) ? d.sources : []
    };
  }

  function readCache(){
    try { const raw = localStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw) : null; } catch(e){ return null; }
  }
  function saveCache(data){
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); localStorage.setItem(CACHE_TIME_KEY, String(Date.now())); } catch(e){}
  }

  function publish(data){
    state.loaded = true;
    state.error = '';
    state.updatedAt = data.updatedAt || '';
    state.drugs = (data.drugs || []).map(normalizeDrug).filter(d => d.brandName || d.activeIngredient);
    state.sources = data.sources || [];

    // Biến dùng chung cho web chính. Không tạo khung giao diện mới.
    window.VPMED_APPROVED_DRUGS = state.drugs;
    window.VPMED_APPROVED_SOURCES = state.sources;
    window.VPMED_APPROVED_DATA = {
      getDrugs: () => state.drugs,
      getSources: () => state.sources,
      reload: () => loadApprovedData(true),
      findDrug,
      doseByCrCl,
      state: () => ({...state})
    };

    // Alias để những module cũ/dữ liệu cũ có thể đọc nếu cần.
    window.VPMED_CLINICAL_DRUGS = state.drugs;
    window.VPMED_APPROVED_ANTIBIOTICS = state.drugs;

    ensureDatalist();
    attachDrugInputs();
    removeLegacyPanels();

    document.dispatchEvent(new CustomEvent('vpmed:approvedDataReady', {
      detail: {drugs: state.drugs, sources: state.sources, updatedAt: state.updatedAt}
    }));
  }

  async function apiPublic(){
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const url = WEB_APP_URL + (WEB_APP_URL.includes('?') ? '&' : '?') + 'action=getApprovedClinicalData';
    try{
      const res = await fetch(url, {method:'GET', cache:'no-store', signal:controller.signal});
      const txt = await res.text();
      const data = JSON.parse(txt);
      if(!data.ok) throw new Error(data.message || 'Không tải được dữ liệu đã duyệt.');
      return data;
    } finally { clearTimeout(timer); }
  }

  async function loadApprovedData(force=false){
    if(state.loading) return state;

    const cached = readCache();
    const t = Number(localStorage.getItem(CACHE_TIME_KEY) || 0);
    if(cached){
      publish(cached); // hiện dữ liệu có sẵn ngay, không chờ mạng
      if(!force && Date.now() - t < CACHE_TTL_MS) return state;
    }

    state.loading = true;
    try{
      const data = await apiPublic();
      saveCache(data);
      publish(data);
    }catch(e){
      state.error = e.message || 'Không tải được dữ liệu đã duyệt.';
      if(!cached) publish({drugs:[], sources:[], updatedAt:''});
    }finally{
      state.loading = false;
    }
    return state;
  }

  function findDrug(q){
    const nq = norm(q);
    if(!nq) return null;
    return state.drugs.find(d => norm(d.brandName) === nq || norm(d.activeIngredient) === nq)
      || state.drugs.find(d => norm(d.brandName).includes(nq) || norm(d.activeIngredient).includes(nq));
  }

  function doseByCrCl(d, crcl){
    if(!d) return '';
    const r = d.renalDose || {};
    const n = Number(crcl);
    if(Number.isFinite(n)){
      if(n >= 50) return r.crcl_ge_50 || d.adultDose || '';
      if(n >= 30) return r.crcl_30_49 || '';
      if(n >= 15) return r.crcl_15_29 || '';
      return r.crcl_lt_15 || r.hd || r.crrt || '';
    }
    return d.adultDose || r.crcl_ge_50 || '';
  }

  function ensureDatalist(){
    let dl = $('#vpmedApprovedDatalist');
    if(!dl){ dl = document.createElement('datalist'); dl.id='vpmedApprovedDatalist'; document.body.appendChild(dl); }
    dl.innerHTML = state.drugs.map(d => `
      <option value="${esc(d.brandName)}">${esc(d.activeIngredient)} ${esc(d.strength || '')}</option>
      <option value="${esc(d.activeIngredient)}">${esc(d.brandName)} ${esc(d.strength || '')}</option>
    `).join('');
  }

  function inputText(input){
    const id = input.id;
    const lab = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
    const parent = input.closest('label') || input.parentElement;
    return [input.placeholder,input.name,input.id,lab?lab.textContent:'',parent?parent.textContent:''].join(' ');
  }

  function attachDrugInputs(){
    $$('input[type="text"],input[type="search"],input:not([type])').forEach(inp => {
      const label = norm(inputText(inp));
      if(/thuoc|khang sinh|hoat chat|biet duoc|drug|antibiotic/.test(label)){
        inp.setAttribute('list','vpmedApprovedDatalist');
      }
    });
  }

  function removeLegacyPanels(){
    // Xóa toàn bộ khung thừa đã từng được bridge cũ chèn vào các mục ứng dụng.
    $$('.vpmed-approved-panel,[data-vpmed-approved-panel],#vpmedApprovedStatus').forEach(el => el.remove());
  }

  function observeCleanup(){
    let timer = null;
    const mo = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => { removeLegacyPanels(); attachDrugInputs(); }, 250);
    });
    mo.observe(document.body, {childList:true, subtree:true});
  }

  function mount(){
    if(isAdminPage()) return;
    removeLegacyPanels();
    loadApprovedData(false);
    observeCleanup();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
