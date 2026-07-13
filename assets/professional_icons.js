(function () {
  'use strict';

  const STYLE_ID = 'vpmed-professional-icons-style';
  const ICONS = {
    calculator: '<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><path d="M7 6.5h10M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4"/>',
    radiation: '<circle cx="12" cy="12" r="2"/><path d="M10.2 9.2 7.5 4.6A8.5 8.5 0 0 1 12 3v5M13.8 9.2l2.7-4.6A8.5 8.5 0 0 1 20.3 8L16 10.5M15.2 13.4l5.2 2.2A8.5 8.5 0 0 1 17 20l-3.2-4.5M10.2 14.8 7 20a8.5 8.5 0 0 1-3.4-4.4l5.2-2.2"/>',
    capsule: '<path d="m9.4 4.6-4.8 4.8a4.24 4.24 0 0 0 6 6l4.8-4.8a4.24 4.24 0 0 0-6-6Z"/><path d="m8 13 6-6M14.6 19.4a4.24 4.24 0 0 0 6-6l-2-2"/>',
    stethoscope: '<path d="M6 3v5a6 6 0 0 0 12 0V3M4 3h4M16 3h4M12 14v2a4 4 0 0 0 8 0v-1"/><circle cx="20" cy="13" r="2"/>',
    network: '<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="m7.2 10.9 9.5-4M7.2 13.1l9.5 4"/>',
    heartPulse: '<path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l4.1-3.9"/><path d="M14.5 13h2l1-2 2 5 1-3H23"/>',
    maternity: '<circle cx="9" cy="6" r="3"/><path d="M4.5 21v-4.5A4.5 4.5 0 0 1 9 12a4.5 4.5 0 0 1 4.5 4.5V21M16.5 9.5c1.4-1.8 4.5-.8 4.5 1.6 0 2.1-2.4 3.7-4.5 5.3-2.1-1.6-4.5-3.2-4.5-5.3 0-2.4 3.1-3.4 4.5-1.6Z"/>',
    fileSearch: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7M14 2v6h6"/><path d="m14 2 6 6v4"/><circle cx="17" cy="17" r="3"/><path d="m19.3 19.3 2.2 2.2"/>',
    library: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z"/><path d="M8 4v13M12 8h5M12 12h5"/>',
    teamCheck: '<circle cx="9" cy="7" r="3"/><path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 3.8 1.8M16 7.5a3 3 0 0 1 3 3M15.5 19l2 2 4-5"/>',
    shieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    hospital: '<path d="M4 22V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v17M17 9h3a1 1 0 0 1 1 1v12M8 7h5M10.5 4.5v5M8 13h2M13 13h1M8 17h2M13 17h1M9 22v-2h3v2"/>',
    documentCheck: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h3M8 17h2M13 16l1.5 1.5L18 14"/>',
    medicalDocument: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M12 11v7M8.5 14.5h7"/>',
    medicalGuide: '<path d="M3 5.5A3.5 3.5 0 0 1 6.5 4H11v16H6.5A3.5 3.5 0 0 0 3 21V5.5ZM21 5.5A3.5 3.5 0 0 0 17.5 4H13v16h4.5A3.5 3.5 0 0 1 21 21V5.5Z"/><path d="M17 8v6M14 11h6"/>',
    clipboardCheck: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2h6v2M8 10h8M8 14h3M13 16l1.5 1.5L18 14"/>',
    alert: '<path d="M10.3 3.6 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z"/><path d="M8 7h8M8 11h6"/>',
    flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    drugDatabase: '<ellipse cx="10" cy="5" rx="6.5" ry="2.5"/><path d="M3.5 5v6c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V5M3.5 11v5c0 1.4 2.9 2.5 6.5 2.5 1 0 1.9-.1 2.7-.2M18 14v7M14.5 17.5h7"/>',
    kidney: '<path d="M9.5 3C6.5 3 4 5.7 4 9c0 4.8 3.5 8 7 8 1.2 0 2-.8 2-2V8.5C13 5.5 11.7 3 9.5 3ZM15.5 3C18.5 3 21 5.7 21 9c0 4.8-3.5 8-7 8-1.2 0-2-.8-2-2V8.5C12 5.5 13.3 3 15.5 3Z"/><path d="M10 17v4M15 17v4"/>',
    arrowLeft: '<path d="m15 18-6-6 6-6M9 12h10"/>'
  };

  const HOME_ICONS = {
    dose: ['calculator', 'blue'],
    'petct-dose': ['radiation', 'amber'],
    antibiotics: ['capsule', 'teal'],
    diseases: ['stethoscope', 'blue'],
    interactions: ['network', 'red'],
    hepatotoxicity: ['heartPulse', 'red'],
    'pregnancy-lactation': ['maternity', 'purple'],
    'icd10-bhyt': ['fileSearch', 'indigo'],
    sources: ['library', 'slate'],
    'antibiotic-consultation': ['teamCheck', 'amber'],
    pharmacovigilance: ['shieldCheck', 'teal']
  };

  function svg(name) {
    const content = ICONS[name] || ICONS.documentCheck;
    return `<svg class="vpmed-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${content}</svg>`;
  }

  function normalise(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .feature-icon.vpmed-icon-frame,
      .vpmed-source-icon,
      .consultation-source-icon,
      .vpmed-empty-icon{
        display:inline-grid;place-items:center;flex:0 0 auto;font-size:0;
        color:#075d98;background:linear-gradient(145deg,#f4faff,#e3f1fa);
        border:1px solid #c7deec;box-shadow:0 7px 18px rgba(31,74,108,.10)
      }
      .feature-icon.vpmed-icon-frame{width:48px;height:48px;border-radius:14px;margin-bottom:2px}
      .feature-icon.vpmed-icon-frame .vpmed-icon-svg{width:26px;height:26px}
      .feature-card[data-vpmed-icon-tone="amber"] .vpmed-icon-frame{color:#9a5b00;background:linear-gradient(145deg,#fffaf0,#ffedc7);border-color:#efd49a}
      .feature-card[data-vpmed-icon-tone="teal"] .vpmed-icon-frame{color:#08765d;background:linear-gradient(145deg,#f1fcf8,#dff5ed);border-color:#bce2d4}
      .feature-card[data-vpmed-icon-tone="red"] .vpmed-icon-frame{color:#a63b43;background:linear-gradient(145deg,#fff7f7,#fbe5e7);border-color:#efc9cd}
      .feature-card[data-vpmed-icon-tone="purple"] .vpmed-icon-frame{color:#7454a7;background:linear-gradient(145deg,#fbf8ff,#eee7fa);border-color:#d9caef}
      .feature-card[data-vpmed-icon-tone="indigo"] .vpmed-icon-frame{color:#4059a8;background:linear-gradient(145deg,#f7f9ff,#e7ebfa);border-color:#cbd3ef}
      .feature-card[data-vpmed-icon-tone="slate"] .vpmed-icon-frame{color:#52697c;background:linear-gradient(145deg,#fbfdff,#eaf0f4);border-color:#d3dfe7}
      .vpmed-source-icon,.consultation-source-icon{width:42px;height:42px;border-radius:12px;margin:0 0 10px}
      .vpmed-source-icon .vpmed-icon-svg,.consultation-source-icon .vpmed-icon-svg{width:22px;height:22px}
      .source-card[data-vpmed-icon-tone="amber"]>.vpmed-source-icon,.consultation-source[data-vpmed-icon-tone="amber"]>.consultation-source-icon{color:#9a5b00;background:#fff5df;border-color:#edd39d}
      .source-card[data-vpmed-icon-tone="teal"]>.vpmed-source-icon,.consultation-source[data-vpmed-icon-tone="teal"]>.consultation-source-icon{color:#08765d;background:#e8f8f2;border-color:#bce2d4}
      .source-card[data-vpmed-icon-tone="red"]>.vpmed-source-icon{color:#a63b43;background:#fcebed;border-color:#efc9cd}
      .source-card[data-vpmed-icon-tone="purple"]>.vpmed-source-icon{color:#7454a7;background:#f1ebfa;border-color:#d9caef}
      .consultation-source{position:relative}
      .vpmed-empty-icon{width:56px;height:56px;border-radius:16px;margin:0 auto 4px}
      .vpmed-empty-icon .vpmed-icon-svg{width:29px;height:29px}
      .vpmed-back-icon{display:inline-flex!important;align-items:center!important;justify-content:center!important}
      .vpmed-back-icon .vpmed-icon-svg{width:18px;height:18px}
      @media(max-width:640px){.feature-icon.vpmed-icon-frame{width:44px;height:44px;border-radius:13px}.feature-icon.vpmed-icon-frame .vpmed-icon-svg{width:24px;height:24px}}
    `;
    document.head.appendChild(style);
  }

  function iconifyFeatureCards(root) {
    root.querySelectorAll('.feature-card').forEach(card => {
      const route = card.dataset.open || card.dataset.view || '';
      const iconNode = card.querySelector('.feature-icon');
      if (!iconNode) return;
      const config = HOME_ICONS[route] || ['documentCheck', 'blue'];
      if (iconNode.dataset.vpmedIcon === config[0]) return;
      iconNode.innerHTML = svg(config[0]);
      iconNode.classList.add('vpmed-icon-frame');
      iconNode.dataset.vpmedIcon = config[0];
      iconNode.setAttribute('aria-hidden', 'true');
      card.dataset.vpmedIconTone = config[1];
    });
  }

  function sourceIconConfig(title) {
    const text = normalise(title);
    if (text.includes('5948') || text.includes('633 cap') || text.includes('tuong tac')) return ['network', 'red'];
    if (text.includes('29/qd') || text.includes('radiation protection')) return ['shieldCheck', 'teal'];
    if (text.includes('2388') || text.includes('than man')) return ['kidney', 'teal'];
    if (text.includes('icd-10')) return ['fileSearch', 'indigo'];
    if (text.includes('thong tu')) return ['clipboardCheck', 'blue'];
    if (text.includes('thu vien') || text.includes('human health')) return ['library', 'purple'];
    if (text.includes('benh vien') || text.includes('sop noi bo') || text.includes('kho noi tru')) return ['hospital', 'blue'];
    if (text.includes('thuoc') || text.includes('khang sinh')) return ['capsule', 'teal'];
    if (text.includes('iaea')) return ['shieldCheck', 'teal'];
    if (text.includes('pet/ct') || text.includes('snmmi')) return ['radiation', 'amber'];
    if (text.includes('eanm') || text.includes('acr')) return ['documentCheck', 'blue'];
    if (text.includes('quyet dinh')) return ['medicalDocument', 'blue'];
    return ['book', 'blue'];
  }

  function iconifySourceCards(root) {
    root.querySelectorAll('.source-card').forEach(card => {
      const title = card.querySelector('h3')?.textContent || '';
      const config = sourceIconConfig(title);
      const iconNode = card.querySelector(':scope > div');
      if (!iconNode || iconNode.dataset.vpmedIcon === config[0]) return;
      iconNode.innerHTML = svg(config[0]);
      iconNode.classList.add('vpmed-source-icon');
      iconNode.dataset.vpmedIcon = config[0];
      iconNode.setAttribute('aria-hidden', 'true');
      card.dataset.vpmedIconTone = config[1];
    });

    root.querySelectorAll('.consultation-source').forEach(card => {
      const title = card.querySelector('h3')?.textContent || '';
      const text = normalise(title);
      const config = text.includes('5631')
        ? ['shieldCheck', 'amber']
        : text.includes('2115')
          ? ['medicalGuide', 'amber']
          : text.includes('708')
            ? ['capsule', 'teal']
            : ['drugDatabase', 'teal'];
      let iconNode = card.querySelector(':scope > .consultation-source-icon');
      if (!iconNode) {
        iconNode = document.createElement('span');
        iconNode.className = 'consultation-source-icon';
        card.prepend(iconNode);
      }
      if (iconNode.dataset.vpmedIcon === config[0]) return;
      iconNode.innerHTML = svg(config[0]);
      iconNode.dataset.vpmedIcon = config[0];
      iconNode.setAttribute('aria-hidden', 'true');
      card.dataset.vpmedIconTone = config[1];
    });
  }

  function iconifyUtilityElements(root) {
    root.querySelectorAll('.empty-state > div:first-child').forEach(node => {
      if (node.dataset.vpmedIcon === 'flask') return;
      node.innerHTML = svg('flask');
      node.classList.add('vpmed-empty-icon');
      node.dataset.vpmedIcon = 'flask';
      node.setAttribute('aria-hidden', 'true');
    });
    root.querySelectorAll('.back-home-btn > span:first-child').forEach(node => {
      if (node.dataset.vpmedIcon === 'arrowLeft') return;
      node.innerHTML = svg('arrowLeft');
      node.classList.add('vpmed-back-icon');
      node.dataset.vpmedIcon = 'arrowLeft';
      node.setAttribute('aria-hidden', 'true');
    });
  }

  function applyIcons(root) {
    const scope = root && root.querySelectorAll ? root : document;
    installStyles();
    iconifyFeatureCards(scope);
    iconifySourceCards(scope);
    iconifyUtilityElements(scope);
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyIcons(document);
    });
  }

  function init() {
    applyIcons(document);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
