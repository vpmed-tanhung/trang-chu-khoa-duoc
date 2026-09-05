(function () {
  'use strict';

  var monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];
  var databaseName = 'khoa-duoc-thong-tin-thuoc';
  var databaseVersion = 1;
  var documentStoreName = 'documents';
  var staffSessionKey = 'khoa-duoc-staff-session';
  var demoStaffUsername = 'khoaduoc';
  var demoStaffPassword = 'KhoaDuoc@2026';
  var documentsCache = [];
  var previewObjectUrl = '';
  var documentObjectUrls = [];
  var databasePromise = null;
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

  function openDatabase() {
    if (databasePromise) {
      return databasePromise;
    }

    databasePromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error('Trình duyệt không hỗ trợ lưu tài liệu.'));
        return;
      }

      var request = window.indexedDB.open(databaseName, databaseVersion);

      request.onupgradeneeded = function () {
        var database = request.result;
        if (!database.objectStoreNames.contains(documentStoreName)) {
          database.createObjectStore(documentStoreName, { keyPath: 'id' });
        }
      };

      request.onsuccess = function () {
        resolve(request.result);
      };

      request.onerror = function () {
        reject(request.error || new Error('Không thể mở kho tài liệu.'));
      };
    });

    return databasePromise;
  }

  function loadStoredDocuments() {
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var transaction = database.transaction(documentStoreName, 'readonly');
        var request = transaction.objectStore(documentStoreName).getAll();

        request.onsuccess = function () {
          resolve(Array.isArray(request.result) ? request.result : []);
        };

        request.onerror = function () {
          reject(request.error || new Error('Không thể đọc tài liệu đã thêm.'));
        };
      });
    });
  }

  function saveStoredDocument(documentItem) {
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var transaction = database.transaction(documentStoreName, 'readwrite');
        transaction.objectStore(documentStoreName).add(documentItem);

        transaction.oncomplete = function () {
          resolve(documentItem);
        };

        transaction.onerror = function () {
          reject(transaction.error || new Error('Không thể lưu tài liệu.'));
        };

        transaction.onabort = function () {
          reject(transaction.error || new Error('Không thể lưu tài liệu.'));
        };
      });
    });
  }

  function releaseDocumentObjectUrls() {
    documentObjectUrls.forEach(function (url) {
      URL.revokeObjectURL(url);
    });
    documentObjectUrls = [];
  }

  function normalizeUploadedDocument(documentItem) {
    var objectUrl = documentItem.pdfBlob instanceof Blob
      ? URL.createObjectURL(documentItem.pdfBlob)
      : '';

    if (objectUrl) {
      documentObjectUrls.push(objectUrl);
    }

    return {
      id: documentItem.id,
      title: documentItem.title,
      signedDate: documentItem.signedDate,
      file: documentItem.fileName,
      url: objectUrl,
      uploaded: true
    };
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

    releaseDocumentObjectUrls();
    return loadStoredDocuments().then(function (uploadedDocuments) {
      return mergeDocuments(baseDocuments, uploadedDocuments.map(normalizeUploadedDocument));
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
    try {
      return sessionStorage.getItem(staffSessionKey) === 'authenticated';
    } catch (error) {
      return staffAuthenticated;
    }
  }

  function writeStaffSession(isAuthenticated) {
    staffAuthenticated = isAuthenticated;

    try {
      if (isAuthenticated) {
        sessionStorage.setItem(staffSessionKey, 'authenticated');
      } else {
        sessionStorage.removeItem(staffSessionKey);
      }
    } catch (error) {
      return;
    }
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
    var isAuthenticated = readStaffSession();
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

    renderStaffAccess();

    if (!loginButton || !logoutButton || !dialog || !form) {
      return;
    }

    loginButton.addEventListener('click', function () {
      openStaffLoginDialog(dialog);
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
      var username = usernameInput ? usernameInput.value.trim() : '';
      var password = passwordInput ? passwordInput.value : '';

      if (username !== demoStaffUsername || password !== demoStaffPassword) {
        setStaffLoginStatus('Tài khoản hoặc mật khẩu không đúng.', 'error');
        if (passwordInput) {
          passwordInput.value = '';
          passwordInput.focus();
        }
        return;
      }

      writeStaffSession(true);
      renderStaffAccess();
      closeStaffLoginDialog(dialog);

      var addButton = document.getElementById('open-document-upload');
      if (addButton) {
        addButton.focus();
      }
    });

    logoutButton.addEventListener('click', function () {
      writeStaffSession(false);
      renderStaffAccess();

      var uploadDialog = document.getElementById('document-upload-dialog');
      if (uploadDialog && uploadDialog.open) {
        closeUploadDialog(uploadDialog);
      }

      loginButton.focus();
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
      if (!readStaffSession()) {
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

      if (!readStaffSession()) {
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

        return saveStoredDocument({
          id: 'uploaded-' + Date.now() + '-' + Math.random().toString(36).slice(2),
          title: title,
          signedDate: signedDate,
          fileName: file.name,
          pdfBlob: file,
          createdAt: new Date().toISOString()
        });
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
        setUploadStatus(error.message || 'Không thể thêm tài liệu.', 'error');
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
      releaseDocumentObjectUrls();
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
