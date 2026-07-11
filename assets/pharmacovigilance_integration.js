/* VPMED – Cảnh báo dược tích hợp cùng web chính. Giao diện modal như bản 42 cảnh báo. */
(function(){
  'use strict';
  const VERSION='20260711c';
  const ROUTE='pharmacovigilance';
  let host, root, alerts=[], activeCategory='Tất cả', initialized=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const dateToTime=s=>{const m=String(s||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);return m?new Date(+m[3],+m[2]-1,+m[1]).getTime():0};
  const levelNames={red:'Khẩn cấp',orange:'Quan trọng',yellow:'Theo dõi',green:'Thông tin'};
  const $=sel=>root?.querySelector(sel);
  const $$=sel=>Array.from(root?.querySelectorAll(sel)||[]);

  function injectCard(){
    const grid=document.querySelector('#view-home .feature-grid');
    if(!grid||grid.querySelector('[data-open="pharmacovigilance"]')) return;
    const card=document.createElement('button');
    card.type='button'; card.className='feature-card pharmacovigilance-feature'; card.dataset.open=ROUTE;
    card.innerHTML='<span class="feature-icon">⚕️</span><b>Cảnh báo dược về sử dụng thuốc</b><small>Tra cứu 42 cảnh báo an toàn thuốc, ADR, tương tác, thuốc nguy cơ cao và biện pháp giảm thiểu nguy cơ.</small><em id="pvHomeBadge">42 cảnh báo · tự động cập nhật</em>';
    const sourceCard=grid.querySelector('[data-open="sources"]');
    if(sourceCard) grid.insertBefore(card,sourceCard); else grid.appendChild(card);
    card.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openView(ROUTE);});
    syncHomeIntroduction();
  }

  function syncHomeIntroduction(){
    const list=document.getElementById('heroFeatureList');
    const grid=document.querySelector('#view-home .feature-grid');
    if(!list||!grid)return;
    const cards=Array.from(grid.querySelectorAll('.feature-card')).filter(c=>c.dataset.introExclude!=='true');
    list.innerHTML=cards.map(c=>{const t=c.querySelector('b')?.textContent?.trim();const d=c.querySelector('small')?.textContent?.trim();return t?`<li><strong>${esc(t)}:</strong>${d?` ${esc(d)}`:''}</li>`:''}).filter(Boolean).join('');
  }

  function injectView(){
    if(document.getElementById('view-pharmacovigilance')) return;
    const section=document.createElement('section');
    section.className='view'; section.id='view-pharmacovigilance';
    section.innerHTML='<div class="back-home-wrap"><button type="button" class="back-home-btn" id="pvBackHome"><span aria-hidden="true">←</span> Quay lại Trang chủ</button></div><div id="pvExactHost"></div>';
    const sources=document.getElementById('view-sources');
    const parent=sources?.parentNode || document.querySelector('main.app-shell') || document.querySelector('main') || document.body;
    if(sources?.parentNode) sources.parentNode.insertBefore(section,sources); else parent.appendChild(section);
    document.getElementById('pvBackHome')?.addEventListener('click',()=>openView('home'));
    host=section.querySelector('#pvExactHost');
    root=host.attachShadow({mode:'open'});
    buildApp();
  }

  function buildApp(){
    root.innerHTML=`<style>
      :host{display:block;--blue:#075f9f;--blue2:#0a78ba;--navy:#0b3553;--cyan:#e9f6fd;--bg:#f3f7fa;--white:#fff;--text:#17212b;--muted:#62717d;--line:#d8e2e8;--red:#ba1a1a;--redbg:#fff0f0;--orange:#a34f00;--orangebg:#fff5e8;--yellow:#7a5b00;--yellowbg:#fff9df;--green:#137149;--greenbg:#eaf8f1;--shadow:0 10px 28px rgba(10,57,86,.10);font-family:Arial,"Segoe UI",sans-serif;color:var(--text)}
      *{box-sizing:border-box}button,input,select{font:inherit}a{color:var(--blue)}
      .app{line-height:1.48;padding-bottom:76px}.wrap{max-width:1440px;margin:auto}
      .hero{background:linear-gradient(135deg,#064f85,#0879b9 62%,#38a6d5);color:#fff;border-radius:22px;padding:24px;box-shadow:var(--shadow);display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center}
      .hero h1{margin:3px 0 8px;font-size:30px;line-height:1.15}.hero p{margin:0;max-width:940px;color:#e9f8ff}.eyebrow{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.09em;color:#cceeff}
      .hero-badge{min-width:230px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.30);border-radius:17px;padding:15px;text-align:center}.hero-badge b{display:block;font-size:24px}.hero-badge small{color:#e9f8ff}
      .notice{margin-top:14px;background:#fff;border-left:6px solid var(--blue);border-radius:13px;padding:12px 15px;box-shadow:0 5px 18px rgba(10,57,86,.06)}.notice b{color:var(--blue)}
      .sync-note{margin-top:10px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:9px;background:#eef9f4;border:1px solid #b9dfcd;border-left:6px solid var(--green);border-radius:13px;padding:10px 13px;color:#214b38}.sync-note b{color:#0c6841}.sync-meta{font-size:12px;color:#49685a}.sync-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:#dff4e9;color:#0b6740;padding:5px 9px;font-size:11px;font-weight:900}.sync-dot{width:8px;height:8px;border-radius:50%;background:#18a35f;box-shadow:0 0 0 4px rgba(24,163,95,.12)}
      .btn{border:0;border-radius:11px;padding:10px 14px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px}.btn-soft{background:var(--cyan);color:var(--blue)}
      .toolbar{margin-top:16px;background:#fff;border:1px solid var(--line);border-radius:17px;padding:14px;box-shadow:0 5px 18px rgba(10,57,86,.05)}
      .search-row{display:grid;grid-template-columns:minmax(280px,1.8fr) repeat(3,minmax(150px,.7fr)) auto;gap:10px}.field{width:100%;border:1px solid #c9d7df;border-radius:11px;padding:11px 12px;background:#fff;color:var(--text);outline:none}.field:focus{border-color:#4ba2d1;box-shadow:0 0 0 3px rgba(45,148,202,.12)}
      .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}.stat{background:#f8fbfd;border:1px solid var(--line);border-radius:12px;padding:10px 12px}.stat b{display:block;font-size:20px;color:var(--navy)}.stat span{font-size:12px;color:var(--muted)}
      .layout{display:grid;grid-template-columns:250px minmax(0,1fr);gap:16px;margin-top:16px;align-items:start}.side{position:sticky;top:78px;background:#fff;border:1px solid var(--line);border-radius:17px;padding:14px;box-shadow:0 5px 18px rgba(10,57,86,.05)}
      .side h3{margin:0 0 10px;color:var(--navy);font-size:16px}.side button{width:100%;text-align:left;border:0;background:#fff;border-radius:10px;padding:9px 10px;margin:2px 0;cursor:pointer;color:#33434f}.side button:hover,.side button.active{background:var(--cyan);color:var(--blue);font-weight:800}.side hr{border:0;border-top:1px solid var(--line);margin:12px 0}.legend{display:flex;align-items:flex-start;gap:8px;font-size:13px;margin:8px 0}.dot{width:11px;height:11px;border-radius:50%;flex:0 0 auto;margin-top:4px}.dot.red{background:var(--red)}.dot.orange{background:#d76b00}.dot.yellow{background:#c89b00}.dot.green{background:var(--green)}
      .main-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:10px}.main-head h2{margin:0;color:var(--navy);font-size:21px}.main-head p{margin:3px 0 0;color:var(--muted);font-size:13px}.result-count{font-weight:800;color:var(--blue);white-space:nowrap}
      .cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.card{background:#fff;border:1px solid var(--line);border-radius:17px;overflow:hidden;box-shadow:0 5px 18px rgba(10,57,86,.05);display:flex;flex-direction:column;min-height:285px}.card-top{height:5px}.card-top.red{background:var(--red)}.card-top.orange{background:#d76b00}.card-top.yellow{background:#c89b00}.card-top.green{background:var(--green)}
      .card-body{padding:15px;display:flex;flex-direction:column;height:100%}.meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px}.pill{border-radius:999px;padding:4px 8px;font-size:11px;font-weight:900}.pill.red{background:var(--redbg);color:var(--red)}.pill.orange{background:var(--orangebg);color:var(--orange)}.pill.yellow{background:var(--yellowbg);color:var(--yellow)}.pill.green{background:var(--greenbg);color:var(--green)}.pill.gray{background:#eef3f6;color:#566671}.pill.auto{background:#e5f2ff;color:#075f9f}
      .card h3{margin:0 0 7px;font-size:18px;line-height:1.3;color:#102f45}.drug{font-size:13px;color:var(--blue);font-weight:800;margin-bottom:8px}.summary{font-size:14px;color:#364650;margin:0 0 11px}.quick{background:#f7fafc;border-radius:11px;padding:9px 10px;font-size:13px;margin-bottom:12px}.quick b{color:var(--navy)}
      .card-foot{margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:9px;border-top:1px solid #e5ecef;padding-top:10px}.date{font-size:12px;color:var(--muted)}.detail-btn{border:0;background:var(--cyan);color:var(--blue);font-weight:900;border-radius:10px;padding:8px 10px;cursor:pointer}.empty{background:#fff;border:1px dashed #adc1cc;border-radius:16px;padding:35px;text-align:center;color:var(--muted);grid-column:1/-1}
      .modal{position:fixed;inset:0;background:rgba(7,28,42,.58);z-index:2147483000;display:none;align-items:center;justify-content:center;padding:18px}.modal.open{display:flex}.modal-panel{background:#fff;border-radius:20px;max-width:980px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 24px 70px rgba(0,0,0,.28)}
      .modal-head{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--line);padding:15px 18px;display:flex;justify-content:space-between;gap:15px;align-items:flex-start;z-index:2}.modal-head h2{margin:4px 0 0;font-size:23px;line-height:1.25;color:var(--navy)}.close{width:38px;height:38px;border-radius:50%;border:0;background:#edf3f6;cursor:pointer;font-size:20px}.modal-body{padding:18px}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.box{border:1px solid var(--line);border-radius:14px;padding:13px;background:#fff}.box h4{margin:0 0 8px;color:var(--navy)}.box ul{margin:0;padding-left:20px}.box li{margin:5px 0}.box.full{grid-column:1/-1}.alert-box{border-left:5px solid var(--red);background:var(--redbg)}.source-box{background:#f6fafc}.source-link{word-break:break-word}.source-link a{font-weight:800}.auto-source{border-left:5px solid var(--blue);background:#f2f9fd}.auto-excerpt{white-space:pre-line;color:#314550}
      .fixed-note{position:fixed;left:0;right:0;bottom:0;z-index:2147482000;background:#fff7f7;border-top:2px solid #d43c3c;padding:9px 16px;text-align:center;color:#7b1c1c;font-size:13px;font-weight:800;box-shadow:0 -4px 14px rgba(80,0,0,.08)}
      @media(max-width:1050px){.search-row{grid-template-columns:1fr 1fr}.search-row .search{grid-column:1/-1}.layout{grid-template-columns:1fr}.side{position:static}.side .category-list{display:flex;overflow:auto;gap:5px}.side button{width:auto;white-space:nowrap}.cards{grid-template-columns:1fr 1fr}}
      @media(max-width:760px){.hero{grid-template-columns:1fr;padding:18px}.hero h1{font-size:24px}.hero-badge{min-width:0}.search-row{grid-template-columns:1fr}.search-row .search{grid-column:auto}.stats{grid-template-columns:1fr 1fr}.cards{grid-template-columns:1fr}.detail-grid{grid-template-columns:1fr}.box.full{grid-column:auto}.fixed-note{font-size:11px;padding:7px 9px}.main-head{align-items:flex-start;flex-direction:column}}
    </style>
    <div class="app"><main class="wrap">
      <section class="hero"><div><div class="eyebrow">Thông tin thuốc và cảnh giác dược</div><h1>Cảnh báo dược về sử dụng thuốc</h1><p>Tra cứu nhanh cảnh báo an toàn, phản ứng có hại đáng chú ý, tương tác nguy hiểm, dấu hiệu nhận biết sớm và biện pháp giảm thiểu nguy cơ trong quá trình sử dụng thuốc.</p></div><div class="hero-badge"><b id="heroCount">42 cảnh báo</b><small id="heroUpdated">Đang kiểm tra dữ liệu mới…</small></div></section>
      <div class="notice"><b>Phạm vi:</b> Đây là thư viện thông tin cảnh báo dược, không phải biểu mẫu báo cáo ADR. Nội dung ưu tiên nguồn của Trung tâm DI & ADR Quốc gia và cơ quan quản lý dược.</div>
      <div class="sync-note"><div><span class="sync-badge"><span class="sync-dot"></span>Tự động đồng bộ</span> <b>Kiểm tra nguồn chính thức mỗi giờ.</b></div><div id="syncStatus" class="sync-meta">Đang tải trạng thái đồng bộ…</div></div>
      <section class="toolbar"><div class="search-row"><input id="searchInput" class="field search" type="search" placeholder="Tìm theo hoạt chất, nhóm thuốc, ADR, dấu hiệu hoặc tương tác..." autocomplete="off"><select id="levelFilter" class="field"><option value="">Tất cả mức cảnh báo</option><option value="red">Khẩn cấp</option><option value="orange">Quan trọng</option><option value="yellow">Theo dõi</option><option value="green">Thông tin</option></select><select id="systemFilter" class="field"><option value="">Tất cả hệ cơ quan</option></select><select id="yearFilter" class="field"><option value="">Tất cả năm</option></select><button id="resetBtn" class="btn btn-soft" type="button">Đặt lại</button></div><div class="stats"><div class="stat"><b id="totalStat">42</b><span>Tổng cảnh báo</span></div><div class="stat"><b id="redStat">0</b><span>Mức khẩn cấp</span></div><div class="stat"><b id="interactionStat">0</b><span>Cảnh báo tương tác</span></div><div class="stat"><b id="latestStat">0</b><span>Cập nhật năm 2026</span></div></div></section>
      <section class="layout"><aside class="side"><h3>Nhóm cảnh báo</h3><div id="categoryList" class="category-list"></div><hr><h3>Mức cảnh báo</h3><div class="legend"><span class="dot red"></span><span><b>Khẩn cấp:</b> nguy cơ đe dọa tính mạng hoặc cần xử trí ngay</span></div><div class="legend"><span class="dot orange"></span><span><b>Quan trọng:</b> cần rà soát sớm, chỉnh thuốc hoặc tăng theo dõi</span></div><div class="legend"><span class="dot yellow"></span><span><b>Theo dõi:</b> tiếp tục sử dụng có giám sát phù hợp</span></div><div class="legend"><span class="dot green"></span><span><b>Thông tin:</b> lưu ý thực hành và tư vấn người bệnh</span></div></aside><div><div class="main-head"><div><h2>Danh sách cảnh báo</h2><p>Chọn một cảnh báo để xem đầy đủ yếu tố nguy cơ, dấu hiệu và nội dung cần theo dõi.</p></div><div id="resultCount" class="result-count">42/42 cảnh báo</div></div><div id="cards" class="cards"></div></div></section>
    </main>
    <div id="modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-panel"><div class="modal-head"><div><div id="modalMeta" class="meta"></div><h2 id="modalTitle"></h2></div><button id="closeModal" class="close" type="button" aria-label="Đóng">×</button></div><div id="modalBody" class="modal-body"></div></div></div>
    <div class="fixed-note">Thông tin chỉ nhằm hỗ trợ tra cứu và rà soát an toàn thuốc; không thay thế tờ hướng dẫn sử dụng được phê duyệt, chẩn đoán, xử trí cấp cứu hoặc quyết định chuyên môn của bác sĩ.</div></div>`;
    bindEvents();
  }

  function openView(name){
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById(`view-${name}`)?.classList.add('active');
    document.querySelectorAll('.main-nav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
    document.getElementById('mainNav')?.classList.remove('open');
    try{history.replaceState(null,'',name==='home'?'#home':'#'+name)}catch(_e){}
    window.scrollTo({top:0,behavior:'smooth'});
    if(name===ROUTE&&!initialized) loadData();
  }

  async function readJson(url){const r=await fetch(`${url}?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
  function titleKey(x){return norm(x?.title).replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ')}
  function mergeItems(curated,auto){
    const out=[], ids=new Set(), titles=new Set();
    const add=(raw,isAuto)=>{
      if(!raw||!raw.title)return;
      const id=String(raw.id||'').trim(); const tk=titleKey(raw);
      if((id&&ids.has(id))||(tk&&titles.has(tk)))return;
      if(id)ids.add(id);if(tk)titles.add(tk);
      out.push({...raw,auto:Boolean(isAuto||raw.auto)});
    };
    curated.forEach(x=>add(x,false));
    auto.forEach(x=>add(x,true));
    return out.sort((a,b)=>dateToTime(b.date)-dateToTime(a.date));
  }

  async function loadData(){
    if(initialized)return; initialized=true;
    try{
      const [c,a]=await Promise.allSettled([readJson('assets/pharmacovigilance_alerts.json'),readJson('assets/pharmacovigilance_auto.json')]);
      const curated=c.status==='fulfilled'?(c.value.items||[]):[];
      const auto=a.status==='fulfilled'?(a.value.items||[]):[];
      alerts=mergeItems(curated,auto);
      const checked=a.status==='fulfilled'&&a.value.checked_at?new Date(a.value.checked_at).toLocaleString('vi-VN'):'chưa chạy lần đầu';
      $('#syncStatus').textContent=`Đồng bộ dữ liệu gần nhất: ${checked} · ${alerts.filter(x=>x.auto).length} tin tự động đang hiển thị`;
      if(!curated.length) $('#syncStatus').textContent='Không tải được dữ liệu đã biên tập. Kiểm tra tệp pharmacovigilance_alerts.json.';
    }catch(e){alerts=[];$('#syncStatus').textContent='Không tải được dữ liệu cảnh báo.';console.error(e)}
    fillFilters();updateStats();render();
    const badge=document.getElementById('pvHomeBadge');if(badge)badge.textContent=`${alerts.length} cảnh báo · tự động cập nhật`;
  }

  function fillFilters(){
    const systems=[...new Set(alerts.flatMap(a=>String(a.system||'').split(' · ')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
    $('#systemFilter').innerHTML='<option value="">Tất cả hệ cơ quan</option>'+systems.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    const years=[...new Set(alerts.map(a=>String(a.year||'')).filter(Boolean))].sort((a,b)=>Number(b)-Number(a));
    $('#yearFilter').innerHTML='<option value="">Tất cả năm</option>'+years.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    const cats=['Tất cả',...new Set(alerts.map(a=>a.category).filter(Boolean))];
    $('#categoryList').innerHTML=cats.map(c=>`<button type="button" data-category="${esc(c)}" class="${c===activeCategory?'active':''}">${esc(c)}</button>`).join('');
    $('#categoryList').onclick=e=>{const b=e.target.closest('button');if(!b)return;activeCategory=b.dataset.category;$$('#categoryList button').forEach(x=>x.classList.toggle('active',x===b));render()};
  }

  function getFiltered(){
    const q=norm($('#searchInput').value),level=$('#levelFilter').value,system=$('#systemFilter').value,year=$('#yearFilter').value;
    return alerts.filter(a=>{const hay=norm([a.title,a.drugs,a.summary,a.quick,a.category,a.system,...(a.risk||[]),...(a.signs||[]),...(a.action||[]),...(a.monitor||[])].join(' '));return(!q||hay.includes(q))&&(!level||a.level===level)&&(!system||String(a.system||'').includes(system))&&(!year||String(a.year)===year)&&(activeCategory==='Tất cả'||a.category===activeCategory)});
  }

  function render(){
    const list=getFiltered(); $('#resultCount').textContent=`${list.length}/${alerts.length} cảnh báo`;
    $('#cards').innerHTML=list.length?list.map(a=>`<article class="card"><div class="card-top ${esc(a.level)}"></div><div class="card-body"><div class="meta"><span class="pill ${esc(a.level)}">${esc(levelNames[a.level]||'Theo dõi')}</span><span class="pill gray">${esc(a.category||'Cảnh báo thuốc')}</span>${a.interaction?'<span class="pill gray">Tương tác</span>':''}${a.auto?'<span class="pill auto">Tự động từ nguồn</span>':''}</div><h3>${esc(a.title)}</h3><div class="drug">${esc(a.drugs||'Thuốc/nhóm thuốc liên quan')}</div><p class="summary">${esc(a.summary||'')}</p><div class="quick"><b>Điểm cần nhớ:</b> ${esc(a.quick||'Đọc bài nguồn và rà soát trước khi áp dụng.')}</div><div class="card-foot"><span class="date">${esc(a.date||'Chưa rõ ngày')} · ${esc(a.source||'Nguồn chính thức')}</span><button class="detail-btn" data-id="${esc(a.id)}" type="button">Xem chi tiết</button></div></div></article>`).join(''):'<div class="empty"><b>Không tìm thấy cảnh báo phù hợp.</b><br>Hãy đổi từ khóa hoặc đặt lại bộ lọc.</div>';
    $$('.detail-btn').forEach(b=>b.addEventListener('click',()=>openDetail(b.dataset.id)));
  }

  const listHtml=items=>`<ul>${(items||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
  function openDetail(id){
    const a=alerts.find(x=>String(x.id)===String(id));if(!a)return;
    $('#modalMeta').innerHTML=`<span class="pill ${esc(a.level)}">${esc(levelNames[a.level]||'Theo dõi')}</span><span class="pill gray">${esc(a.category||'Cảnh báo thuốc')}</span><span class="pill gray">Cập nhật ${esc(a.date||'')}</span>${a.auto?'<span class="pill auto">Tự động từ nguồn</span>':''}`;
    $('#modalTitle').textContent=a.title;
    if(a.auto){
      $('#modalBody').innerHTML=`<div class="detail-grid"><div class="box full auto-source"><h4>Điểm tin mới được đồng bộ tự động</h4><p><b>Chủ đề/thuốc liên quan:</b> ${esc(a.drugs)}</p><p class="auto-excerpt">${esc(a.excerpt||a.summary)}</p><p><b>Lưu ý:</b> ${esc(a.quick)}</p></div><div class="box"><h4>Trạng thái chuyên môn</h4><p>Tin đã được đưa lên web khi nguồn chính thức công bố. Nội dung chi tiết chưa được Khoa Dược chuẩn hóa thành quy tắc cảnh báo lâm sàng.</p></div><div class="box"><h4>Hành động phù hợp</h4>${listHtml(a.action?.length?a.action:['Mở bài gốc để đọc đầy đủ','Dược sĩ rà soát trước khi chuyển thành cảnh báo áp dụng trong bệnh viện'])}</div><div class="box full source-box"><h4>Nguồn thông tin</h4><p><b>${esc(a.source)}</b></p><p class="source-link"><a href="${esc(a.url||'#')}" target="_blank" rel="noopener noreferrer">Mở bài nguồn gốc ↗</a></p></div></div>`;
    }else{
      $('#modalBody').innerHTML=`<div class="detail-grid"><div class="box full alert-box"><h4>Thông tin cảnh báo</h4><p><b>Thuốc/nhóm thuốc:</b> ${esc(a.drugs)}</p><p>${esc(a.summary)}</p><p><b>Điểm cần nhớ:</b> ${esc(a.quick)}</p></div><div class="box"><h4>Đối tượng và yếu tố nguy cơ</h4>${listHtml(a.risk)}</div><div class="box"><h4>Dấu hiệu cần nhận biết</h4>${listHtml(a.signs)}</div><div class="box"><h4>Hành động cần xem xét</h4>${listHtml(a.action)}</div><div class="box"><h4>Nội dung cần theo dõi</h4>${listHtml(a.monitor)}</div><div class="box full source-box"><h4>Nguồn thông tin</h4><p><b>${esc(a.source)}</b></p><p class="source-link"><a href="${esc(a.url||'#')}" target="_blank" rel="noopener noreferrer">Mở nội dung gốc từ nguồn tham khảo ↗</a></p><p><small>Nội dung đã được tóm tắt để hỗ trợ tra cứu nhanh; cần đối chiếu tờ hướng dẫn sử dụng, phác đồ và dữ liệu lâm sàng trước khi áp dụng.</small></p></div></div>`;
    }
    $('#modal').classList.add('open');document.body.style.overflow='hidden';
  }
  function closeModal(){$('#modal').classList.remove('open');document.body.style.overflow=''}
  function updateStats(){
    $('#heroCount').textContent=`${alerts.length} cảnh báo`;$('#totalStat').textContent=alerts.length;$('#redStat').textContent=alerts.filter(a=>a.level==='red').length;$('#interactionStat').textContent=alerts.filter(a=>a.interaction).length;$('#latestStat').textContent=alerts.filter(a=>String(a.year)==='2026').length;
    const newest=[...alerts].sort((a,b)=>dateToTime(b.date)-dateToTime(a.date))[0];$('#heroUpdated').textContent=newest?`Dữ liệu mới nhất: ${newest.date}`:'Chưa xác định ngày cập nhật';
  }
  function bindEvents(){
    ['searchInput','levelFilter','systemFilter','yearFilter'].forEach(id=>$('#'+id).addEventListener(id==='searchInput'?'input':'change',render));
    $('#resetBtn').addEventListener('click',()=>{$('#searchInput').value='';$('#levelFilter').value='';$('#systemFilter').value='';$('#yearFilter').value='';activeCategory='Tất cả';$$('#categoryList button').forEach((b,i)=>b.classList.toggle('active',i===0));render()});
    $('#closeModal').addEventListener('click',closeModal);$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
  }
  function init(){injectCard();injectView();const grid=document.querySelector('#view-home .feature-grid');if(grid&&window.MutationObserver)new MutationObserver(()=>{injectCard();syncHomeIntroduction()}).observe(grid,{childList:true,subtree:true});const h=location.hash.replace('#','');if(h===ROUTE||h==='canh-bao-duoc')setTimeout(()=>openView(ROUTE),0)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
