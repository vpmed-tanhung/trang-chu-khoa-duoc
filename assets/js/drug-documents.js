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
  var combinedPdfCache = {};
  var combinedObjectUrls = [];
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

  function getBaseInstructions() {
    var instructions = Array.isArray(window.DRUG_INSTRUCTIONS) ? window.DRUG_INSTRUCTIONS : [];
    return instructions.filter(function (item) {
      return item && item.title && item.file;
    }).map(function (item) {
      return {
        title: item.title,
        keywords: item.keywords || '',
        file: item.file,
        url: 'assets/documents/huong-dan-su-dung/' + encodeStoragePath(item.file)
      };
    });
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

  function removeStorageObject(storagePath, accessToken) {
    if (!storagePath) return Promise.resolve(null);
    return serverRequest('/storage/v1/object/remove/' + encodeURIComponent(storageBucket), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [storagePath] })
    }, accessToken);
  }

  function normalizeServerDocument(documentItem) {
    return {
      id: documentItem.id,
      title: documentItem.title,
      signedDate: documentItem.signed_date,
      file: documentItem.file_name,
      url: publicDocumentUrl(documentItem.storage_path),
      storagePath: documentItem.storage_path,
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

  function loadContentMigrations() {
    if (!hasServerConfig()) return Promise.resolve([]);
    return serverRequest('/rest/v1/content_migrations?select=migration_key', {
      method: 'GET', headers: { Accept: 'application/json' }
    }).then(function (rows) {
      return Array.isArray(rows) ? rows.map(function (row) { return row.migration_key; }) : [];
    });
  }

  function normalizeMatchText(value) {
    return String(value || '').toLocaleLowerCase('vi')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function getProductTokens(value) {
    var ignored = {
      thuoc: true, dieu: true, tri: true, khang: true, sinh: true, chong: true,
      ung: true, thu: true, giai: true, doc: true, va: true, cac: true,
      benh: true, glucose: true, mau: true, tang: true, huyet: true, ap: true,
      nhom: true, dung: true, dich: true, tiem: true, vien: true, nang: true,
      bom: true, xit: true, huong: true, dan: true, su: true, hdsd: true,
      ham: true, luong: true, bao: true, phim: true, tra: true, mat: true,
      nho: true, hon: true, nhuan: true, trang: true, loi: true, tieu: true,
      gian: true, tron: true, acid: true,
      mg: true, ml: true, mcg: true, ug: true, iu: true,
      bot: true, pha: true, tiem: true, truyen: true, uong: true,
      duoi: true, dang: true, thanh: true, phan: true, hoat: true, chat: true,
      hydrate: true, hydrat: true, trihydrate: true, trihydrat: true,
      injection: true, inject: true, inj: true, tablet: true, tablets: true,
      capsule: true, capsules: true, solution: true, powder: true, for: true,
      use: true, kem: true
    };
    var seen = {};
    return normalizeMatchText(value).split(' ').filter(function (token) {
      if (token.length < 3 || ignored[token] || /^\d/.test(token) || seen[token]) return false;
      seen[token] = true;
      return true;
    }).sort();
  }

  function getDoseTokens(value) {
    var text = String(value || '').toLocaleLowerCase('vi')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/,/g, '.')
      .replace(/μg|µg/g, 'mcg');
    var doses = [];
    var seen = {};
    var pattern = /(\d+(?:\.\d+)?)\s*(mcg|mg|ml|iu|g|%)(?![a-z])/g;
    var match;

    function normalizeDose(amount, unit) {
      var numericAmount = Number(amount);
      if (unit === 'g') return 'mass:' + String(numericAmount * 1000) + 'mg';
      if (unit === 'mcg') return 'mass:' + String(numericAmount / 1000) + 'mg';
      if (unit === 'mg') return 'mass:' + String(numericAmount) + 'mg';
      return unit + ':' + String(numericAmount);
    }

    while ((match = pattern.exec(text)) !== null) {
      var normalizedDose = normalizeDose(match[1], match[2]);
      if (!seen[normalizedDose]) {
        seen[normalizedDose] = true;
        doses.push(normalizedDose);
      }
    }

    return doses.sort();
  }

  function containsAllTokens(containerTokens, requiredTokens) {
    return requiredTokens.every(function (token) {
      return containerTokens.indexOf(token) !== -1;
    });
  }

  function countCommonTokens(firstTokens, secondTokens) {
    return firstTokens.filter(function (token) {
      return secondTokens.indexOf(token) !== -1;
    }).length;
  }

  function haveCommonDose(firstDoses, secondDoses) {
    return firstDoses.some(function (dose) {
      return secondDoses.indexOf(dose) !== -1;
    });
  }

  function instructionIdentityText(instruction) {
    return [instruction.title, instruction.keywords].filter(Boolean).join(' ');
  }

  function scoreInstructionMatch(documentItem, instruction) {
    var documentTokens = getProductTokens(documentItem.title);
    var instructionTokens = getProductTokens(instructionIdentityText(instruction));
    var documentDoses = getDoseTokens(documentItem.title);
    var instructionDoses = getDoseTokens(instructionIdentityText(instruction));
    var commonTokens = countCommonTokens(documentTokens, instructionTokens);
    var smallerTokenCount = Math.min(documentTokens.length, instructionTokens.length);
    var sameProductTokens = documentTokens.join('|') === instructionTokens.join('|');
    var oneProductContainsOther = containsAllTokens(documentTokens, instructionTokens) ||
      containsAllTokens(instructionTokens, documentTokens);
    var score = 0;

    if (!documentTokens.length || !instructionTokens.length || !commonTokens) return null;

    if (sameProductTokens) {
      score += 100;
    } else if (oneProductContainsOther) {
      score += 80;
    } else if (commonTokens >= 2 && commonTokens / smallerTokenCount >= 0.75) {
      score += 55;
    } else {
      return null;
    }

    if (documentDoses.length && instructionDoses.length) {
      if (!haveCommonDose(documentDoses, instructionDoses)) return null;
      score += documentDoses.join('|') === instructionDoses.join('|') ? 40 : 30;
    } else if (!documentDoses.length && !instructionDoses.length) {
      score += 10;
    }

    return {
      instruction: instruction,
      score: score,
      identityKey: instructionTokens.join('|') + '::' + instructionDoses.join('|')
    };
  }

  function loadServerInstructions() {
    if (!hasServerConfig()) return Promise.resolve([]);
    return serverRequest('/rest/v1/drug_instructions?select=id,title,keywords,signed_date,file_name,storage_path&order=created_at.desc', { method: 'GET', headers: { Accept: 'application/json' } })
      .then(function (rows) {
        return Array.isArray(rows) ? rows.map(function (row) {
          return { title: row.title, keywords: row.keywords || '', signedDate: row.signed_date, file: row.file_name, url: publicDocumentUrl(row.storage_path), server: true };
        }) : [];
      });
  }

  function findMatchingInstruction(documentItem, instructions) {
    var candidates = instructions.map(function (item) {
      return scoreInstructionMatch(documentItem, item);
    }).filter(Boolean).sort(function (first, second) {
      var scoreOrder = second.score - first.score;
      if (scoreOrder) return scoreOrder;
      return String(second.instruction.signedDate || '').localeCompare(String(first.instruction.signedDate || ''));
    });

    if (!candidates.length) return null;
    if (candidates.length > 1 &&
        candidates[0].score === candidates[1].score &&
        candidates[0].identityKey !== candidates[1].identityKey) {
      return null;
    }
    return candidates[0].instruction;
  }

  function mergeDocuments(baseDocuments, uploadedDocuments, instructions) {
    var seen = {};

    return sortDocuments(uploadedDocuments.concat(baseDocuments).filter(function (documentItem) {
      if (!isValidDocument(documentItem)) {
        return false;
      }

      var key = documentItem.title.trim().toLocaleLowerCase('vi') + '|' + documentItem.signedDate;
      if (seen[key]) {
        return false;
      }

      seen[key] = true;
      var matched = findMatchingInstruction(documentItem, instructions || []);
      if (matched && !documentItem.hdsdUrl) documentItem.hdsdUrl = matched.url || ('assets/documents/huong-dan-su-dung/' + encodeURIComponent(matched.file || ''));
      if (matched) documentItem.hdsdTitle = matched.title;
      return true;
    }));
  }

  function loadDocuments() {
    var baseDocuments = getBaseDocuments();
    var baseInstructions = getBaseInstructions();

    return Promise.all([
      loadServerDocuments().catch(function () { return []; }),
      loadServerInstructions().catch(function () { return []; }),
      loadContentMigrations().catch(function () { return []; })
    ]).then(function (results) {
      if (results[2].indexOf('drug_documents_v1') !== -1) baseDocuments = [];
      if (results[2].indexOf('drug_instructions_v1') !== -1) baseInstructions = [];
      return mergeDocuments(baseDocuments, results[0], results[1].concat(baseInstructions));
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

  function useSameTabPdfViewer() {
    return typeof window.matchMedia === 'function' && (
      window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(max-width: 820px)').matches
    );
  }

  function prepareCombinedPdf(documentItem) {
    var primaryUrl = documentItem.url || documentUrl(documentItem.file);
    var cacheKey = primaryUrl + '|' + documentItem.hdsdUrl;
    if (combinedPdfCache[cacheKey]) return combinedPdfCache[cacheKey];
    if (!window.PDFLib || !window.PDFLib.PDFDocument) {
      return Promise.reject(new Error('Bộ ghép PDF chưa được tải.'));
    }

    combinedPdfCache[cacheKey] = Promise.all([
      fetch(primaryUrl).then(function (response) {
        if (!response.ok) throw new Error('Không đọc được bản có chữ ký.');
        return response.arrayBuffer();
      }),
      fetch(documentItem.hdsdUrl).then(function (response) {
        if (!response.ok) throw new Error('Không đọc được tờ HDSD.');
        return response.arrayBuffer();
      })
    ]).then(function (files) {
      return Promise.all([
        window.PDFLib.PDFDocument.load(files[0], { ignoreEncryption: true }),
        window.PDFLib.PDFDocument.load(files[1], { ignoreEncryption: true }),
        window.PDFLib.PDFDocument.create()
      ]);
    }).then(function (documents) {
      var signedPdf = documents[0];
      var instructionPdf = documents[1];
      var mergedPdf = documents[2];
      return mergedPdf.copyPages(signedPdf, signedPdf.getPageIndices()).then(function (signedPages) {
        signedPages.forEach(function (page) { mergedPdf.addPage(page); });
        return mergedPdf.copyPages(instructionPdf, instructionPdf.getPageIndices());
      }).then(function (instructionPages) {
        instructionPages.forEach(function (page) { mergedPdf.addPage(page); });
        return mergedPdf.save();
      });
    }).then(function (bytes) {
      var objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      combinedObjectUrls.push(objectUrl);
      return objectUrl;
    });

    return combinedPdfCache[cacheKey];
  }

  function createPdfLink(documentItem, className) {
    var link = document.createElement('a');
    var primaryUrl = documentItem.url || documentUrl(documentItem.file);
    link.href = primaryUrl;
    link.target = useSameTabPdfViewer() ? '_self' : '_blank';
    link.rel = 'noopener';
    link.textContent = documentItem.title;
    link.setAttribute('aria-label', documentItem.title + ' — mở PDF trong thẻ mới');

    if (className) {
      link.className = className;
    }

    if (documentItem.hdsdUrl && !documentItem.hdsdFile) {
      link.setAttribute('aria-label', documentItem.title + ' — mở bản có chữ ký kèm Hướng dẫn sử dụng');
      link.addEventListener('click', function (event) {
        event.preventDefault();

        if (useSameTabPdfViewer()) {
          if (link.getAttribute('aria-busy') === 'true') return;
          link.setAttribute('aria-busy', 'true');
          prepareCombinedPdf(documentItem).then(function (url) {
            window.location.assign(url);
          }).catch(function () {
            window.location.assign(primaryUrl);
          }).finally(function () {
            link.removeAttribute('aria-busy');
          });
          return;
        }

        var viewer = window.open('', '_blank');
        if (viewer) {
          viewer.opener = null;
          viewer.document.title = 'Đang ghép tài liệu...';
          viewer.document.body.textContent = 'Đang ghép bản có chữ ký và Hướng dẫn sử dụng...';
        }
        prepareCombinedPdf(documentItem).then(function (url) {
          if (viewer) viewer.location.replace(url);
          else window.open(url, '_blank');
        }).catch(function () {
          if (viewer) viewer.location.replace(link.href);
          else window.open(link.href, '_blank');
        });
      });
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
        var actions = document.createElement('div');
        var date = document.createElement('time');
        var attachmentNote = null;

        row.className = 'document-row';
        number.className = 'document-number';
        number.textContent = String(index + 1).padStart(2, '0');
        body.className = 'document-body';
        actions.className = 'document-row-actions';
        date.dateTime = documentItem.signedDate;
        date.textContent = 'Ngày ký ban hành: ' + formatDate(documentItem.signedDate);
        body.appendChild(createPdfLink(documentItem, 'document-title'));
        body.appendChild(date);

        if (documentItem.hdsdFile || documentItem.hdsdUrl) {
          attachmentNote = document.createElement('span');
          attachmentNote.className = 'document-attachment-note';
          attachmentNote.textContent = 'Bản có chữ ký + Hướng dẫn sử dụng';
          body.appendChild(attachmentNote);
        }

        if (documentItem.uploaded && staffAuthenticated) {
          var deleteButton = document.createElement('button');
          deleteButton.type = 'button';
          deleteButton.className = 'document-delete-button';
          deleteButton.textContent = 'Xóa tài liệu';
          deleteButton.addEventListener('click', function () {
            deleteButton.disabled = true;
            deleteServerDocument(documentItem).then(refreshDocuments).catch(function () {
              deleteButton.disabled = false;
              window.alert('Không thể xóa tài liệu. Vui lòng thử lại.');
            });
          });
          actions.appendChild(deleteButton);
        }

        row.appendChild(number);
        row.appendChild(body);
        row.appendChild(actions);
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

  function deleteServerDocument(documentItem) {
    return getStaffAccessToken().then(function (token) {
      return serverRequest('/rest/v1/drug_documents?id=eq.' + encodeURIComponent(documentItem.id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }, token).then(function () {
        if (!documentItem.storagePath) return;
        return removeStorageObject(documentItem.storagePath, token).catch(function () {
          // Bản ghi đã xóa; lỗi dọn file cũ không được làm thất bại thao tác của nhân viên.
          return null;
        });
      });
    });
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
      var storedSession = JSON.parse(localStorage.getItem(staffSessionKey) || sessionStorage.getItem(staffSessionKey) || 'null');
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
        localStorage.setItem(staffSessionKey, JSON.stringify(authSession));
      } else {
        sessionStorage.removeItem(staffSessionKey);
        localStorage.removeItem(staffSessionKey);
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
    }).catch(function (error) {
      if (error && (error.status === 400 || error.status === 401 || error.status === 403)) {
        clearStaffSession();
      }
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
    var migrationButton = document.getElementById('migrate-legacy-documents');

    if (loginButton) {
      loginButton.hidden = isAuthenticated;
    }

    if (controls) {
      controls.hidden = !isAuthenticated;
    }

    if (addButton) {
      addButton.hidden = !isAuthenticated;
    }

    if (migrationButton) {
      migrationButton.hidden = !isAuthenticated;
      if (isAuthenticated) refreshMigrationButton();
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

    validateStaffSession().then(function () {
      renderStaffAccess();
      return refreshDocuments();
    });

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
        refreshDocuments();
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
        refreshDocuments();

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

      return removeStorageObject(storagePath, accessToken).catch(function () {}).then(function () {
        throw error;
      });
    });
  }

  function setMigrationStatus(message, isError) {
    var status = document.getElementById('document-migration-status');
    if (!status) return;
    status.textContent = message || '';
    status.style.color = isError ? '#b42318' : '';
  }

  function refreshMigrationButton() {
    var button = document.getElementById('migrate-legacy-documents');
    if (!button || !staffAuthenticated) return;
    loadContentMigrations().then(function (keys) {
      button.hidden = keys.indexOf('drug_documents_v1') !== -1 && keys.indexOf('drug_instructions_v1') !== -1;
    }).catch(function () { button.hidden = false; });
  }

  function fetchLegacyPdf(url, fileName) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error('Không đọc được PDF cũ: ' + fileName);
      return response.blob();
    }).then(function (blob) {
      if (blob.size > maxUploadBytes) throw new Error('PDF vượt quá 25 MB: ' + fileName);
      return new File([blob], fileName, { type: 'application/pdf' });
    });
  }

  function uploadLegacyInstruction(item, signedDate) {
    var storagePath = 'hdsd/' + signedDate.slice(0, 7) + '/' + createSecureId() + '.pdf';
    var token = '';
    var uploaded = false;
    return fetchLegacyPdf(item.url, item.file).then(function (file) {
      return getStaffAccessToken().then(function (accessToken) {
        token = accessToken;
        return serverRequest('/storage/v1/object/' + encodeURIComponent(storageBucket) + '/' + encodeStoragePath(storagePath), {
          method: 'POST',
          headers: { 'Content-Type': 'application/pdf', 'Cache-Control': '3600', 'x-upsert': 'false' },
          body: file
        }, token);
      }).then(function () {
        uploaded = true;
        return serverRequest('/rest/v1/drug_instructions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({
            title: item.title,
            keywords: item.keywords || '',
            signed_date: signedDate,
            file_name: item.file.slice(0, 255),
            storage_path: storagePath
          })
        }, token);
      });
    }).catch(function (error) {
      if (!uploaded || !token) throw error;
      return removeStorageObject(storagePath, token).catch(function () {}).then(function () { throw error; });
    });
  }

  function markMigrationComplete(key) {
    return getStaffAccessToken().then(function (token) {
      return serverRequest('/rest/v1/content_migrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({ migration_key: key })
      }, token);
    });
  }

  function runSequentially(items, worker, onProgress) {
    return items.reduce(function (promise, item, index) {
      return promise.then(function () {
        onProgress(index + 1, items.length, item);
        return worker(item);
      });
    }, Promise.resolve());
  }

  function migrateLegacyContent() {
    var button = document.getElementById('migrate-legacy-documents');
    var staticDocuments = getBaseDocuments();
    var staticInstructions = getBaseInstructions();
    var today = new Date().toISOString().slice(0, 10);
    if (button) button.disabled = true;
    setMigrationStatus('Đang kiểm tra dữ liệu cũ...', false);

    return Promise.all([loadServerDocuments(), loadServerInstructions(), loadContentMigrations()]).then(function (results) {
      var serverDocuments = results[0];
      var serverInstructions = results[1];
      var completed = results[2];
      var documentKeys = {};
      var instructionKeys = {};
      serverDocuments.forEach(function (item) { documentKeys[normalizeMatchText(item.title) + '|' + item.signedDate] = true; });
      serverInstructions.forEach(function (item) { instructionKeys[normalizeMatchText(item.title)] = true; });

      var pendingDocuments = completed.indexOf('drug_documents_v1') !== -1 ? [] : staticDocuments.filter(function (item) {
        return !documentKeys[normalizeMatchText(item.title) + '|' + item.signedDate];
      });
      var pendingInstructions = completed.indexOf('drug_instructions_v1') !== -1 ? [] : staticInstructions.filter(function (item) {
        return !instructionKeys[normalizeMatchText(item.title)];
      });

      return runSequentially(pendingDocuments, function (item) {
        var sourceUrl = documentUrl(item.file);
        return fetchLegacyPdf(sourceUrl, item.file).then(function (file) {
          return uploadServerDocument(file, item.title, item.signedDate);
        });
      }, function (current, total) {
        setMigrationStatus('Đang chuyển Thông tin thuốc: ' + current + '/' + total, false);
      }).then(function () {
        return completed.indexOf('drug_documents_v1') === -1 ? markMigrationComplete('drug_documents_v1') : null;
      }).then(function () {
        return runSequentially(pendingInstructions, function (item) {
          return uploadLegacyInstruction(item, today);
        }, function (current, total) {
          setMigrationStatus('Đang chuyển HDSD: ' + current + '/' + total, false);
        });
      }).then(function () {
        return completed.indexOf('drug_instructions_v1') === -1 ? markMigrationComplete('drug_instructions_v1') : null;
      });
    }).then(function () {
      setMigrationStatus('Đã chuyển toàn bộ dữ liệu. Mọi tài liệu đều có thể xóa thật.', false);
      signalDocumentsChanged();
      return refreshDocuments();
    }).catch(function (error) {
      setMigrationStatus(error && error.message ? error.message : 'Không thể chuyển dữ liệu cũ.', true);
    }).finally(function () {
      if (button) button.disabled = false;
      refreshMigrationButton();
    });
  }

  function initLegacyMigration() {
    var button = document.getElementById('migrate-legacy-documents');
    if (!button) return;
    button.addEventListener('click', function () {
      if (!staffAuthenticated) return;
      migrateLegacyContent();
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

      var titleInput = document.getElementById('document-pdf-title');
      if (titleInput && !titleInput.value.trim()) {
        titleInput.value = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
      }
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
      combinedObjectUrls.forEach(function (url) { URL.revokeObjectURL(url); });
      combinedObjectUrls = [];
      if (updateChannel) {
        updateChannel.close();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initStaffAccess();
    initUploadDialog();
    initLegacyMigration();
    refreshDocuments();
  });

  window.KHOA_DUOC_DRUG_MATCHER = Object.freeze({
    normalizeText: normalizeMatchText,
    productTokens: getProductTokens,
    doseTokens: getDoseTokens,
    findMatchingInstruction: findMatchingInstruction
  });
}());
