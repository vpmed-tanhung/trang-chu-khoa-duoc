async function loadAntibiotics(){
  let base = Array.isArray(window.VPMED_ANTIBIOTICS_DATA)
    ? window.VPMED_ANTIBIOTICS_DATA
    : [];

  // Khi chạy trên GitHub Pages/máy chủ, ưu tiên đọc file JSON mới nhất.
  // Khi mở trực tiếp bằng file://, trình duyệt thường chặn fetch; dữ liệu nhúng sẽ được dùng tự động.
  if (location.protocol !== 'file:') {
    try {
      const res = await fetch('./data/antibiotics.json', { cache: 'no-store' });
      if (res.ok) base = await res.json();
    } catch (error) {
      console.warn('Không tải được JSON bên ngoài, dùng dữ liệu dự phòng đã nhúng.', error);
    }
  }
  if (!Array.isArray(base) || !base.length) {
    throw new Error('Không có dữ liệu kháng sinh khả dụng.');
  }

  let custom=[];
  try{custom=JSON.parse(localStorage.getItem('vpmed_custom_antibiotics')||'[]')}catch(e){}
  const byId=new Map(base.map(x=>[x.id,x])); custom.forEach(x=>byId.set(x.id,x));
  return [...byId.values()].sort((a,b)=>(a.stt_noi_tru||999)-(b.stt_noi_tru||999));
}
const state={data:[],selectedId:null,activeTab:'overview'};
const esc=v=>(v??'').toString().replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function norm(v){return (v||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function list(items){return items?.length?items.map(i=>`<li>${esc(i)}</li>`).join(''):'<li>Không ghi nhận dữ liệu phù hợp trong hồ sơ hiện tại.</li>'}
function rows(obj){return obj&&Object.keys(obj).length?Object.entries(obj).map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join(''):'<tr><td colspan="2">Chưa có dữ liệu.</td></tr>'}
function interactions(items){return items?.length?items.map(x=>`<article class="interaction"><div><b>${esc(x.cap||'Tương tác')}</b><span class="severity ${norm(x.muc_do)}">${esc(x.muc_do||'Theo dõi')}</span></div><p>${esc(x.canh_bao||'')}</p><small><b>Xử trí:</b> ${esc(x.xu_tri||'Đánh giá lâm sàng và theo dõi.')}</small></article>`).join(''):'<p>Chưa ghi nhận tương tác ưu tiên mức độ cao trong hồ sơ hiện tại; vẫn cần rà soát toàn bộ y lệnh.</p>'}
function tabs(){return [['overview','Tổng quan'],['dose','Liều & CrCl'],['admin','Pha truyền'],['safety','Chống chỉ định & ADR'],['interactions','Tương tác'],['monitor','Theo dõi & TDM'],['refs','Nguồn']].map(([id,t])=>`<button class="tab-btn ${state.activeTab===id?'active':''}" data-tab="${id}">${t}</button>`).join('')}
function panel(item){
 const c=item.thong_tin_chuyen_mon||{}, pha=c.pha_truyen||item.cach_pha_truyen||{}, tdm=c.tdm||item.tdm||{};
 const panels={
 overview:`<div class="content-grid"><section><h4>Cơ chế tác dụng</h4><p>${esc(c.co_che||'Chưa có dữ liệu.')}</p><h4>Phổ tác dụng</h4><ul>${list(c.pho_tac_dung)}</ul></section><section><h4>Chỉ định chính</h4><ul>${list(c.chi_dinh_chinh||item.chi_dinh_goi_y)}</ul><h4>PK/PD</h4><ul>${list(c.duoc_dong_hoc)}</ul></section></div>`,
 dose:`<section><h4>Liều chuẩn người lớn</h4><p>${esc(c.lieu_chuan||item.lieu_goi_y?.lieu_truyen_thong||'')}</p><h4>ODA / truyền kéo dài</h4><p>${esc(c.oda_truyen_keo_dai||item.lieu_goi_y?.oda_keo_dai||'Không áp dụng.')}</p><div class="table-wrap"><table class="renal-table"><thead><tr><th>CrCl / phương thức lọc máu</th><th>Khuyến cáo liều</th></tr></thead><tbody>${rows(c.hieu_chinh_than||item.lieu_goi_y?.hieu_chinh_crcl)}</tbody></table></div><p class="source-line"><b>Nguồn hiệu chỉnh:</b> ${(item.nguon_hieu_chinh_than||[]).map(esc).join(' · ')}</p></section>`,
 admin:`<div class="content-grid"><section><h4>Dung môi / hoàn nguyên</h4><p>${esc(pha.dung_moi||'')}</p><h4>Tốc độ / thời gian dùng</h4><p>${esc(pha.toc_do||'')}</p></section><section><h4>Lưu ý tương hợp</h4><p>${esc(pha.luu_y||'')}</p><h4>Bảo quản</h4><p>${esc(c.bao_quan||'Theo tờ hướng dẫn sử dụng của chế phẩm.')}</p></section></div>`,
 safety:`<div class="content-grid"><section><h4>Chống chỉ định</h4><ul>${list(c.chong_chi_dinh||item.chong_chi_dinh)}</ul></section><section><h4>ADR cần lưu ý</h4><ul>${list(c.adr||item.adr_can_luu_y)}</ul></section></div>`,
 interactions:`<section><h4>Tương tác thuốc ưu tiên lâm sàng</h4><div class="interaction-list">${interactions(c.tuong_tac||item.canh_bao_tuong_tac)}</div></section>`,
 monitor:`<div class="content-grid"><section><h4>Theo dõi</h4><ul>${list(c.theo_doi||item.theo_doi)}</ul></section><section><h4>TDM</h4><p><b>${tdm.can?'Cần/ưu tiên TDM':'Không cần TDM thường quy'}</b></p><p>${esc(tdm.muc_tieu||'')}</p></section></div>`,
 refs:`<section><h4>Nguồn tham khảo</h4><ul>${list(item.nguon_tham_khao)}</ul></section>`
 };
 return panels[state.activeTab]||panels.overview;
}
function card(item){return `<article class="abx-card"><header class="drug-header"><div><p class="eyebrow">STT nội trú ${esc(item.stt_noi_tru)}</p><h3>${esc(item.ten_thuoc_biet_duoc)}</h3><p><b>Hoạt chất:</b> ${esc(item.hoat_chat)}</p></div></header><div class="quick-meta"><span><b>Nhóm:</b> ${esc(item.nhom_khang_sinh)}</span><span><b>Hàm lượng:</b> ${esc(item.ham_luong_nong_do)}</span><span><b>Đường dùng:</b> ${esc(item.duong_dung)}</span></div><nav class="detail-tabs">${tabs()}</nav><div class="tab-panel">${panel(item)}</div></article>`}
function filtered(){const q=norm(document.querySelector('#abxSearch')?.value),g=document.querySelector('#groupFilter')?.value||'';return state.data.filter(x=>(!q||norm([x.ten_thuoc_biet_duoc,x.hoat_chat,x.nhom_khang_sinh].join(' ')).includes(q))&&(!g||x.nhom_khang_sinh===g))}
function renderList(items){const el=document.querySelector('#abxListPanel');if(!el)return;el.innerHTML=items.length?items.map(x=>`<button class="drug-item ${state.selectedId===x.id?'selected':''}" data-id="${esc(x.id)}"><b>${esc(x.ten_thuoc_biet_duoc)}</b><span>${esc(x.hoat_chat)}</span><small>${esc(x.ham_luong_nong_do)}</small></button>`).join(''):'<p class="error">Không tìm thấy thuốc.</p>';el.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>selectDrug(b.dataset.id))}
function selectDrug(id){const item=state.data.find(x=>x.id===id);if(!item)return;state.selectedId=id;document.querySelector('#abxResult').innerHTML=card(item);renderList(filtered());document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.activeTab=b.dataset.tab;selectDrug(id)})}
function refresh(){const items=filtered();renderList(items);if(!items.length){document.querySelector('#abxResult').innerHTML='<p class="error">Không tìm thấy thuốc phù hợp.</p>';return}if(!items.some(x=>x.id===state.selectedId))state.selectedId=items[0].id;selectDrug(state.selectedId)}
function setup(data){state.data=data;state.selectedId=data[0]?.id;document.querySelector('#metricTotal').textContent=data.length;const groups=[...new Set(data.map(x=>x.nhom_khang_sinh).filter(Boolean))].sort((a,b)=>norm(a).localeCompare(norm(b)));document.querySelector('#groupFilter').innerHTML='<option value="">Tất cả nhóm</option>'+groups.map(g=>`<option>${esc(g)}</option>`).join('');document.querySelector('#abxSearch').oninput=refresh;document.querySelector('#groupFilter').onchange=refresh;refresh()}
document.addEventListener('DOMContentLoaded',async()=>{document.querySelector('.menu-toggle')?.addEventListener('click',()=>document.querySelector('.nav')?.classList.toggle('open'));try{setup(await loadAntibiotics())}catch(e){console.error(e);document.querySelector('#abxResult').innerHTML='<p class="error">Không tải được dữ liệu kháng sinh. Hãy kiểm tra lại gói cài đặt.</p>'}});
