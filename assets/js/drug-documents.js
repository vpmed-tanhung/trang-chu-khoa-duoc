(function () {
  'use strict';

  var monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];
  var serverConfig = window.KHOA_DUOC_SERVER || {};
  var supabaseUrl = String(serverConfig.supabaseUrl || '').replace(/\/+$/, '');
  var publishableKey = String(serverConfig.supabasePublishableKey || '');
  var storageBucket = String(serverConfig.storageBucket || 'drug-documents');
  var maxUploadBytes = Number(serverConfig.maxUploadBytes) || 26214400;
  var staffSessionKey = 'khoa-duoc-secure-staff-session';
  var documentsCache = [];
  var previewObjectUrl = '';
  var authSession = null;
  var refreshPromise = null;
  var staffAuthenticated = false;
  var updateChannel = typeof BroadcastChannel === 'function'
    ? new BroadcastChannel('khoa-duoc-thong-tin-thuoc')
    : null;

  function isValidDocument(documentItem) {
    return Boolean(
      documentItem &&
      documentItem.title &&
      (documentItem.file || documentItem.url) &&
      /^\d{4}-\d{2}-\d{2}$/.test(documentItem.signedDate)
    );
  }

  function sortDocuments(documents) {
    return documents.slice().sort(function (first, second) {
      var dateOrder = second.signedDate.localeCompare(first.signedDate);
      return dateOrder || first.title.localeCompare(second.title, 'vi');
    });
  }

  function getBaseDocuments() {
    var documents = Array.isArray(window.DRUG_DOCUMENTS) ? window.DRUG_DOCUMENTS : [];
    return documents.filter(isValidDocument);
  }

  function hasServerConfig() {
    return /^https:\/\//i.test(supabaseUrl) && publishableKey.length >= 20;
  }

  function encodeStoragePath(path) {
    return String(path || '').split('/').map(encodeURIComponent).join('/');
  }

  function serverRequest(path, options, accessToken) {
    var requestOptions = options || {};
    var headers = new Headers(requestOptions.headers || {});

    if (!hasServerConfig()) {
      return Promise.reject(new Error('Máy chủ bảo mật chưa được cấu hình.'));
    }

    headers.set('apikey', publishableKey);
    if (accessToken) {
      headers.set('Authorization', 'Bearer ' + accessToken);
    }

    requestOptions.headers = headers;
    return fetch(supabaseUrl + path, requestOptions).then(function (response) {
      return response.text().then(function (bodyText) {
        var payload = null;
        if (bodyText) {
          try {
            payload = JSON.parse(bodyText);
          } catch (error) {
            payload = bodyText;
          }
        }

        if (!response.ok) {
          var requestError = new Error('Yêu cầu máy chủ không thành công.');
          requestError.status = response.status;
          requestError.payload = payload;
          throw requestError;
        }

        return payload;
      });
    });
  }

  function publicDocumentUrl(storagePath) {
    return supabaseUrl + '/storage/v1/object/public/' +
      encodeURIComponent(storageBucket) + '/' + encodeStoragePath(storagePath);
  }

  function normalizeServerDocument(documentItem) {
    return {
      id: documentItem.id,
      title: documentItem.title,
      signedDate: documentItem.signed_date,
      file: documentItem.file_name,
      url: publicDocumentUrl(documentItem.storage_path),
      uploaded: true
    };
  }

  function loadServerDocuments() {
    if (!hasServerConfig()) {
      return Promise.resolve([]);
    }

    return serverRequest(
      '/rest/v1/drug_documents?select=id,title,signed_date,file_name,storage_path,created_at&order=signed_date.desc,title.asc',
      { method: 'GET', headers: { Accept: 'application/json' } }
    ).then(function (documents) {
      return Array.isArray(documents) ? documents.map(normalizeServerDocument) : [];
    });
  }

  function mergeDocuments(baseDocuments, uploadedDocuments) {
    var seen = {};

    return sortDocuments(baseDocuments.concat(uploadedDocuments).filter(function (documentItem) {
      if (!isValidDocument(documentItem)) {
        return false;
      }

      var key = documentItem.title.trim().toLocaleLowerCase('vi') + '|' + documentItem.signedDate;
      if (seen[key]) {
        return false;
      }

      seen[key] = true;
      return true;
    }));
  }

  function loadDocuments() {
    var baseDocuments = getBaseDocuments();

    return loadServerDocuments().then(function (uploadedDocuments) {
      return mergeDocuments(baseDocuments, uploadedDocuments);
    }).catch(function () {
      return sortDocuments(baseDocuments);
    });
  }

  function signalDocumentsChanged() {
    if (updateChannel) {
      updateChannel.postMessage('refresh');
    }

    try {
      localStorage.setItem('khoa-duoc-documents-updated', String(Date.now()));
    } catch (error) {
      return;
    }
  }

  function getDateParts(isoDate) {
    var parts = isoDate.split('-');
    return {
      year: Number(parts[0]),
      month: Number(parts[1]),
      day: Number(parts[2])
    };
  }

  function formatDate(isoDate) {
    var parts = getDateParts(isoDate);
    return String(parts.day).padStart(2, '0') + '/' +
      String(parts.month).padStart(2, '0') + '/' + parts.year;
  }

  function getMonthKey(isoDate) {
    return isoDate.slice(0, 7);
  }

  function formatMonth(monthKey) {
    var parts = monthKey.split('-');
    return monthNames[Number(parts[1]) - 1] + ', ' + parts[0];
  }

  function documentUrl(fileName) {
    return 'assets/documents/thong-tin-thuoc/' + fileName.split('/').map(encodeURIComponent).join('/');
  }

  function createPdfLink(documentItem, className) {
    var link = document.createElement('a');
    link.href = documentItem.url || documentUrl(documentItem.file);
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = documentItem.title;
    link.setAttribute('aria-label', documentItem.title + ' — mở PDF trong thẻ mới');

    if (className) {
      link.className = className;
    }

    return link;
  }

  function groupByMonth(documents) {
    return documents.reduce(function (groups, documentItem) {
      var key = getMonthKey(documentItem.signedDate);

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(documentItem);
      return groups;
    }, {});
  }

  function renderCategoryCount(documents) {
    var categoryLink = document.getElementById('document-category-link');

    if (!categoryLink) {
      return;
    }

    categoryLink.textContent = 'Thông tin thuốc (' + documents.length + ')';
    categoryLink.setAttribute('aria-label', 'Mở thư mục Thông tin thuốc, có ' + documents.length + ' tài liệu');
  }

  function renderRecentDocuments(documents) {
    var recentList = document.getElementById('recent-drug-documents');

    if (!recentList) {
      return;
    }

    recentList.textContent = '';

    documents.slice(0, 6).forEach(function (documentItem) {
      var listItem = document.createElement('li');
      var date = document.createElement('time');
      date.dateTime = documentItem.signedDate;
      date.textContent = formatDate(documentItem.signedDate);
      listItem.appendChild(createPdfLink(documentItem));
      listItem.appendChild(date);
      recentList.appendChild(listItem);
    });
  }

  function renderArchives(documents) {
    var archiveList = document.getElementById('drug-document-archives');

    if (!archiveList) {
      return;
    }

    var groups = groupByMonth(documents);
    archiveList.textContent = '';

    Object.keys(groups).sort().reverse().forEach(function (monthKey) {
      var listItem = document.createElement('li');
      var link = document.createElement('a');
      link.href = 'thong-tin-thuoc.html#luu-tru-' + monthKey;
      link.textContent = formatMonth(monthKey) + ' (' + groups[monthKey].length + ')';
      listItem.appendChild(link);
      archiveList.appendChild(listItem);
    });
  }

  function renderDocumentDirectory(documents) {
    var directory = document.getElementById('drug-document-directory');

    if (!directory) {
      return;
    }

    directory.textContent = '';

    if (documents.length === 0) {
      var emptyMessage = document.createElement('p');
      emptyMessage.className = 'document-empty';
      emptyMessage.textContent = 'Chưa có tài liệu trong thư mục Thông tin thuốc.';
      directory.appendChild(emptyMessage);
      return;
    }

    var groups = groupByMonth(documents);

    Object.keys(groups).sort().reverse().forEach(function (monthKey) {
      var group = document.createElement('section');
      var heading = document.createElement('div');
      var title = document.createElement('h2');
      var count = document.createElement('span');
      var list = document.createElement('div');

      group.className = 'document-month';
      group.id = 'luu-tru-' + monthKey;
      heading.className = 'document-month-heading';
      title.textContent = formatMonth(monthKey);
      count.textContent = groups[monthKey].length + ' tài liệu';
      list.className = 'document-list';

      groups[monthKey].forEach(function (documentItem, index) {
        var row = document.createElement('article');
        var number = document.createElement('span');
        var body = document.createElement('div');
        var date = document.createElement('time');
        var attachmentNote = null;

        row.className = 'document-row';
        number.className = 'document-number';
        number.textContent = String(index + 1).padStart(2, '0');
        body.className = 'document-body';
        date.dateTime = documentItem.signedDate;
        date.textContent = 'Ngày ký ban hành: ' + formatDate(documentItem.signedDate);
        body.appendChild(createPdfLink(documentItem, 'document-title'));
        body.appendChild(date);

        if (documentItem.hdsdFile) {
          attachmentNote = document.createElement('span');
          attachmentNote.className = 'document-attachment-note';
          attachmentNote.textContent = 'Bản có chữ ký + Hướng dẫn sử dụng';
          body.appendChild(attachmentNote);
        }

        row.appendChild(number);
        row.appendChild(body);
        list.appendChild(row);
      });

      heading.appendChild(title);
      heading.appendChild(count);
      group.appendChild(heading);
      group.appendChild(list);
      directory.appendChild(group);
    });
  }

  function renderAll(documents) {
    documentsCache = documents;
    renderCategoryCount(documents);
    renderRecentDocuments(documents);
    renderArchives(documents);
    renderDocumentDirectory(documents);
  }

  function refreshDocuments() {
    return loadDocuments().then(function (documents) {
      renderAll(documents);
      return documents;
    });
  }

  function setUploadStatus(message, type) {
    var status = document.getElementById('document-upload-status');
    if (!status) {
      return;
    }

    status.textContent = message || '';
    status.classList.toggle('is-error', type === 'error');
    status.classList.toggle('is-success', type === 'success');
  }

  function clearPreview() {
    var preview = document.getElementById('document-pdf-preview');
    var empty = document.getElementById('document-pdf-preview-empty');

    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = '';
    }

    if (preview) {
      preview.removeAttribute('data');
      preview.classList.remove('is-visible');
    }

    if (empty) {
      empty.hidden = false;
    }
  }

  function showPreview(file) {
    var preview = document.getElementById('document-pdf-preview');
    var empty = document.getElementById('document-pdf-preview-empty');

    clearPreview();
    if (!preview || !file) {
      return;
    }

    previewObjectUrl = URL.createObjectURL(file);
    preview.data = previewObjectUrl;
    preview.classList.add('is-visible');
    if (empty) {
      empty.hidden = true;
    }
  }

  function resetUploadForm() {
    var form = document.getElementById('document-upload-form');
    if (form) {
      form.reset();
    }
    clearPreview();
    setUploadStatus('', '');
  }

  function closeUploadDialog(dialog) {
    resetUploadForm();
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  function readStaffSession() {
    if (authSession) {
      return authSession;
    }

    try {
      var storedSession = JSON.parse(sessionStorage.getItem(staffSessionKey) || 'null');
      if (storedSession && storedSession.access_token && storedSession.refresh_token) {
        authSession = storedSession;
        return authSession;
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  function writeStaffSession(session) {
    authSession = session || null;

    try {
      if (authSession) {
        sessionStorage.setItem(staffSessionKey, JSON.stringify(authSession));
      } else {
        sessionStorage.removeItem(staffSessionKey);
      }
    } catch (error) {
      return;
    }
  }

  function clearStaffSession() {
    staffAuthenticated = false;
    writeStaffSession(null);
  }

  function normalizeAuthSession(payload) {
    var expiresAt = Number(payload && payload.expires_at);
    if (!expiresAt && payload && payload.expires_in) {
      expiresAt = Math.floor(Date.now() / 1000) + Number(payload.expires_in);
    }

    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: expiresAt || 0
    };
  }

  function refreshStaffSession(session) {
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = serverRequest('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    }).then(function (payload) {
      var refreshedSession = normalizeAuthSession(payload);
      writeStaffSession(refreshedSession);
      return refreshedSession;
    }).catch(function (error) {
      clearStaffSession();
      throw error;
    }).finally(function () {
      refreshPromise = null;
    });

    return refreshPromise;
  }

  function getStaffAccessToken() {
    var session = readStaffSession();
    if (!session) {
      return Promise.reject(new Error('Phiên đăng nhập không tồn tại.'));
    }

    if (session.expires_at > Math.floor(Date.now() / 1000) + 60) {
      return Promise.resolve(session.access_token);
    }

    return refreshStaffSession(session).then(function (refreshedSession) {
      return refreshedSession.access_token;
    });
  }

  function validateStaffSession() {
    if (!hasServerConfig() || !readStaffSession()) {
      clearStaffSession();
      return Promise.resolve(false);
    }

    return getStaffAccessToken().then(function (accessToken) {
      return serverRequest('/auth/v1/user', { method: 'GET' }, accessToken).then(function () {
        return serverRequest('/rest/v1/rpc/is_pharmacy_staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        }, accessToken);
      });
    }).then(function (hasPermission) {
      staffAuthenticated = hasPermission === true;
      if (!staffAuthenticated) {
        clearStaffSession();
      }
      return staffAuthenticated;
    }).catch(function () {
      clearStaffSession();
      return false;
    });
  }

  function signInStaff(email, password) {
    return serverRequest('/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (payload) {
      writeStaffSession(normalizeAuthSession(payload));
      return validateStaffSession();
    }).then(function (isAuthorized) {
      if (!isAuthorized) {
        throw new Error('Tài khoản không có quyền nhân viên Khoa Dược.');
      }
      return true;
    });
  }

  function signOutStaff() {
    var session = readStaffSession();
    var request = session && hasServerConfig()
      ? serverRequest('/auth/v1/logout?scope=local', { method: 'POST' }, session.access_token).catch(function () {})
      : Promise.resolve();

    return request.finally(function () {
      clearStaffSession();
    });
  }

  function setStaffLoginStatus(message, type) {
    var status = document.getElementById('staff-login-status');
    if (!status) {
      return;
    }

    status.textContent = message || '';
    status.classList.toggle('is-error', type === 'error');
    status.classList.toggle('is-success', type === 'success');
  }

  function renderStaffAccess() {
    var isAuthenticated = staffAuthenticated;
    var loginButton = document.getElementById('open-staff-login');
    var controls = document.getElementById('document-staff-controls');
    var addButton = document.getElementById('open-document-upload');

    if (loginButton) {
      loginButton.hidden = isAuthenticated;
    }

    if (controls) {
      controls.hidden = !isAuthenticated;
    }

    if (addButton) {
      addButton.hidden = !isAuthenticated;
    }
  }

  function closeStaffLoginDialog(dialog) {
    var form = document.getElementById('staff-login-form');
    if (form) {
      form.reset();
    }
    setStaffLoginStatus('', '');

    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  function openStaffLoginDialog(dialog) {
    var usernameInput = document.getElementById('staff-username');
    var form = document.getElementById('staff-login-form');

    if (form) {
      form.reset();
    }
    setStaffLoginStatus('', '');

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    if (usernameInput) {
      usernameInput.focus();
    }
  }

  function initStaffAccess() {
    var loginButton = document.getElementById('open-staff-login');
    var logoutButton = document.getElementById('staff-logout');
    var dialog = document.getElementById('staff-login-dialog');
    var closeButton = document.getElementById('close-staff-login');
    var cancelButton = document.getElementById('cancel-staff-login');
    var form = document.getElementById('staff-login-form');

    staffAuthenticated = false;
    renderStaffAccess();

    if (!loginButton || !logoutButton || !dialog || !form) {
      return;
    }

    validateStaffSession().then(renderStaffAccess);

    loginButton.addEventListener('click', function () {
      openStaffLoginDialog(dialog);
      if (!hasServerConfig()) {
        setStaffLoginStatus('Máy chủ bảo mật chưa được cấu hình.', 'error');
      }
    });

    [closeButton, cancelButton].forEach(function (button) {
      if (button) {
        button.addEventListener('click', function () {
          closeStaffLoginDialog(dialog);
        });
      }
    });

    dialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeStaffLoginDialog(dialog);
    });

    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) {
        closeStaffLoginDialog(dialog);
      }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var usernameInput = document.getElementById('staff-username');
      var passwordInput = document.getElementById('staff-password');
      var submitButton = form.querySelector('button[type="submit"]');
      var email = usernameInput ? usernameInput.value.trim().toLowerCase() : '';
      var password = passwordInput ? passwordInput.value : '';

      if (!hasServerConfig()) {
        setStaffLoginStatus('Máy chủ bảo mật chưa được cấu hình.', 'error');
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
      }
      setStaffLoginStatus('Đang xác thực...', '');

      signInStaff(email, password).then(function () {
        renderStaffAccess();
        closeStaffLoginDialog(dialog);

        var addButton = document.getElementById('open-document-upload');
        if (addButton) {
          addButton.focus();
        }
      }).catch(function () {
        setStaffLoginStatus('Email, mật khẩu hoặc quyền truy cập không đúng.', 'error');
        if (passwordInput) {
          passwordInput.value = '';
          passwordInput.focus();
        }
      }).finally(function () {
        if (submitButton) {
          submitButton.disabled = false;
        }
      });
    });

    logoutButton.addEventListener('click', function () {
      signOutStaff().then(function () {
        renderStaffAccess();

        var uploadDialog = document.getElementById('document-upload-dialog');
        if (uploadDialog && uploadDialog.open) {
          closeUploadDialog(uploadDialog);
        }

        loginButton.focus();
      });
    });
  }

  function createSecureId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }

    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      var randomBytes = new Uint8Array(16);
      window.crypto.getRandomValues(randomBytes);
      return Array.prototype.map.call(randomBytes, function (value) {
        return value.toString(16).padStart(2, '0');
      }).join('');
    }

    throw new Error('Trình duyệt không hỗ trợ tạo mã tệp an toàn.');
  }

  function uploadServerDocument(file, title, signedDate) {
    var storagePath = signedDate.slice(0, 7) + '/' + createSecureId() + '.pdf';
    var accessToken = '';
    var uploaded = false;

    return getStaffAccessToken().then(function (token) {
      accessToken = token;
      return serverRequest(
        '/storage/v1/object/' + encodeURIComponent(storageBucket) + '/' + encodeStoragePath(storagePath),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/pdf',
            'Cache-Control': '3600',
            'x-upsert': 'false'
          },
          body: file
        },
        accessToken
      );
    }).then(function () {
      uploaded = true;
      return serverRequest('/rest/v1/drug_documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          title: title,
          signed_date: signedDate,
          file_name: file.name.slice(0, 255),
          storage_path: storagePath
        })
      }, accessToken);
    }).catch(function (error) {
      if (!uploaded || !accessToken) {
        throw error;
      }

      return serverRequest(
        '/storage/v1/object/' + encodeURIComponent(storageBucket) + '/' + encodeStoragePath(storagePath),
        { method: 'DELETE' },
        accessToken
      ).catch(function () {}).then(function () {
        throw error;
      });
    });
  }

  function initUploadDialog() {
    var openButton = document.getElementById('open-document-upload');
    var dialog = document.getElementById('document-upload-dialog');
    var closeButton = document.getElementById('close-document-upload');
    var cancelButton = document.getElementById('cancel-document-upload');
    var submitButton = document.getElementById('submit-document-upload');
    var form = document.getElementById('document-upload-form');
    var fileInput = document.getElementById('document-pdf-file');

    if (!openButton || !dialog || !form || !fileInput || !submitButton) {
      return;
    }

    openButton.addEventListener('click', function () {
      if (!staffAuthenticated) {
        var staffLoginDialog = document.getElementById('staff-login-dialog');
        if (staffLoginDialog) {
          openStaffLoginDialog(staffLoginDialog);
        }
        return;
      }

      resetUploadForm();
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
      fileInput.focus();
    });

    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      setUploadStatus('', '');

      if (!file) {
        clearPreview();
        return;
      }

      if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
        clearPreview();
        setUploadStatus('Chỉ chấp nhận tệp PDF.', 'error');
        fileInput.value = '';
        return;
      }

      showPreview(file);
    });

    [closeButton, cancelButton].forEach(function (button) {
      if (button) {
        button.addEventListener('click', function () {
          closeUploadDialog(dialog);
        });
      }
    });

    dialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeUploadDialog(dialog);
    });

    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) {
        closeUploadDialog(dialog);
      }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      if (!staffAuthenticated) {
        closeUploadDialog(dialog);
        renderStaffAccess();
        return;
      }

      var file = fileInput.files && fileInput.files[0];
      var titleInput = document.getElementById('document-pdf-title');
      var dateInput = document.getElementById('document-signed-date');
      var title = titleInput ? titleInput.value.trim().replace(/\s+/g, ' ') : '';
      var signedDate = dateInput ? dateInput.value : '';

      if (!file || !title || !/^\d{4}-\d{2}-\d{2}$/.test(signedDate)) {
        setUploadStatus('Vui lòng chọn PDF, nhập đúng tiêu đề và ngày ký ban hành.', 'error');
        return;
      }

      if (file.size > maxUploadBytes) {
        setUploadStatus('Tệp PDF vượt quá giới hạn 25 MB.', 'error');
        return;
      }

      var duplicate = documentsCache.some(function (documentItem) {
        return documentItem.title.trim().toLocaleLowerCase('vi') === title.toLocaleLowerCase('vi') &&
          documentItem.signedDate === signedDate;
      });

      if (duplicate) {
        setUploadStatus('Tài liệu này đã có trong danh sách.', 'error');
        return;
      }

      submitButton.disabled = true;
      if (cancelButton) {
        cancelButton.disabled = true;
      }
      setUploadStatus('Đang thêm tài liệu...', '');

      file.slice(0, 5).text().then(function (signature) {
        if (signature !== '%PDF-') {
          throw new Error('Tệp được chọn không phải PDF hợp lệ.');
        }

        return validateStaffSession();
      }).then(function (isAuthorized) {
        if (!isAuthorized) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }

        return uploadServerDocument(file, title, signedDate);
      }).then(function () {
        signalDocumentsChanged();
        return refreshDocuments();
      }).then(function () {
        setUploadStatus('Đã thêm tài liệu và cập nhật toàn bộ danh sách.', 'success');
        window.setTimeout(function () {
          closeUploadDialog(dialog);
          var target = document.getElementById('luu-tru-' + signedDate.slice(0, 7));
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 650);
      }).catch(function (error) {
        if (!staffAuthenticated) {
          setUploadStatus('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
          renderStaffAccess();
        } else {
          setUploadStatus('Không thể tải tài liệu lên máy chủ. Vui lòng thử lại.', 'error');
        }
      }).finally(function () {
        submitButton.disabled = false;
        if (cancelButton) {
          cancelButton.disabled = false;
        }
      });
    });

    if (updateChannel) {
      updateChannel.addEventListener('message', function () {
        refreshDocuments();
      });
    }

    window.addEventListener('storage', function (event) {
      if (event.key === 'khoa-duoc-documents-updated') {
        refreshDocuments();
      }
    });

    window.addEventListener('beforeunload', function () {
      clearPreview();
      if (updateChannel) {
        updateChannel.close();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initStaffAccess();
    initUploadDialog();
    refreshDocuments();
  });
}());
