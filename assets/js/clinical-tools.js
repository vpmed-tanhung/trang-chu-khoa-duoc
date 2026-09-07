(function (window, document) {
  'use strict';

  var data = window.KHOA_DUOC_CLINICAL_DATA || {};
  var historyPrefix = 'khoa-duoc-clinical-history:';

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

  function containsAlias(value, aliases) {
    if (!Array.isArray(aliases)) return false;
    var haystack = ' ' + normalize(value) + ' ';
    return aliases.some(function (alias) {
      var needle = normalize(alias);
      return needle && haystack.indexOf(' ' + needle + ' ') !== -1;
    });
  }

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

  function writeHistory(tool, item) {
    var items = readHistory(tool);
    items.unshift(item);
    try {
      window.localStorage.setItem(
        historyKey(tool),
        JSON.stringify(items.slice(0, 20))
      );
    } catch (error) {
      /* localStorage có thể bị chặn */
    }
  }

  function renderHistory(tool, target) {
    if (!target) return;
    var items = readHistory(tool);

    if (!items.length) {
      target.innerHTML = '<p class="clinical-history-empty">Chưa có lịch sử trên thiết bị này.</p>';
      return;
    }

    target.innerHTML = items.map(function (item) {
      return (
        '<div class="clinical-history-item">' +
          '<strong>' + escapeHtml(item.title) + '</strong>' +
          '<span>' + escapeHtml(item.summary) + '</span>' +
          '<span>' + escapeHtml(item.time) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  function clearHistory(tool, target) {
    try {
      window.localStorage.removeItem(historyKey(tool));
    } catch (error) {
      /* bỏ qua */
    }
    renderHistory(tool, target);
  }

  function setResult(target, html, state) {
    if (!target) return;
    target.className = 'clinical-result' + (state ? ' ' + state : '');
    target.innerHTML = html;
  }

  function fieldValue(id) {
    var element = document.getElementById(id);
    return element ? element.value : '';
  }

  /* =========================================================
   * THẺ CÔNG CỤ LÂM SÀNG (featuredTools) — TRANG CHỦ
   * ========================================================= */

  var featuredToolIcons = {
    scanner: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m8.5 4.5 11 11-4 4-11-11z"/><path d="m5 8 3-3M12 15l-3 3M4 20h7"/></svg>',
    document: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3"/><path d="M5 20c.8-3.4 3-5 7-5s6.2 1.6 7 5M4 4h2M18 4h2"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v5M20 12h-5M12 20v-5M4 12h5"/></svg>'
  };

  function featuredToolCard(tool) {
    if (!tool || !tool.link) return '';
    var icon = featuredToolIcons[tool.icon] || featuredToolIcons.scanner;
    return (
      '<a class="clinical-tool-card" href="' + escapeHtml(tool.link) + '">' +
        '<div class="clinical-tool-card-top">' +
          '<span class="clinical-tool-icon" aria-hidden="true">' + icon + '</span>' +
          '<span class="clinical-tool-badge">' + escapeHtml(tool.badgeText || tool.status || 'Sẵn sàng') + '</span>' +
        '</div>' +
        '<h3>' + escapeHtml(tool.title || '') + '</h3>' +
        '<p>' + escapeHtml(tool.desc || '') + '</p>' +
        '<div class="clinical-tool-status">' +
          '<span>' + escapeHtml(tool.actionText || 'Mở công cụ') + '</span>' +
          '<span aria-hidden="true">→</span>' +
        '</div>' +
      '</a>'
    );
  }

  function renderFeaturedTools() {
    if (typeof document.querySelector !== 'function') return 0;
    var grid = document.querySelector('.clinical-tools-grid');
    if (!grid) return 0;
    var tools = Array.isArray(data.featuredTools) ? data.featuredTools : [];
    if (!tools.length) return 0;
    grid.innerHTML = tools.map(featuredToolCard).join('');
    return tools.length;
  }

  /* =========================================================
   * MODULE 1 — TƯƠNG TÁC THUỐC
   * ========================================================= */

  function findInteractions(first, second, list) {
    var firstText = String(first || '').trim();
    var secondText = String(second || '').trim();

    if (!firstText || !secondText) return [];

    /*
     * Ưu tiên Module 1: tương tác chống chỉ định.
     */
    if (typeof window.checkContraindicatedInteraction === 'function') {
      try {
        var ciResult = window.checkContraindicatedInteraction(
          firstText,
          secondText
        );

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

    /*
     * Không có kết quả Module 1 -> tiếp tục bộ tương tác cũ.
     */
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

  function setupInteractionTool() {
    var form = document.getElementById('interaction-form');
    var result = document.getElementById('interaction-result');
    var history = document.getElementById('interaction-history');
    var items = document.getElementById('interaction-list');
    var clearButton = document.getElementById('interaction-clear-history');

    if (!form) return;

    var interactionCatalog = Array.isArray(data.interactions)
      ? data.interactions
      : [];

    renderHistory('interaction', history);

    function renderRules(matches) {
      if (!matches.length) {
        setResult(
          result,
          '<h3>Chưa phát hiện trong bộ quy tắc đang tích hợp</h3>' +
          '<p>Điều này không đồng nghĩa là không có tương tác. Cần đối chiếu nguồn tương tác chuyên dụng và quy trình bệnh viện khi quyết định điều trị.</p>',
          'is-success'
        );
        return;
      }

      setResult(
        result,
        matches.map(function (match) {
          var severity = String(match.rule.severity || 'cảnh báo');
          var levelClass = severity === 'cao' ? 'is-error' : 'is-warning';

          return (
            '<div class="clinical-result ' + levelClass + '">' +
              '<h3>' + escapeHtml(severity.toUpperCase()) + ' — ' + escapeHtml(match.rule.title || 'Tương tác thuốc') + '</h3>' +
              '<p><strong>' + escapeHtml(match.first) + '</strong> + <strong>' + escapeHtml(match.second) + '</strong></p>' +
              '<p>' + escapeHtml(match.rule.advice || '') + '</p>' +
            '</div>'
          );
        }).join(''),
        'is-warning'
      );
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var first = fieldValue('interaction-first').trim();
      var second = fieldValue('interaction-second').trim();

      if (!first || !second) {
        setResult(
          result,
          '<h3>Chưa đủ dữ liệu</h3><p>Nhập tên hai thuốc để kiểm tra.</p>',
          'is-error'
        );
        return;
      }

      var matches = findInteractions(first, second, interactionCatalog)
        .map(function (rule) {
          return { first: first, second: second, rule: rule };
        });

      renderRules(matches);

      writeHistory('interaction', {
        title: first + ' + ' + second,
        summary: matches.length
          ? matches.length + ' cảnh báo'
          : 'Chưa phát hiện trong bộ quy tắc',
        time: nowText()
      });

      renderHistory('interaction', history);
    });

    if (items) {
      items.addEventListener('input', function () {
        var values = items.value
          .split(/\n|,|;/)
          .map(function (value) { return value.trim(); })
          .filter(Boolean);

        if (values.length < 2) {
          setResult(
            result,
            '<h3>Chưa đủ dữ liệu</h3><p>Nhập từ hai thuốc trở lên, mỗi thuốc một dòng hoặc ngăn cách bằng dấu phẩy.</p>',
            'is-warning'
          );
          return;
        }

        renderRules(findAllInteractions(values, interactionCatalog));
      });
    }

    if (clearButton) {
      clearButton.addEventListener('click', function () {
        clearHistory('interaction', history);
      });
    }
  }

  /* =========================================================
   * MODULE 2 — CHỨC NĂNG THẬN / VANCOMYCIN
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
    var isAvailable =
      typeof window.getVancomycinLoadingDose === 'function' &&
      typeof window.getVancomycinMaintenanceRegimen === 'function';

    if (!isAvailable) {
      return (
        '<p class="clinical-help">' +
          '<strong>Module 2:</strong> chưa nạp được nomogram Vancomycin; chỉ hiển thị cảnh báo chức năng thận hiện có.' +
        '</p>'
      );
    }

    try {
      if (
        dialysisChecked &&
        typeof window.getVancomycinHemodialysisRegimen === 'function'
      ) {
        var hd = window.getVancomycinHemodialysisRegimen(weight);

        if (hd && !hd.error) {
          return (
            '<div class="clinical-note">' +
              '<strong>Module 2 — Vancomycin / lọc máu:</strong><br>' +
              'Liều nạp theo nomogram: <strong>' + format(hd.loadingDoseMg, 0) + ' mg</strong><br>' +
              'Liều duy trì theo nomogram: <strong>' + format(hd.maintenanceDoseMg, 0) + ' mg</strong><br>' +
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
          '<div class="clinical-note">' +
            '<strong>Module 2 — Nomogram Vancomycin:</strong><br>' +
            'Liều nạp: <strong>' + format(loadingDose, 0) + ' mg</strong><br>' +
            'Liều duy trì tham khảo: <strong>' + format(maintenance.doseMg, 0) + ' mg' + intervalText + '</strong><br>' +
            escapeHtml(maintenance.note || '') +
            '<br><small>Nomogram này không thay thế TDM/AUC và phác đồ bệnh viện.</small>' +
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
    var result = document.getElementById('renal-result');
    var history = document.getElementById('renal-history');
    var drugSelect = document.getElementById('renal-drug');
    var clearButton = document.getElementById('renal-clear-history');

    if (!form) return;

    var renalCatalog = Array.isArray(data.renalAdjustment)
      ? data.renalAdjustment
      : [];

    var renalGrid = form.querySelector('.clinical-form-grid');

    if (renalGrid && !document.getElementById('renal-height')) {
      renalGrid.insertAdjacentHTML(
        'afterbegin',
        '<div class="clinical-field">' +
          '<label for="renal-his">Mã HIS (không nhập họ tên)</label>' +
          '<input id="renal-his" type="text" autocomplete="off" placeholder="Mã nội bộ nếu cần lưu vết">' +
        '</div>' +
        '<div class="clinical-field">' +
          '<label for="renal-height">Chiều cao (cm, tùy chọn)</label>' +
          '<input id="renal-height" type="number" min="40" max="250" step="0.1" placeholder="Nhập để dùng IBW/AdjBW của Module 2">' +
        '</div>'
      );

      var scrInput = document.getElementById('renal-scr');
      var scrField = scrInput ? scrInput.closest('.clinical-field') : null;

      if (scrField) {
        scrField.insertAdjacentHTML(
          'afterend',
          '<div class="clinical-field">' +
            '<label for="renal-scr-unit">Đơn vị creatinine</label>' +
            '<select id="renal-scr-unit">' +
              '<option value="mg-dl">mg/dL</option>' +
              '<option value="umol-l">µmol/L</option>' +
            '</select>' +
          '</div>' +
          '<label class="clinical-field clinical-check-field">' +
            '<span>Đang lọc máu</span>' +
            '<span><input id="renal-dialysis" type="checkbox"> HD/CRRT</span>' +
          '</label>'
        );
      }
    }

    if (drugSelect) {
      drugSelect.innerHTML = '<option value="">— Chọn thuốc —</option>';
      renalCatalog.forEach(function (drug) {
        var option = document.createElement('option');
        option.value = drug.name;
        option.textContent = drug.name;
        drugSelect.appendChild(option);
      });
    }

    renderHistory('renal', history);

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var age = number(fieldValue('renal-age'));
      var weight = number(fieldValue('renal-weight'));
      var height = number(fieldValue('renal-height'));
      var scrUnit = fieldValue('renal-scr-unit') || 'mg-dl';
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
        setResult(
          result,
          '<h3>Dữ liệu chưa hợp lệ</h3>' +
          '<p>Nhập tuổi từ 18 trở lên, cân nặng dương và creatinine huyết thanh &gt; 0.</p>',
          'is-error'
        );
        return;
      }

      var renalCore = null;
      var crcl = NaN;

      /*
       * Module 2 cần chiều cao để chọn IBW/AdjBW.
       */
      if (
        Number.isFinite(height) &&
        height > 0 &&
        typeof window.computeRenalCore === 'function'
      ) {
        try {
          renalCore = window.computeRenalCore(
            age,
            sex,
            height,
            weight,
            scr
          );

          if (
            renalCore &&
            Number.isFinite(Number(renalCore.crcl))
          ) {
            crcl = Number(renalCore.crcl);
          }
        } catch (error) {
          console.error('Lỗi Module 2 computeRenalCore:', error);
        }
      }

      /* fallback giữ công cụ hoạt động khi thiếu chiều cao/module */
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

      var dialysisNote = dialysisChecked
        ? '<p class="clinical-help"><strong>HD/CRRT:</strong> cần lịch lọc, loại màng, thời điểm dùng thuốc và phác đồ riêng; không dùng một giá trị CrCl/eGFR để tự động chốt liều.</p>'
        : '';

      var absoluteText = Number.isFinite(egfrAbsolute)
        ? '<div class="clinical-metric"><span>eGFR quy đổi theo BSA</span><strong>' + format(egfrAbsolute) + ' mL/phút</strong></div>'
        : '';

      var weightMethodText = '';
      var crclMethod = 'Cockcroft–Gault dự phòng dùng cân nặng thực';

      if (renalCore) {
        crclMethod = 'Module 2 · Cockcroft–Gault có hiệu chỉnh cân nặng';

        var weightParts = [];

        if (Number.isFinite(Number(renalCore.ibw))) {
          weightParts.push('IBW: ' + format(Number(renalCore.ibw), 1) + ' kg');
        }

        if (
          renalCore.isObese &&
          Number.isFinite(Number(renalCore.adjBW))
        ) {
          weightParts.push('AdjBW: ' + format(Number(renalCore.adjBW), 1) + ' kg');
        }

        if (Number.isFinite(Number(renalCore.crclWeight))) {
          weightParts.push(
            'Cân nặng tính CrCl: ' +
            format(Number(renalCore.crclWeight), 1) +
            ' kg'
          );
        }

        if (weightParts.length) {
          weightMethodText =
            '<p class="clinical-help"><strong>Hiệu chỉnh cân nặng:</strong> ' +
            escapeHtml(weightParts.join(' · ')) +
            '</p>';
        }
      } else if (!Number.isFinite(height)) {
        weightMethodText =
          '<p class="clinical-help"><strong>Module 2:</strong> chưa dùng IBW/AdjBW vì chưa nhập chiều cao; CrCl đang dùng công thức dự phòng với cân nặng thực.</p>';
      }

      var vancomycinBlock = '';
      if (drug && normalize(drug.name) === 'vancomycin') {
        vancomycinBlock = renderVancomycinModule2(
          weight,
          crcl,
          dialysisChecked
        );
      }

      setResult(
        result,
        '<h3>Kết quả ước tính</h3>' +
        '<div class="clinical-metrics">' +
          '<div class="clinical-metric"><span>CrCl Cockcroft–Gault</span><strong>' + format(crcl) + ' mL/phút</strong></div>' +
          '<div class="clinical-metric"><span>eGFR CKD-EPI 2021</span><strong>' + format(egfr) + ' mL/phút/1,73 m²</strong></div>' +
          absoluteText +
          '<div class="clinical-metric"><span>Nhóm cảnh báo</span><strong>' + escapeHtml(band) + '</strong></div>' +
        '</div>' +
        '<p class="clinical-help"><strong>Cách tính CrCl:</strong> ' + escapeHtml(crclMethod) + '</p>' +
        weightMethodText +
        '<p><strong>' + escapeHtml(drug ? drug.name : 'Thuốc chưa chọn') + ':</strong> ' + escapeHtml(advice) + '</p>' +
        vancomycinBlock +
        dialysisNote +
        '<p class="clinical-help">Creatinine đã được chuẩn hóa về mg/dL trước khi tính. CrCl và eGFR là hai ước tính khác nhau; quyết định liều phải theo tài liệu thuốc, TDM và quy trình bệnh viện.</p>',
        band === 'normal' ? 'is-success' : 'is-warning'
      );

      writeHistory('renal', {
        title: drug ? drug.name : 'Đánh giá chức năng thận',
        summary:
          'CrCl ' + format(crcl) +
          ' mL/phút · eGFR ' + format(egfr) +
          ' mL/phút/1,73 m²',
        time: nowText()
      });

      renderHistory('renal', history);
    });

    if (clearButton) {
      clearButton.addEventListener('click', function () {
        clearHistory('renal', history);
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
    var result = document.getElementById('pediatric-result');
    var history = document.getElementById('pediatric-history');
    var drugSelect = document.getElementById('pediatric-drug');
    var clearButton = document.getElementById('pediatric-clear-history');

    if (!form) return;

    var pediatricCatalog = Array.isArray(window.PEDIATRIC_ANTIBIOTICS)
      ? window.PEDIATRIC_ANTIBIOTICS
      : [];

    if (
      !pediatricCatalog.length ||
      typeof window.getPediatricDose !== 'function'
    ) {
      setResult(
        result,
        '<h3>Module Nhi chưa được nạp</h3>' +
        '<p>Không tìm thấy PEDIATRIC_ANTIBIOTICS/getPediatricDose từ module3-pediatric-dosing.js.</p>',
        'is-error'
      );
      return;
    }

    /*
     * Giữ phần MIC/PK-PD đang có của website.
     * MIC chỉ dùng để hiển thị mục tiêu phơi nhiễm, KHÔNG tự đổi liều.
     */
    var pediatricGrid = form.querySelector('.clinical-form-grid');
    var pkpdSelect = document.getElementById('pediatric-pkpd-target');

    if (pediatricGrid && !document.getElementById('pediatric-mic')) {
      pediatricGrid.insertAdjacentHTML(
        'beforeend',
        '<div class="clinical-field">' +
          '<label for="pediatric-mic">MIC (mg/L = µg/mL, tùy chọn)</label>' +
          '<input id="pediatric-mic" type="number" min="0.001" step="0.001" placeholder="Nhập kết quả kháng sinh đồ">' +
          '<small>MIC không tự động thay đổi liều nếu chưa có mô hình PK/TDM phù hợp.</small>' +
        '</div>' +
        '<div class="clinical-field">' +
          '<label for="pediatric-pkpd-target">Đích PK/PD theo MIC</label>' +
          '<select id="pediatric-pkpd-target"><option value="">— Chọn sau khi chọn thuốc —</option></select>' +
          '<small>Hiện dùng bộ mục tiêu beta-lactam đã có trong dữ liệu website.</small>' +
        '</div>'
      );

      pkpdSelect = document.getElementById('pediatric-pkpd-target');
    }

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
          option.textContent =
            drug.name +
            (drug.class ? ' — ' + drug.class : '');
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
      return !!(
        drug &&
        /beta[-\s]?lactam/i.test(String(drug.class || ''))
      );
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

    if (drugSelect) {
      drugSelect.addEventListener('change', renderPkpdTargets);
    }

    renderPkpdTargets();
    renderHistory('pediatric', history);

    function renderPediatricRow(row) {
      var calculated = pediatricDoseText(row.calculatedDose);

      var calculatedHtml = calculated
        ? '<br><strong>Liều theo cân nặng: ' + escapeHtml(calculated) + '</strong>'
        : '';

      var intervalHtml = row.interval
        ? '<br><span>Khoảng cách: ' + escapeHtml(row.interval) + '</span>'
        : '';

      var routeHtml = row.route
        ? '<br><span>Đường dùng: ' + escapeHtml(row.route) + '</span>'
        : '';

      var notesHtml = row.notes
        ? '<br><span class="clinical-help">' + escapeHtml(row.notes) + '</span>'
        : '';

      return (
        '<div class="clinical-check-item">' +
          '<strong>' + escapeHtml(row.label || 'Dòng liều phù hợp') + '</strong>' +
          '<br><span>Liều nguồn: ' + escapeHtml(row.dose || 'Không ghi') + '</span>' +
          calculatedHtml +
          intervalHtml +
          routeHtml +
          notesHtml +
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
        setResult(
          result,
          '<h3>Dữ liệu chưa hợp lệ</h3><p>Kiểm tra lại tuổi, tháng tuổi và cân nặng.</p>',
          'is-error'
        );
        return;
      }

      var totalMonths = years * 12 + months;

      if (years >= 18 || totalMonths >= 216) {
        setResult(
          result,
          '<h3>Không áp dụng</h3><p>Công cụ Nhi khóa bệnh nhân từ đủ 18 tuổi.</p>',
          'is-error'
        );
        return;
      }

      if (!drugId) {
        setResult(
          result,
          '<h3>Chưa chọn thuốc</h3><p>Chọn kháng sinh cần tính liều.</p>',
          'is-error'
        );
        return;
      }

      /*
       * Chỉ dùng PNA làm tuổi chính khi tuổi năm/tháng đang là 0.
       * Tránh trường hợp trẻ lớn nhưng PNA nhập nhầm làm bị phân loại thành sơ sinh.
       */
      var usePna = totalMonths === 0 && Number.isFinite(pna) && pna >= 0;

      if (totalMonths === 0 && !usePna) {
        setResult(
          result,
          '<h3>Thiếu tuổi sau sinh</h3><p>Trẻ dưới 1 tháng cần nhập PNA (ngày) để chọn đúng dòng liều sơ sinh.</p>',
          'is-error'
        );
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
        setResult(
          result,
          '<h3>Không thể tính</h3><p>Module liều Nhi phát sinh lỗi khi xử lý dữ liệu.</p>',
          'is-error'
        );
        return;
      }

      if (!calculation || !calculation.drug) {
        setResult(
          result,
          '<h3>Không tìm thấy thuốc</h3><p>Không tìm thấy thuốc trong Module 3.</p>',
          'is-error'
        );
        return;
      }

      var drug = calculation.drug;
      var patient = calculation.patient || {};

      /* khóa cứng Ceftriaxone ≤28 ngày */
      var ceftriaxone = /ceftriaxone/i.test(
        String(drug.id || '') + ' ' + String(drug.name || '')
      );

      if (
        ceftriaxone &&
        Number.isFinite(Number(patient.ageDays)) &&
        Number(patient.ageDays) <= 28
      ) {
        setResult(
          result,
          '<h3>⛔ Ceftriaxone bị khóa</h3>' +
          '<p>Không cho phép công cụ tự tính Ceftriaxone ở trẻ sơ sinh ≤28 ngày.</p>' +
          '<p class="clinical-help">Cần đối chiếu chống chỉ định, chế phẩm, calci tĩnh mạch, bilirubin và phác đồ của bệnh viện.</p>',
          'is-error'
        );
        return;
      }

      var matchingRows = (Array.isArray(calculation.rows) ? calculation.rows : [])
        .filter(function (row) { return row.isMatch; });

      var pma = NaN;
      if (
        usePna &&
        Number.isFinite(ga) &&
        Number.isFinite(pna)
      ) {
        pma = ga + pna / 7;
      }

      var pmaHtml = Number.isFinite(pma)
        ? '<div class="clinical-metric"><span>PMA</span><strong>' + format(pma, 1) + ' tuần</strong></div>'
        : '';

      var html =
        '<h3>' + escapeHtml(drug.name) + '</h3>' +
        '<div class="clinical-metrics">' +
          '<div class="clinical-metric"><span>Nhóm tuổi</span><strong>' + escapeHtml(patient.ageLabel || 'Chưa xác định') + '</strong></div>' +
          '<div class="clinical-metric"><span>Cân nặng</span><strong>' + format(weight, 2) + ' kg</strong></div>' +
          pmaHtml +
        '</div>';

      if (drug.class) {
        html += '<p><strong>Nhóm:</strong> ' + escapeHtml(drug.class) + '</p>';
      }

      if (matchingRows.length) {
        html += '<h4>Liều phù hợp với dữ liệu đã nhập</h4><div class="clinical-check-list">';
        matchingRows.forEach(function (row) {
          html += renderPediatricRow(row);
        });
        html += '</div>';
      } else {
        var specialRows = (Array.isArray(calculation.rows) ? calculation.rows : [])
          .filter(function (row) {
            return row.gaRequired || row.scrRequired;
          });

        html +=
          '<div class="clinical-note"><strong>Không tự động chọn được dòng liều.</strong><br>';

        if (specialRows.length) {
          html +=
            'Thuốc này có dòng liều phụ thuộc tuổi thai GA hoặc creatinine huyết thanh SCr. Công cụ không tự suy diễn khi thiếu điều kiện cần thiết.';
        } else {
          html += 'Không có dòng liều phù hợp với tuổi/cân nặng đã nhập.';
        }

        html += '</div>';

        if (specialRows.length) {
          html += '<h4>Các dòng cần đánh giá thêm</h4><div class="clinical-check-list">';
          specialRows.forEach(function (row) {
            html +=
              '<div class="clinical-check-item">' +
                '<strong>' + escapeHtml(row.label || 'Dòng liều') + '</strong>' +
                '<br>Liều nguồn: ' + escapeHtml(row.dose || '') +
                (row.interval ? '<br>Khoảng cách: ' + escapeHtml(row.interval) : '') +
                (row.route ? '<br>Đường dùng: ' + escapeHtml(row.route) : '') +
              '</div>';
          });
          html += '</div>';
        }
      }

      /* MIC/PK-PD giữ độc lập với phép tính liều */
      var micRaw = fieldValue('pediatric-mic');
      if (String(micRaw).trim() !== '') {
        var mic = number(micRaw);

        if (!Number.isFinite(mic) || mic <= 0) {
          setResult(
            result,
            '<h3>MIC chưa hợp lệ</h3><p>MIC phải là số lớn hơn 0 mg/L (tương đương µg/mL).</p>',
            'is-error'
          );
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
            '<div class="clinical-metrics clinical-metrics-secondary">' +
              '<div class="clinical-metric"><span>MIC</span><strong>' + format(mic, 3) + ' mg/L</strong></div>' +
              '<div class="clinical-metric"><span>Ngưỡng theo mục tiêu</span><strong>' + format(mic * target.multiple, 3) + ' mg/L</strong></div>' +
            '</div>' +
            '<p class="clinical-help"><strong>PK/PD:</strong> ' + escapeHtml(target.label) + '. Phần này chỉ hiển thị mục tiêu phơi nhiễm; không tự đổi liều nếu thiếu mô hình PK/TDM.</p>';
        } else {
          html +=
            '<p class="clinical-help"><strong>MIC:</strong> ' +
            format(mic, 3) +
            ' mg/L. Chưa có mục tiêu PK/PD cấu trúc cho thuốc này trong dữ liệu hiện tại.</p>';
        }
      }

      if (drug.maxDose) {
        html +=
          '<p class="clinical-help"><strong>Giới hạn liều ghi trong dữ liệu nguồn:</strong> ' +
          escapeHtml(drug.maxDose) +
          '</p>';
      }

      if (drug.citation) {
        html +=
          '<p class="clinical-source-note"><strong>Nguồn:</strong> ' +
          escapeHtml(drug.citation) +
          '</p>';
      }

      html +=
        '<p class="clinical-help"><strong>Quy tắc tính:</strong> mg/kg/ngày được giữ là tổng liều/ngày; mg/kg/lần hoặc mg/kg/liều được giữ là liều mỗi lần. Công cụ không tự coi tổng liều ngày là liều mỗi lần.</p>';

      setResult(
        result,
        html,
        matchingRows.length ? 'is-success' : 'is-warning'
      );

      writeHistory('pediatric', {
        title: drug.name,
        summary: matchingRows.length
          ? matchingRows.length + ' dòng liều phù hợp · ' + format(weight, 2) + ' kg'
          : 'Cần đánh giá thêm · ' + format(weight, 2) + ' kg',
        time: nowText()
      });

      renderHistory('pediatric', history);
    });

    if (clearButton) {
      clearButton.addEventListener('click', function () {
        clearHistory('pediatric', history);
      });
    }
  }

  /* =========================================================
   * MODULE 4 — PET/CT
   * ========================================================= */

  function setupPetTool() {
    var form = document.getElementById('pet-form');
    var result = document.getElementById('pet-result');
    var history = document.getElementById('pet-history');
    var select = document.getElementById('pet-nuclide');
    var targetInput = document.getElementById('pet-target');
    var factorInput = document.getElementById('pet-dose-factor');
    var unitSelect = document.getElementById('pet-dose-unit');
    var clearButton = document.getElementById('pet-clear-history');

    if (!form) return;

    var petApi = window.PETCT_DOSE_API;

    if (
      !petApi ||
      typeof petApi.getTracer !== 'function' ||
      typeof petApi.minutesBetween !== 'function' ||
      typeof petApi.decayFactor !== 'function' ||
      typeof petApi.calculateTargetActivity !== 'function' ||
      typeof petApi.calcPetctDose !== 'function' ||
      typeof petApi.mBqToMci !== 'function'
    ) {
      setResult(
        result,
        '<h3>Module PET/CT chưa được nạp đầy đủ</h3>' +
        '<p>Thiếu PETCT_DOSE_API hoặc một trong các hàm lõi của module4-petct-dose.js.</p>',
        'is-error'
      );
      return;
    }

    var petGrid = form.querySelector('.clinical-form-grid');

    if (petGrid && !document.getElementById('pet-weight')) {
      petGrid.insertAdjacentHTML(
        'afterbegin',
        '<div class="clinical-field">' +
          '<label for="pet-weight">Cân nặng (kg, tùy chọn)</label>' +
          '<input id="pet-weight" type="number" min="0.1" step="0.1" placeholder="Dùng khi tính theo hệ số/kg">' +
        '</div>' +
        '<div class="clinical-field">' +
          '<label for="pet-dose-factor">Hệ số liều</label>' +
          '<input id="pet-dose-factor" type="number" min="0.001" step="0.001" placeholder="Ví dụ 4.0 MBq/kg">' +
        '</div>' +
        '<div class="clinical-field">' +
          '<label for="pet-dose-unit">Đơn vị hệ số</label>' +
          '<select id="pet-dose-unit">' +
            '<option value="MBq/kg">MBq/kg</option>' +
            '<option value="mCi/kg">mCi/kg</option>' +
          '</select>' +
        '</div>'
      );

      targetInput = document.getElementById('pet-target');
      factorInput = document.getElementById('pet-dose-factor');
      unitSelect = document.getElementById('pet-dose-unit');
    }

    if (targetInput) {
      targetInput.removeAttribute('required');
      var targetField = targetInput.closest('.clinical-field');
      var targetLabel = targetField ? targetField.querySelector('label') : null;

      if (targetLabel) {
        targetLabel.textContent =
          'Hoạt độ đích tại lúc tiêm (MBq, có thể để trống nếu tính theo cân nặng)';
      }
    }

    if (select) {
      select.innerHTML = '<option value="">— Chọn dược chất —</option>';

      Object.keys(petApi.TRACER_DATA || {}).forEach(function (key) {
        var tracer = petApi.TRACER_DATA[key];
        var option = document.createElement('option');
        option.value = tracer.id || key;
        option.textContent =
          tracer.name + ' — T½ ' + tracer.halfLifeMin + ' phút';
        select.appendChild(option);
      });

      select.addEventListener('change', function () {
        var tracer = petApi.getTracer(select.value);
        if (!tracer) return;

        if (
          factorInput &&
          Number.isFinite(Number(tracer.midDoseMBqKg))
        ) {
          factorInput.value = tracer.midDoseMBqKg;
        }

        if (unitSelect) {
          unitSelect.value = 'MBq/kg';
        }
      });
    }

    renderHistory('pet', history);

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var tracer = petApi.getTracer(fieldValue('pet-nuclide'));

      if (!tracer) {
        setResult(
          result,
          '<h3>Chưa chọn dược chất</h3><p>Chọn đồng vị/dược chất phóng xạ trước khi tính.</p>',
          'is-error'
        );
        return;
      }

      var directTargetMBq = number(fieldValue('pet-target'));
      var weight = number(fieldValue('pet-weight'));
      var doseFactor = number(fieldValue('pet-dose-factor'));
      var doseUnit = fieldValue('pet-dose-unit') || 'MBq/kg';
      var residualMBq = number(fieldValue('pet-residual'));
      var stockActivityMBq = number(fieldValue('pet-stock-activity'));
      var stockVolumeMl = number(fieldValue('pet-stock-volume'));
      var calibrationTime = fieldValue('pet-calibration');
      var drawTime = fieldValue('pet-draw');
      var administrationTime = fieldValue('pet-administration');

      if (!Number.isFinite(residualMBq)) residualMBq = 0;

      if (residualMBq < 0) {
        setResult(
          result,
          '<h3>Dữ liệu chưa hợp lệ</h3><p>Hoạt độ tồn dư không được nhỏ hơn 0.</p>',
          'is-error'
        );
        return;
      }

      if (
        !Number.isFinite(stockActivityMBq) ||
        stockActivityMBq <= 0 ||
        !Number.isFinite(stockVolumeMl) ||
        stockVolumeMl <= 0
      ) {
        setResult(
          result,
          '<h3>Dữ liệu nguồn chưa hợp lệ</h3><p>Hoạt độ nguồn và thể tích nguồn phải lớn hơn 0.</p>',
          'is-error'
        );
        return;
      }

      var calibrationToDraw = petApi.minutesBetween(calibrationTime, drawTime);
      var drawToAdministration = petApi.minutesBetween(drawTime, administrationTime);

      if (!Number.isFinite(calibrationToDraw) || calibrationToDraw < 0) {
        setResult(
          result,
          '<h3>Thời gian chưa hợp lệ</h3><p>Thời điểm rút phải bằng hoặc sau thời điểm hiệu chuẩn.</p>',
          'is-error'
        );
        return;
      }

      if (!Number.isFinite(drawToAdministration) || drawToAdministration < 0) {
        setResult(
          result,
          '<h3>Thời gian chưa hợp lệ</h3><p>Thời điểm tiêm phải bằng hoặc sau thời điểm rút.</p>',
          'is-error'
        );
        return;
      }

      /* hoạt độ đích bệnh nhân */
      var targetMBq;
      var targetBasis;

      if (Number.isFinite(directTargetMBq) && directTargetMBq > 0) {
        targetMBq = directTargetMBq;
        targetBasis = 'Nhập trực tiếp: ' + format(directTargetMBq) + ' MBq';
      } else {
        var targetCalculation = petApi.calculateTargetActivity(
          weight,
          doseFactor,
          doseUnit
        );

        if (!targetCalculation || targetCalculation.error) {
          setResult(
            result,
            '<h3>Không thể xác định hoạt độ đích</h3><p>' +
            escapeHtml(targetCalculation && targetCalculation.error
              ? targetCalculation.error
              : 'Kiểm tra lại cân nặng và hệ số liều.') +
            '</p>',
            'is-error'
          );
          return;
        }

        targetMBq = Number(targetCalculation.targetMBq);
        targetBasis =
          format(weight, 1) + ' kg × ' +
          format(doseFactor, 3) + ' ' +
          escapeHtml(doseUnit);
      }

      /*
       * Nguồn được nhập tại thời điểm hiệu chuẩn.
       * Trước khi gọi calcPetctDose(), quy nguồn về thời điểm rút.
       */
      var stockDecayFactor = petApi.decayFactor(
        calibrationToDraw,
        tracer.halfLifeMin
      );

      if (!Number.isFinite(stockDecayFactor) || stockDecayFactor <= 0) {
        setResult(
          result,
          '<h3>Không thể tính phân rã nguồn</h3>',
          'is-error'
        );
        return;
      }

      var stockActivityAtDrawMBq = stockActivityMBq * stockDecayFactor;
      var concentrationAtDrawMBqMl = stockActivityAtDrawMBq / stockVolumeMl;
      var concentrationAtDrawMciMl = petApi.mBqToMci(concentrationAtDrawMBqMl);

      if (
        !Number.isFinite(concentrationAtDrawMciMl) ||
        concentrationAtDrawMciMl <= 0
      ) {
        setResult(
          result,
          '<h3>Không thể xác định nồng độ nguồn tại lúc rút</h3>',
          'is-error'
        );
        return;
      }

      /*
       * Hoạt độ trong bơm tại thời điểm tiêm phải gồm:
       * hoạt độ đích bệnh nhân + tồn dư dự kiến.
       */
      var syringeActivityAtAdministrationMBq = targetMBq + residualMBq;

      /*
       * GỌI TRỰC TIẾP HÀM LÕI MODULE 4.
       * Dùng weight=1 và doseFactor = tổng MBq cần có tại lúc tiêm
       * để calcPetctDose xử lý bù phân rã + thể tích rút.
       */
      var core;

      try {
        core = petApi.calcPetctDose({
          weightKg: 1,
          doseFactor: syringeActivityAtAdministrationMBq,
          doseUnit: 'MBqKg',
          halfLifeMin: tracer.halfLifeMin,
          waitMinutes: drawToAdministration,
          concentrationMciMl: concentrationAtDrawMciMl
        });
      } catch (error) {
        console.error('Lỗi Module 4 calcPetctDose:', error);
        setResult(
          result,
          '<h3>Không thể tính PET/CT</h3><p>Module 4 phát sinh lỗi khi xử lý dữ liệu.</p>',
          'is-error'
        );
        return;
      }

      if (!core || core.error) {
        setResult(
          result,
          '<h3>Không thể tính PET/CT</h3><p>' +
          escapeHtml(core && core.error ? core.error : 'Kết quả Module 4 không hợp lệ.') +
          '</p>',
          'is-error'
        );
        return;
      }

      var requiredAtDrawMBq = Number(
        core.drawNeededMBq != null
          ? core.drawNeededMBq
          : core.drawNeededMbq
      );
      var volumeToDrawMl = Number(core.volumeToDrawMl);
      var correctionFactor = Number(core.correctionFactor);

      if (
        !Number.isFinite(requiredAtDrawMBq) ||
        requiredAtDrawMBq <= 0 ||
        !Number.isFinite(volumeToDrawMl) ||
        volumeToDrawMl <= 0
      ) {
        setResult(
          result,
          '<h3>Kết quả Module 4 không hợp lệ</h3>',
          'is-error'
        );
        return;
      }

      if (volumeToDrawMl > stockVolumeMl) {
        setResult(
          result,
          '<h3>Không đủ nguồn để rút liều</h3>' +
          '<p>Thể tích cần rút (' + format(volumeToDrawMl, 3) + ' mL) lớn hơn thể tích nguồn hiện có (' + format(stockVolumeMl, 3) + ' mL).</p>',
          'is-error'
        );
        return;
      }

      var html =
        '<h3>Kết quả PET/CT — Module 4</h3>' +
        '<div class="clinical-metrics">' +
          '<div class="clinical-metric"><span>Hoạt độ đích bệnh nhân</span><strong>' + format(targetMBq) + ' MBq</strong></div>' +
          '<div class="clinical-metric"><span>Hoạt độ bơm tại lúc tiêm</span><strong>' + format(syringeActivityAtAdministrationMBq) + ' MBq</strong></div>' +
          '<div class="clinical-metric"><span>Hoạt độ cần lúc rút</span><strong>' + format(requiredAtDrawMBq) + ' MBq</strong></div>' +
          '<div class="clinical-metric"><span>Thể tích cần rút</span><strong>' + format(volumeToDrawMl, 3) + ' mL</strong></div>' +
        '</div>' +
        '<p><strong>Dược chất:</strong> ' + escapeHtml(tracer.name) +
          ' · <strong>T½:</strong> ' + format(tracer.halfLifeMin, 1) + ' phút</p>' +
        '<p><strong>Cơ sở hoạt độ đích:</strong> ' + targetBasis + '</p>' +
        '<p><strong>Nồng độ nguồn tại lúc rút:</strong> ' +
          format(concentrationAtDrawMBqMl, 3) +
          ' MBq/mL · <strong>Hệ số bù phân rã:</strong> ×' +
          format(correctionFactor, 3) +
        '</p>' +
        (residualMBq > 0
          ? '<p><strong>Tồn dư dự kiến:</strong> ' + format(residualMBq) + ' MBq — đã cộng vào hoạt độ bơm cần chuẩn bị.</p>'
          : '') +
        '<p class="clinical-help"><strong>Khoảng liều tham khảo trong Module 4:</strong> ' +
          escapeHtml(tracer.doseRange || '') +
          (tracer.indication ? ' · ' + escapeHtml(tracer.indication) : '') +
        '</p>' +
        '<p class="clinical-help">Phải kiểm tra hoạt độ thực tế bằng hoạt độ kế, thời gian thực, thể tích chết và hoạt độ tồn dư trước khi sử dụng.</p>';

      setResult(result, html, 'is-success');

      writeHistory('pet', {
        title: tracer.name + ' PET/CT',
        summary:
          format(volumeToDrawMl, 3) + ' mL · ' +
          format(targetMBq) + ' MBq đích',
        time: nowText()
      });

      renderHistory('pet', history);
    });

    if (clearButton) {
      clearButton.addEventListener('click', function () {
        clearHistory('pet', history);
      });
    }
  }

  /* =========================================================
   * API TƯƠNG THÍCH / KIỂM TRA TRẠNG THÁI MODULE
   * ========================================================= */

  function moduleStatus() {
    return {
      module1:
        typeof window.checkContraindicatedInteraction === 'function',
      module2:
        typeof window.computeRenalCore === 'function',
      module3:
        Array.isArray(window.PEDIATRIC_ANTIBIOTICS) &&
        typeof window.getPediatricDose === 'function',
      module4:
        !!(
          window.PETCT_DOSE_API &&
          typeof window.PETCT_DOSE_API.calcPetctDose === 'function'
        )
    };
  }

  var api = {
    normalize: normalize,
    findInteractions: findInteractions,
    findAllInteractions: findAllInteractions,
    calculateCrCl: calculateCrCl,
    calculateEgfr: calculateEgfr,
    calculateEgfrAbsolute: calculateEgfrAbsolute,
    convertCreatinine: convertCreatinine,
    renalBand: renalBand,
    moduleStatus: moduleStatus,
    module1: window.INTERACTIONS_CI_API || null,
    module2: window.RENAL_DOSING_API || null,
    module3: {
      catalog: window.PEDIATRIC_ANTIBIOTICS || [],
      getPediatricDose: window.getPediatricDose || null
    },
    module4: window.PETCT_DOSE_API || null,
    featuredTools: data.featuredTools || [],
    renderFeaturedTools: renderFeaturedTools
  };

  window.KHOA_DUOC_CLINICAL_TOOLS = api;

  document.addEventListener('DOMContentLoaded', function () {
    renderFeaturedTools();

    var tool = document.body.getAttribute('data-clinical-tool');

    if (tool === 'interaction') setupInteractionTool();
    if (tool === 'renal') setupRenalTool();
    if (tool === 'pediatric') setupPediatricTool();
    if (tool === 'pet') setupPetTool();
  });

}(window, document));
