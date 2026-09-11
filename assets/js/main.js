document.addEventListener('DOMContentLoaded', function () {
  var configuredVersion = String((window.KHOA_DUOC_SERVER || {}).appVersion || '').trim();
  document.querySelectorAll('[data-app-version]').forEach(function (label) {
    if (configuredVersion) label.textContent = 'v' + configuredVersion.replace(/^v/i, '');
  });

  var toggle = document.querySelector('.nav-toggle');
  var navigation = document.querySelector('.main-nav');
  var navigationLinks = document.querySelectorAll('.main-nav a');
  var header = document.querySelector('.site-header');
  var sectionLinks = Array.prototype.slice.call(document.querySelectorAll('.main-nav a[href^="#"]'));
  var sections = sectionLinks.map(function (link) {
    return document.querySelector(link.getAttribute('href'));
  }).filter(function (section) {
    return section !== null;
  });
  var ticking = false;

  if (!toggle || !navigation) {
    return;
  }

  function setMenuState(isOpen) {
    navigation.classList.toggle('open', isOpen);
    document.body.classList.toggle('nav-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Đóng menu' : 'Mở menu');
  }

  var dropdownItems = Array.prototype.slice.call(document.querySelectorAll('.nav-dropdown-item'));

  function setDropdownState(item, isOpen) {
    if (!item) return;
    var trigger = item.querySelector('.nav-dropdown-trigger');
    var menu = item.querySelector('.nav-dropdown-menu');
    if (!trigger || !menu) return;
    trigger.setAttribute('aria-expanded', String(isOpen));
    menu.hidden = !isOpen;
    item.classList.toggle('is-open', isOpen);
  }

  function closeDropdowns(exceptItem) {
    dropdownItems.forEach(function (item) {
      if (item !== exceptItem) setDropdownState(item, false);
    });
  }

  dropdownItems.forEach(function (item) {
    var trigger = item.querySelector('.nav-dropdown-trigger');
    if (!trigger) return;
    trigger.addEventListener('click', function () {
      var shouldOpen = trigger.getAttribute('aria-expanded') !== 'true';
      closeDropdowns(item);
      setDropdownState(item, shouldOpen);
    });
  });
  document.documentElement.dataset.headerDropdowns = 'ready';

  document.addEventListener('click', function (event) {
    if (!event.target.closest || !event.target.closest('.nav-dropdown-item')) {
      closeDropdowns();
    }
  });

  function setActiveLink(sectionId) {
    sectionLinks.forEach(function (link) {
      var isActive = link.getAttribute('href') === '#' + sectionId;
      link.classList.toggle('active', isActive);

      if (isActive) {
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    });
    document.querySelectorAll('.nav-dropdown-item').forEach(function (item) {
      var trigger = item.querySelector('.nav-dropdown-trigger');
      if (trigger) trigger.classList.toggle('active', Boolean(item.querySelector('a.active')));
    });
  }

  function updateActiveLinkFromScroll() {
    if (sections.length === 0) {
      return;
    }

    var headerHeight = header ? header.offsetHeight : 0;
    var markerPosition = window.scrollY + headerHeight + 80;
    var currentSection = sections[0];

    sections.forEach(function (section) {
      if (section.offsetTop <= markerPosition) {
        currentSection = section;
      }
    });

    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      currentSection = sections[sections.length - 1];
    }

    setActiveLink(currentSection.id);
  }

  toggle.addEventListener('click', function () {
    var isOpen = toggle.getAttribute('aria-expanded') === 'true';
    setMenuState(!isOpen);
  });

  navigationLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      setMenuState(false);
      closeDropdowns();

      if (link.hash) {
        setActiveLink(link.hash.slice(1));
      }
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeDropdowns();
      if (toggle.getAttribute('aria-expanded') === 'true') {
        setMenuState(false);
        toggle.focus();
      }
    }
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 1040) {
      setMenuState(false);
    }

    updateActiveLinkFromScroll();
  });

  window.addEventListener('scroll', function () {
    if (ticking) {
      return;
    }

    ticking = true;
    window.requestAnimationFrame(function () {
      updateActiveLinkFromScroll();
      ticking = false;
    });
  }, { passive: true });

  updateActiveLinkFromScroll();
  });
