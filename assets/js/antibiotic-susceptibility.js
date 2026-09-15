(function (window, document) {
  'use strict';

  var data = window.KHOA_DUOC_AMR_DATA;
  if (!data || !Array.isArray(data.antibiotics)) return;

  var selectedAntibioticId = '';
  var selectedSpecimenId = 0;
  var lastFocusedElement = null;
  var lookupCatalog = [];

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatPercent(value) {
    return String(value).replace('.', ',') + '%';
  }

  function formatNumber(value) {
    if (value == null) return '';
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function toneFor(value) {
    if (value >= 80) return 'high';
    if (value >= 50) return 'moderate';
    return 'low';
  }

  function antibioticById(id) {
    return data.antibiotics.find(function (item) { return item.id === id; }) || null;
  }

  function findAntibiotic(query) {
    var normalized = normalize(query);
    if (!normalized) return null;
    var exact = data.antibiotics.find(function (item) {
      var names = [item.id, item.name].concat(item.aliases || []);
      return names.some(function (name) { return normalize(name) === normalized; });
    });
    if (exact) return exact;
    return data.antibiotics.find(function (item) {
      var names = [item.name].concat(item.aliases || []);
      return names.some(function (name) {
        var alias = normalize(name);
        return alias.length >= 4 && normalized.indexOf(alias) !== -1;
      });
    }) || null;
  }

  function rowsFor(antibiotic, specimenId) {
    return (antibiotic && antibiotic.rows ? antibiotic.rows : []).filter(function (row) {
      return row[1] === specimenId;
    });
  }

  function specimenIdsFor(antibiotic) {
    var seen = {};
    (antibiotic.rows || []).forEach(function (row) { seen[row[1]] = true; });
    return data.specimens.map(function (item) { return item.id; }).filter(function (id) { return seen[id]; });
  }

  function organismName(row) {
    var organism = data.organisms[row[0]];
    return organism ? organism.name : 'Không xác định';
  }

  function variantName(row) {
    var variant = row[4] ? data.variants[row[4]] : null;
    return variant && variant.name ? variant.name : '';
  }

  function progressHtml(row, compact) {
    var value = row[2];
    var organism = organismName(row);
    var tone = toneFor(value);
    var variant = variantName(row);
    return '<div class="amr-data-row' + (compact ? ' is-compact' : '') + '">'
      + '<div class="amr-organism"><em>' + escapeHtml(organism) + '</em>' + (variant ? '<small>' + escapeHtml(variant) + '</small>' : '') + '</div>'
      + '<progress class="amr-progress amr-tone-' + tone + '" max="100" value="' + value + '" aria-label="' + escapeHtml(organism) + ': ' + escapeHtml(formatPercent(value)) + ' nhạy cảm"></progress>'
      + '<strong class="amr-percent amr-tone-' + tone + '">' + escapeHtml(formatPercent(value)) + '</strong>'
      + (compact ? '' : '<span class="amr-sample">' + (row[3] == null ? '—' : 'n=' + formatNumber(row[3])) + '</span>')
      + '</div>';
  }

  function sourceFootnote() {
    return '<p class="amr-source-note">' + escapeHtml(data.footnote) + '</p>';
  }

  function summaryHtml(query) {
    var requested = String(query || '').trim();
    if (!requested) return '';
    var antibiotic = findAntibiotic(requested);
    if (!antibiotic) {
      return '<section class="amr-summary-card is-empty" aria-label="Mức nhạy cảm kháng sinh">'
        + '<div class="amr-summary-header"><h4>Mức nhạy cảm kháng sinh</h4><button class="amr-summary-button" type="button" data-amr-open data-amr-query="' + escapeHtml(requested) + '">Tra cứu danh mục</button></div>'
        + '<p class="amr-empty-message">Báo cáo giám sát quốc gia năm 2020 không có số liệu cho ' + escapeHtml(requested) + '.</p>'
        + sourceFootnote() + '</section>';
    }
    var specimenIds = specimenIdsFor(antibiotic);
    var summarySpecimenId = specimenIds.indexOf(0) !== -1 ? 0 : specimenIds[0];
    var rows = rowsFor(antibiotic, summarySpecimenId);
    var specimen = data.specimens[summarySpecimenId];
    return '<section class="amr-summary-card" aria-labelledby="amr-summary-title-' + escapeHtml(antibiotic.id) + '">'
      + '<div class="amr-summary-header"><div><h4 id="amr-summary-title-' + escapeHtml(antibiotic.id) + '">Mức nhạy cảm kháng sinh</h4>'
      + (summarySpecimenId === 0 ? '' : '<span class="amr-summary-scope">' + escapeHtml(specimen.name) + '</span>') + '</div>'
      + '<button class="amr-summary-button" type="button" data-amr-open="' + escapeHtml(antibiotic.id) + '">Xem chi tiết</button></div>'
      + '<div class="amr-summary-list">' + rows.map(function (row) { return progressHtml(row, true); }).join('') + '</div>'
      + sourceFootnote() + '</section>';
  }

  function collectCurrentCatalog() {
    var clinicalData = window.KHOA_DUOC_CLINICAL_DATA || {};
    var names = [];
    (clinicalData.renalAdjustment || []).forEach(function (item) { if (item.name) names.push(item.name); });
    (clinicalData.formulary || []).forEach(function (item) { if (item.active) names.push(item.active); });
    (window.VPMED_DRUGS || []).forEach(function (item) { if (item.active) names.push(item.active); });
    var seen = {};
    return names.filter(function (name) {
      var key = normalize(name);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return !findAntibiotic(name);
    }).sort(function (a, b) { return a.localeCompare(b, 'vi'); });
  }

  function buildLookupCatalog() {
    var supported = data.antibiotics.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'vi'); }).map(function (item) {
      return { value: 'amr:' + item.id, label: item.name, amrId: item.id, query: item.name, supported: true };
    });
    var unsupported = collectCurrentCatalog().map(function (name, index) {
      return { value: 'local:' + index, label: name, amrId: '', query: name, supported: false };
    });
    lookupCatalog = supported.concat(unsupported);
    return { supported: supported, unsupported: unsupported };
  }

  function optionHtml(item) {
    return '<option value="' + escapeHtml(item.value) + '">' + escapeHtml(item.label) + '</option>';
  }

  function catalogOptionsHtml(catalog) {
    var supportedOptions = catalog.supported.map(optionHtml).join('');
    var unsupportedOptions = catalog.unsupported.map(optionHtml).join('');
    return '<optgroup label="Có số liệu trong báo cáo">' + supportedOptions + '</optgroup>'
      + (unsupportedOptions ? '<optgroup label="Danh mục hiện có – báo cáo không có số liệu">' + unsupportedOptions + '</optgroup>' : '');
  }

  function modalHtml() {
    var catalog = buildLookupCatalog();
    var totalRows = data.antibiotics.reduce(function (sum, item) { return sum + item.rows.length; }, 0);
    return '<div class="amr-modal" id="amr-modal" role="dialog" aria-modal="true" aria-labelledby="amr-modal-title" hidden>'
      + '<div class="amr-modal-backdrop" data-amr-close></div><section class="amr-modal-dialog">'
      + '<header class="amr-modal-header"><div><h2 id="amr-modal-title">Mức nhạy cảm kháng sinh</h2><p>' + data.antibiotics.length + ' kháng sinh · ' + totalRows + ' dòng số liệu · ' + data.source.hospitals + ' bệnh viện</p></div>'
      + '<button class="amr-modal-close" type="button" data-amr-close aria-label="Đóng cửa sổ">×</button></header>'
      + '<div class="amr-modal-body"><div class="amr-lookup-field"><label for="amr-antibiotic-select">Kháng sinh cần tra cứu</label><select id="amr-antibiotic-select">'
      + catalogOptionsHtml(catalog)
      + '</select></div><div class="amr-modal-drug" id="amr-modal-drug"></div><div class="amr-specimen-tabs" id="amr-specimen-tabs" role="group" aria-label="Chọn loại bệnh phẩm"></div>'
      + '<div class="amr-detail-content" id="amr-detail-content" aria-live="polite"></div><div class="amr-notes" id="amr-notes"></div></div>'
      + '</section></div>';
  }

  function selectedCatalogItem() {
    var select = document.getElementById('amr-antibiotic-select');
    if (!select) return null;
    return lookupCatalog.find(function (item) { return item.value === select.value; }) || null;
  }

  function notesHtml(antibiotic) {
    var specific = (antibiotic && antibiotic.notes) || [];
    var blocks = [];
    if (specific.length) {
      blocks.push('<section class="amr-note-block"><h3>Lưu ý theo kháng sinh</h3><ul>' + specific.map(function (note) { return '<li>' + escapeHtml(note) + '</li>'; }).join('') + '</ul></section>');
    }
    blocks.push('<section class="amr-note-block"><h3>Lưu ý chung khi đọc số liệu</h3><ul>' + data.commonNotes.map(function (note) { return '<li>' + escapeHtml(note) + '</li>'; }).join('') + '</ul></section>');
    blocks.push('<p class="amr-warning">' + escapeHtml(data.warning) + '</p>');
    blocks.push('<p class="amr-source-link"><a href="' + escapeHtml(data.source.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(data.source.title) + '</a> · ' + escapeHtml(data.source.publisher + ', ' + data.source.publicationPlaceAndYear) + ' · ' + escapeHtml(data.source.interpretiveStandard) + '.</p>');
    return blocks.join('');
  }

  function renderModalSelection(item) {
    var title = document.getElementById('amr-modal-drug');
    var tabs = document.getElementById('amr-specimen-tabs');
    var content = document.getElementById('amr-detail-content');
    var notes = document.getElementById('amr-notes');
    if (!title || !tabs || !content || !notes || !item) return;
    if (!item.supported) {
      selectedAntibioticId = '';
      title.innerHTML = '<h3>' + escapeHtml(item.label) + '</h3><span class="amr-data-status is-unavailable">Chưa có số liệu trong nguồn</span>';
      tabs.innerHTML = '';
      content.innerHTML = '<p class="amr-empty-message">Báo cáo giám sát kháng kháng sinh tại Việt Nam 2020 không công bố bảng tỷ lệ nhạy cảm cho kháng sinh này. Hệ thống không tự suy diễn hoặc tạo số liệu thay thế.</p>';
      notes.innerHTML = notesHtml(null);
      return;
    }
    var antibiotic = antibioticById(item.amrId);
    var specimenIds = specimenIdsFor(antibiotic);
    if (selectedAntibioticId !== antibiotic.id || specimenIds.indexOf(selectedSpecimenId) === -1) {
      selectedSpecimenId = specimenIds.indexOf(0) !== -1 ? 0 : specimenIds[0];
    }
    selectedAntibioticId = antibiotic.id;
    title.innerHTML = '<h3>' + escapeHtml(antibiotic.name) + '</h3><span class="amr-data-status">Có ' + antibiotic.rows.length + ' dòng số liệu</span>';
    tabs.innerHTML = specimenIds.map(function (id) {
      var specimen = data.specimens[id];
      return '<button type="button" class="amr-specimen-button' + (id === selectedSpecimenId ? ' is-active' : '') + '" data-amr-specimen="' + id + '" aria-pressed="' + (id === selectedSpecimenId ? 'true' : 'false') + '">' + escapeHtml(id === 0 ? 'Chung' : specimen.name) + '</button>';
    }).join('');
    var rows = rowsFor(antibiotic, selectedSpecimenId);
    content.innerHTML = '<div class="amr-detail-head" aria-hidden="true"><span>Vi khuẩn</span><span>Mức %S</span><span>%S</span><span>Cỡ mẫu</span></div>'
      + '<div class="amr-detail-list">' + rows.map(function (row) { return progressHtml(row, false); }).join('') + '</div>';
    notes.innerHTML = notesHtml(antibiotic);
  }

  function setSelectForQuery(query) {
    var select = document.getElementById('amr-antibiotic-select');
    if (!select) return null;
    var antibiotic = findAntibiotic(query);
    var item = antibiotic
      ? lookupCatalog.find(function (candidate) { return candidate.amrId === antibiotic.id; })
      : lookupCatalog.find(function (candidate) { return normalize(candidate.query) === normalize(query); });
    if (!item) item = lookupCatalog[0];
    select.value = item.value;
    return item;
  }

  function openLookup(query) {
    var modal = document.getElementById('amr-modal');
    if (!modal) return;
    var requested = query || (document.getElementById('renal-drug') ? document.getElementById('renal-drug').value : '');
    var item = setSelectForQuery(requested);
    renderModalSelection(item);
    lastFocusedElement = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('amr-modal-open');
    document.getElementById('amr-antibiotic-select').focus();
  }

  function closeLookup() {
    var modal = document.getElementById('amr-modal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('amr-modal-open');
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') lastFocusedElement.focus();
  }

  function init() {
    buildLookupCatalog();
    if (!document.getElementById('amr-modal')) (document.getElementById('clinical-workspace') || document.body).insertAdjacentHTML('beforeend', modalHtml());
    var actions = document.querySelector('#renal-form .clinical-actions');
    if (actions && !document.getElementById('amr-open-catalog')) {
      actions.insertAdjacentHTML('beforeend', '<button class="clinical-button" id="amr-open-catalog" type="button" data-amr-open>Tra cứu mức nhạy cảm</button>');
    }
    var select = document.getElementById('amr-antibiotic-select');
    if (select) select.addEventListener('change', function () { renderModalSelection(selectedCatalogItem()); });
    document.addEventListener('click', function (event) {
      var openButton = event.target.closest ? event.target.closest('[data-amr-open]') : null;
      if (openButton) {
        openLookup(openButton.getAttribute('data-amr-open') || openButton.getAttribute('data-amr-query') || '');
        return;
      }
      var closeButton = event.target.closest ? event.target.closest('[data-amr-close]') : null;
      if (closeButton) {
        closeLookup();
        return;
      }
      var specimenButton = event.target.closest ? event.target.closest('[data-amr-specimen]') : null;
      if (specimenButton) {
        selectedSpecimenId = Number(specimenButton.getAttribute('data-amr-specimen'));
        renderModalSelection(selectedCatalogItem());
      }
    });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeLookup(); });
  }

  window.KHOA_DUOC_AMR = {
    findAntibiotic: findAntibiotic,
    renderSummary: summaryHtml,
    open: openLookup,
    getCoverage: function () {
      return {
        antibiotics: data.antibiotics.length,
        rows: data.antibiotics.reduce(function (sum, item) { return sum + item.rows.length; }, 0),
        organisms: data.organisms.length,
        specimens: data.specimens.length
      };
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window, document);
