(function (window, document) {
  'use strict';

  var config = window.KHOA_DUOC_SERVER || {};
  var baseUrl = String(config.supabaseUrl || '').replace(/\/+$/, '');
  var apiKey = String(config.supabasePublishableKey || '');
  var sessionKey = 'khoa-duoc-secure-staff-session';
  var session = null;
  var authenticated = false;
  var refreshPromise = null;

  function configured() {
    return /^https:\/\//i.test(baseUrl) && apiKey.length >= 20;
  }

  function request(path, options, token) {
    if (!configured()) return Promise.reject(new Error('Máy chủ Supabase chưa được cấu hình.'));
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
          var failure = new Error('Đăng nhập không thành công.');
          failure.status = response.status;
          failure.payload = payload;
          throw failure;
        }
        return payload;
      });
    });
  }

  function readSession() {
    if (session) return session;
    try {
      session = JSON.parse(localStorage.getItem(sessionKey) || sessionStorage.getItem(sessionKey) || 'null');
    } catch (error) {
      session = null;
    }
    return session;
  }

  function writeSession(value) {
    session = value || null;
    try {
      if (session) {
        localStorage.setItem(sessionKey, JSON.stringify(session));
        sessionStorage.setItem(sessionKey, JSON.stringify(session));
      } else {
        localStorage.removeItem(sessionKey);
        sessionStorage.removeItem(sessionKey);
      }
    } catch (error) {}
  }

  function normalizeSession(payload) {
    var expiresAt = Number(payload && payload.expires_at);
    if (!expiresAt && payload && payload.expires_in) expiresAt = Math.floor(Date.now() / 1000) + Number(payload.expires_in);
    return { access_token: payload.access_token, refresh_token: payload.refresh_token, expires_at: expiresAt || 0 };
  }

  function notify() {
    window.KHOA_DUOC_STAFF_AUTHENTICATED = authenticated;
    window.dispatchEvent(new Event('khoa-duoc-auth-changed'));
    try { localStorage.setItem('khoa-duoc-auth-updated', String(Date.now())); } catch (error) {}
    render();
  }

  function clearSession() {
    authenticated = false;
    writeSession(null);
    notify();
  }

  function refreshAccessToken(current) {
    if (refreshPromise) return refreshPromise;
    refreshPromise = request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: current.refresh_token })
    }).then(function (payload) {
      var next = normalizeSession(payload);
      writeSession(next);
      return next.access_token;
    }).catch(function (error) {
      if (error && (error.status === 400 || error.status === 401 || error.status === 403)) {
        authenticated = false;
        writeSession(null);
      }
      throw error;
    }).finally(function () {
      refreshPromise = null;
    });
    return refreshPromise;
  }

  function accessToken() {
    var current = readSession();
    if (!current) return Promise.reject(new Error('Phiên đăng nhập không tồn tại.'));
    if (current.expires_at > Math.floor(Date.now() / 1000) + 60) return Promise.resolve(current.access_token);
    return refreshAccessToken(current);
  }

  function validate() {
    var storedSession = readSession();
    if (!configured() || !storedSession) {
      authenticated = false;
      writeSession(null);
      notify();
      return Promise.resolve(false);
    }
    // Giữ trạng thái đã xác thực trong lúc chuyển trang; chỉ xóa phiên khi máy chủ trả về 401/403 hoặc quyền thực sự bị từ chối.
    authenticated = true;
    notify();
    return accessToken().then(function (token) {
      return Promise.all([
        request('/auth/v1/user', { method: 'GET' }, token),
        request('/rest/v1/rpc/is_pharmacy_staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, token),
        request('/rest/v1/rpc/is_pharmacy_admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, token)
      ]);
    }).then(function (results) {
      authenticated = results[1] === true && results[2] === true;
      if (!authenticated) {
        writeSession(null);
      }
      notify();
      return authenticated;
    }).catch(function (error) {
      if (error && (error.status === 401 || error.status === 403)) {
        authenticated = false;
        writeSession(null);
        notify();
        return false;
      }
      authenticated = true;
      notify();
      return true;
    });
  }

  function signIn(email, password) {
    return request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (payload) {
      writeSession(normalizeSession(payload));
      return validate();
    }).then(function (allowed) {
      if (!allowed) throw new Error('Tài khoản không có đủ quyền trên trang.');
      return true;
    });
  }

  function signOut() {
    var current = readSession();
    var requestLogout = current && configured()
      ? request('/auth/v1/logout?scope=local', { method: 'POST' }, current.access_token).catch(function () {})
      : Promise.resolve();
    return requestLogout.then(function () {
      authenticated = false;
      writeSession(null);
      notify();
    });
  }

  function openDialog() {
    var dialog = document.getElementById('global-auth-dialog');
    var form = document.getElementById('global-auth-form');
    var email = document.getElementById('global-auth-email');
    if (!dialog) return;
    if (form) form.reset();
    setStatus('', '');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    if (email) email.focus();
  }

  function closeDialog() {
    var dialog = document.getElementById('global-auth-dialog');
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  function setStatus(message, type) {
    var status = document.getElementById('global-auth-status');
    if (!status) return;
    status.textContent = message || '';
    status.classList.toggle('is-error', type === 'error');
    status.classList.toggle('is-success', type === 'success');
  }

  function render() {
    var login = document.getElementById('open-global-login');
    var badge = document.getElementById('global-auth-badge');
    var logout = document.getElementById('global-auth-logout');
    if (login) login.hidden = authenticated;
    if (badge) badge.hidden = !authenticated;
    if (logout) logout.hidden = !authenticated;
  }

  function installUi() {
    var headerContainer = document.querySelector('.site-header .container');
    if (!headerContainer || document.getElementById('global-auth-wrap')) return;
    var wrapper = document.createElement('div');
    wrapper.id = 'global-auth-wrap';
    wrapper.className = 'global-auth-wrap';
    wrapper.innerHTML = '<button class="global-auth-button" id="open-global-login" type="button">Đăng nhập admin</button><span class="global-auth-badge" id="global-auth-badge" hidden>Đã đăng nhập</span><button class="global-auth-logout" id="global-auth-logout" type="button" hidden>Đăng xuất</button>';
    headerContainer.appendChild(wrapper);

    var dialog = document.createElement('dialog');
    dialog.className = 'global-auth-dialog';
    dialog.id = 'global-auth-dialog';
    dialog.setAttribute('aria-labelledby', 'global-auth-title');
    dialog.innerHTML = '<form id="global-auth-form"><div class="global-auth-header"><div><div class="kicker">Khoa Dược</div><h2 id="global-auth-title">Đăng nhập quản trị</h2></div><button class="global-auth-close" id="global-auth-close" type="button" aria-label="Đóng">×</button></div><div class="global-auth-fields"><label><span>Email</span><input id="global-auth-email" type="email" autocomplete="username" autocapitalize="none" required></label><label><span>Mật khẩu</span><input id="global-auth-password" type="password" autocomplete="current-password" required></label><p id="global-auth-status" role="status" aria-live="polite"></p></div><div class="global-auth-actions"><button class="global-auth-cancel" id="global-auth-cancel" type="button">Hủy</button><button class="global-auth-submit" type="submit">Đăng nhập</button></div></form>';
    document.body.appendChild(dialog);

    document.getElementById('open-global-login').addEventListener('click', openDialog);
    document.getElementById('global-auth-logout').addEventListener('click', function () {
      setStatus('Đang đăng xuất...', '');
      signOut().catch(function () { clearSession(); }).then(function () { render(); });
    });
    document.getElementById('global-auth-close').addEventListener('click', closeDialog);
    document.getElementById('global-auth-cancel').addEventListener('click', closeDialog);
    dialog.addEventListener('cancel', function (event) { event.preventDefault(); closeDialog(); });
    dialog.addEventListener('click', function (event) { if (event.target === dialog) closeDialog(); });
    document.getElementById('global-auth-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var email = document.getElementById('global-auth-email').value.trim().toLowerCase();
      var password = document.getElementById('global-auth-password').value;
      var submit = event.currentTarget.querySelector('button[type="submit"]');
      if (!configured()) { setStatus('Máy chủ bảo mật chưa được cấu hình.', 'error'); return; }
      if (submit) submit.disabled = true;
      setStatus('Đang xác thực...', '');
      signIn(email, password).then(function () {
        setStatus('Đăng nhập thành công.', 'success');
        closeDialog();
      }).catch(function () {
        setStatus('Email, mật khẩu hoặc quyền truy cập không đúng.', 'error');
        document.getElementById('global-auth-password').value = '';
      }).finally(function () { if (submit) submit.disabled = false; });
    });
    authenticated = Boolean(readSession());
    render();
  }

  window.KHOA_DUOC_AUTH = Object.freeze({
    accessToken: accessToken,
    getAccessToken: accessToken,
    validate: validate,
    signIn: signIn,
    signOut: signOut,
    isAuthenticated: function () { return authenticated; }
  });
  window.addEventListener('storage', function (event) {
    if (event.key === sessionKey || event.key === 'khoa-duoc-auth-updated') {
      session = null;
      validate();
    }
  });
  document.addEventListener('DOMContentLoaded', function () {
    installUi();
    validate();
  });
}(window, document));
