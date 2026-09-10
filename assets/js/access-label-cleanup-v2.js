'use strict';

(function () {
  var openFeatures = new Set([
    'dose',
    'interactions',
    'pediatric-dose',
    'antibiotics',
    'cap-cuu-phan-ve',
    'pharmacovigilance',
    'sources'
  ]);

  function cleanAccessLabels() {
    document.querySelectorAll('.clinical-nav-menu a').forEach(function (link) {
      link.classList.remove('is-public-feature');
    });
    document.querySelectorAll('[data-clinical-heading-kicker]').forEach(function (label) {
      label.remove();
    });
    document.querySelectorAll('#view-home .feature-card[data-open]').forEach(function (card) {
      if (!openFeatures.has(card.getAttribute('data-open'))) return;
      var badge = card.querySelector('em');
      if (badge) badge.remove();
    });
  }

  cleanAccessLabels();
  document.addEventListener('DOMContentLoaded', cleanAccessLabels, { once: true });
  window.addEventListener('vpmed-auth-ready', cleanAccessLabels);
  window.addEventListener('vpmed:auth-changed', cleanAccessLabels);

  var workspace = document.getElementById('clinical-workspace');
  if (workspace && typeof MutationObserver === 'function') {
    new MutationObserver(cleanAccessLabels).observe(workspace, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });
  }
})();
