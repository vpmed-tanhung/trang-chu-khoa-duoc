(() => {
  'use strict';

  const VERSION_URL = 'assets/app-version.json';
  const POLL_INTERVAL_MS = 5 * 60 * 1000;
  const CURRENT_VERSION_KEY = 'vpmed-app-current-version';
  const PENDING_VERSION_KEY = 'vpmed-app-pending-version';
  const JUST_UPDATED_KEY = 'vpmed-app-just-updated';
  const DISMISSED_PREFIX = 'vpmed-update-notice-dismissed:';
  let applyTimer = 0;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));

  function readStorage(key) {
    try { return localStorage.getItem(key) || ''; } catch (_) { return ''; }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) { /* Thiết bị chặn lưu cục bộ. */ }
  }

  function removeStorage(key) {
    try { localStorage.removeItem(key); } catch (_) { /* Thiết bị chặn lưu cục bộ. */ }
  }

  function wasDismissed(id) {
    return readStorage(`${DISMISSED_PREFIX}${id}`) === '1';
  }

  function rememberDismissed(id) {
    writeStorage(`${DISMISSED_PREFIX}${id}`, '1');
  }

  function waitUntilAppReady(callback) {
    if (!document.documentElement.classList.contains('system-loading')) {
      callback();
      return;
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      observer.disconnect();
      callback();
    };
    const observer = new MutationObserver(() => {
      if (!document.documentElement.classList.contains('system-loading')) finish();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.setTimeout(finish, 7000);
  }

  function showNotice(options) {
    const id = String(options.id || 'cap-nhat-hien-tai').trim();
    if (wasDismissed(id)) return;

    const current = document.getElementById('vpmedUpdateNotice');
    if (current?.dataset.noticeId === id) return;
    current?.remove();

    const notice = document.createElement('aside');
    notice.id = 'vpmedUpdateNotice';
    notice.dataset.noticeId = id;
    notice.className = `vpmed-update-notice${options.tone === 'success' ? ' is-success' : ''}`;
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.innerHTML = `
      <div class="vpmed-update-notice__card">
        <span class="vpmed-update-notice__icon" aria-hidden="true">${options.tone === 'success' ? '✓' : '↻'}</span>
        <span class="vpmed-update-notice__copy">
          <span class="vpmed-update-notice__label">${escapeHtml(options.label || 'Cập nhật ứng dụng')}</span>
          <strong class="vpmed-update-notice__title">${escapeHtml(options.title || '')}</strong>
          <span class="vpmed-update-notice__message">${escapeHtml(options.message || '')}</span>
          ${options.note ? `<span class="vpmed-update-notice__note">${escapeHtml(options.note)}</span>` : ''}
        </span>
        <button type="button" class="vpmed-update-notice__dismiss">Đã hiểu</button>
      </div>`;

    document.body.appendChild(notice);
    notice.querySelector('.vpmed-update-notice__dismiss')?.addEventListener('click', () => {
      rememberDismissed(id);
      notice.classList.remove('is-visible');
      window.setTimeout(() => notice.remove(), 260);
    });
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      notice.classList.add('is-visible');
    }));
  }

  function presentNotice(options) {
    waitUntilAppReady(() => showNotice(options));
  }

  async function loadManifest() {
    try {
      const response = await fetch(`${VERSION_URL}?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json();
      if (!manifest?.version || !manifest?.release_at) return null;
      if (Number.isNaN(Date.parse(manifest.release_at))) return null;
      return manifest;
    } catch (_) {
      return null;
    }
  }

  function scheduledNotice(version) {
    return {
      id: `sap-cap-nhat:${version}`,
      title: 'Phiên bản mới sẽ được cập nhật tự động tối nay',
      message: 'Hệ thống tiếp tục hoạt động bình thường, không làm gián đoạn phiên tra cứu hiện tại.',
      note: 'Bản mới sẽ được áp dụng tự động trong đêm; từ sáng mai các bác sĩ sẽ sử dụng phiên bản mới nhất.'
    };
  }

  function completedNotice(version) {
    return {
      id: `da-cap-nhat:${version}`,
      tone: 'success',
      title: 'Ứng dụng đã được cập nhật thành công',
      message: 'Hệ thống đang sử dụng phiên bản mới nhất.',
      note: 'Các chức năng đã sẵn sàng để bác sĩ tiếp tục sử dụng.'
    };
  }

  function applyVersion(manifest) {
    const version = String(manifest.version);
    writeStorage(CURRENT_VERSION_KEY, version);
    writeStorage(JUST_UPDATED_KEY, version);
    removeStorage(PENDING_VERSION_KEY);

    const url = new URL(window.location.href);
    url.searchParams.set('app_version', version.slice(0, 12));
    window.location.replace(url.href);
  }

  function scheduleApplication(manifest) {
    window.clearTimeout(applyTimer);
    const delay = Date.parse(manifest.release_at) - Date.now();
    if (delay <= 0) {
      applyVersion(manifest);
      return;
    }
    applyTimer = window.setTimeout(() => applyVersion(manifest), Math.min(delay, 2147483647));
  }

  function markPending(manifest) {
    writeStorage(PENDING_VERSION_KEY, JSON.stringify({
      version: String(manifest.version),
      release_at: String(manifest.release_at)
    }));
    presentNotice(scheduledNotice(String(manifest.version)));
    scheduleApplication(manifest);
  }

  function processManifest(manifest) {
    if (!manifest) return;
    const version = String(manifest.version);
    const releaseTime = Date.parse(manifest.release_at);
    const currentVersion = readStorage(CURRENT_VERSION_KEY);
    const justUpdated = readStorage(JUST_UPDATED_KEY);

    if (!currentVersion) {
      if (manifest.announce_on_first_visit && Date.now() < releaseTime) {
        writeStorage(CURRENT_VERSION_KEY, `truoc-${version}`);
        markPending(manifest);
      } else {
        writeStorage(CURRENT_VERSION_KEY, version);
        if (manifest.announce_on_first_visit && Date.now() >= releaseTime) {
          presentNotice(completedNotice(version));
        }
      }
      return;
    }

    if (currentVersion !== version) {
      if (Date.now() >= releaseTime) applyVersion(manifest);
      else markPending(manifest);
      return;
    }

    removeStorage(PENDING_VERSION_KEY);
    if (justUpdated === version) {
      removeStorage(JUST_UPDATED_KEY);
      presentNotice(completedNotice(version));
    }
  }

  async function checkForUpdates() {
    processManifest(await loadManifest());
  }

  function install() {
    checkForUpdates();
    window.setInterval(checkForUpdates, POLL_INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
