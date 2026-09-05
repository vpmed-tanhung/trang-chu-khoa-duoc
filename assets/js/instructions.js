(function () {
  'use strict';

  var serverConfig = window.KHOA_DUOC_SERVER || {};
  var supabaseUrl = String(serverConfig.supabaseUrl || '').replace(/\/+$/, '');
  var publishableKey = String(serverConfig.supabasePublishableKey || '');

  function normalizeText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function hasServerConfig() {
    return /^https:\/\//i.test(supabaseUrl) && publishableKey.length >= 20;
  }

  function instructionUrl(fileName) {
    return 'assets/documents/huong-dan-su-dung/' + String(fileName || '').split('/').map(encodeURIComponent).join('/');
  }

  function useSameTabPdfViewer() {
    return typeof window.matchMedia === 'function' && (
      window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(max-width: 820px)').matches
    );
  }

  function getStaticInstructions() {
    var instructions = Array.isArray(window.DRUG_INSTRUCTIONS) ? window.DRUG_INSTRUCTIONS : [];
    return instructions.filter(function (instruction) { return Boolean(instruction && instruction.title && instruction.file); });
  }

  function loadServerInstructions() {
    if (!hasServerConfig()) return Promise.resolve([]);
    return fetch(supabaseUrl + '/rest/v1/drug_instructions?select=id,title,keywords,signed_date,file_name,storage_path&order=title.asc', {
      method: 'GET', headers: { apikey: publishableKey, Accept: 'application/json' }
    }).then(function (response) {
      if (!response.ok) throw new Error('Không thể đọc kho HDSD.');
      return response.json();
    }).then(function (rows) {
      return Array.isArray(rows) ? rows.map(function (row) {
        return {
          id: row.id,
          title: row.title,
          keywords: row.keywords || '',
          file: row.file_name,
          storagePath: row.storage_path,
          signedDate: row.signed_date,
          url: supabaseUrl + '/storage/v1/object/public/' + encodeURIComponent(String(serverConfig.storageBucket || 'drug-documents')) + '/' + String(row.storage_path || '').split('/').map(encodeURIComponent).join('/'),
          uploaded: true
        };
      }) : [];
    });
  }

  function loadContentMigrations() {
    if (!hasServerConfig()) return Promise.resolve([]);
    return fetch(supabaseUrl + '/rest/v1/content_migrations?select=migration_key', {
      method: 'GET', headers: { apikey: publishableKey, Accept: 'application/json' }
    }).then(function (response) {
      if (!response.ok) throw new Error('Không thể đọc trạng thái chuyển dữ liệu.');
      return response.json();
    }).then(function (rows) {
      return Array.isArray(rows) ? rows.map(function (row) { return row.migration_key; }) : [];
    });
  }

  function loadInstructions() {
    var staticInstructions = getStaticInstructions();
    return Promise.all([
      loadServerInstructions().catch(function () { return []; }),
      loadContentMigrations().catch(function () { return []; })
    ]).then(function (results) {
      var serverInstructions = results[0];
      var completed = results[1];
      var serverTitles = {};
      serverInstructions.forEach(function (item) { serverTitles[normalizeText(item.title)] = true; });
      if (completed.indexOf('drug_instructions_v1') !== -1) staticInstructions = [];
      staticInstructions = staticInstructions.filter(function (item) { return !serverTitles[normalizeText(item.title)]; });
      return serverInstructions.concat(staticInstructions).sort(function (first, second) { return first.title.localeCompare(second.title, 'vi'); });
    });
  }

  function renderCategoryCount(instructions) {
    var link = document.getElementById('instruction-category-link');
    if (!link) return;
    link.textContent = 'Hướng dẫn sử dụng (' + instructions.length + ')';
    link.setAttribute('aria-label', 'Mở thư mục Hướng dẫn sử dụng, có ' + instructions.length + ' tài liệu');
  }

  function renderInstructions(instructions, total, query) {
    var directory = document.getElementById('instruction-directory');
    var summary = document.getElementById('instruction-search-summary');
    if (!directory) return;
    directory.textContent = '';
    if (summary) summary.textContent = query ? 'Tìm thấy ' + instructions.length + ' trong ' + total + ' tài liệu.' : total + ' tài liệu hướng dẫn sử dụng.';
    if (instructions.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'instruction-empty';
      empty.textContent = 'Không tìm thấy tài liệu phù hợp.';
      directory.appendChild(empty);
      return;
    }
    instructions.forEach(function (instruction, index) {
      var row = document.createElement('article');
      var number = document.createElement('span');
      var body = document.createElement('div');
      var actions = document.createElement('div');
      var link = document.createElement('a');
      var note = document.createElement('small');
      row.className = 'instruction-row';
      number.className = 'instruction-number';
      number.textContent = String(index + 1).padStart(2, '0');
      body.className = 'instruction-body';
      actions.className = 'document-row-actions';
      link.className = 'instruction-title';
      link.href = instruction.url || instructionUrl(instruction.file);
      link.target = useSameTabPdfViewer() ? '_self' : '_blank';
      link.rel = 'noopener';
      link.textContent = instruction.title;
      link.setAttribute('aria-label', instruction.title + ' — mở PDF trong thẻ mới');
      note.textContent = instruction.signedDate ? 'Hướng dẫn sử dụng · ' + instruction.signedDate.split('-').reverse().join('/') : 'Hướng dẫn sử dụng';
      body.appendChild(link);
      body.appendChild(note);
      if (instruction.uploaded && window.KHOA_DUOC_STAFF_AUTHENTICATED === true) {
        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'document-delete-button';
        remove.textContent = 'Xóa tài liệu';
        remove.dataset.instructionId = instruction.id || '';
        remove.addEventListener('click', function () {
          if (typeof window.KHOA_DUOC_DELETE_INSTRUCTION === 'function') window.KHOA_DUOC_DELETE_INSTRUCTION(instruction);
        });
        actions.appendChild(remove);
      }
      row.appendChild(number);
      row.appendChild(body);
      row.appendChild(actions);
      directory.appendChild(row);
    });
  }

  function initInstructionDirectory() {
    var searchInput = document.getElementById('instruction-search-input');
    loadInstructions().then(function (instructions) {
      renderCategoryCount(instructions);
      if (!searchInput) return;
      function applySearch() {
        var rawQuery = searchInput.value.trim();
        var query = normalizeText(rawQuery);
        var filtered = instructions.filter(function (instruction) {
          return !query || normalizeText(instruction.title + ' ' + (instruction.keywords || '')).indexOf(query) !== -1;
        });
        renderInstructions(filtered, instructions.length, rawQuery);
      }
      searchInput.addEventListener('input', applySearch);
      applySearch();
    });
  }

  document.addEventListener('DOMContentLoaded', initInstructionDirectory);
  window.addEventListener('khoa-duoc-auth-changed', initInstructionDirectory);
}());
