(function (window, document) {
  'use strict';

  var data = window.KHOA_DUOC_CLINICAL_DATA || {};
  var historyPrefix = 'khoa-duoc-clinical-history:';
  var petStateKey = 'khoa-duoc-clinical-state:pet-plan';

  var toolLabels = {
    interaction: 'Tương tác thuốc',
    renal: 'Liều kháng sinh & CrCl/eGFR',
    pediatric: 'Liều kháng sinh Nhi',
    pet: 'PET/CT'
  };

  /* =========================================================
   * HÀM DÙNG CHUNG
   * ========================================================= */

  function normalize(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function number(value) {
    var parsed = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function format(value, digits) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return '—';
    return numeric.toLocaleString('vi-VN', {
      maximumFractionDigits: digits == null ? 1 : digits
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function nowText() {
    return new Date().toLocaleString('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }

  function dateStamp() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  function containsAlias(value, aliases) {
    if (!Array.isArray(aliases)) return false;
    var haystack = ' ' + normalize(value) + ' ';
    return aliases.some(function (alias) {
      var needle = normalize(alias);
      return needle && haystack.indexOf(' ' + needle + ' ') !== -1;
    });
  }

  function fieldValue(id) {
    var element = document.getElementById(id);
    return element ? element.value : '';
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function timeToDate(hhmm, base) {
    var parts = String(hhmm || '').trim().split(':');
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    var d = base ? new Date(base.getTime()) : new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  function formatTime(date) {
    if (!date || Number.isNaN(date.getTime())) return '—';
    return pad2(date.getHours()) + ':' + pad2(date.getMinutes());
  }

  /* =========================================================
   * KHUNG KẾT QUẢ
   * ========================================================= */

  function setResultBox(box, html) {
    if (!box) return;
    box.innerHTML = '<div class="ct-result-body">' + html + '</div>';
  }

  function resetResultBox(box, originalHtml) {
    if (!box) return;
    box.innerHTML = originalHtml || '<div class="ct-result-empty"><div class="ct-result-icon" aria-hidden="true">🧪</div><h3>Chưa có kết quả</h3><p>Nhập thông tin rồi bấm nút tính để hiển thị kết quả.</p></div>';
  }

  /* =========================================================
   * LỊCH SỬ TRA CỨU (localStorage, bảng + CSV)
   * ========================================================= */

  function historyKey(tool) {
    return historyPrefix + tool;
  }

  function readHistory(tool) {
    try {
      var raw = window.localStorage.getItem(historyKey(tool));
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function normalizeRecord(item) {
    if (!item) {
      return { time: '', his: '', unit: '', metric: '', drug: '', suggestion: '' };
    }
    if (item.time && !item.drug && !item.metric && (item.title || item.summary)) {
      return {
        time: item.time || '',
        his: item.his || item.title || '',
        unit: item.unit || '',
        metric: item.metric || item.summary || '',
        drug: item.drug || item.title || '',
        suggestion: item.suggestion || ''
      };
    }
    return {
      time: item.time || '',
      his: item.his || '',
      unit: item.unit || '',
      metric: item.metric || '',
      drug: item.drug || '',
      suggestion: item.suggestion || ''
    };
  }

  function saveRecords(tool, records) {
    try {
      window.localStorage.setItem(historyKey(tool), JSON.stringify(records.slice(0, 50)));
    } catch (error) {
      /* localStorage có thể bị chặn */
    }
  }

  function writeHistoryItem(tool, record) {
    var records = readHistory(tool);
    records.unshift(normalizeRecord(record));
    saveRecords(tool, records);
  }

  function clearHistory(tool) {
    try {
      window.localStorage.removeItem(historyKey(tool));
    } catch (error) {
      /* bỏ qua */
    }
  }

  function renderHistoryTable(tool, tbody, empty) {
    if (!tbody) return;
    var records = readHistory(tool).map(normalizeRecord);

    tbody.innerHTML = records.length
      ? records.map(function (record, index) {
          return (
            '<tr>' +
              '<td>' + escapeHtml(record.time) + '</td>' +
              '<td>' + escapeHtml(record.his) + '</td>' +
              '<td>' + escapeHtml(record.unit) + '</td>' +
              '<td>' + escapeHtml(record.metric) + '</td>' +
              '<td>' + escapeHtml(record.drug) + '</td>' +
              '<td>' + escapeHtml(record.suggestion) + '</td>' +
              '<td class="ct-ta-right">' +
                '<button type="button" class="btn btn-danger-outline btn-xs" data-history-index="' + index + '">Xóa</button>' +
              '</td>' +
            '</tr>'
          );
        }).join('')
      : '';

    if (empty) empty.hidden = records.length > 0;
  }

  function csvCell(value) {
    var text = String(value == null ? '' : value).replace(/"/g, '""');
    return /[",\n]/.test(text) ? '"' + text + '"' : text;
  }

  function exportCsv(tool, filename) {
    var records = readHistory(tool).map(normalizeRecord);
    var header = ['Thời gian', 'Mã bệnh nhân', 'Khoa/phòng', 'Chỉ số', 'Thuốc', 'Gợi ý'];
    var lines = [header.map(csvCell).join(',')].concat(records.map(function (record) {
      return [record.time, record.his, record.unit, record.metric, record.drug, record.suggestion]
        .map(csvCell).join(',');
    }));

    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 200);
  }

  function initHistoryCard(tool, ids) {
    var tbody = document.getElementById(ids.tbody);
    var empty = document.getElementById(ids.empty);
    if (!tbody) return;

    function refresh() {
      renderHistoryTable(tool, tbody, empty);
    }

    refresh();

    var refreshButton = document.getElementById(ids.refresh);
    if (refreshButton) refreshButton.addEventListener('click', refresh);

    var exportButton = document.getElementById(ids.export);
    if (exportButton) {
      exportButton.addEventListener('click', function () {
        exportCsv(tool, 'lich-su-' + tool + '-' + dateStamp() + '.csv');
      });
    }

    var clearButton = document.getElementById(ids.clear);
    if (clearButton) {
      clearButton.addEventListener('click', function () {
        var records = readHistory(tool);
        if (!records.length) {
          refresh();
          return;
        }
        if (window.confirm('Xóa toàn bộ lịch sử "' + (toolLabels[tool] || tool) + '" trên thiết bị này?')) {
          clearHistory(tool);
          refresh();
        }
      });
    }

    tbody.addEventListener('click', function (event) {
      var button = event.target.closest('[data-history-index]');
      if (!button) return;
      var index = Number(button.getAttribute('data-history-index'));
      var records = readHistory(tool);
      if (!Number.isFinite(index) || index < 0 || index >= records.length) return;
      records.splice(index, 1);
      saveRecords(tool, records);
      refresh();
    });
  }

  /* =========================================================
   * MODULE 1 — TƯƠNG TÁC THUỐC
   * ========================================================= */

  function findInteractions(first, second, list) {
    var firstText = String(first || '').trim();
    var secondText = String(second || '').trim();
    if (!firstText || !secondText) return [];

    if (typeof window.checkContraindicatedInteraction === 'function') {
      try {
        var ciResult = window.checkContraindicatedInteraction(firstText, secondText);
        if (ciResult) {
          var ciItems = Array.isArray(ciResult) ? ciResult : [ciResult];
          var contraindications = ciItems
            .filter(Boolean)
            .map(function (item) {
              var details = [
                item.mechanism ? 'Cơ chế: ' + item.mechanism : '',
                item.consequence ? 'Hậu quả: ' + item.consequence : '',
                item.management ? 'Xử trí: ' + item.management : 'Không phối hợp. Cần kiểm tra lại tài liệu chuyên môn.'
              ].filter(Boolean).join(' ');

              return {
                a: [item.d1 || firstText],
                b: [item.d2 || secondText],
                severity: 'cao',
                title: 'Chống chỉ định',
                advice: details,
                sourceModule: 1
              };
            });

          if (contraindications.length) {
            return contraindications;
          }
        }
      } catch (error) {
        console.error('Lỗi Module 1:', error);
      }
    }

    var normalizedFirst = normalize(firstText);
    var normalizedSecond = normalize(secondText);

    return (Array.isArray(list) ? list : []).filter(function (rule) {
      var direct =
        containsAlias(normalizedFirst, rule.a) &&
        containsAlias(normalizedSecond, rule.b);
      var reverse =
        containsAlias(normalizedFirst, rule.b) &&
        containsAlias(normalizedSecond, rule.a);
      return direct || reverse;
    });
  }

  function findAllInteractions(items, list) {
    var values = Array.isArray(items) ? items : [];
    var results = [];

    for (var i = 0; i < values.length; i += 1) {
      for (var j = i + 1; j < values.length; j += 1) {
        findInteractions(values[i], values[j], list).forEach(function (rule) {
          results.push({
            first: values[i],
            second: values[j],
            rule: rule
          });
        });
      }
    }

    return results;
  }

  function severityClass(severity) {
    var text = normalize(severity);
    if (
      text === 'cao' ||
      text === 'chongchidinh' ||
      text === 'contraindicated' ||
      text === 'nghiemtrong'
    ) {
      return 'is-error';
    }
    if (
      text === 'trung binh' ||
      text === 'vua' ||
      text === 'moderate' ||
      text === 'trungbinh'
    ) {
      return 'is-warning';
    }
    if (
      text === 'thap' ||
      text === 'low' ||
      text === 'nhe'
    ) {
      return 'is-info';
    }
    return 'is-warning';
  }

  function setupInteractionTool() {
    var form = document.getElementById('interaction-form');
    var box = document.getElementById('interaction-result');
    var items = document.getElementById('interaction-list');
    var resetButton = document.getElementById('interaction-reset');
    if (!form) return;

    var emptyHtml = box ? box.innerHTML : '';
    var interactionCatalog = Array.isArray(data.interactions) ? data.interactions : [];

    initHistoryCard('interaction', {
      tbody: 'interaction-history',
      empty: 'interaction-history-empty',
      refresh: 'interaction-refresh',
      export: 'interaction-export',
      clear: 'interaction-clear'
    });

    function renderMatches(matches) {
      if (!matches.length) {
        setResultBox(
          box,
          '<h3>Chưa phát hiện tương tác trong bộ quy tắc</h3>' +
          '<p>Điều này không đồng nghĩa với việc không có tương tác. Cần đối chiếu nguồn tương tác chuyên dụng và quy trình bệnh viện trước khi quyết định điều trị.</p>'
        );
        writeHistoryItem('interaction', {
          his: '',
          unit: '',
          metric: 'Chưa phát hiện',
          drug: matches.length ? '' : '',
          suggestion: 'Không có cảnh báo trong bộ quy tắc'
        });
        renderHistoryTable('interaction', document.getElementById('interaction-history'), document.getElementById('interaction-history-empty'));
        return;
      }

      setResultBox(
        box,
        matches.map(function (match) {
          var severity = String(match.rule.severity || 'cảnh báo');
          return (
            '<div class="ct-alert ' + severityClass(severity) + '">' +
              '<strong>' + escapeHtml(severity.toUpperCase()) + ' — ' + escapeHtml(match.rule.title || 'Tương tác thuốc') + '</strong>' +
              '<p><strong>' + escapeHtml(match.first) + '</strong> + <strong>' + escapeHtml(match.second) + '</strong></p>' +
              '<p>' + escapeHtml(match.rule.advice || '') + '</p>' +
            '</div>'
          );
        }).join('')
      );

      var topSeverity = String(matches[0].rule.severity || 'cảnh báo');
      writeHistoryItem('interaction', {
        his: matches[0].first + ' + ' + matches[0].second,
        unit: '',
        metric: matches.length + ' cảnh báo',
        drug: matches[0].first + ' + ' + matches[0].second,
        suggestion: 'Có cảnh báo — ' + topSeverity
      });
      renderHistoryTable('interaction', document.getElementById('interaction-history'), document.getElementById('interaction-history-empty'));
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var first = fieldValue('interaction-first').trim();
      var second = fieldValue('interaction-second').trim();

      if (!first || !second) {
        setResultBox(box, '<h3>Chưa đủ dữ liệu</h3><p>Nhập tên hai thuốc để kiểm tra.</p>');
        return;
      }

      renderMatches(
        findInteractions(first, second, interactionCatalog)
          .map(function (rule) { return { first: first, second: second, rule: rule }; })
      );
    });

    if (items) {
      items.addEventListener('input', function () {
        var values = items.value
          .split(/\n|,|;/)
          .map(function (value) { return value.trim(); })
          .filter(Boolean);

        if (values.length < 2) {
          resetResultBox(box, emptyHtml);
          return;
        }

        renderMatches(findAllInteractions(values, interactionCatalog));
      });
    }

    if (resetButton) {
      resetButton.addEventListener('click', function () {
        form.reset();
        if (items) items.value = '';
        resetResultBox(box, emptyHtml);
      });
    }
  }

  /* =========================================================
   * MODULE 2 — CHỨC NĂNG THẬN / LIỀU KHÁNG SINH
   * ========================================================= */

  function calculateCrCl(age, weight, serumCreatinine, sex) {
    var result = ((140 - age) * weight) / (72 * serumCreatinine);
    return sex === 'female' ? result * 0.85 : result;
  }

  function calculateEgfr(scr, age, sex) {
    var kappa = sex === 'female' ? 0.7 : 0.9;
    var alpha = sex === 'female' ? -0.241 : -0.302;
    var ratio = scr / kappa;
    var egfr =
      142 *
      Math.pow(Math.min(ratio, 1), alpha) *
      Math.pow(Math.max(ratio, 1), -1.2) *
      Math.pow(0.9938, age);
    return sex === 'female' ? egfr * 1.012 : egfr;
  }

  function convertCreatinine(value, unit) {
    var parsed = number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return NaN;
    return unit === 'umol-l' ? parsed / 88.4 : parsed;
  }

  function calculateEgfrAbsolute(egfrIndexed, height, weight) {
    var heightCm = number(height);
    var weightKg = number(weight);
    if (
      !Number.isFinite(egfrIndexed) ||
      !Number.isFinite(heightCm) ||
      !Number.isFinite(weightKg) ||
      heightCm <= 0 ||
      weightKg <= 0
    ) {
      return NaN;
    }
    var bodySurfaceArea = Math.sqrt((heightCm * weightKg) / 3600);
    return egfrIndexed * bodySurfaceArea / 1.73;
  }

  function renalBand(crcl) {
    if (crcl > 60) return 'normal';
    if (crcl >= 30) return 'mild';
    if (crcl >= 15) return 'moderate';
    return 'severe';
  }

  var bandLabels = {
    normal: 'Chức năng thận bình thường',
    mild: 'Suy thận nhẹ',
    moderate: 'Suy thận trung bình',
    severe: 'Suy thận nặng / mất bù'
  };

  function findRenalDrug(name, list) {
    var normalized = normalize(name);
    return (Array.isArray(list) ? list : []).find(function (drug) {
      return (
        normalize(drug.name) === normalized ||
        containsAlias(normalized, drug.aliases)
      );
    }) || null;
  }

  function renderVancomycinModule2(weight, crcl, dialysisChecked) {
    var module2Available =
      typeof window.getVancomycinLoadingDose === 'function' &&
      typeof window.getVancomycinMaintenanceRegimen === 'function';

    if (!module2Available) return '';

    try {
      if (
        dialysisChecked &&
        typeof window.getVancomycinHemodialysisRegimen === 'function'
      ) {
        var hd = window.getVancomycinHemodialysisRegimen(weight);
        if (hd && !hd.error) {
          return (
            '<div class="ct-note">' +
              '<strong>Vancomycin / lọc máu:</strong><br>' +
              'Liều nạp: <strong>' + format(hd.loadingDoseMg, 0) + ' mg</strong> · ' +
              'Liều duy trì: <strong>' + format(hd.maintenanceDoseMg, 0) + ' mg</strong><br>' +
              escapeHtml(hd.note || '') +
            '</div>'
          );
        }
      }

      var loadingDose = window.getVancomycinLoadingDose(weight);
      var maintenance = window.getVancomycinMaintenanceRegimen(crcl, weight);

      if (maintenance && !maintenance.error) {
        var intervalText = Number.isFinite(Number(maintenance.intervalH))
          ? ' mỗi ' + format(Number(maintenance.intervalH), 0) + ' giờ'
          : '';
        return (
          '<div class="ct-note">' +
            '<strong>Nomogram Vancomycin:</strong><br>' +
            'Liều nạp: <strong>' + format(loadingDose, 0) + ' mg</strong> · ' +
            'Liều duy trì tham khảo: <strong>' + format(maintenance.doseMg, 0) + ' mg' + intervalText + '</strong><br>' +
            escapeHtml(maintenance.note || '') +
            '<br><small>Không thay thế TDM/AUC và phác đồ bệnh viện.</small>' +
          '</div>'
        );
      }
    } catch (error) {
      console.error('Lỗi Module 2 Vancomycin:', error);
    }

    return '';
  }

  function setupRenalTool() {
    var form = document.getElementById('renal-form');
    var box = document.getElementById('renal-result');
    var resetButton = document.getElementById('renal-reset');
    if (!form) return;

    var emptyHtml = box ? box.innerHTML : '';
    var renalCatalog = Array.isArray(data.renalAdjustment) ? data.renalAdjustment : [];

    var drugSelect = document.getElementById('renal-drug');
    if (drugSelect) {
      drugSelect.innerHTML = '<option value="">— Chọn thuốc —</option>';
      renalCatalog.forEach(function (drug) {
        var option = document.createElement('option');
        option.value = drug.name;
        option.textContent = drug.name;
        drugSelect.appendChild(option);
      });
    }

    initHistoryCard('renal', {
      tbody: 'renal-history',
      empty: 'renal-history-empty',
      refresh: 'renal-refresh',
      export: 'renal-export',
      clear: 'renal-clear'
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var age = number(fieldValue('renal-age'));
      var weight = number(fieldValue('renal-weight'));
      var height = number(fieldValue('renal-height'));
      var scrUnit = fieldValue('renal-scr-unit') || 'umol-l';
      var scr = convertCreatinine(fieldValue('renal-scr'), scrUnit);
      var sex = fieldValue('renal-sex');

      if (
        !Number.isFinite(age) ||
        age < 18 ||
        !Number.isFinite(weight) ||
        weight <= 0 ||
        !Number.isFinite(scr) ||
        scr <= 0
      ) {
        setResultBox(box, '<h3>Dữ liệu chưa hợp lệ</h3><p>Nhập tuổi từ 18 trở lên, cân nặng dương và creatinine huyết thanh &gt; 0.</p>');
        return;
      }

      var renalCore = null;
      var crcl = NaN;

      if (
        Number.isFinite(height) &&
        height > 0 &&
        typeof window.computeRenalCore === 'function'
      ) {
        try {
          renalCore = window.computeRenalCore(age, sex, height, weight, scr);
          if (renalCore && Number.isFinite(Number(renalCore.crcl))) {
            crcl = Number(renalCore.crcl);
          }
        } catch (error) {
          console.error('Lỗi Module 2 computeRenalCore:', error);
        }
      }

      if (!Number.isFinite(crcl)) {
        crcl = calculateCrCl(age, weight, scr, sex);
      }

      var egfr = calculateEgfr(scr, age, sex);
      var egfrAbsolute = calculateEgfrAbsolute(egfr, height, weight);
      var band = renalBand(crcl);
      var drug = findRenalDrug(fieldValue('renal-drug'), renalCatalog);
      var advice = drug
        ? drug.guidance[band]
        : 'Chọn một thuốc để xem cảnh báo theo nhóm chức năng thận.';

      var dialysis = document.getElementById('renal-dialysis');
      var dialysisChecked = !!(dialysis && dialysis.checked);

      var crclMethod = 'Cockcroft–Gault dùng cân nặng thực';
      var weightParts = [];

      if (renalCore) {
        crclMethod = 'Cockcroft–Gault có hiệu chỉnh cân nặng (IBW/AdjBW)';
        if (Number.isFinite(Number(renalCore.ibw))) {
          weightParts.push('IBW: ' + format(Number(renalCore.ibw), 1) + ' kg');
        }
        if (renalCore.isObese && Number.isFinite(Number(renalCore.adjBW))) {
          weightParts.push('AdjBW: ' + format(Number(renalCore.adjBW), 1) + ' kg');
        }
        if (Number.isFinite(Number(renalCore.crclWeight))) {
          weightParts.push('Cân nặng tính CrCl: ' + format(Number(renalCore.crclWeight), 1) + ' kg');
        }
      }

      setResultBox(
        box,
        '<h3>' + escapeHtml(fieldValue('renal-his') || 'Người bệnh') + '</h3>' +
        '<div class="ct-stat-grid">' +
          '<div class="ct-stat"><span>CrCl Cockcroft–Gault</span><strong>' + format(crcl) + ' <small>mL/phút</small></strong></div>' +
          '<div class="ct-stat"><span>eGFR CKD-EPI 2021</span><strong>' + format(egfr) + ' <small>mL/phút/1,73 m²</small></strong></div>' +
          (Number.isFinite(egfrAbsolute)
            ? '<div class="ct-stat"><span>eGFR quy đổi BSA</span><strong>' + format(egfrAbsolute) + ' <small>mL/phút</small></strong></div>'
            : '') +
          '<div class="ct-stat"><span>Nhóm chức năng thận</span><strong>' + escapeHtml(bandLabels[band] || band) + '</strong></div>' +
        '</div>' +
        '<div class="ct-alert ' + (band === 'normal' ? 'is-success' : 'is-info') + '">' +
          '<strong>' + escapeHtml(drug ? drug.name : 'Thuốc chưa chọn') + ':</strong> ' + escapeHtml(advice) +
        '</div>' +
        (dialysisChecked
          ? '<div class="ct-note"><strong>HD/CRRT:</strong> cần lịch lọc, loại màng, thời điểm dùng thuốc và phác đồ riêng; không dùng một giá trị CrCl/eGFR để tự động chốt liều.</div>'
          : '') +
        renderVancomycinModule2(weight, crcl, dialysisChecked) +
        '<div class="ct-note"><strong>Cách tính:</strong> ' + escapeHtml(crclMethod) +
          (weightParts.length ? ' · ' + escapeHtml(weightParts.join(' · ')) : '') +
        '.<br>Creatinine đã chuẩn hóa về mg/dL trước khi tính. CrCl và eGFR là hai ước tính khác nhau; quyết định liều phải theo tài liệu thuốc, TDM và quy trình bệnh viện.</div>'
      );

      writeHistoryItem('renal', {
        his: fieldValue('renal-his'),
        unit: fieldValue('renal-unit'),
        metric: 'CrCl ' + format(crcl) + ' · eGFR ' + format(egfr),
        drug: drug ? drug.name : '—',
        suggestion: bandLabels[band] || band
      });
      renderHistoryTable('renal', document.getElementById('renal-history'), document.getElementById('renal-history-empty'));
    });

    if (resetButton) {
      resetButton.addEventListener('click', function () {
        form.reset();
        var scrUnit = document.getElementById('renal-scr-unit');
        if (scrUnit) scrUnit.value = 'umol-l';
        resetResultBox(box, emptyHtml);
      });
    }
  }

  /* =========================================================
   * MODULE 3 — LIỀU KHÁNG SINH NHI
   * ========================================================= */

  function pediatricDoseText(calculatedDose) {
    if (!calculatedDose) return '';
    if (typeof calculatedDose === 'string') return calculatedDose;
    return calculatedDose.display || '';
  }

  function setupPediatricTool() {
    var form = document.getElementById('pediatric-form');
    var box = document.getElementById('pediatric-result');
    var resetButton = document.getElementById('pediatric-reset');
    if (!form) return;

    var emptyHtml = box ? box.innerHTML : '';
    var pediatricCatalog = Array.isArray(window.PEDIATRIC_ANTIBIOTICS)
      ? window.PEDIATRIC_ANTIBIOTICS
      : [];

    if (!pediatricCatalog.length || typeof window.getPediatricDose !== 'function') {
      setResultBox(box, '<h3>Module Nhi chưa được nạp</h3><p>Không tìm thấy PEDIATRIC_ANTIBIOTICS/getPediatricDose từ module3-pediatric-dosing.js.</p>');
    }

    var drugSelect = document.getElementById('pediatric-drug');
    var pkpdSelect = document.getElementById('pediatric-pkpd-target');

    if (drugSelect) {
      drugSelect.innerHTML = '<option value="">— Chọn thuốc —</option>';
      pediatricCatalog
        .slice()
        .sort(function (a, b) {
          return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
        })
        .forEach(function (drug) {
          var option = document.createElement('option');
          option.value = drug.id;
          option.textContent = drug.name + (drug.class ? ' — ' + drug.class : '');
          drugSelect.appendChild(option);
        });
    }

    function selectedPediatricDrug() {
      if (!drugSelect) return null;
      var id = drugSelect.value;
      return pediatricCatalog.find(function (drug) {
        return drug.id === id;
      }) || null;
    }

    function isBetaLactam(drug) {
      return !!(drug && /beta[-\s]?lactam/i.test(String(drug.class || '')));
    }

    function renderPkpdTargets() {
      if (!pkpdSelect) return;
      pkpdSelect.innerHTML = '<option value="">— Chọn đích PK/PD —</option>';
      var drug = selectedPediatricDrug();
      var targets =
        drug &&
        isBetaLactam(drug) &&
        data.pediatricPkpd &&
        Array.isArray(data.pediatricPkpd['beta-lactam'])
          ? data.pediatricPkpd['beta-lactam']
          : [];

      targets.forEach(function (target) {
        var option = document.createElement('option');
        option.value = target.id;
        option.textContent = target.label;
        pkpdSelect.appendChild(option);
      });

      pkpdSelect.disabled = !targets.length;
    }

    if (drugSelect) drugSelect.addEventListener('change', renderPkpdTargets);
    renderPkpdTargets();

    initHistoryCard('pediatric', {
      tbody: 'pediatric-history',
      empty: 'pediatric-history-empty',
      refresh: 'pediatric-refresh',
      export: 'pediatric-export',
      clear: 'pediatric-clear'
    });

    function renderPediatricRow(row) {
      var calculated = pediatricDoseText(row.calculatedDose);
      return (
        '<div class="ct-check-item">' +
          '<strong>' + escapeHtml(row.label || 'Dòng liều phù hợp') + '</strong>' +
          '<br><span>Liều nguồn: ' + escapeHtml(row.dose || 'Không ghi') + '</span>' +
          (calculated ? '<br><strong>Liều theo cân nặng: ' + escapeHtml(calculated) + '</strong>' : '') +
          (row.interval ? '<br><span>Khoảng cách: ' + escapeHtml(row.interval) + '</span>' : '') +
          (row.route ? '<br><span>Đường dùng: ' + escapeHtml(row.route) + '</span>' : '') +
          (row.notes ? '<br><span>' + escapeHtml(row.notes) + '</span>' : '') +
        '</div>'
      );
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var years = number(fieldValue('pediatric-age-years'));
      var months = number(fieldValue('pediatric-age-months'));
      var weight = number(fieldValue('pediatric-weight'));
      var pnaRaw = fieldValue('pediatric-pna');
      var gaRaw = fieldValue('pediatric-ga');
      var pna = pnaRaw !== '' ? number(pnaRaw) : NaN;
      var ga = gaRaw !== '' ? number(gaRaw) : NaN;
      var drugId = fieldValue('pediatric-drug');

      if (
        !Number.isFinite(years) ||
        years < 0 ||
        !Number.isFinite(months) ||
        months < 0 ||
        months > 11 ||
        !Number.isFinite(weight) ||
        weight <= 0
      ) {
        setResultBox(box, '<h3>Dữ liệu chưa hợp lệ</h3><p>Kiểm tra lại tuổi, tháng tuổi và cân nặng.</p>');
        return;
      }

      var totalMonths = years * 12 + months;

      if (years >= 18 || totalMonths >= 216) {
        setResultBox(box, '<h3>Không áp dụng</h3><p>Công cụ Nhi khóa bệnh nhân từ đủ 18 tuổi.</p>');
        return;
      }

      if (!drugId) {
        setResultBox(box, '<h3>Chưa chọn thuốc</h3><p>Chọn kháng sinh cần tính liều.</p>');
        return;
      }

      var usePna = totalMonths === 0 && Number.isFinite(pna) && pna >= 0;

      if (totalMonths === 0 && !usePna) {
        setResultBox(box, '<h3>Thiếu tuổi sau sinh</h3><p>Trẻ dưới 1 tháng cần nhập PNA (ngày) để chọn đúng dòng liều sơ sinh.</p>');
        return;
      }

      var ageRaw = usePna ? pna : totalMonths;
      var ageUnit = usePna ? 'days' : 'months';
      var calculation;

      try {
        calculation = window.getPediatricDose(drugId, {
          ageRaw: ageRaw,
          ageUnit: ageUnit,
          weightKg: weight
        });
      } catch (error) {
        console.error('Lỗi Module 3:', error);
        setResultBox(box, '<h3>Không thể tính</h3><p>Module liều Nhi phát sinh lỗi khi xử lý dữ liệu.</p>');
        return;
      }

      if (!calculation || !calculation.drug) {
        setResultBox(box, '<h3>Không tìm thấy thuốc</h3><p>Không tìm thấy thuốc trong Module 3.</p>');
        return;
      }

      var drug = calculation.drug;
      var patient = calculation.patient || {};

      var ceftriaxone = /ceftriaxone/i.test(String(drug.id || '') + ' ' + String(drug.name || ''));
      if (ceftriaxone && Number.isFinite(Number(patient.ageDays)) && Number(patient.ageDays) <= 28) {
        setResultBox(
          box,
          '<div class="ct-alert is-error"><strong>⛔ Ceftriaxone bị khóa</strong><br>Không cho phép công cụ tự tính Ceftriaxone ở trẻ sơ sinh ≤28 ngày.<br>Cần đối chiếu chống chỉ định, chế phẩm, calci tĩnh mạch, bilirubin và phác đồ của bệnh viện.</div>'
        );
        return;
      }

      var matchingRows = (Array.isArray(calculation.rows) ? calculation.rows : [])
        .filter(function (row) { return row.isMatch; });

      var pma = NaN;
      if (usePna && Number.isFinite(ga) && Number.isFinite(pna)) {
        pma = ga + pna / 7;
      }

      var html =
        '<h3>' + escapeHtml(drug.name) + '</h3>' +
        '<div class="ct-stat-grid">' +
          '<div class="ct-stat"><span>Nhóm tuổi</span><strong>' + escapeHtml(patient.ageLabel || 'Chưa xác định') + '</strong></div>' +
          '<div class="ct-stat"><span>Cân nặng</span><strong>' + format(weight, 2) + ' <small>kg</small></strong></div>' +
          (Number.isFinite(pma)
            ? '<div class="ct-stat"><span>PMA</span><strong>' + format(pma, 1) + ' <small>tuần</small></strong></div>'
            : '') +
        '</div>';

      if (drug.class) {
        html += '<p><strong>Nhóm:</strong> ' + escapeHtml(drug.class) + '</p>';
      }

      if (matchingRows.length) {
        html += '<h4>Liều phù hợp với dữ liệu đã nhập</h4><div class="ct-check-list">';
        matchingRows.forEach(function (row) {
          html += renderPediatricRow(row);
        });
        html += '</div>';
      } else {
        var specialRows = (Array.isArray(calculation.rows) ? calculation.rows : [])
          .filter(function (row) {
            return row.gaRequired || row.scrRequired;
          });

        html += '<div class="ct-note"><strong>Không tự động chọn được dòng liều.</strong><br>';

        if (specialRows.length) {
          html += 'Thuốc này có dòng liều phụ thuộc tuổi thai GA hoặc creatinine huyết thanh SCr. Công cụ không tự suy diễn khi thiếu điều kiện cần thiết.';
        } else {
          html += 'Không có dòng liều phù hợp với tuổi/cân nặng đã nhập.';
        }

        html += '</div>';

        if (specialRows.length) {
          html += '<h4>Các dòng cần đánh giá thêm</h4><div class="ct-check-list">';
          specialRows.forEach(function (row) {
            html += renderPediatricRow(row);
          });
          html += '</div>';
        }
      }

      var micRaw = fieldValue('pediatric-mic');
      if (String(micRaw).trim() !== '') {
        var mic = number(micRaw);
        if (!Number.isFinite(mic) || mic <= 0) {
          setResultBox(box, '<h3>MIC chưa hợp lệ</h3><p>MIC phải là số lớn hơn 0 mg/L (tương đương µg/mL).</p>');
          return;
        }

        var targets =
          isBetaLactam(drug) &&
          data.pediatricPkpd &&
          Array.isArray(data.pediatricPkpd['beta-lactam'])
            ? data.pediatricPkpd['beta-lactam']
            : [];

        var selectedTargetId = fieldValue('pediatric-pkpd-target');
        var target = targets.find(function (item) {
          return item.id === selectedTargetId;
        }) || targets[0] || null;

        if (target) {
          html +=
            '<div class="ct-alert is-info">' +
              '<strong>Mục tiêu PK/PD:</strong> ' + escapeHtml(target.label) +
              ' — Ngưỡng theo MIC ' + format(mic, 3) + ' mg/L: <strong>' + format(mic * target.multiple, 3) + ' mg/L</strong>.<br>' +
              'Phần này chỉ hiển thị mục tiêu phơi nhiễm; không tự đổi liều nếu thiếu mô hình PK/TDM.' +
            '</div>';
        } else {
          html +=
            '<div class="ct-alert is-info"><strong>MIC:</strong> ' + format(mic, 3) +
            ' mg/L. Chưa có mục tiêu PK/PD cấu trúc cho thuốc này trong dữ liệu hiện tại.</div>';
        }
      }

      if (drug.maxDose) {
        html += '<p class="ct-note-sm"><strong>Giới hạn liều ghi trong dữ liệu nguồn:</strong> ' + escapeHtml(drug.maxDose) + '</p>';
      }

      if (drug.citation) {
        html += '<p class="ct-note-sm"><strong>Nguồn:</strong> ' + escapeHtml(drug.citation) + '</p>';
      }

      setResultBox(
        box,
        html +
        '<div class="ct-note"><strong>Quy tắc tính:</strong> mg/kg/ngày được giữ là tổng liều/ngày; mg/kg/lần hoặc mg/kg/liều được giữ là liều mỗi lần. Công cụ không tự coi tổng liều ngày là liều mỗi lần.</div>'
      );

      var firstDose = matchingRows.length ? pediatricDoseText(matchingRows[0].calculatedDose) : '';
      writeHistoryItem('pediatric', {
        his: fieldValue('pediatric-his'),
        unit: fieldValue('pediatric-unit'),
        metric: firstDose || 'Cần đánh giá thêm',
        drug: drug.name,
        suggestion: matchingRows.length
          ? matchingRows.length + ' dòng liều phù hợp'
          : 'Không khớp — xem lại điều kiện'
      });
      renderHistoryTable('pediatric', document.getElementById('pediatric-history'), document.getElementById('pediatric-history-empty'));
    });

    if (resetButton) {
      resetButton.addEventListener('click', function () {
        form.reset();
        if (pkpdSelect) {
          pkpdSelect.innerHTML = '<option value="">— Chọn đích PK/PD —</option>';
          pkpdSelect.disabled = true;
        }
        resetResultBox(box, emptyHtml);
      });
    }
  }

  /* =========================================================
   * MODULE 4 — PET/CT: LẬP KẾ HOẠCH LIỀU
   * ========================================================= */

  var PET_DEFAULTS = {
    plan: {
      activity: 370,
      receive: '08:00',
      doseFactor: 0.15,
      doseUnit: 'mCi/kg',
      waitMin: 45,
      halfLife: 110
    },
    rows: []
  };

  function readPetState() {
    try {
      var raw = window.localStorage.getItem(petStateKey);
      var parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || !parsed.plan) return cloneJson(PET_DEFAULTS);
      return parsed;
    } catch (error) {
      return cloneJson(PET_DEFAULTS);
    }
  }

  function savePetState(state) {
    try {
      window.localStorage.setItem(petStateKey, JSON.stringify(state));
    } catch (error) {
      /* bỏ qua */
    }
  }

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function defaultSlot(receiveDate, offsetMinutes) {
    if (!receiveDate) return '--';
    var d = new Date(receiveDate.getTime() + offsetMinutes * 60000);
    return formatTime(d);
  }

  function computePetPlan(plan, rows, petApi) {
    var result = { rows: [], summary: { count: 0, avgMci: NaN, totalWeight: NaN } };

    if (!petApi || typeof petApi.decayFactor !== 'function' || typeof petApi.minutesBetween !== 'function') {
      return result;
    }

    var receive = timeToDate(String(plan.receive || '').trim());
    var waitMin = Number(plan.waitMin);
    var halfLife = Number(plan.halfLife);
    var activity = Number(plan.activity);
    var isMbq = /mbq/i.test(String(plan.doseUnit || ''));
    var factor = Number(plan.doseFactor);
    var factorMci = isMbq && typeof petApi.mBqToMci === 'function'
      ? petApi.mBqToMci(factor)
      : factor;

    var sumDose = 0;
    var doseCount = 0;
    var totalWeight = 0;
    var cumulative = 0;

    var computed = rows.map(function (row, index) {
      var weight = number(row.weight);
      var overrideRaw = row.override === '' || row.override == null ? '' : String(row.override).trim();
      var override = overrideRaw === '' ? NaN : number(overrideRaw);
      var hasOverride = Number.isFinite(override) && override > 0;

      var doseMci = hasOverride
        ? override
        : (Number.isFinite(factorMci) && Number.isFinite(weight) && weight > 0 ? weight * factorMci : NaN);

      var injectDate = timeToDate(String(row.inject || '').trim());
      if (!injectDate) {
        injectDate = timeToDate(defaultSlot(receive, 45 + index * 15));
      }

      var scanDate = injectDate && Number.isFinite(waitMin)
        ? new Date(injectDate.getTime() + waitMin * 60000)
        : null;

      var needed = NaN;
      if (injectDate && receive && Number.isFinite(halfLife) && halfLife > 0) {
        var delta = petApi.minutesBetween(receive, injectDate);
        var decay = petApi.decayFactor(delta, halfLife);
        if (delta >= 0 && Number.isFinite(decay) && decay > 0 && Number.isFinite(doseMci)) {
          needed = doseMci / decay;
        }
      }

      if (Number.isFinite(needed)) cumulative += needed;
      var remaining = Number.isFinite(activity) ? activity - cumulative : NaN;

      if (Number.isFinite(doseMci)) {
        sumDose += doseMci;
        doseCount += 1;
      }
      if (Number.isFinite(weight) && weight > 0) totalWeight += weight;

      return {
        weight: weight,
        overrideRaw: overrideRaw,
        overrideValue: override,
        hasOverride: hasOverride,
        diabetic: !!row.diabetic,
        glucose: row.glucose || '',
        doseMci: doseMci,
        injectInput: injectDate ? formatTime(injectDate) : '',
        scanInput: scanDate ? formatTime(scanDate) : '—',
        needed: needed,
        remaining: remaining
      };
    });

    result.rows = computed;
    result.summary = {
      count: computed.length,
      avgMci: doseCount ? sumDose / doseCount : NaN,
      totalWeight: totalWeight
    };
    result.milestone = {
      receive: receive ? formatTime(receive) : '—',
      activity: activity,
      needed: cumulative,
      remaining: Number.isFinite(activity) ? activity - cumulative : NaN
    };

    return result;
  }

  function setupPetTool() {
    var planForm = document.getElementById('pet-plan-form');
    var rowsTbody = document.getElementById('pet-rows');
    if (!planForm || !rowsTbody) return;

    var state = readPetState();
    var petApi = window.PETCT_DOSE_API || {};

    function syncPlanForm() {
      var plan = state.plan;
      setField('pet-activity', plan.activity);
      setField('pet-receive', plan.receive || '08:00');
      setField('pet-dose-factor', plan.doseFactor);
      setField('pet-dose-unit', plan.doseUnit || 'mCi/kg');
      setField('pet-wait-min', plan.waitMin);
      setField('pet-half-life', plan.halfLife);
    }

    function setField(id, value) {
      var element = document.getElementById(id);
      if (element) element.value = value;
    }

    function applyPlan() {
      var plan = state.plan;
      var activity = number(fieldValue('pet-activity'));
      var receive = fieldValue('pet-receive');
      var doseFactor = number(fieldValue('pet-dose-factor'));
      var doseUnit = fieldValue('pet-dose-unit') || 'mCi/kg';
      var waitMin = number(fieldValue('pet-wait-min'));
      var halfLife = number(fieldValue('pet-half-life'));

      if (Number.isFinite(activity) && activity >= 0) plan.activity = activity;
      if (/^\d{1,2}:\d{2}$/.test(receive)) plan.receive = receive;
      if (Number.isFinite(doseFactor) && doseFactor > 0) plan.doseFactor = doseFactor;
      plan.doseUnit = doseUnit;
      if (Number.isFinite(waitMin) && waitMin >= 0) plan.waitMin = waitMin;
      if (Number.isFinite(halfLife) && halfLife > 0) plan.halfLife = halfLife;

      /* lập lại lịch tiêm cho mọi ca theo thông số mới */
      state.rows.forEach(function (row) { row.inject = ''; });

      syncPlanForm();
      renderPet();
      savePetState(state);
    }

    function readRowInputs(rowElement) {
      var inputs = rowElement.querySelectorAll('input, select');
      var values = {};
      inputs.forEach(function (input) {
        values[input.name] = input.type === 'checkbox' ? input.checked : input.value;
      });
      return values;
    }

    function renderPet() {
      var plan = state.plan;
      var computed = computePetPlan(plan, state.rows, petApi);

      rowsTbody.innerHTML = '';

      /* hàng MỐC NHẬN */
      var milestoneRow = document.createElement('tr');
      milestoneRow.className = 'ct-milestone';
      milestoneRow.innerHTML =
        '<td class="ct-rowmark"><span class="ct-pill">MỐC NHẬN</span></td>' +
        '<td><span class="ct-num">' + format(computed.milestone.activity, 0) + ' mCi</span></td>' +
        '<td class="cell-mid">—</td>' +
        '<td class="cell-mid">—</td>' +
        '<td class="cell-mid">—</td>' +
        '<td class="cell-mid">—</td>' +
        '<td><span class="ct-num">' + escapeHtml(computed.milestone.receive) + '</span></td>' +
        '<td class="cell-mid">—</td>' +
        '<td><span class="ct-num">' + format(computed.milestone.needed) + ' mCi</span></td>' +
        '<td>' + formatRemaining(computed.milestone.remaining) + '</td>';
      rowsTbody.appendChild(milestoneRow);

      /* các ca bệnh nhân */
      computed.rows.forEach(function (row, index) {
        var tr = document.createElement('tr');
        tr.dataset.petRow = String(index);

        var weightCell = numberInput(index, 'weight', row.weight);
        var overrideCell = numberInput2(index, 'override', row.overrideRaw);
        var glucoseCell = tribbleInput(index, 'glucose', row.glucose);
        var injectCell = timeInput(index, 'inject', row.injectInput);

        tr.innerHTML =
          '<td class="ct-rowmark"><span class="ct-num is-muted">Ca ' + (index + 1) + '</span></td>' +
          '<td>' + overrideCell + '</td>' +
          '<td>' + weightCell + '</td>' +
          '<td class="cell-mid"><input class="tbl-check" type="checkbox" name="diabetic" data-pet="' + index + '"' + (row.diabetic ? ' checked' : '') + ' aria-label="Tiểu đường"></td>' +
          '<td>' + glucoseCell + '</td>' +
          '<td><span class="ct-num">' + (Number.isFinite(row.doseMci) ? format(row.doseMci) + ' mCi' : '—') + '</span>' +
            (row.hasOverride ? ' <small class="ct-note-sm ct-inline-tag">(nhập tay)</small>' : '') + '</td>' +
          '<td>' + injectCell + '</td>' +
          '<td><span class="ct-num">' + escapeHtml(row.scanInput) + '</span></td>' +
          '<td><span class="ct-num">' + (Number.isFinite(row.needed) ? format(row.needed) + ' mCi' : '—') + '</span></td>' +
          '<td>' + formatRemaining(row.remaining) + '</td>';

        rowsTbody.appendChild(tr);
      });

      /* tóm tắt */
      setText('pet-avg-dose', Number.isFinite(computed.summary.avgMci) ? format(computed.summary.avgMci) + ' mCi' : '--');
      setText('pet-count', String(computed.summary.count));
      setText('pet-total-weight', Number.isFinite(computed.summary.totalWeight) ? format(computed.summary.totalWeight, 1) + ' kg' : '--');
    }

    function formatRemaining(value) {
      if (!Number.isFinite(value)) return '<span class="ct-num is-muted">--</span>';
      var html = '<span class="ct-num' + (value < 0 ? ' ct-neg' : '') + '">' + format(value) + ' mCi</span>';
      return html + (value < 0 ? ' <small class="ct-neg">(thiếu)</small>' : '');
    }

    function numberInput(index, name, value) {
      var input = '<input class="tbl-input" type="number" min="0.1" step="0.1" name="' + name + '" data-pet="' + index + '" value="' +
        escapeHtml(value == null || value === '' ? '' : value) + '" aria-label="' + name + '">';
      return input;
    }

    function numberInput2(index, name, value) {
      var input = '<input class="tbl-input" type="number" min="0.01" step="0.01" name="' + name + '" data-pet="' + index + '" value="' +
        escapeHtml(value == null ? '' : value) + '" placeholder="tự tính" aria-label="' + name + '">';
      return input;
    }

    function tribbleInput(index, name, value) {
      var input = '<input class="tbl-input" type="text" name="' + name + '" data-pet="' + index + '" value="' +
        escapeHtml(value == null || value === '' ? '' : value) + '" placeholder="mmol/L" aria-label="' + name + '">';
      return input;
    }

    function timeInput(index, name, value) {
      var input = '<input class="tbl-input tbl-time" type="time" name="' + name + '" data-pet="' + index + '" value="' +
        escapeHtml(value || '') + '" aria-label="' + name + '">';
      return input;
    }

    function setText(id, text) {
      var element = document.getElementById(id);
      if (element) element.textContent = text;
    }

    rowsTbody.addEventListener('change', function (event) {
      var target = event.target;
      if (!target || !target.matches('[data-pet]')) return;
      var tr = target.closest('[data-pet-row]');
      if (!tr) return;
      var index = Number(tr.getAttribute('data-pet-row'));
      if (!Number.isFinite(index) || index < 0 || index >= state.rows.length) return;

      var values = readRowInputs(tr);
      var row = state.rows[index];
      row.weight = values.weight;
      row.override = values.override;
      row.diabetic = !!values.diabetic;
      row.glucose = values.glucose;
      row.inject = values.inject;

      renderPet();
      savePetState(state);
    });

    var addButton = document.getElementById('pet-add');
    if (addButton) {
      addButton.addEventListener('click', function () {
        state.rows.push({ weight: 65, diabetic: false, glucose: '', override: '', inject: '' });
        renderPet();
        savePetState(state);
      });
    }

    var addFiveButton = document.getElementById('pet-add-five');
    if (addFiveButton) {
      addFiveButton.addEventListener('click', function () {
        [55, 60, 65, 70, 75].forEach(function (weight) {
          state.rows.push({ weight: weight, diabetic: false, glucose: '', override: '', inject: '' });
        });
        renderPet();
        savePetState(state);
      });
    }

    var clearButton = document.getElementById('pet-clear');
    if (clearButton) {
      clearButton.addEventListener('click', function () {
        if (!state.rows.length) return;
        if (window.confirm('Xóa toàn bộ danh sách ca hiện tại? (thông số kế hoạch được giữ)')) {
          state.rows = [];
          renderPet();
          savePetState(state);
        }
      });
    }

    if (planForm) {
      planForm.addEventListener('submit', function (event) {
        event.preventDefault();
        applyPlan();
      });
    }

    var applyButton = document.getElementById('pet-apply');
    if (applyButton) {
      applyButton.addEventListener('click', applyPlan);
    }

    syncPlanForm();
    renderPet();
  }

  /* =========================================================
   * API + KHỞI ĐỘNG
   * ========================================================= */

  function moduleStatus() {
    return {
      module1: typeof window.checkContraindicatedInteraction === 'function',
      module2: typeof window.computeRenalCore === 'function',
      module3:
        Array.isArray(window.PEDIATRIC_ANTIBIOTICS) &&
        typeof window.getPediatricDose === 'function',
      module4: !!(
        window.PETCT_DOSE_API &&
        typeof window.PETCT_DOSE_API.calcPetctDose === 'function'
      )
    };
  }

  var api = {
    normalize: normalize,
    number: number,
    format: format,
    escapeHtml: escapeHtml,
    timeToDate: timeToDate,
    formatTime: formatTime,
    computePetPlan: computePetPlan,
    findInteractions: findInteractions,
    findAllInteractions: findAllInteractions,
    calculateCrCl: calculateCrCl,
    calculateEgfr: calculateEgfr,
    calculateEgfrAbsolute: calculateEgfrAbsolute,
    convertCreatinine: convertCreatinine,
    renalBand: renalBand,
    readHistory: readHistory,
    moduleStatus: moduleStatus,
    modules: {
      module1: window.INTERACTIONS_CI_API || null,
      module2: window.RENAL_DOSING_API || null,
      module3: {
        catalog: window.PEDIATRIC_ANTIBIOTICS || [],
        getPediatricDose: window.getPediatricDose || null
      },
      module4: window.PETCT_DOSE_API || null
    }
  };

  window.KHOA_DUOC_CLINICAL_PAGES = api;

  document.addEventListener('DOMContentLoaded', function () {
    var tool = document.body.getAttribute('data-clinical-tool');

    if (tool === 'interaction') setupInteractionTool();
    if (tool === 'renal') setupRenalTool();
    if (tool === 'pediatric') setupPediatricTool();
    if (tool === 'pet') setupPetTool();
  });

}(window, document));