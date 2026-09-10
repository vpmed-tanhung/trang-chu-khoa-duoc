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
  var currentPage = 1;
  var totalPages = 1;
  var hasNextPage = false;
  var previewUrl = '';
  var channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('khoa-duoc-posts') : null;
  var contentChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('khoa-duoc-thong-tin-thuoc') : null;

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
        return opts.returnMeta ? { data: payload, headers: response.headers } : payload;
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

  function signalRecentContentChanged() {
    if (contentChannel) contentChannel.postMessage('refresh');
    try { localStorage.setItem('khoa-duoc-documents-updated', String(Date.now())); } catch (error) {}
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

  function weekOfMonth(day) {
    return Math.min(5, Math.floor((Number(day) - 1) / 7) + 1);
  }

  function formatDate(isoDate) {
    var parts = String(isoDate || '').split('-');
    return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : '';
  }

  function publicUrl(path) {
    return baseUrl + '/storage/v1/object/public/' + encodeURIComponent(bucket) + '/' + String(path || '').split('/').map(encodeURIComponent).join('/');
  }

  function configurePdfLink(link) {
    if (window.KHOA_DUOC_DEVICE) return window.KHOA_DUOC_DEVICE.configurePdfLink(link);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  function safeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    var bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (value) { return value.toString(16).padStart(2, '0'); }).join('');
  }

  function loadPosts(page) {
    if (!configured()) return Promise.resolve({ rows: [], total: 0, hasNext: false });
    var requestedPage = Math.max(1, Number(page) || 1);
    var offset = (requestedPage - 1) * 5;
    return request('/rest/v1/posts?select=id,title,category,excerpt,publish_date,week_number,author,file_name,storage_path,created_at&order=created_at.desc&limit=5&offset=' + offset, {
      method: 'GET',
      returnMeta: true,
      headers: { Accept: 'application/json', Prefer: 'count=exact' }
    }).then(function (result) {
      var rows = Array.isArray(result.data) ? result.data : [];
      var contentRange = result.headers && result.headers.get('content-range');
      var total = 0;
      var match = contentRange && contentRange.match(/\/([0-9]+|\*)$/);
      if (match && match[1] !== '*') total = Number(match[1]);
      return { rows: rows, total: total, hasNext: total ? offset + rows.length < total : rows.length === 5 };
    });
  }

  function renderPagination() {
    var pagination = document.getElementById('post-pagination');
    var previous = document.getElementById('post-page-prev');
    var next = document.getElementById('post-page-next');
    var label = document.getElementById('post-page-label');
    var visible = totalPages > 1 || currentPage > 1;
    if (pagination) pagination.hidden = !visible;
    if (previous) previous.disabled = currentPage <= 1;
    if (next) next.disabled = !hasNextPage;
    if (label) label.textContent = 'Trang ' + currentPage + (totalPages > 1 ? ' / ' + totalPages : '');
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

  function updatePostTitle(item, title) {
    if (!authenticated || !item || !item.id) return Promise.reject(new Error('Không có quyền sửa tiêu đề.'));
    return accessToken().then(function (token) {
      return request('/rest/v1/posts?id=eq.' + encodeURIComponent(item.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ title: title })
      }, token);
    });
  }

  function renderPosts(items) {
    var ledger = document.getElementById('bulletin-ledger');
    if (!ledger) return;
    ledger.textContent = '';
    if (!items.length) {
      var empty = document.createElement('p'); empty.className = 'document-empty'; empty.textContent = 'Chưa có bản tin trên Supabase.'; ledger.appendChild(empty); renderPagination(); return;
    }
    items.slice(0, 5).forEach(function (item) {
      var row = document.createElement('article'); row.className = 'ledger-row';
      var body = document.createElement('div'); body.className = 'ledger-body';
      var heading = document.createElement('h3');
      var link = document.createElement('a'); link.href = item.storage_path ? publicUrl(item.storage_path) : '#'; link.textContent = item.title || 'Bản tin Dược'; configurePdfLink(link); heading.appendChild(link);
      body.appendChild(heading);
      var meta = document.createElement('div'); meta.className = 'ledger-meta'; meta.textContent = (item.author || 'admin') + ' - ' + formatDate(item.publish_date); body.appendChild(meta);
      if (item.excerpt) { var excerpt = document.createElement('p'); excerpt.textContent = item.excerpt; body.appendChild(excerpt); }
      if (authenticated && item.id) {
        var controls = document.createElement('div');
        controls.className = 'document-row-actions post-row-actions';
        var edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'document-edit-button';
        edit.textContent = 'Sửa tiêu đề';
        edit.addEventListener('click', function () {
          if (!window.KHOA_DUOC_TITLE_EDITOR) return;
          window.KHOA_DUOC_TITLE_EDITOR.open({
            container: body,
            display: heading,
            before: meta,
            title: item.title,
            onSave: function (nextTitle) {
              return updatePostTitle(item, nextTitle).then(function () {
                item.title = nextTitle;
                if (channel) channel.postMessage('refresh');
                signalRecentContentChanged();
                return refresh();
              });
            }
          });
        });
        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'document-delete-button post-delete-button';
        remove.textContent = 'Xóa bản tin';
        remove.addEventListener('click', function () {
          remove.disabled = true;
          setStatus('post-list-status', 'Đang xóa bản tin...', '');
          deletePost(item).then(function () {
            if (channel) channel.postMessage('refresh');
            signalRecentContentChanged();
            return refresh();
          }).then(function () {
            setStatus('post-list-status', 'Đã xóa bản tin và tệp PDF.', 'success');
          }).catch(function () {
            remove.disabled = false;
            setStatus('post-list-status', 'Không thể xóa bản tin. Vui lòng thử lại.', 'error');
          });
        });
        controls.appendChild(edit);
        controls.appendChild(remove);
        body.appendChild(controls);
      }
      row.appendChild(body); ledger.appendChild(row);
    });
    renderPagination();
  }

  function refresh() {
    return loadPosts(currentPage).then(function (result) {
      if (!result.rows.length && currentPage > 1) {
        currentPage -= 1;
        return refresh();
      }
      posts = result.rows;
      hasNextPage = result.hasNext;
      totalPages = result.total ? Math.max(1, Math.ceil(result.total / 5)) : Math.max(currentPage, result.hasNext ? currentPage + 1 : currentPage);
      renderPosts(posts);
      return posts;
    }).catch(function () { posts = []; hasNextPage = false; totalPages = 1; renderPosts([]); return []; });
  }

  function openDialog(id) {
    var dialog = document.getElementById(id); if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }

  function closeDialog(id) {
    var dialog = document.getElementById(id); if (!dialog) return;
    var form = dialog.querySelector('form'); if (form) form.reset();
    if (id === 'post-upload-dialog') clearPostPreview();
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
  }

  function clearPostPreview() {
    var preview = document.getElementById('post-pdf-preview');
    var empty = document.getElementById('post-pdf-preview-empty');
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = '';
    }
    if (window.KHOA_DUOC_DEVICE) window.KHOA_DUOC_DEVICE.clearPdfPreview(preview, empty);
    else {
      if (preview) { preview.removeAttribute('data'); preview.classList.remove('is-visible'); }
      if (empty) empty.hidden = false;
    }
  }

  function showPostPreview(file) {
    var preview = document.getElementById('post-pdf-preview');
    var empty = document.getElementById('post-pdf-preview-empty');
    clearPostPreview();
    if (!preview || !file) return;
    previewUrl = URL.createObjectURL(file);
    if (window.KHOA_DUOC_DEVICE) window.KHOA_DUOC_DEVICE.showPdfPreview(preview, empty, previewUrl);
    else {
      preview.data = previewUrl;
      preview.classList.add('is-visible');
      if (empty) empty.hidden = true;
    }
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
    var titleInput = document.getElementById('post-title');
    var previousPage = document.getElementById('post-page-prev');
    var nextPage = document.getElementById('post-page-next');
    renderAccess();
    validateStaff().then(function () { renderAccess(); renderPosts(posts); return refresh(); });
    if (loginButton) loginButton.addEventListener('click', function () { openDialog('post-login-dialog'); if (!configured()) setStatus('post-login-status', 'Máy chủ Supabase chưa được cấu hình.', 'error'); });
    ['close-post-login', 'cancel-post-login'].forEach(function (id) { var node = document.getElementById(id); if (node) node.addEventListener('click', function () { closeDialog('post-login-dialog'); }); });
    if (loginForm) loginForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var email = document.getElementById('post-login-email').value.trim().toLowerCase();
      var password = document.getElementById('post-login-password').value;
      setStatus('post-login-status', 'Đang xác thực...', '');
      signIn(email, password).then(function () {
        renderAccess();
        renderPosts(posts);
        closeDialog('post-login-dialog');
        return refresh();
      }).catch(function () { setStatus('post-login-status', 'Email, mật khẩu hoặc quyền admin không đúng.', 'error'); });
    });
    if (logoutButton) logoutButton.addEventListener('click', function () {
      signOut().then(function () {
        renderAccess();
        renderPosts(posts);
        return refresh();
      });
    });
    if (previousPage) previousPage.addEventListener('click', function () { if (currentPage > 1) { currentPage -= 1; refresh(); } });
    if (nextPage) nextPage.addEventListener('click', function () { if (hasNextPage) { currentPage += 1; refresh(); } });
    if (uploadButton) uploadButton.addEventListener('click', function () { if (authenticated) openDialog('post-upload-dialog'); else openDialog('post-login-dialog'); });
    ['close-post-upload', 'close-post-upload-cancel'].forEach(function (id) { var node = document.getElementById(id); if (node) node.addEventListener('click', function () { closeDialog('post-upload-dialog'); }); });
    ['post-login-dialog', 'post-upload-dialog'].forEach(function (id) {
      var dialog = document.getElementById(id);
      if (!dialog) return;
      dialog.addEventListener('cancel', function (event) { event.preventDefault(); closeDialog(id); });
      dialog.addEventListener('click', function (event) { if (event.target === dialog) closeDialog(id); });
    });
    if (fileInput) fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) { clearPostPreview(); return; }
      if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) { clearPostPreview(); setStatus('post-upload-status', 'Chỉ chấp nhận tệp PDF.', 'error'); fileInput.value = ''; return; }
      showPostPreview(file);
      setStatus('post-upload-status', 'Đã chọn PDF.', 'success');
    });
    if (uploadForm) uploadForm.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!authenticated) { setStatus('post-upload-status', 'Phiên admin không hợp lệ.', 'error'); return; }
      var file = fileInput.files && fileInput.files[0]; var publishDate = localDateIso(); var title = titleInput ? titleInput.value.trim().replace(/\s+/g, ' ') : '';
      if (!file || !title) { setStatus('post-upload-status', 'Vui lòng chọn PDF và nhập tiêu đề.', 'error'); return; }
      if (file.size > maxBytes) { setStatus('post-upload-status', 'Tệp PDF vượt quá giới hạn 25 MB.', 'error'); return; }
      var path = 'posts/' + publishDate.slice(0, 7) + '/' + safeId() + '.pdf'; var uploaded = false; var token = '';
      setStatus('post-upload-status', 'Đang tải bản tin lên Supabase...', '');
      accessToken().then(function (value) { token = value; return request('/storage/v1/object/' + encodeURIComponent(bucket) + '/' + path.split('/').map(encodeURIComponent).join('/'), { method: 'POST', headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false' }, body: file }, token); }).then(function () { uploaded = true; return request('/rest/v1/posts', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ title: title, category: 'Bản tin Dược lâm sàng', excerpt: null, publish_date: publishDate, week_number: weekOfMonth(Number(publishDate.slice(8, 10))), author: 'admin', file_name: file.name.slice(0, 255), storage_path: path }) }, token); }).then(function () { if (channel) channel.postMessage('refresh'); signalRecentContentChanged(); setStatus('post-upload-status', 'Đã đăng bản tin.', 'success'); return refresh(); }).then(function () { window.setTimeout(function () { closeDialog('post-upload-dialog'); }, 500); }).catch(function () { if (uploaded && token) request('/storage/v1/object/remove/' + encodeURIComponent(bucket), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [path] }) }, token).catch(function () {}); setStatus('post-upload-status', 'Không thể tải bản tin lên Supabase.', 'error'); });
    });
    if (channel) channel.addEventListener('message', refresh);
    window.addEventListener('beforeunload', function () { if (previewUrl) URL.revokeObjectURL(previewUrl); if (channel) channel.close(); if (contentChannel) contentChannel.close(); });
  }

  window.KHOA_DUOC_POSTS = { localDateIso: localDateIso, formatDate: formatDate, refresh: refresh, deletePost: deletePost, updatePostTitle: updatePostTitle };
  document.addEventListener('DOMContentLoaded', init);
}());
