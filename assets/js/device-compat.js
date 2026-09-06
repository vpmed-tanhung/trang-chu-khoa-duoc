(function () {
  'use strict';

  function mediaMatches(query) {
    return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  }

  function preferSameTab() {
    return mediaMatches('(max-width: 900px)') ||
      mediaMatches('(pointer: coarse)') ||
      Number((window.navigator && window.navigator.maxTouchPoints) || 0) > 0;
  }

  function configurePdfLink(link) {
    if (!link) return link;
    link.target = preferSameTab() ? '_self' : '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  function openPdf(url) {
    if (!url) return false;

    if (preferSameTab()) {
      window.location.assign(url);
      return true;
    }

    var viewer = window.open(url, '_blank', 'noopener,noreferrer');
    if (viewer) {
      viewer.opener = null;
      return true;
    }

    window.location.assign(url);
    return true;
  }

  function previewLinkFor(preview) {
    var wrapper = preview && preview.parentElement;
    if (!wrapper) return null;
    var link = wrapper.querySelector('.document-pdf-preview-open');

    if (!link) {
      link = document.createElement('a');
      link.className = 'document-pdf-preview-open';
      link.textContent = 'Mở PDF đã chọn';
      link.rel = 'noopener noreferrer';
      wrapper.appendChild(link);
    }

    return link;
  }

  function showPdfPreview(preview, empty, url) {
    if (!preview || !url) return;
    var openLink = previewLinkFor(preview);

    if (openLink) {
      openLink.href = url;
      openLink.hidden = false;
      configurePdfLink(openLink);
    }

    if (preferSameTab()) {
      preview.removeAttribute('data');
      preview.classList.remove('is-visible');
      if (empty) {
        if (!empty.dataset.defaultText) empty.dataset.defaultText = empty.textContent;
        empty.textContent = 'Thiết bị này sẽ mở PDF ở màn hình riêng.';
        empty.hidden = false;
      }
      return;
    }

    preview.data = url;
    preview.classList.add('is-visible');
    if (empty) empty.hidden = true;
  }

  function clearPdfPreview(preview, empty) {
    if (preview) {
      preview.removeAttribute('data');
      preview.classList.remove('is-visible');
      var openLink = previewLinkFor(preview);
      if (openLink) {
        openLink.removeAttribute('href');
        openLink.hidden = true;
      }
    }

    if (empty) {
      if (empty.dataset.defaultText) empty.textContent = empty.dataset.defaultText;
      empty.hidden = false;
    }
  }

  window.KHOA_DUOC_DEVICE = Object.freeze({
    preferSameTab: preferSameTab,
    configurePdfLink: configurePdfLink,
    openPdf: openPdf,
    showPdfPreview: showPdfPreview,
    clearPdfPreview: clearPdfPreview
  });
}());
