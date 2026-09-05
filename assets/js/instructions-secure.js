(function () {
  'use strict';

  var config = window.KHOA_DUOC_SERVER || {};
  var baseUrl = String(config.supabaseUrl || '').replace(/\/+$/, '');
  var publishableKey = String(config.supabasePublishableKey || '');
  var bucket = String(config.storageBucket || 'drug-documents');
  var maxBytes = Number(config.maxUploadBytes) || 26214400;
  var sessionKey = 'khoa-duoc-secure-staff-session';
  var session = null;
  var authenticated = false;
  var refreshPromise = null;
  var previewUrl = '';

  function configured() { return /^https:\/\//i.test(baseUrl) && publishableKey.length >= 20; }
  function request(path, options, token) {
    if (!configured()) return Promise.reject(new Error('Máy chủ bảo mật chưa được cấu hình.'));
    var opts = options || {};
    var headers = new Headers(opts.headers || {});
    headers.set('apikey', publishableKey);
    if (token) headers.set('Authorization', 'Bearer ' + token);
    opts.headers = headers;
    return fetch(baseUrl + path, opts).then(function (response) {
      return response.text().then(function (text) {
        var payload = null;
        if (text) { try { payload = JSON.parse(text); } catch (error) { payload = text; } }
        if (!response.ok) throw new Error('Yêu cầu máy chủ không thành công.');
        return payload;
      });
    });
  }
  function readSession() {
    if (session) return session;
    try { session = JSON.parse(sessionStorage.getItem(sessionKey) || 'null'); } catch (error) { session = null; }
    return session;
  }
  function writeSession(value) {
    session = value || null;
    try {
      if (session) sessionStorage.setItem(sessionKey, JSON.stringify(session));
      else sessionStorage.removeItem(sessionKey);
    } catch (error) {}
  }
  function clearSession() { authenticated = false; writeSession(null); }
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
    }).then(function (payload) { var refreshed = normalizeSession(payload); writeSession(refreshed); return refreshed.access_token; }).catch(function (error) { clearSession(); throw error; }).finally(function () { refreshPromise = null; });
    return refreshPromise;
  }
  function validate() {
    if (!configured() || !readSession()) { clearSession(); return Promise.resolve(false); }
    return accessToken().then(function (token) {
      return request('/auth/v1/user', { method: 'GET' }, token).then(function () {
        return request('/rest/v1/rpc/is_pharmacy_staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, token);
      });
    }).then(function (allowed) { authenticated = allowed === true; if (!authenticated) clearSession(); return authenticated; }).catch(function () { clearSession(); return false; });
  }
  function setStatus(id, message, type) {
    var status = document.getElementById(id);
    if (!status) return;
    status.textContent = message || '';
    status.classList.toggle('is-error', type === 'error');
    status.classList.toggle('is-success', type === 'success');
  }
  function renderAccess() {
    window.KHOA_DUOC_STAFF_AUTHENTICATED = authenticated;
    var login = document.getElementById('open-staff-login');
    var controls = document.getElementById('document-staff-controls');
    var add = document.getElementById('open-instruction-upload');
    if (login) login.hidden = authenticated;
    if (controls) controls.hidden = !authenticated;
    if (add) add.hidden = !authenticated;
  }
  function deleteInstruction(instruction) {
    if (!authenticated || !instruction || !instruction.id) return;
    accessToken().then(function (token) {
      return request('/rest/v1/drug_instructions?id=eq.' + encodeURIComponent(instruction.id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }, token);
    }).then(function () {
      if (!instruction.storagePath) return;
      return accessToken().then(function (token) {
        return request('/storage/v1/object/' + encodeURIComponent(bucket) + '/' + encodePath(instruction.storagePath), { method: 'DELETE' }, token);
      }).catch(function () { return null; });
    }).then(function () { window.dispatchEvent(new Event('khoa-duoc-auth-changed')); }).catch(function () { window.alert('Không thể xóa HDSD. Vui lòng thử lại.'); });
  }
  function closeDialog(id) {
    var dialog = document.getElementById(id);
    if (!dialog) return;
    var form = dialog.querySelector('form');
    if (form) form.reset();
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
  }
  function openDialog(id) {
    var dialog = document.getElementById(id);
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }
  function secureId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') throw new Error('Trình duyệt không hỗ trợ tạo mã tệp an toàn.');
    var bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (value) { return value.toString(16).padStart(2, '0'); }).join('');
  }
  function encodePath(path) { return String(path).split('/').map(encodeURIComponent).join('/'); }
  function uploadInstruction(file, title, signedDate) {
    var path = 'hdsd/' + signedDate.slice(0, 7) + '/' + secureId() + '.pdf';
    var token = '';
    var uploaded = false;
    return accessToken().then(function (value) {
      token = value;
      return request('/storage/v1/object/' + encodeURIComponent(bucket) + '/' + encodePath(path), {
        method: 'POST', headers: { 'Content-Type': 'application/pdf', 'Cache-Control': '3600', 'x-upsert': 'false' }, body: file
      }, token);
    }).then(function () {
      uploaded = true;
      return request('/rest/v1/drug_instructions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ title: title, keywords: title, signed_date: signedDate, file_name: file.name.slice(0, 255), storage_path: path })
      }, token);
    }).catch(function (error) {
      if (!uploaded || !token) throw error;
      return request('/storage/v1/object/' + encodeURIComponent(bucket) + '/' + encodePath(path), { method: 'DELETE' }, token).catch(function () {}).then(function () { throw error; });
    });
  }
  function init() {
    window.KHOA_DUOC_DELETE_INSTRUCTION = deleteInstruction;
    var login = document.getElementById('open-staff-login');
    var logout = document.getElementById('staff-logout');
    var loginDialog = document.getElementById('staff-login-dialog');
    var loginForm = document.getElementById('staff-login-form');
    var add = document.getElementById('open-instruction-upload');
    var uploadDialog = document.getElementById('instruction-upload-dialog');
    var uploadForm = document.getElementById('instruction-upload-form');
    var fileInput = document.getElementById('instruction-pdf-file');
    var preview = document.getElementById('instruction-pdf-preview');
    var empty = document.getElementById('instruction-pdf-preview-empty');
    var uploadSubmit = document.getElementById('submit-instruction-upload');
    var cancelUpload = document.getElementById('cancel-instruction-upload');
    renderAccess();
    if (loginDialog && loginForm) validate().then(renderAccess);
    if (login) login.addEventListener('click', function () { openDialog('staff-login-dialog'); if (!configured()) setStatus('staff-login-status', 'Máy chủ bảo mật chưa được cấu hình.', 'error'); });
    ['close-staff-login', 'cancel-staff-login'].forEach(function (id) { var button = document.getElementById(id); if (button) button.addEventListener('click', function () { closeDialog('staff-login-dialog'); }); });
    if (loginDialog) loginDialog.addEventListener('click', function (event) { if (event.target === loginDialog) closeDialog('staff-login-dialog'); });
    if (loginForm) loginForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var email = document.getElementById('staff-username').value.trim().toLowerCase();
      var password = document.getElementById('staff-password').value;
      var submit = loginForm.querySelector('button[type="submit"]');
      if (!configured()) { setStatus('staff-login-status', 'Máy chủ bảo mật chưa được cấu hình.', 'error'); return; }
      if (submit) submit.disabled = true;
      setStatus('staff-login-status', 'Đang xác thực...', '');
      request('/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, password: password }) }).then(function (payload) { writeSession(normalizeSession(payload)); return validate(); }).then(function (allowed) { if (!allowed) throw new Error('Không có quyền.'); renderAccess(); closeDialog('staff-login-dialog'); }).catch(function () { setStatus('staff-login-status', 'Email, mật khẩu hoặc quyền truy cập không đúng.', 'error'); document.getElementById('staff-password').value = ''; }).finally(function () { if (submit) submit.disabled = false; });
    });
    if (logout) logout.addEventListener('click', function () { accessToken().catch(function () {}).then(function () { clearSession(); renderAccess(); }); });
    if (add) add.addEventListener('click', function () { if (!authenticated) { openDialog('staff-login-dialog'); return; } openDialog('instruction-upload-dialog'); });
    ['close-instruction-upload', 'cancel-instruction-upload'].forEach(function (id) { var button = document.getElementById(id); if (button) button.addEventListener('click', function () { closeDialog('instruction-upload-dialog'); }); });
    if (uploadDialog) uploadDialog.addEventListener('click', function (event) { if (event.target === uploadDialog) closeDialog('instruction-upload-dialog'); });
    if (fileInput) fileInput.addEventListener('change', function () { var file = fileInput.files && fileInput.files[0]; setStatus('instruction-upload-status', '', ''); if (!file) return; if ((file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) || file.size > maxBytes) { setStatus('instruction-upload-status', 'Chỉ nhận PDF hợp lệ, tối đa 25 MB.', 'error'); fileInput.value = ''; return; } if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = URL.createObjectURL(file); preview.data = previewUrl; preview.classList.add('is-visible'); if (empty) empty.hidden = true; });
    if (uploadForm) uploadForm.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!authenticated) { closeDialog('instruction-upload-dialog'); return; }
      var file = fileInput.files && fileInput.files[0];
      var title = document.getElementById('instruction-pdf-title').value.trim().replace(/\s+/g, ' ');
      var signedDate = new Date().toISOString().slice(0, 10);
      if (!file || !title) { setStatus('instruction-upload-status', 'Vui lòng chọn PDF và nhập tên thuốc.', 'error'); return; }
      uploadSubmit.disabled = true; setStatus('instruction-upload-status', 'Đang tải HDSD lên máy chủ...', '');
      validate().then(function (allowed) { if (!allowed) throw new Error('Hết phiên.'); return uploadInstruction(file, title, signedDate); }).then(function () { localStorage.setItem('khoa-duoc-documents-updated', String(Date.now())); setStatus('instruction-upload-status', 'Đã thêm HDSD; các bài Thông tin thuốc sẽ tự đối chiếu.', 'success'); window.setTimeout(function () { closeDialog('instruction-upload-dialog'); window.location.reload(); }, 700); }).catch(function () { setStatus('instruction-upload-status', 'Không thể tải HDSD lên máy chủ.', 'error'); }).finally(function () { uploadSubmit.disabled = false; });
    });
  }
  document.addEventListener('DOMContentLoaded', init);
}());
