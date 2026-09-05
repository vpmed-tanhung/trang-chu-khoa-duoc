(function () {
  'use strict';

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLocaleLowerCase('vi')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function getInstructions() {
    var instructions = Array.isArray(window.DRUG_INSTRUCTIONS) ? window.DRUG_INSTRUCTIONS : [];

    return instructions.filter(function (instruction) {
      return Boolean(instruction && instruction.title && instruction.file);
    }).slice().sort(function (first, second) {
      return first.title.localeCompare(second.title, 'vi');
    });
  }

  function instructionUrl(fileName) {
    return 'assets/documents/huong-dan-su-dung/' + fileName.split('/').map(encodeURIComponent).join('/');
  }

  function renderCategoryCount(instructions) {
    var link = document.getElementById('instruction-category-link');
    if (!link) {
      return;
    }

    link.textContent = 'Hướng dẫn sử dụng (' + instructions.length + ')';
    link.setAttribute('aria-label', 'Mở thư mục Hướng dẫn sử dụng, có ' + instructions.length + ' tài liệu');
  }

  function renderInstructions(instructions, total, query) {
    var directory = document.getElementById('instruction-directory');
    var summary = document.getElementById('instruction-search-summary');

    if (!directory) {
      return;
    }

    directory.textContent = '';

    if (summary) {
      summary.textContent = query
        ? 'Tìm thấy ' + instructions.length + ' trong ' + total + ' tài liệu.'
        : total + ' tài liệu hướng dẫn sử dụng.';
    }

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
      var link = document.createElement('a');
      var note = document.createElement('small');

      row.className = 'instruction-row';
      number.className = 'instruction-number';
      number.textContent = String(index + 1).padStart(2, '0');
      body.className = 'instruction-body';
      link.className = 'instruction-title';
      link.href = instructionUrl(instruction.file);
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = instruction.title;
      link.setAttribute('aria-label', instruction.title + ' — mở PDF trong thẻ mới');
      note.textContent = 'Hướng dẫn sử dụng';

      body.appendChild(link);
      body.appendChild(note);
      row.appendChild(number);
      row.appendChild(body);
      directory.appendChild(row);
    });
  }

  function initInstructionDirectory() {
    var instructions = getInstructions();
    var searchInput = document.getElementById('instruction-search-input');

    renderCategoryCount(instructions);

    if (!searchInput) {
      return;
    }

    function applySearch() {
      var rawQuery = searchInput.value.trim();
      var query = normalizeText(rawQuery);
      var filtered = instructions.filter(function (instruction) {
        var searchable = normalizeText(instruction.title + ' ' + (instruction.keywords || ''));
        return !query || searchable.indexOf(query) !== -1;
      });

      renderInstructions(filtered, instructions.length, rawQuery);
    }

    searchInput.addEventListener('input', applySearch);
    applySearch();
  }

  document.addEventListener('DOMContentLoaded', initInstructionDirectory);
}());
