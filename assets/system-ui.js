/* VPMED – loading hệ thống và điều hướng điện thoại, 12/07/2026 */
(function(){
  'use strict';
  var root=document.documentElement;
  var loader=document.getElementById('systemLoader');
  var bar=document.getElementById('systemLoaderBar');
  var status=document.getElementById('systemLoaderStatus');
  var percent=document.getElementById('systemLoaderPercent');
  var started=Date.now(),closed=false,closing=false,current=7,timer=null;
  function setProgress(value,label){current=Math.max(current,Math.min(100,Math.round(value)));if(bar)bar.style.width=current+'%';if(percent)percent.textContent=current+'%';if(status&&label)status.textContent=label}
  function closeLoader(){if(closed||closing)return;closing=true;var wait=Math.max(0,1800-(Date.now()-started));setTimeout(function(){if(timer)clearInterval(timer);setProgress(100,'Hệ thống đã sẵn sàng');setTimeout(function(){closed=true;if(loader)loader.classList.add('is-hidden');root.classList.remove('system-loading');setTimeout(function(){if(loader&&loader.parentNode)loader.parentNode.removeChild(loader)},480)},350)},wait)}
  if(loader){var steps=[{at:23,label:'Đang khởi tạo giao diện…'},{at:46,label:'Đang tải công cụ lâm sàng…'},{at:68,label:'Đang chuẩn bị dữ liệu tra cứu…'},{at:86,label:'Đang hoàn tất hệ thống…'}],i=0;timer=setInterval(function(){if(i<steps.length){setProgress(steps[i].at,steps[i].label);i+=1}else if(current<93){setProgress(current+1,'Đang hoàn tất hệ thống…')}},380);if(document.readyState==='complete')closeLoader();else window.addEventListener('load',closeLoader,{once:true});setTimeout(closeLoader,6000)}else root.classList.remove('system-loading');

  function setupMenu(){var button=document.getElementById('menuBtn'),nav=document.getElementById('mainNav');if(!button||!nav)return;button.setAttribute('aria-controls','mainNav');
    function sync(){var open=nav.classList.contains('open');button.setAttribute('aria-expanded',open?'true':'false');button.setAttribute('aria-label',open?'Đóng menu':'Mở menu');document.body.classList.toggle('mobile-menu-open',open&&innerWidth<=1100)}
    function close(){nav.classList.remove('open');sync()}
    button.addEventListener('click',function(){requestAnimationFrame(sync)});nav.addEventListener('click',function(e){if(e.target.closest('a,button'))close()});document.addEventListener('click',function(e){if(!nav.classList.contains('open'))return;if(nav.contains(e.target)||button.contains(e.target))return;close()});document.addEventListener('keydown',function(e){if(e.key==='Escape'){close();button.focus()}});window.addEventListener('resize',function(){if(innerWidth>1100)close();else sync()},{passive:true});sync()}
  function addTableAccessibility(){document.querySelectorAll('.table-wrap,.pl-table-wrap').forEach(function(w){if(w.dataset.mobileScrollReady==='true')return;w.dataset.mobileScrollReady='true';w.setAttribute('tabindex','0');w.setAttribute('role','region');if(!w.getAttribute('aria-label'))w.setAttribute('aria-label','Bảng dữ liệu có thể cuộn ngang trên điện thoại')})}
  function init(){setupMenu();addTableAccessibility();var scheduled=false;new MutationObserver(function(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){addTableAccessibility();scheduled=false})}).observe(document.body,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
}());
