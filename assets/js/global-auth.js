(function () {
  'use strict';

  var config = window.KHOA_DUOC_SERVER || {};
  var baseUrl = String(config.supabaseUrl || '').replace(/\/+$/, '');
  var apiKey = String(config.supabasePublishableKey || '');
  var sessionKey = 'khoa-duoc-secure-staff-session';
  var publicFeatures = new Set([
    'dose',
    'interactions',
    'pediatric-dose',
    'antibiotics',
    'cap-cuu-phan-ve',
    'pharmacovigilance',
    'sources'
  ]);
  var listeners = new Set();
  var refreshPromise = null;
  var state = {
    status: 'loading',
    authenticated: false,
    role: 'guest',
    user: null,
    session: null
  };

  function configured() {
    return /^https:\/\//i.test(baseUrl) && apiKey.length >= 20;
  }

  function getSupabaseAuthStorageKey() {
    if (!baseUrl) return '';
    try {
      var hostname = new URL(baseUrl).hostname;
      var projectRef = String(hostname.split('.')[0] || '').trim();
      return projectRef ? 'sb-' + projectRef + '-auth-token' : '';
    } catch (error) {
      return '';
    }
  }

  function syncSupabaseAuthStorage(session) {
    var storageKey = getSupabaseAuthStorageKey();
    if (!storageKey) return;

    try {
      if (session && session.access_token && session.refresh_token) {
        var expiresAt = Number(session.expires_at) || 0;
        var expiresIn = Number(session.expires_in) || 0;
        if (!expiresIn && expiresAt) {
          expiresIn = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
        }

        var supabaseSession = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          token_type: session.token_type || 'bearer',
          expires_in: expiresIn,
          expires_at: expiresAt,
          user: session.user || null
        };

        // Supabase JS v2 mặc định đọc session theo khóa sb-<project-ref>-auth-token.
        // Đồng bộ session đăng nhập chung để các module iframe cùng origin dùng lại
        // đúng phiên đã đăng nhập, không yêu cầu đăng nhập lần thứ hai.
        localStorage.setItem(storageKey, JSON.stringify(supabaseSession));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch (error) {}
  }

  function request(path, options, token) {
    if (!configured()) return Promise.reject(new Error('Máy chủ xác thực chưa được cấu hình.'));
    var opts = options || {};
    var headers = new Headers(opts.headers || {});
    headers.set('apikey', apiKey);
    if (token) headers.set('Authorization', 'Bearer ' + token);
    opts.headers = headers;
    return fetch(baseUrl + path, opts).then(function (response) {
      return response.text().then(function (text) {
        var payload = null;
        if (text) {
          try { payload = JSON.parse(text); } catch (error) { payload = text; }
        }
        if (!response.ok) {
          var failure = new Error('Không thể xác thực với máy chủ.');
          failure.status = response.status;
          failure.payload = payload;
          throw failure;
        }
        return payload;
      });
    });
  }

  function readSession() {
    if (state.session) return state.session;
    try {
      return JSON.parse(localStorage.getItem(sessionKey) || sessionStorage.getItem(sessionKey) || 'null');
    } catch (error) {
      return null;
    }
  }

  function writeSession(session) {
    state.session = session || null;
    try {
      if (session) {
        localStorage.setItem(sessionKey, JSON.stringify(session));
        sessionStorage.setItem(sessionKey, JSON.stringify(session));
      } else {
        localStorage.removeItem(sessionKey);
        sessionStorage.removeItem(sessionKey);
      }
    } catch (error) {}

    syncSupabaseAuthStorage(session || null);
  }

  function normalizeSession(payload, previous) {
    var expiresIn = Number(payload && payload.expires_in) || Number(previous && previous.expires_in) || 0;
    var expiresAt = Number(payload && payload.expires_at);
    if (!expiresAt && expiresIn) {
      expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    }
    if (!expiresIn && expiresAt) {
      expiresIn = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
    }

    return {
      access_token: (payload && payload.access_token) || (previous && previous.access_token),
      refresh_token: (payload && payload.refresh_token) || (previous && previous.refresh_token),
      token_type: (payload && payload.token_type) || (previous && previous.token_type) || 'bearer',
      expires_in: expiresIn,
      expires_at: expiresAt || Number(previous && previous.expires_at) || 0,
      verified_at: Number(previous && previous.verified_at) || 0,
      user: (payload && payload.user) || (previous && previous.user) || null
    };
  }

  function setState(next) {
    state = Object.assign({}, state, next);
    window.KHOA_DUOC_STAFF_AUTHENTICATED = state.authenticated === true;
    render();
    listeners.forEach(function (listener) {
      try { listener(getState()); } catch (error) { console.error(error); }
    });
    window.dispatchEvent(new CustomEvent('khoa-duoc-auth-changed', { detail: getState() }));
  }

  function clearSession() {
    writeSession(null);
    setState({ status: 'guest', authenticated: false, role: 'guest', user: null, session: null });
  }

  function getAccessToken() {
    var current = readSession();
    if (!current || !current.access_token) return Promise.reject(new Error('Phiên đăng nhập không tồn tại.'));
    if (Number(current.expires_at) > Math.floor(Date.now() / 1000) + 60) {
      state.session = current;
      return Promise.resolve(current.access_token);
    }
    if (!current.refresh_token) return Promise.reject(new Error('Phiên đăng nhập đã hết hạn.'));
    if (refreshPromise) return refreshPromise;
    refreshPromise = request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: current.refresh_token })
    }).then(function (payload) {
      var refreshed = normalizeSession(payload, current);
      writeSession(refreshed);
      return refreshed.access_token;
    }).finally(function () { refreshPromise = null; });
    return refreshPromise;
  }

  function validate() {
    var current = readSession();
    if (!configured() || !current) {
      clearSession();
      return Promise.resolve(false);
    }
    return getAccessToken().then(function (token) {
      return request('/auth/v1/user', { method: 'GET' }, token).then(function (user) {
        return request('/rest/v1/rpc/is_pharmacy_staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        }, token).then(function (allowed) { return { allowed: allowed === true, user: user }; });
      });
    }).then(function (result) {
      if (!result.allowed) {
        clearSession();
        return false;
      }
      var nextSession = Object.assign({}, readSession(), {
        verified_at: Date.now(),
        user: result.user
      });
      writeSession(nextSession);
      setState({
        status: 'authenticated',
        authenticated: true,
        role: 'pharmacy_staff',
        user: result.user,
        session: nextSession
      });
      return true;
    }).catch(function (error) {
      var cached = readSession();
      var recentlyVerified = cached && Number(cached.verified_at) > Date.now() - 24 * 60 * 60 * 1000;
      if (!navigator.onLine && recentlyVerified) {
        setState({
          status: 'authenticated',
          authenticated: true,
          role: 'pharmacy_staff',
          user: cached.user || null,
          session: cached
        });
        return true;
      }
      clearSession();
      return false;
    });
  }

  function signIn(email, password) {
    setDialogStatus('Đang xác thực tài khoản Khoa Dược…', '');
    return request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (payload) {
      writeSession(normalizeSession(payload));
      return validate();
    }).then(function (allowed) {
      if (!allowed) throw new Error('Tài khoản chưa được cấp quyền Khoa Dược.');
      closeLogin();
      return true;
    });
  }

  function signOut() {
    var current = readSession();
    var logoutRequest = current && configured()
      ? request('/auth/v1/logout?scope=local', { method: 'POST' }, current.access_token).catch(function () {})
      : Promise.resolve();
    return logoutRequest.finally(clearSession);
  }

  function getState() {
    return {
      status: state.status,
      authenticated: state.authenticated,
      role: state.role,
      user: state.user,
      publicFeatures: Array.from(publicFeatures)
    };
  }

  function canAccessFeature(feature) {
    return feature === 'home' || publicFeatures.has(String(feature || '')) || state.authenticated;
  }

  function setDialogStatus(message, tone) {
    var status = document.getElementById('global-auth-status');
    if (!status) return;
    status.textContent = message || '';
    status.className = 'global-auth-status' + (tone ? ' is-' + tone : '');
  }

  function ensureDialog() {
    var existing = document.getElementById('global-auth-dialog');
    if (existing) return existing;
    var dialog = document.createElement('dialog');
    dialog.id = 'global-auth-dialog';
    dialog.className = 'global-auth-dialog';
    dialog.setAttribute('aria-labelledby', 'global-auth-title');
    dialog.innerHTML = '<form id="global-auth-form"><div class="global-auth-heading"><span class="global-auth-mark" aria-hidden="true">Rx</span><div><span class="global-auth-eyebrow">Khu vực nội bộ</span><h2 id="global-auth-title">Đăng nhập Khoa Dược</h2></div><button type="button" class="global-auth-close" aria-label="Đóng">×</button></div><p class="global-auth-copy" id="global-auth-message">Đăng nhập một lần để mở các công cụ và chức năng nội bộ.</p><label>Email Khoa Dược<input id="global-auth-email" type="email" autocomplete="username" autocapitalize="none" required></label><label>Mật khẩu<input id="global-auth-password" type="password" autocomplete="current-password" required></label><p class="global-auth-status" id="global-auth-status" role="status" aria-live="polite"></p><div class="global-auth-actions"><button type="button" class="global-auth-cancel">Hủy</button><button type="submit" class="global-auth-submit">Đăng nhập</button></div></form>';
    document.body.appendChild(dialog);
    dialog.querySelector('.global-auth-close').addEventListener('click', closeLogin);
    dialog.querySelector('.global-auth-cancel').addEventListener('click', closeLogin);
    dialog.addEventListener('cancel', function (event) { event.preventDefault(); closeLogin(); });
    dialog.addEventListener('click', function (event) { if (event.target === dialog) closeLogin(); });
    dialog.querySelector('form').addEventListener('submit', function (event) {
      event.preventDefault();
      var submit = dialog.querySelector('.global-auth-submit');
      var email = dialog.querySelector('#global-auth-email').value.trim().toLowerCase();
      var password = dialog.querySelector('#global-auth-password').value;
      submit.disabled = true;
      signIn(email, password).catch(function (error) {
        setDialogStatus(error && error.message ? error.message : 'Email, mật khẩu hoặc quyền truy cập không đúng.', 'error');
        dialog.querySelector('#global-auth-password').value = '';
        dialog.querySelector('#global-auth-password').focus();
      }).finally(function () { submit.disabled = false; });
    });
    return dialog;
  }

  function openLogin(options) {
    var dialog = ensureDialog();
    var message = dialog.querySelector('#global-auth-message');
    message.textContent = options && options.message
      ? options.message
      : 'Đăng nhập một lần để mở các công cụ và chức năng nội bộ.';
    setDialogStatus('', '');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    window.setTimeout(function () { dialog.querySelector('#global-auth-email').focus(); }, 0);
  }

  function closeLogin() {
    var dialog = document.getElementById('global-auth-dialog');
    if (!dialog) return;
    dialog.querySelector('form').reset();
    setDialogStatus('', '');
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  function render() {
    document.querySelectorAll('[data-global-auth-slot]').forEach(function (slot) {
      var email = state.user && state.user.email ? state.user.email : '';
      slot.innerHTML = state.authenticated
        ? '<span class="auth-user"><span class="auth-state-dot"></span><span><small>Đã đăng nhập</small><b>' + escapeHtml(email || 'Khoa Dược') + '</b></span></span><button type="button" class="auth-logout">Đăng xuất</button>'
        : '<button type="button" class="auth-login">Đăng nhập</button>';
      var login = slot.querySelector('.auth-login');
      var logout = slot.querySelector('.auth-logout');
      if (login) login.addEventListener('click', function () { openLogin(); });
      if (logout) logout.addEventListener('click', signOut);
    });

    document.documentElement.dataset.authState = state.authenticated ? 'staff' : 'guest';
    renderPageAccess();
    document.querySelectorAll('[data-open]').forEach(function (node) {
      var feature = node.getAttribute('data-open');
      var publicAccess = publicFeatures.has(feature);
      var staffOnly = feature !== 'home' && !publicAccess;
      var hiddenForGuest = staffOnly && !state.authenticated;
      node.hidden = hiddenForGuest;
      node.setAttribute('aria-hidden', hiddenForGuest ? 'true' : 'false');
      node.classList.remove('is-locked');
      node.classList.remove('is-public-feature');
      node.dataset.access = publicAccess ? 'public' : (feature === 'home' ? 'navigation' : 'staff');
      var badge = node.matches('.feature-card') ? node.querySelector('em') : null;
      if (badge && publicAccess) badge.remove();
      if (badge && !publicAccess) badge.textContent = 'Nội bộ Khoa Dược';
    });
    document.querySelectorAll('[data-clinical-tool-count]').forEach(function (node) {
      var visibleCount = document.querySelectorAll('#view-home .feature-card:not([hidden])').length;
      node.textContent = visibleCount + ' công cụ';
    });
  }

  function renderPageAccess() {
    if (!document.body || document.body.dataset.requiresStaff !== 'true') return;
    var main = document.querySelector('main');
    var gate = document.getElementById('staff-page-gate');
    if (!gate) {
      gate = document.createElement('section');
      gate.id = 'staff-page-gate';
      gate.className = 'staff-page-gate';
      gate.innerHTML = '<div><span class="global-auth-mark" aria-hidden="true">Rx</span><span class="global-auth-eyebrow">Tài liệu nội bộ</span><h1>Yêu cầu đăng nhập Khoa Dược</h1><p>Nội dung chuyên sâu và chức năng quản trị chỉ dành cho tài khoản Khoa Dược đã được cấp quyền.</p><button type="button">Đăng nhập để tiếp tục</button><a href="index.html#clinical-home">Về trang chủ</a></div>';
      gate.querySelector('button').addEventListener('click', function () {
        openLogin({ message: 'Đăng nhập tài khoản Khoa Dược để xem tài liệu chuyên sâu.' });
      });
      if (main) main.parentNode.insertBefore(gate, main);
      else document.body.appendChild(gate);
    }
    if (main) main.hidden = !state.authenticated;
    gate.hidden = state.authenticated;
    document.body.classList.toggle('staff-access-granted', state.authenticated);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener(getState());
    return function () { listeners.delete(listener); };
  }

  var api = Object.freeze({
    publicFeatures: Object.freeze(Array.from(publicFeatures)),
    getState: getState,
    getAccessToken: getAccessToken,
    canAccessFeature: canAccessFeature,
    openLogin: openLogin,
    closeLogin: closeLogin,
    signIn: signIn,
    signOut: signOut,
    validate: validate,
    subscribe: subscribe
  });
  window.KHOA_DUOC_AUTH = api;

  function initialize() {
    ensureDialog();
    render();
    validate();
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-global-login]');
      if (!trigger) return;
      event.preventDefault();
      openLogin({ message: trigger.dataset.loginMessage || '' });
    });
    window.addEventListener('storage', function (event) {
      if (event.key === sessionKey) validate();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
}());
