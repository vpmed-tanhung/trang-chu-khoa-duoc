/* VPMED – Gắn nguyên giao diện file Cảnh báo dược vào Ứng dụng chính. */
(function(){
  'use strict';
  const ROUTE='pharmacovigilance';
  const FRAME_SRC='assets/pharmacovigilance/index.html?v=20260711-exact-file';

  function addStyle(){
    if(document.getElementById('pvExactEmbedStyle'))return;
    const s=document.createElement('style');s.id='pvExactEmbedStyle';
    s.textContent=`
      #view-pharmacovigilance{display:none!important;padding:0!important;margin:0!important;max-width:none!important;width:100%!important}
      #view-pharmacovigilance.active{display:block!important;position:fixed!important;inset:0!important;z-index:2147483000!important;background:#f3f7fa!important;overflow:hidden!important}
      #view-pharmacovigilance .pv-exact-frame{display:block!important;width:100%!important;height:100vh!important;border:0!important;margin:0!important;padding:0!important;background:#f3f7fa!important}
      body.pv-exact-open{overflow:hidden!important}
      body.pv-exact-open>header,body.pv-exact-open>footer{display:none!important}
      body.pv-exact-open .app-shell{padding:0!important;margin:0!important;max-width:none!important;width:100%!important}
    `;
    document.head.appendChild(s);
  }

  function addCard(){
    const grid=document.querySelector('#view-home .feature-grid');if(!grid)return;
    grid.querySelectorAll('[data-open="pharmacovigilance"],[data-open="canh-bao-duoc"]').forEach((el,i)=>{if(i>0)el.remove()});
    let card=grid.querySelector('[data-open="pharmacovigilance"]');
    if(!card){
      card=document.createElement('button');card.type='button';card.className='feature-card pharmacovigilance-feature';card.dataset.open=ROUTE;
      const before=grid.querySelector('[data-open="sources"]');
      if(before)grid.insertBefore(card,before);else grid.appendChild(card);
    }
    card.innerHTML='<span class="feature-icon">⚕️</span><b>Cảnh báo dược về sử dụng thuốc</b><small>Tra cứu 42 cảnh báo an toàn thuốc, ADR, tương tác, dấu hiệu nhận biết và biện pháp giảm thiểu nguy cơ.</small><em>Cập nhật tự động</em>';
    card.onclick=function(e){e.preventDefault();e.stopPropagation();openExact();};
  }

  function addHeroLine(){
    const list=document.getElementById('heroFeatureList');if(!list||list.querySelector('[data-pv-exact-line]'))return;
    const li=document.createElement('li');li.dataset.pvExactLine='1';li.innerHTML='<strong>Cảnh báo dược về sử dụng thuốc:</strong> Tra cứu cảnh báo an toàn thuốc, ADR và tương tác mới.';list.appendChild(li);
  }

  function addView(){
    document.querySelectorAll('#view-pharmacovigilance').forEach((el,i)=>{if(i>0)el.remove()});
    let view=document.getElementById('view-pharmacovigilance');
    if(!view){view=document.createElement('section');view.className='view';view.id='view-pharmacovigilance';document.querySelector('main.app-shell,main')?.appendChild(view);}
    view.innerHTML='<iframe class="pv-exact-frame" title="Cảnh báo dược về sử dụng thuốc" src="'+FRAME_SRC+'" loading="eager"></iframe>';
    return view;
  }

  function openExact(){
    const view=document.getElementById('view-pharmacovigilance')||addView();
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    view.classList.add('active');document.body.classList.add('pv-exact-open');
    document.querySelectorAll('.main-nav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===ROUTE));
    document.getElementById('mainNav')?.classList.remove('open');
    if(location.hash!=='#'+ROUTE)history.pushState(null,'','#'+ROUTE);
  }

  function closeExact(){
    document.body.classList.remove('pv-exact-open');
    document.getElementById('view-pharmacovigilance')?.classList.remove('active');
  }

  function route(){
    const hash=location.hash.replace('#','');
    if(hash===ROUTE||hash==='canh-bao-duoc')openExact();else closeExact();
  }

  function init(){addStyle();addCard();addHeroLine();addView();window.addEventListener('hashchange',route);route();
    const grid=document.querySelector('#view-home .feature-grid');if(grid&&window.MutationObserver)new MutationObserver(addCard).observe(grid,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
