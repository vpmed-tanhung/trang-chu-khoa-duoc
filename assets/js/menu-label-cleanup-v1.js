'use strict';

(function () {
  function cleanClinicalMenu() {
    document.querySelectorAll('.clinical-nav-menu a').forEach(function (link) {
      link.classList.remove('is-public-feature');
    });
  }

  cleanClinicalMenu();
  document.addEventListener('DOMContentLoaded', cleanClinicalMenu, { once: true });
  window.addEventListener('vpmed-auth-ready', cleanClinicalMenu);
  window.addEventListener('vpmed:auth-changed', cleanClinicalMenu);

  var menu = document.getElementById('clinical-nav-menu');
  if (menu && typeof MutationObserver === 'function') {
    new MutationObserver(cleanClinicalMenu).observe(menu, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }
})();
