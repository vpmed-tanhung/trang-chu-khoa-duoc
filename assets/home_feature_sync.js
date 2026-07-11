(function(){
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));
  const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const LEVELS = {
    red:{label:'Khẩn cấp',className:'red'},
    orange:{label:'Quan trọng',className:'orange'},
    yellow:{label:'Theo dõi',className:'yellow'},
    green:{label:'Thông tin',className:'green'}
  };
  let pvItems=[];
  let pvAutoMeta=null;

  function syncHomeIntroduction(){
    const list = document.getElementById('heroFeatureList');
    const grid = document.querySelector('#view-home .feature-grid');
    if(!list || !grid) return;
    const cards = Array.from(grid.querySelectorAll('.feature-card')).filter(card => card.dataset.introExclude !== 'true');
    const items = cards.map(card => {
      const title = card.querySelector('b')?.textContent?.trim() || '';
      const description = card.querySelector('small')?.textContent?.trim() || '';
      return title ? `<li><strong>${esc(title)}:</strong>${description ? ` ${esc(description)}` : ''}</li>` : '';
    }).filter(Boolean);
    if(items.length) list.innerHTML = items.join('');
  }

  function loadCss(){
    if(document.querySelector('link[data-pv-style]')) return;
    const link=document.createElement('link');
    link.rel='stylesheet'; link.href='assets/pharmacovigilance.css?v=20260711'; link.dataset.pvStyle='1';
    document.head.appendChild(link);
  }

  function injectCard(){
    const grid=document.querySelector('#view-home .feature-grid');
    if(!grid || grid.querySelector('[data-open="pharmacovigilance"]')) return;
    const card=document.createElement('button');
    card.type='button'; card.className='feature-card pharmacovigilance-feature'; card.dataset.open='pharmacovigilance';
    card.innerHTML='<span class="feature-icon">⚕️</span><b>Cảnh báo dược về sử dụng thuốc</b><small>Tra cứu cảnh báo an toàn thuốc, ADR đáng chú ý, tương tác, thuốc nguy cơ cao và biện pháp giảm thiểu nguy cơ.</small><em>Tự động cập nhật nguồn mới</em>';
    const sourceCard=grid.querySelector('[data-open="sources"]');
    if(sourceCard) grid.insertBefore(card,sourceCard); else grid.appendChild(card);
    card.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openPv();});
  }

  function injectView(){
    if(document.getElementById('view-pharmacovigilance')) return;
    const section=document.createElement('section');
    section.className='view'; section.id='view-pharmacovigilance';
    section.innerHTML=`
      <div class="back-home-wrap"><button type="button" class="back-home-btn" id="pvBackHome"><span aria-hidden="true">←</span> Quay lại Trang chủ</button></div>
      <div class="pv-head">
        <div><span class="pv-kicker">Cảnh giác dược · An toàn sử dụng thuốc</span><h1>Cảnh báo dược về sử dụng thuốc</h1><p>Tra cứu cảnh báo ADR, tương tác, sai sót sử dụng, thuốc nguy cơ cao, theo dõi xét nghiệm, thai kỳ và các biện pháp giảm thiểu nguy cơ. Nội dung mở ngay trong website Hỗ trợ lâm sàng của Khoa Dược.</p></div>
        <div class="pv-count"><strong id="pvHeroCount">0</strong><span>cảnh báo đang hiển thị</span></div>
      </div>
      <div class="pv-note"><b>Phạm vi:</b> Dữ liệu tự động chỉ hiển thị tiêu đề, trích đoạn và liên kết nguồn chính thức. Nội dung xử trí chi tiết chỉ được coi là đã biên tập sau khi Khoa Dược rà soát.</div>
      <div class="pv-toolbar">
        <div class="pv-grid-controls">
          <input id="pvSearch" class="pv-field pv-search" type="search" placeholder="Tìm hoạt chất, nhóm thuốc, ADR, dấu hiệu hoặc tương tác…" autocomplete="off">
          <select id="pvLevel" class="pv-field"><option value="">Tất cả mức cảnh báo</option><option value="red">Khẩn cấp</option><option value="orange">Quan trọng</option><option value="yellow">Theo dõi</option><option value="green">Thông tin</option></select>
          <select id="pvCategory" class="pv-field"><option value="">Tất cả nhóm cảnh báo</option></select>
          <select id="pvYear" class="pv-field"><option value="">Tất cả năm</option></select>
        </div>
        <div class="pv-actions"><div><div id="pvStatus" class="pv-status">Đang tải dữ liệu…</div><div id="pvAutoInfo" class="pv-auto-info"></div></div><button id="pvReset" class="pv-reset" type="button">Đặt lại bộ lọc</button></div>
      </div>
      <div class="pv-stats"><div class="pv-stat"><strong id="pvTotal">0</strong><span>Tổng cảnh báo</span></div><div class="pv-stat"><strong id="pvRed">0</strong><span>Khẩn cấp</span></div><div class="pv-stat"><strong id="pvInteraction">0</strong><span>Có tương tác</span></div><div class="pv-stat"><strong id="pvAuto">0</strong><span>Tin tự động mới</span></div></div>
      <div id="pvList" class="pv-list"><div class="pv-empty">Đang tải dữ liệu cảnh giác dược…</div></div>
      <div class="pv-fixed-note">Thông tin chỉ hỗ trợ tra cứu và nhận diện nguy cơ, không thay thế đánh giá lâm sàng, xử trí cấp cứu hoặc quyết định chuyên môn của bác sĩ.</div>`;
    const main=document.querySelector('main.app-shell') || document.querySelector('main') || document.body;
    const sources=document.getElementById('view-sources');
    if(sources?.parentNode) sources.parentNode.insertBefore(section,sources); else main.appendChild(section);
    document.getElementById('pvBackHome')?.addEventListener('click',()=>openView('home'));
    ['pvSearch','pvLevel','pvCategory','pvYear'].forEach(id=>document.getElementById(id)?.addEventListener(id==='pvSearch'?'input':'change',render));
    document.getElementById('pvReset')?.addEventListener('click',()=>{
      ['pvSearch','pvLevel','pvCategory','pvYear'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});render();
    });
  }

  function openView(name){
    document.querySelectorAll('.view').forEach(view=>view.classList.remove('active'));
    const target=document.getElementById(`view-${name}`);
    if(target) target.classList.add('active');
    document.querySelectorAll('.main-nav button[data-view]').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===name));
    const menu=document.getElementById('mainNav'); if(menu) menu.classList.remove('open');
    try{history.replaceState(null,'',name==='home'?'#home':'#'+name);}catch(_e){}
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function openPv(){openView('pharmacovigilance');if(!pvItems.length)loadData();}

  async function readJson(url){
    const response=await fetch(`${url}${url.includes('?')?'&':'?'}v=${Date.now()}`,{cache:'no-store'});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function dedupe(items){
    const out=[]; const seen=new Set();
    items.forEach(item=>{
      const key=String(item.url||item.id||item.title||'').trim();
      if(!key || seen.has(key)) return; seen.add(key); out.push(item);
    });
    return out;
  }

  function dateValue(text){
    const m=String(text||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return m ? new Date(+m[3],+m[2]-1,+m[1]).getTime() : 0;
  }

  async function loadData(){
    const status=document.getElementById('pvStatus');
    try{
      const [curatedResult,autoResult]=await Promise.allSettled([
        readJson('assets/pharmacovigilance_alerts.json'),
        readJson('assets/pharmacovigilance_auto.json')
      ]);
      const curated=curatedResult.status==='fulfilled'?(curatedResult.value.items||[]):[];
      const auto=autoResult.status==='fulfilled'?(autoResult.value.items||[]):[];
      pvAutoMeta=autoResult.status==='fulfilled'?autoResult.value:null;
      const curatedUrls=new Set(curated.map(x=>x.url).filter(Boolean));
      pvItems=dedupe([...curated,...auto.filter(x=>!curatedUrls.has(x.url))]).sort((a,b)=>dateValue(b.date)-dateValue(a.date));
      fillFilters(); render();
      if(status) status.textContent=`Đã tải ${pvItems.length} cảnh báo.`;
      const info=document.getElementById('pvAutoInfo');
      if(info){
        const checked=pvAutoMeta?.checked_at ? new Date(pvAutoMeta.checked_at).toLocaleString('vi-VN') : 'chưa chạy lần đầu';
        info.textContent=`Kiểm tra nguồn tự động: ${checked}.`;
      }
    }catch(error){
      if(status) status.textContent='Không tải được dữ liệu. Kiểm tra lại các tệp trong thư mục assets.';
      document.getElementById('pvList').innerHTML=`<div class="pv-empty">Lỗi tải dữ liệu: ${esc(error.message)}</div>`;
    }
  }

  function fillFilters(){
    const category=document.getElementById('pvCategory');
    const year=document.getElementById('pvYear');
    if(category){
      const current=category.value;
      const options=[...new Set(pvItems.map(x=>x.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
      category.innerHTML='<option value="">Tất cả nhóm cảnh báo</option>'+options.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
      category.value=current;
    }
    if(year){
      const current=year.value;
      const options=[...new Set(pvItems.map(x=>String(x.year||'')).filter(Boolean))].sort().reverse();
      year.innerHTML='<option value="">Tất cả năm</option>'+options.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
      year.value=current;
    }
  }

  function listBox(title,values,full=false){
    const items=Array.isArray(values)?values.filter(Boolean):[];
    if(!items.length) return '';
    return `<div class="pv-box${full?' full':''}"><h4>${esc(title)}</h4><ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;
  }

  function cardHtml(item){
    const level=LEVELS[item.level]||LEVELS.yellow;
    const auto=!!item.auto;
    return `<article class="pv-card" data-level="${esc(item.level||'yellow')}">
      <div class="pv-card-main">
        <div class="pv-meta"><span class="pv-badge ${level.className}">${level.label}</span><span class="pv-badge">${esc(item.category||'Cảnh báo thuốc')}</span><span class="pv-badge">${esc(item.date||'Chưa rõ ngày')}</span>${auto?'<span class="pv-badge auto">Tự động từ nguồn</span>':''}</div>
        <h3>${esc(item.title)}</h3><div class="pv-drugs">${esc(item.drugs||'Thuốc/nhóm thuốc liên quan')}</div><p class="pv-summary">${esc(item.summary||'')}</p>${item.quick?`<div class="pv-quick">${esc(item.quick)}</div>`:''}
      </div>
      <details><summary>Xem chi tiết cảnh báo</summary><div class="pv-detail"><div class="pv-detail-grid">
        ${listBox('Yếu tố/đối tượng nguy cơ',item.risk)}${listBox('Dấu hiệu cần nhận biết',item.signs)}${listBox('Hành động cần xem xét',item.action)}${listBox('Theo dõi',item.monitor)}
        <div class="pv-box full pv-source"><h4>Nguồn thông tin</h4><div>${esc(item.source||'Nguồn chính thức')}</div>${item.url?`<div><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Mở bài nguồn gốc ↗</a></div>`:''}${item.excerpt?`<p>${esc(item.excerpt)}</p>`:''}</div>
      </div></div></details></article>`;
  }

  function render(){
    const q=fold(document.getElementById('pvSearch')?.value||'');
    const level=document.getElementById('pvLevel')?.value||'';
    const category=document.getElementById('pvCategory')?.value||'';
    const year=document.getElementById('pvYear')?.value||'';
    const filtered=pvItems.filter(item=>{
      const hay=fold([item.title,item.drugs,item.summary,item.quick,item.category,item.system,(item.risk||[]).join(' '),(item.signs||[]).join(' '),(item.action||[]).join(' ')].join(' '));
      return (!q||hay.includes(q))&&(!level||item.level===level)&&(!category||item.category===category)&&(!year||String(item.year)===year);
    });
    const list=document.getElementById('pvList');
    if(list) list.innerHTML=filtered.length?filtered.map(cardHtml).join(''):'<div class="pv-empty">Không tìm thấy cảnh báo phù hợp với bộ lọc.</div>';
    const count=filtered.length;
    const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=String(value);};
    set('pvHeroCount',count);set('pvTotal',pvItems.length);set('pvRed',pvItems.filter(x=>x.level==='red').length);set('pvInteraction',pvItems.filter(x=>x.interaction).length);set('pvAuto',pvItems.filter(x=>x.auto).length);
    const status=document.getElementById('pvStatus');if(status)status.textContent=`Hiển thị ${count}/${pvItems.length} cảnh báo.`;
  }

  function init(){
    loadCss(); injectCard(); injectView(); syncHomeIntroduction();
    const grid=document.querySelector('#view-home .feature-grid');
    if(grid && typeof MutationObserver!=='undefined'){
      const observer=new MutationObserver(()=>{injectCard();syncHomeIntroduction();});
      observer.observe(grid,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-intro-exclude']});
    }
    const hash=location.hash.replace('#','');
    if(hash==='pharmacovigilance'||hash==='canh-bao-duoc') setTimeout(openPv,0);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
