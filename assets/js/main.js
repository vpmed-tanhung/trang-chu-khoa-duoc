document.addEventListener('DOMContentLoaded', function () {
  var configuredVersion = String((window.KHOA_DUOC_SERVER || {}).appVersion || '').trim();
  document.querySelectorAll('[data-app-version]').forEach(function (label) {
    if (configuredVersion) label.textContent = 'v' + configuredVersion.replace(/^v/i, '');
  });

  var toggle = document.querySelector('.nav-toggle');
  var navigation = document.querySelector('.main-nav');
  function addDropdown(triggerSelector, links) {
    var trigger = navigation ? navigation.querySelector(triggerSelector) : null;
    if (!trigger || trigger.parentElement.querySelector('.nav-dropdown')) return;
    var parent = trigger.parentElement;
    var dropdown = document.createElement('ul');
    dropdown.className = 'nav-dropdown';
    links.forEach(function (item) {
      var existing = navigation.querySelector('a[href="' + item.href + '"]');
      var child = existing && existing.parentElement.parentElement === navigation.querySelector('ul')
        ? existing.parentElement
        : document.createElement('li');
      var link = existing || document.createElement('a');
      if (!existing) {
        link.href = item.href;
        link.textContent = item.label;
        child.appendChild(link);
      }
      dropdown.appendChild(child);
    });
    parent.classList.add('has-dropdown');
    trigger.setAttribute('aria-haspopup', 'true');
    var caret = document.createElement('span');
    caret.className = 'nav-caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = '▾';
    trigger.appendChild(caret);
    parent.appendChild(dropdown);
  }

  addDropdown('a[href="#gioi-thieu"]', [
    { href: '#chuc-nang', label: 'Chức năng – nhiệm vụ' },
    { href: '#to-chuc', label: 'Cơ cấu tổ chức' }
  ]);
  addDropdown('a[href="#cong-cu"]', [
    { href: 'cong-cu-tuong-tac-thuoc.html', label: 'Kiểm tra tương tác thuốc' },
    { href: 'cong-cu-lieu-khang-sinh.html', label: 'Liều kháng sinh & CrCl/eGFR' },
    { href: 'cong-cu-lieu-nhi.html', label: 'Liều kháng sinh Nhi & MIC' },
    { href: 'cong-cu-pet-ct.html', label: 'Tính liều PET/CT' }
  ]);
  addDropdown('a[href="#ban-tin"]', [
    { href: 'thong-tin-thuoc.html', label: 'Thông tin thuốc' },
    { href: 'huong-dan-su-dung.html', label: 'Hướng dẫn sử dụng' }
  ]);
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

      if (link.hash) {
        setActiveLink(link.hash.slice(1));
      }
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setMenuState(false);
      toggle.focus();
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
