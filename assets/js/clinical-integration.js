(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var dropdowns = Array.prototype.slice.call(document.querySelectorAll('.nav-dropdown-item'));
    var disclaimerPromise = null;
    function loadDisclaimer() {
      if (window.VpmedDisclaimerGate) return Promise.resolve();
      if (disclaimerPromise) return disclaimerPromise;
      disclaimerPromise = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = 'assets/disclaimer-gate.js?v=20260822-disclaimer-gate-v1';
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
      return disclaimerPromise;
    }
    function setOpen(item, open) {
      if (!item) return;
      var trigger = item.querySelector('.nav-dropdown-trigger');
      var menu = item.querySelector('.nav-dropdown-menu');
      if (!trigger || !menu) return;
      trigger.setAttribute('aria-expanded', String(open));
      menu.hidden = !open;
      item.classList.toggle('is-open', open);
    }
    function closeAll(exceptItem) {
      dropdowns.forEach(function (item) {
        if (item !== exceptItem) setOpen(item, false);
      });
    }
    dropdowns.forEach(function (item) {
      var trigger = item.querySelector('.nav-dropdown-trigger');
      if (!trigger) return;
      trigger.addEventListener('click', function () {
        var shouldOpen = trigger.getAttribute('aria-expanded') !== 'true';
        closeAll(item);
        setOpen(item, shouldOpen);
      });
    });
    document.addEventListener('click', function (event) {
      if (!event.target.closest || !event.target.closest('.nav-dropdown-item')) closeAll();
      var clinicalTrigger = event.target.closest && event.target.closest('[data-open],[data-go]');
      if (clinicalTrigger) {
        closeAll();
        var feature = clinicalTrigger.getAttribute('data-open') || clinicalTrigger.getAttribute('data-go');
        if (feature && feature !== 'home' && feature !== 'sources') loadDisclaimer();
      }
      var sectionLink = event.target.closest && event.target.closest('.nav-dropdown-menu a[href^="#"]');
      if (sectionLink) closeAll();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeAll();
    });
    if (String(location.hash || '').startsWith('#clinical-') && !['#clinical-home', '#clinical-sources'].includes(location.hash)) {
      loadDisclaimer();
    }
  });
})();
