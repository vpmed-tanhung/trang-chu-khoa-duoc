(function(){
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));

  function syncHomeIntroduction(){
    const list = document.getElementById('heroFeatureList');
    const grid = document.querySelector('#view-home .feature-grid');
    if(!list || !grid) return;

    const cards = Array.from(grid.querySelectorAll('.feature-card'))
      .filter(card => card.dataset.introExclude !== 'true');

    const items = cards.map(card => {
      const title = card.querySelector('b')?.textContent?.trim() || '';
      const description = card.querySelector('small')?.textContent?.trim() || '';
      if(!title) return '';
      return `<li><strong>${esc(title)}:</strong>${description ? ` ${esc(description)}` : ''}</li>`;
    }).filter(Boolean);

    if(items.length) list.innerHTML = items.join('');
  }

  function init(){
    syncHomeIntroduction();
    const grid = document.querySelector('#view-home .feature-grid');
    if(!grid || typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver(syncHomeIntroduction);
    observer.observe(grid, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['data-intro-exclude']
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
