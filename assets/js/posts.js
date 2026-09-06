(function () {
  'use strict';

  var config = window.KHOA_DUOC_SERVER || {};
  var baseUrl = String(config.supabaseUrl || '').replace(/\/+$/, '');
  var apiKey = String(config.supabasePublishableKey || '');
  var bucket = String(config.storageBucket || 'drug-documents');
  var maxBytes = Number(config.maxUploadBytes) || 26214400;
  var sessionKey = 'khoa-duoc-secure-staff-session';
  var session = null;
  var authenticated = false;
  var refreshPromise = null;
  var posts = [];
  var previewUrl = '';
  var channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('khoa-duoc-posts') : null;

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
          var failure = new Error('Yêu cầu Supabase không thành công.');
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
    } catch (error) { session = null; }
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

  function clearSession() {
    authenticated = false;
    writeSession(null);
  }

  function normalizeSession(payload) {
    var expiresAt = Number(payload && payload.expires_at);
    if (!expiresAt && payload && payload.expires_in) expiresAt = Math.floor(Date.now() / 1000) + Number(payload.expires_in);
    return { access_token: payload.access_token, refresh_token: payload.refresh_token, expires_at: expiresAt || 0 };
  }

  function accessToken() {
    var current = readSession();
    if (!current) return Promise.reject(new Error('Phiên đăng nhập không tồn tại.'));
    if (current.expires_at > Math.floor(Date.now() / 1000) + 60) return Promise.resolve(current.access_token);
    if (refreshPromise) return refreshPromise;
    refreshPromise = request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: current.refresh_token })
    }).then(function (payload) {
      var next = normalizeSession(payload); writeSession(next); return next.access_token;
    }).catch(function (error) { clearSession(); throw error; }).finally(function () { refreshPromise = null; });
    return refreshPromise;
  }

  function validateStaff() {
    if (!configured() || !readSession()) { clearSession(); return Promise.resolve(false); }
    return accessToken().then(function (token) {
      return request('/auth/v1/user', { method: 'GET' }, token).then(function () {
        return request('/rest/v1/rpc/is_pharmacy_admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, token);
      });
    }).then(function (allowed) {
      authenticated = allowed === true;
      if (!authenticated) clearSession();
      return authenticated;
    }).catch(function () { clearSession(); return false; });
  }

  function signIn(email, password) {
    return request('/auth/v1/token?grant_type=password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, password: password })
    }).then(function (payload) { writeSession(normalizeSession(payload)); return validateStaff(); }).then(function (ok) {
      if (!ok) throw new Error('Tài khoản không có quyền admin.');
      return true;
    });
  }

  function signOut() {
    var current = readSession();
    var logout = current && configured() ? request('/auth/v1/logout?scope=local', { method: 'POST' }, current.access_token).catch(function () {}) : Promise.resolve();
    return logout.finally(clearSession);
  }

  function setStatus(id, message, type) {
    var node = document.getElementById(id);
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('is-error', type === 'error');
    node.classList.toggle('is-success', type === 'success');
  }

  function renderAccess() {
    window.KHOA_DUOC_STAFF_AUTHENTICATED = authenticated;
    var login = document.getElementById('open-post-login');
    var upload = document.getElementById('open-post-upload');
    var logout = document.getElementById('post-logout');
    if (login) login.hidden = authenticated;
    if (upload) upload.hidden = !authenticated;
    if (logout) logout.hidden = !authenticated;
  }

  function localDateIso() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }

  function validDate(year, month, day) {
    var date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function extractDateFromText(text) {
    var source = String(text || '').slice(0, 400000);
    var weekMatch = source.match(/(?:tuần|tuan)[\s_-]*(\d)\D{0,20}(?:tháng|thang)[\s_-]*(\d{1,2})\D{0,10}(\d{4})/i) || source.match(/(\d{4})[\s_-]+(\d{1,2})[\s_-]+(?:tuần|tuan)[\s_-]*(\d)/i);
    if (weekMatch) {
      var week; var month; var year;
      if (/^\d{4}/.test(weekMatch[1])) {
        year = Number(weekMatch[1]); month = Number(weekMatch[2]); week = Number(weekMatch[3]);
      } else {
        week = Number(weekMatch[1]); month = Number(weekMatch[2]); year = Number(weekMatch[3]);
      }
      var weekDay = Math.min(29, (week - 1) * 7 + 1);
      if (week >= 1 && week <= 5 && validDate(year, month, weekDay)) return year + '-' + String(month).padStart(2, '0') + '-' + String(weekDay).padStart(2, '0');
    }
    var patterns = [
      /(?:ngày\s*)?(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/i,
      /(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/i,
      /ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/i
    ];
    for (var i = 0; i < patterns.length; i += 1) {
      var match = source.match(patterns[i]);
      if (!match) continue;
      var day; var month; var year;
      if (patterns[i] === patterns[1]) {
        year = Number(match[1]); month = Number(match[2]); day = Number(match[3]);
      } else {
        day = Number(match[1]); month = Number(match[2]); year = Number(match[3]);
      }
      if (validDate(year, month, day)) return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    }
    return '';
  }

  function extractDateFromFile(file) {
    var fileNameDate = extractDateFromText(file.name);
    if (fileNameDate) return Promise.resolve(fileNameDate);
    return file.slice(0, Math.min(file.size, 4000000)).arrayBuffer().then(function (buffer) {
      var bytes = new Uint8Array(buffer);
      var text = '';
      try { text = new TextDecoder('latin1').decode(bytes); } catch (error) {
        text = Array.prototype.map.call(bytes, function (value) { return String.fromCharCode(value); }).join('');
      }
      return extractDateFromText(text) || localDateIso();
    }).catch(function () { return localDateIso(); });
  }

  function weekOfMonth(day) {
    return Math.min(5, Math.floor((Number(day) - 1) / 7) + 1);
  }

  function normalizedTitle(isoDate) {
    var parts = isoDate.split('-');
    return 'Bản tin Dược lâm sàng – Tuần ' + weekOfMonth(Number(parts[2])) + ', tháng ' + Number(parts[1]) + '/' + parts[0];
  }

  function formatDate(isoDate) {
    var parts = String(isoDate || '').split('-');
    return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : '';
  }

  function publicUrl(path) {
    return baseUrl + '/storage/v1/object/public/' + encodeURIComponent(bucket) + '/' + String(path || '').split('/').map(encodeURIComponent).join('/');
  }

  function safeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    var bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (value) { return value.toString(16).padStart(2, '0'); }).join('');
  }

  function loadPosts() {
    if (!configured()) return Promise.resolve([]);
    return request('/rest/v1/posts?select=id,title,category,excerpt,publish_date,week_number,author,file_name,storage_path,created_at&order=created_at.desc&limit=5', { method: 'GET', headers: { Accept: 'application/json' } }).then(function (rows) {
      return Array.isArray(rows) ? rows : [];
    });
  }

  function removeStorageObject(path, token) {
    if (!path) return Promise.resolve(null);
    return request('/storage/v1/object/remove/' + encodeURIComponent(bucket), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [path] })
    }, token);
  }

  function deletePost(item) {
    if (!authenticated || !item || !item.id) return Promise.reject(new Error('Không có quyền xóa bản tin.'));
    return accessToken().then(function (token) {
      return request('/rest/v1/posts?id=eq.' + encodeURIComponent(item.id), {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' }
      }, token).then(function () {
        return removeStorageObject(item.storage_path, token).catch(function () {
          return null;
        });
      });
    });
  }

  function renderPosts(items) {
    var ledger = document.getElementById('bulletin-ledger');
    if (!ledger) return;
    ledger.textContent = '';
    if (!items.length) {
      var empty = document.createElement('p'); empty.className = 'document-empty'; empty.textContent = 'Chưa có bản tin trên Supabase.'; ledger.appendChild(empty); return;
    }
    items.slice(0, 5).forEach(function (item) {
      var row = document.createElement('article'); row.className = 'ledger-row';
      var stamp = document.createElement('div'); stamp.className = 'date-stamp';
      var date = String(item.publish_date || '').split('-');
      var day = document.createElement('span'); day.className = 'day'; day.textContent = date[2] || '--';
      var month = document.createElement('span'); month.className = 'month'; month.textContent = date[1] ? 'Th' + Number(date[1]) : '';
      stamp.appendChild(day); stamp.appendChild(month);
      var body = document.createElement('div'); body.className = 'ledger-body';
      var heading = document.createElement('h3');
      var link = document.createElement('a'); link.href = item.storage_path ? publicUrl(item.storage_path) : '#'; link.target = '_blank'; link.rel = 'noopener'; link.textContent = item.title || ''; heading.appendChild(link);
      body.appendChild(heading);
      var meta = document.createElement('div'); meta.className = 'ledger-meta'; meta.textContent = (item.category || 'Bản tin Dược lâm sàng') + ' – ' + (item.author || 'admin'); body.appendChild(meta);
      if (item.excerpt) { var excerpt = document.createElement('p'); excerpt.textContent = item.excerpt; body.appendChild(excerpt); }
      if (authenticated && item.id) {
        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'document-delete-button post-delete-button';
        remove.textContent = 'Xóa bản tin';
        remove.addEventListener('click', function () {
          remove.disabled = true;
          setStatus('post-upload-status', 'Đang xóa bản tin...', '');
          deletePost(item).then(function () {
            if (channel) channel.postMessage('refresh');
            return refresh();
          }).then(function () {
            setStatus('post-upload-status', 'Đã xóa bản tin và tệp PDF.', 'success');
          }).catch(function () {
            remove.disabled = false;
            setStatus('post-upload-status', 'Không thể xóa bản tin. Vui lòng thử lại.', 'error');
          });
        });
        body.appendChild(remove);
      }
      row.appendChild(stamp); row.appendChild(body); ledger.appendChild(row);
    });
  }

  function refresh() {
    return loadPosts().then(function (items) { posts = items; renderPosts(items); return items; }).catch(function () { renderPosts([]); return []; });
  }

  function openDialog(id) {
    var dialog = document.getElementById(id); if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }

  function closeDialog(id) {
    var dialog = document.getElementById(id); if (!dialog) return;
    var form = dialog.querySelector('form'); if (form) form.reset();
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
  }

  function init() {
    var loginButton = document.getElementById('open-post-login');
    var uploadButton = document.getElementById('open-post-upload');
    var logoutButton = document.getElementById('post-logout');
    var loginForm = document.getElementById('post-login-form');
    var uploadForm = document.getElementById('post-upload-form');
    var fileInput = document.getElementById('post-pdf-file');
    var preview = document.getElementById('post-pdf-preview');
    var previewEmpty = document.getElementById('post-pdf-preview-empty');
    var dateOutput = document.getElementById('post-detected-date');
    var titleOutput = document.getElementById('post-detected-title');
    renderAccess();
    validateStaff().then(function () { renderAccess(); return refresh(); });
    if (loginButton) loginButton.addEventListener('click', function () { openDialog('post-login-dialog'); if (!configured()) setStatus('post-login-status', 'Máy chủ Supabase chưa được cấu hình.', 'error'); });
    ['close-post-login', 'cancel-post-login'].forEach(function (id) { var node = document.getElementById(id); if (node) node.addEventListener('click', function () { closeDialog('post-login-dialog'); }); });
    if (loginForm) loginForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var email = document.getElementById('post-login-email').value.trim().toLowerCase();
      var password = document.getElementById('post-login-password').value;
      setStatus('post-login-status', 'Đang xác thực...', '');
      signIn(email, password).then(function () { renderAccess(); closeDialog('post-login-dialog'); }).catch(function () { setStatus('post-login-status', 'Email, mật khẩu hoặc quyền admin không đúng.', 'error'); });
    });
    if (logoutButton) logoutButton.addEventListener('click', function () { signOut().then(function () { renderAccess(); }); });
    if (uploadButton) uploadButton.addEventListener('click', function () { if (authenticated) openDialog('post-upload-dialog'); else openDialog('post-login-dialog'); });
    ['close-post-upload', 'close-post-upload-cancel'].forEach(function (id) { var node = document.getElementById(id); if (node) node.addEventListener('click', function () { closeDialog('post-upload-dialog'); }); });
    if (fileInput) fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) { setStatus('post-upload-status', 'Chỉ chấp nhận tệp PDF.', 'error'); fileInput.value = ''; return; }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(file); if (preview) preview.data = previewUrl; if (previewEmpty) previewEmpty.hidden = true;
      setStatus('post-upload-status', 'Đang nhận diện ngày trong PDF...', '');
      extractDateFromFile(file).then(function (isoDate) { if (dateOutput) dateOutput.value = isoDate; if (titleOutput) titleOutput.value = normalizedTitle(isoDate); setStatus('post-upload-status', 'Đã nhận diện ngày ' + formatDate(isoDate) + '.', 'success'); });
    });
    if (uploadForm) uploadForm.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!authenticated) { setStatus('post-upload-status', 'Phiên admin không hợp lệ.', 'error'); return; }
      var file = fileInput.files && fileInput.files[0]; var publishDate = dateOutput && dateOutput.value; var title = titleOutput && titleOutput.value.trim();
      if (!file || !/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) { setStatus('post-upload-status', 'Vui lòng chọn PDF để hệ thống nhận diện ngày.', 'error'); return; }
      if (file.size > maxBytes) { setStatus('post-upload-status', 'Tệp PDF vượt quá giới hạn 25 MB.', 'error'); return; }
      var path = 'posts/' + publishDate.slice(0, 7) + '/' + safeId() + '.pdf'; var uploaded = false; var token = '';
      setStatus('post-upload-status', 'Đang tải bản tin lên Supabase...', '');
      accessToken().then(function (value) { token = value; return request('/storage/v1/object/' + encodeURIComponent(bucket) + '/' + path.split('/').map(encodeURIComponent).join('/'), { method: 'POST', headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false' }, body: file }, token); }).then(function () { uploaded = true; return request('/rest/v1/posts', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ title: title, category: 'Bản tin Dược lâm sàng', excerpt: null, publish_date: publishDate, week_number: weekOfMonth(Number(publishDate.slice(8, 10))), author: 'admin', file_name: file.name.slice(0, 255), storage_path: path }) }, token); }).then(function () { if (channel) channel.postMessage('refresh'); setStatus('post-upload-status', 'Đã đăng bản tin.', 'success'); return refresh(); }).then(function () { window.setTimeout(function () { closeDialog('post-upload-dialog'); }, 500); }).catch(function () { if (uploaded && token) request('/storage/v1/object/remove/' + encodeURIComponent(bucket), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [path] }) }, token).catch(function () {}); setStatus('post-upload-status', 'Không thể tải bản tin lên Supabase.', 'error'); });
    });
    if (channel) channel.addEventListener('message', refresh);
    window.addEventListener('beforeunload', function () { if (previewUrl) URL.revokeObjectURL(previewUrl); if (channel) channel.close(); });
  }

  window.KHOA_DUOC_POSTS = { extractDateFromText: extractDateFromText, extractDateFromFile: extractDateFromFile, weekOfMonth: weekOfMonth, normalizedTitle: normalizedTitle, refresh: refresh, deletePost: deletePost };
  document.addEventListener('DOMContentLoaded', init);
}());
