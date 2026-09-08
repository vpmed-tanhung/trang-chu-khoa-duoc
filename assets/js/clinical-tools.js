(function (window, document) {
  'use strict';

  var data = window.KHOA_DUOC_CLINICAL_DATA || {};
  var historyPrefix = 'khoa-duoc-clinical-history:';

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function number(value) {
    var parsed = Number(String(value || '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function format(value, digits) {
    if (!Number.isFinite(value)) return '—';
    return value.toLocaleString('vi-VN', { maximumFractionDigits: digits == null ? 1 : digits });
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
    return new Date().toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  }

  function containsAlias(value, aliases) {
    var haystack = ' ' + normalize(value) + ' ';
    return aliases.some(function (alias) {
      var needle = normalize(alias);
      return needle && haystack.indexOf(' ' + needle + ' ') !== -1;
    });
  }

  function findInteractions(first, second, list) {
    var firstText = normalize(first);
    var secondText = normalize(second);
    if (!firstText || !secondText) return [];
    return (list || []).filter(function (rule) {
      var direct = containsAlias(firstText, rule.a) && containsAlias(secondText, rule.b);
      var reverse = containsAlias(firstText, rule.b) && containsAlias(secondText, rule.a);
      return direct || reverse;
    });
  }

  function findAllInteractions(items, list) {
    var results = [];
    for (var i = 0; i < items.length; i += 1) {
      for (var j = i + 1; j < items.length; j += 1) {
        findInteractions(items[i], items[j], list).forEach(function (rule) {
          results.push({ first: items[i], second: items[j], rule: rule });
        });
      }
    }
    return results;
  }

  function calculateCrCl(age, weight, serumCreatinine, sex) {
    var result = ((140 - age) * weight) / (72 * serumCreatinine);
    return sex === 'female' ? result * 0.85 : result;
  }

  function calculateEgfr(scr, age, sex) {
    var kappa = sex === 'female' ? 0.7 : 0.9;
    var alpha = sex === 'female' ? -0.241 : -0.302;
    var ratio = scr / kappa;
    var egfr = 142 * Math.pow(Math.min(ratio, 1), alpha) * Math.pow(Math.max(ratio, 1), -1.2) * Math.pow(0.9938, age);
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
    if (!Number.isFinite(egfrIndexed) || !Number.isFinite(heightCm) || !Number.isFinite(weightKg) || heightCm <= 0 || weightKg <= 0) return NaN;
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
    return (list || []).find(function (drug) {
      return normalize(drug.name) === normalized || containsAlias(normalized, drug.aliases);
    }) || null;
  }

  function calculatePediatric(input, catalog) {
    var ageYears = number(input.ageYears);
    var ageMonths = number(input.ageMonths) || 0;
    var weight = number(input.weight);
    var pnaDays = number(input.pnaDays);
    var gaWeeks = number(input.gaWeeks);
    var mic = number(input.mic);
    var drug = (catalog || []).find(function (item) { return item.id === input.drug; });
    if (!drug || !Number.isFinite(ageYears) || !Number.isFinite(weight) || weight <= 0) {
      return { error: 'Cần nhập tuổi và cân nặng hợp lệ, đồng thời chọn thuốc.' };
    }
    if (ageYears >= 18) return { error: 'Công cụ Nhi khóa bệnh nhân từ đủ 18 tuổi. Chuyển sang công cụ người lớn.' };
    if (ageYears < 0 || ageMonths < 0 || ageMonths > 11 || pnaDays < 0 || gaWeeks < 0) {
      return { error: 'Tuổi, PMA hoặc cân nặng không hợp lệ.' };
    }
    var totalMonths = ageYears * 12 + ageMonths;
    if (totalMonths === 0 && !Number.isFinite(pnaDays)) {
      return { error: 'Trẻ dưới 1 tháng cần nhập tuổi sau sinh PNA để kiểm tra các khóa an toàn.' };
    }
    var isNeonate = Number.isFinite(pnaDays) && pnaDays <= 28 && totalMonths === 0;
    var pma = Number.isFinite(gaWeeks) && Number.isFinite(pnaDays) ? gaWeeks + (pnaDays / 7) : NaN;
    if (drug.lockNeonate && isNeonate) {
      return { error: 'Đã khóa: Ceftriaxone không được tính tự động cho trẻ sơ sinh ≤28 ngày. Cần bác sĩ/dược sĩ kiểm tra chống chỉ định và phác đồ thay thế.' };
    }
    if (drug.requiresThreeMonths && totalMonths < 3) {
      return { error: 'Meropenem: dữ liệu nhãn trong công cụ này chỉ cho phép tính tự động từ đủ 3 tháng; trẻ nhỏ hơn cần phác đồ sơ sinh chuyên biệt.' };
    }
    var low = Math.min(drug.min, drug.max);
    var high = Math.max(drug.min, drug.max);
    var dailyLow;
    var dailyHigh;
    var doseLow;
    var doseHigh;
    if (drug.basis === 'mg/kg/ngày') {
      dailyLow = Math.min(low * weight, drug.maxDaily || Infinity);
      dailyHigh = Math.min(high * weight, drug.maxDaily || Infinity);
      doseLow = dailyLow / drug.frequency;
      doseHigh = dailyHigh / drug.frequency;
    } else {
      doseLow = Math.min(low * weight, drug.maxDose || Infinity);
      doseHigh = Math.min(high * weight, drug.maxDose || Infinity);
      dailyLow = doseLow * drug.frequency;
      dailyHigh = doseHigh * drug.frequency;
    }
    var micAssessment = null;
    if (String(input.mic || '').trim() !== '') {
      if (!Number.isFinite(mic) || mic <= 0) return { error: 'MIC phải là số lớn hơn 0 mg/L (tương đương µg/mL).' };
      var targets = (data.pediatricPkpd && data.pediatricPkpd[drug.pkpd]) || [];
      var target = targets.find(function (item) { return item.id === input.pkpdTarget; }) || targets[0];
      if (!target) return { error: 'Chưa có mục tiêu PK/PD theo MIC cho thuốc này; cần đối chiếu phác đồ bệnh viện.' };
      micAssessment = {
        mic: mic,
        target: target,
        threshold: mic * target.multiple,
        metric: drug.pkpd
      };
    }
    return { drug: drug, weight: weight, pma: pma, isNeonate: isNeonate, dailyLow: dailyLow, dailyHigh: dailyHigh, doseLow: doseLow, doseHigh: doseHigh, micAssessment: micAssessment };
  }

  function minutesBetween(start, end) {
    return (end.getTime() - start.getTime()) / 60000;
  }

  function decay(activity, elapsedMinutes, halfLife) {
    return activity * Math.pow(2, -elapsedMinutes / halfLife);
  }

  function calculatePet(input, radionuclides) {
    var nuclide = (radionuclides || []).find(function (item) { return item.id === input.nuclide; });
    var target = number(input.targetActivity);
    var weight = number(input.weight);
    var doseFactor = number(input.doseFactor);
    var doseUnit = input.doseUnit || 'MBq/kg';
    var targetBasis = 'nhập trực tiếp';
    if ((!Number.isFinite(target) || target <= 0) && Number.isFinite(weight) && weight > 0 && Number.isFinite(doseFactor) && doseFactor > 0) {
      target = weight * doseFactor * (doseUnit === 'mCi/kg' ? 37 : 1);
      targetBasis = weight + ' kg × ' + doseFactor + ' ' + doseUnit;
    }
    var residual = number(input.residualActivity) || 0;
    var stockActivity = number(input.stockActivity);
    var stockVolume = number(input.stockVolume);
    var calibration = new Date(input.calibrationTime);
    var draw = new Date(input.drawTime);
    var administration = new Date(input.administrationTime);
    if (!nuclide || !Number.isFinite(target) || target <= 0 || residual < 0 || !Number.isFinite(stockActivity) || stockActivity <= 0 || !Number.isFinite(stockVolume) || stockVolume <= 0 || Number.isNaN(calibration.getTime()) || Number.isNaN(draw.getTime()) || Number.isNaN(administration.getTime())) {
      return { error: 'Nhập đầy đủ hoạt độ đích, hoạt độ/ thể tích lọ hoặc bơm chuẩn và các mốc thời gian.' };
    }
    var drawElapsed = minutesBetween(calibration, draw);
    var administrationElapsed = minutesBetween(calibration, administration);
    var drawToAdministration = minutesBetween(draw, administration);
    if (drawElapsed < 0 || administrationElapsed < 0 || drawToAdministration < 0) {
      return { error: 'Thời gian phải theo thứ tự: hiệu chuẩn → rút thuốc → tiêm.' };
    }
    var syringeActivityAtAdministration = target + residual;
    var requiredAtDraw = syringeActivityAtAdministration * Math.pow(2, drawToAdministration / nuclide.halfLife);
    var stockActivityAtDraw = decay(stockActivity, drawElapsed, nuclide.halfLife);
    var concentrationAtDraw = stockActivityAtDraw / stockVolume;
    var volume = requiredAtDraw / concentrationAtDraw;
    var correctionFactor = Math.pow(2, drawToAdministration / nuclide.halfLife);
    return { nuclide: nuclide, target: target, targetBasis: targetBasis, residual: residual, syringeActivityAtAdministration: syringeActivityAtAdministration, requiredAtDraw: requiredAtDraw, stockActivityAtDraw: stockActivityAtDraw, concentrationAtDraw: concentrationAtDraw, volume: volume, correctionFactor: correctionFactor, drawElapsed: drawElapsed, drawToAdministration: drawToAdministration };
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
    try { window.localStorage.setItem(historyKey(tool), JSON.stringify(items.slice(0, 20))); } catch (error) { /* local storage may be unavailable */ }
  }

  function renderHistory(tool, target) {
    if (!target) return;
    var items = readHistory(tool);
    if (!items.length) {
      target.innerHTML = '<p class="clinical-history-empty">Chưa có lịch sử trên thiết bị này.</p>';
      return;
    }
    target.innerHTML = items.map(function (item) {
      return '<div class="clinical-history-item"><strong>' + escapeHtml(item.title) + '</strong><span>' + escapeHtml(item.summary) + '</span><span>' + escapeHtml(item.time) + '</span></div>';
    }).join('');
  }

  function setResult(target, html, state) {
    target.className = 'clinical-result' + (state ? ' ' + state : '');
    target.innerHTML = html;
  }

  function fieldValue(id) {
    var element = document.getElementById(id);
    return element ? element.value : '';
  }

  function vpmedInteractions() {
    return window.VPMED_INTERACTIONS || null;
  }

  function vpmedDrugProfiles() {
    return window.VPMED_DRUGS || null;
  }

  function interactionCanonicalMap() {
    var map = {};
    (vpmedDrugProfiles() || []).forEach(function (item) {
      if (item.brand) map[normalize(item.brand)] = item.active;
      if (item.active) map[normalize(item.active)] = item.active;
    });
    return map;
  }

  function interactionCanonical(value, map) {
    return map[normalize(value)] || String(value || '').trim();
  }

  function flexibleMatchInteraction(input, target, map) {
    var a = normalize(interactionCanonical(input, map));
    var b = normalize(interactionCanonical(target, map));
    if (!a || !b) return false;
    return a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
  }

  function matchInteractionPair(a, b, item, map) {
    var d1 = item.drug1 || '';
    var d2 = item.drug2 || '';
    return (flexibleMatchInteraction(a, d1, map) && flexibleMatchInteraction(b, d2, map)) ||
      (flexibleMatchInteraction(a, d2, map) && flexibleMatchInteraction(b, d1, map));
  }

  function renderInteractionCards(matches) {
    return matches.map(function (item) {
      var level = item.level || item.severity || '';
      var levelClass = /có điều kiện/i.test(level) ? 'is-warning' : 'is-error';
      return '<div class="clinical-result ' + levelClass + '"><h3>' + escapeHtml(level ? level.toUpperCase() : 'TƯƠNG TÁC') + (item.stt ? ' — #' + escapeHtml(item.stt) : '') + '</h3>'
        + '<p><strong>' + escapeHtml(item.drug1 || item.name || '') + '</strong>' + (item.drug2 ? ' + <strong>' + escapeHtml(item.drug2) + '</strong>' : '') + '</p>'
        + (item.mechanism ? '<p><strong>Cơ chế:</strong> ' + escapeHtml(item.mechanism) + '</p>' : '')
        + (item.consequence ? '<p><strong>Hậu quả:</strong> ' + escapeHtml(item.consequence) + '</p>' : '')
        + (item.management || item.advice ? '<p><strong>Xử trí:</strong> ' + escapeHtml(item.management || item.advice) + '</p>' : '')
        + (item.source ? '<p class="clinical-help">Nguồn: ' + escapeHtml(item.source) + '</p>' : '')
        + '</div>';
    }).join('');
  }

  function setupInteractionTool() {
    var form = document.getElementById('interaction-form');
    var result = document.getElementById('interaction-result');
    var history = document.getElementById('interaction-history');
    var items = document.getElementById('interaction-list');
    if (!form) return;
    renderHistory('interaction', history);
    var bigList = vpmedInteractions();
    var canonMap = interactionCanonicalMap();
    function renderRules(matches) {
      if (!matches.length) {
        if (bigList) {
          setResult(result, '<h3>Không thuộc 369 cặp Chống chỉ định (QĐ 5948)</h3><p>Công cụ này lọc chặt chẽ, chỉ giữ các cặp ở mức “Chống chỉ định”. Không thuộc danh mục này không đồng nghĩa là an toàn — vẫn cần kiểm tra tờ HDSD, chức năng gan thận và nguồn tương tác chuyên dụng.</p>', 'is-success');
          return;
        }
        setResult(result, '<h3>Chưa phát hiện trong bộ quy tắc đang tích hợp</h3><p>Điều này không đồng nghĩa là không có tương tác. Cơ sở dữ liệu hiện tại là bộ quy tắc có cấu trúc, chưa thay thế Micromedex/Lexicomp hoặc quy trình tra cứu của bệnh viện.</p>', 'is-success');
        return;
      }
      if (bigList) {
        setResult(result, renderInteractionCards(matches), 'is-warning');
        return;
      }
      setResult(result, matches.map(function (match) {
        var levelClass = match.rule.severity === 'cao' ? 'is-error' : 'is-warning';
        return '<div class="clinical-result ' + levelClass + '"><h3>' + escapeHtml(match.rule.severity.toUpperCase()) + ' — ' + escapeHtml(match.rule.title) + '</h3><p><strong>' + escapeHtml(match.first) + '</strong> + <strong>' + escapeHtml(match.second) + '</strong></p><p>' + escapeHtml(match.rule.advice) + '</p></div>';
      }).join(''), 'is-warning');
    }
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var first = fieldValue('interaction-first').trim();
      var second = fieldValue('interaction-second').trim();
      if (!first || !second) {
        setResult(result, '<h3>Chưa đủ dữ liệu</h3><p>Nhập tên hai thuốc để kiểm tra.</p>', 'is-error');
        return;
      }
      var matches;
      if (bigList) {
        matches = bigList.filter(function (item) { return matchInteractionPair(first, second, item, canonMap); });
      } else {
        matches = findInteractions(first, second, data.interactions).map(function (rule) { return { first: first, second: second, rule: rule }; });
      }
      renderRules(matches);
      writeHistory('interaction', { title: first + ' + ' + second, summary: matches.length ? matches.length + ' cảnh báo trong bộ quy tắc' : 'Chưa phát hiện trong bộ quy tắc', time: nowText() });
      renderHistory('interaction', history);
    });
    items.addEventListener('input', function () {
      var values = items.value.split(/\n|,|;/).map(function (value) { return value.trim(); }).filter(Boolean);
      var matches = bigList ? findAllVpmedInteractions(values, bigList, canonMap) : findAllInteractions(values, data.interactions);
      if (values.length < 2) {
        setResult(result, '<h3>Chưa đủ dữ liệu</h3><p>Nhập từ hai thuốc trở lên, mỗi thuốc một dòng hoặc ngăn cách bằng dấu phẩy.</p>', 'is-warning');
      } else {
        renderRules(matches);
      }
    });
    document.getElementById('interaction-clear-history').addEventListener('click', function () { window.localStorage.removeItem(historyKey('interaction')); renderHistory('interaction', history); });
    setupInteractionFullSearch(bigList);
  }

  function findAllVpmedInteractions(values, list, map) {
    var results = [];
    for (var i = 0; i < values.length; i += 1) {
      for (var j = i + 1; j < values.length; j += 1) {
        (list || []).filter(function (item) { return matchInteractionPair(values[i], values[j], item, map); }).forEach(function (item) {
          results.push(item);
        });
      }
    }
    return results;
  }

  function setupInteractionFullSearch(bigList) {
    var search = document.getElementById('interaction-full-search');
    var wrap = document.getElementById('interaction-full-list');
    var count = document.getElementById('interaction-full-count');
    if (!search || !wrap) return;
    if (!bigList) {
      wrap.innerHTML = '<p class="clinical-history-empty">Chưa tải được danh mục 633 cặp tương tác. Kiểm tra file assets/clinical-tools/vpmed-interactions.js.</p>';
      return;
    }
    function render() {
      var query = normalize(search.value);
      var items = bigList;
      if (query) {
        items = bigList.filter(function (item) {
          return normalize([item.stt, item.drug1, item.drug2, item.name, item.level, item.mechanism, item.consequence, item.management, item.source].join(' ')).indexOf(query) !== -1;
        });
      }
      if (count) count.textContent = items.length + '/' + bigList.length + ' cặp CHỐNG CHỈ ĐỊNH (Bảng 3.1 QĐ 5948/QĐ-BYT — đã lọc chặt, ẩn các cặp có điều kiện)';
      if (!items.length) {
        wrap.innerHTML = '<p class="clinical-history-empty">Không tìm thấy cặp tương tác khớp từ khóa. Điều này không khẳng định phối hợp an toàn.</p>';
        return;
      }
      wrap.innerHTML = renderInteractionCards(items.slice(0, 200));
    }
    search.addEventListener('input', render);
    render();
  }

  function crclBand(crcl) {
    if (crcl >= 50) return 0;
    if (crcl >= 30) return 1;
    if (crcl >= 15) return 2;
    return 3;
  }

  function egfrStage(egfr) {
    if (egfr >= 90) return { stage: 'G1', label: 'Bình thường hoặc cao' };
    if (egfr >= 60) return { stage: 'G2', label: 'Giảm nhẹ' };
    if (egfr >= 45) return { stage: 'G3a', label: 'Giảm nhẹ đến trung bình' };
    if (egfr >= 30) return { stage: 'G3b', label: 'Giảm trung bình đến nặng' };
    if (egfr >= 15) return { stage: 'G4', label: 'Giảm nặng' };
    return { stage: 'G5', label: 'Suy thận' };
  }

  function crclRiskShort(crcl) {
    if (crcl >= 90) return 'Bảo tồn';
    if (crcl >= 60) return 'Giảm nhẹ';
    if (crcl >= 30) return 'Giảm trung bình';
    if (crcl >= 15) return 'Giảm nặng';
    return 'Rất nặng';
  }

  function renderRenalWarning(drug) {
    if (!drug.warning) return '';
    var rows = [
      ['Tích lũy khi suy thận', drug.warning.accumulation],
      ['Độc tính thận', drug.warning.nephro],
      ['Độc tính thần kinh', drug.warning.neuro],
      ['TDM', drug.warning.tdm]
    ].map(function (pair) {
      return '<tr><th>' + escapeHtml(pair[0]) + '</th><td>' + escapeHtml(pair[1]) + '</td></tr>';
    }).join('');
    var monitoring = drug.warning.monitoring ? '<p class="clinical-help"><strong>Giám sát:</strong> ' + escapeHtml(drug.warning.monitoring) + '</p>' : '';
    return '<h3>Cảnh báo dược lâm sàng</h3><div class="clinical-table-wrap"><table class="clinical-table"><tbody>' + rows + '</tbody></table></div>' + monitoring;
  }

  function renderRenalDoseTable(drug, crcl) {
    if (!Array.isArray(drug.crcl) || !drug.crcl.length) return '';
    var index = crclBand(crcl);
    var rows = drug.crcl.map(function (band, i) {
      var mark = i === index ? ' <strong style="color:#8a5a00">(nhóm của bệnh nhân)</strong>' : '';
      var highlight = i === index ? ' style="background:#fff3d6"' : '';
      return '<tr' + highlight + '><td>' + escapeHtml(band.label) + mark + '</td><td>' + escapeHtml(band.dose) + '</td></tr>';
    }).join('');
    return '<h3>Liều theo chức năng thận (CrCl)</h3><div class="clinical-table-wrap"><table class="clinical-table"><thead><tr><th>Mức lọc cầu thận</th><th>Liều khuyến cáo</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function renderRenalDialysis(drug, dialysis) {
    if (!drug) return '';
    if (!dialysis) return '<p class="clinical-help"><strong>Lọc máu:</strong> nếu bệnh nhân đang chạy thận (HD) hoặc lọc máu liên tục (CRRT), tích chọn ở form để xem phác đồ liều riêng.</p>';
    var parts = [];
    if (drug.hd) {
      var hdRows = [
        ['Liều nạp', drug.hd.loading],
        ['Liều duy trì', drug.hd.maintenance],
        ['Sau buổi lọc', drug.hd.postHd]
      ].map(function (pair) {
        return '<tr><th>' + escapeHtml(pair[0]) + '</th><td>' + escapeHtml(pair[1] || '—') + '</td></tr>';
      }).join('');
      parts.push('<h3>Trong chạy thận ngắt quãng (HD)</h3><div class="clinical-table-wrap"><table class="clinical-table"><tbody>' + hdRows + '</tbody></table></div>' + (drug.hd.note ? '<p class="clinical-help">' + escapeHtml(drug.hd.note) + '</p>' : ''));
    }
    if (drug.crrt) {
      var crrtRows = [
        ['CVVH', drug.crrt.cvvh],
        ['CVVHD', drug.crrt.cvvhd],
        ['CVVHDF', drug.crrt.cvvhdf]
      ].map(function (pair) {
        return '<tr><th>' + escapeHtml(pair[0]) + '</th><td>' + escapeHtml(pair[1] || '—') + '</td></tr>';
      }).join('');
      parts.push('<h3>Trong lọc máu liên tục (CRRT)</h3><div class="clinical-table-wrap"><table class="clinical-table"><tbody>' + crrtRows + '</tbody></table></div>' + (drug.crrt.note ? '<p class="clinical-help">' + escapeHtml(drug.crrt.note) + '</p>' : ''));
    }
    return parts.join('');
  }

  function renderRenalTdm(drug) {
    if (!drug || !drug.tdm) return '';
    var tdmRows = [
      ['Chỉ số đích', drug.tdm.chi_so],
      ['Mục tiêu', drug.tdm.muc_tieu],
      ['Thời điểm lấy mẫu', drug.tdm.thoi_diem],
      ['Khuyến nghị', drug.tdm.khuyen_nghi]
    ].map(function (pair) {
      return '<tr><th>' + escapeHtml(pair[0]) + '</th><td>' + escapeHtml(pair[1] || '—') + '</td></tr>';
    }).join('');
    return '<h3>Giám sát điều trị (TDM)</h3><div class="clinical-table-wrap"><table class="clinical-table"><tbody>' + tdmRows + '</tbody></table></div>';
  }

  function renderRenalDetail(drug, crcl, dialysis) {
    if (!drug) return '<p>Chọn một thuốc để xem khuyến cáo chỉnh liều theo chức năng thận.</p>';
    var meta = [];
    if (drug.group) meta.push('Nhóm: ' + drug.group);
    if (drug.priority) meta.push('Mức ưu tiên: ' + drug.priority);
    if (drug.standardDose) meta.push('Liều chuẩn: ' + drug.standardDose);
    if (drug.requiresAdjustment) meta.push('Chỉnh liều khi suy thận: ' + drug.requiresAdjustment);
    if (drug.requiresTdm) meta.push('TDM: ' + drug.requiresTdm);
    return '<h3>' + escapeHtml(drug.name) + (drug.brand ? ' <small>(' + escapeHtml(drug.brand) + ')</small>' : '') + '</h3><p><strong>' + escapeHtml(meta.join(' · ')) + '</strong></p>'
      + renderRenalDoseTable(drug, crcl)
      + renderRenalDialysis(drug, dialysis)
      + renderRenalTdm(drug)
      + renderRenalWarning(drug);
  }

  function setupRenalTool() {
    var form = document.getElementById('renal-form');
    var result = document.getElementById('renal-result');
    var history = document.getElementById('renal-history');
    var drugSelect = document.getElementById('renal-drug');
    if (!form) return;
    var renalGrid = form.querySelector('.clinical-form-grid');
    if (renalGrid && !document.getElementById('renal-height')) {
      renalGrid.insertAdjacentHTML('afterbegin', '<div class="clinical-field"><label for="renal-his">Mã HIS (không nhập họ tên)</label><input id="renal-his" type="text" autocomplete="off" placeholder="Mã nội bộ nếu cần lưu vết"></div><div class="clinical-field"><label for="renal-height">Chiều cao (cm, tùy chọn)</label><input id="renal-height" type="number" min="40" max="250" step="0.1" placeholder="Dùng để quy đổi eGFR theo BSA"></div>');
      var scrField = document.getElementById('renal-scr').closest('.clinical-field');
      scrField.insertAdjacentHTML('afterend', '<div class="clinical-field"><label for="renal-scr-unit">Đơn vị creatinine</label><select id="renal-scr-unit"><option value="mg-dl">mg/dL</option><option value="umol-l">µmol/L</option></select></div><label class="clinical-field clinical-check-field"><span>Đang lọc máu</span><span><input id="renal-dialysis" type="checkbox"> HD/CRRT</span></label>');
    }
    data.renalAdjustment.forEach(function (drug) { var option = document.createElement('option'); option.value = drug.name; option.textContent = drug.name + (drug.brand ? ' (' + drug.brand + ')' : ''); drugSelect.appendChild(option); });
    renderHistory('renal', history);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var age = number(fieldValue('renal-age'));
      var weight = number(fieldValue('renal-weight'));
      var height = number(fieldValue('renal-height'));
      var scrUnit = fieldValue('renal-scr-unit') || 'mg-dl';
      var scr = convertCreatinine(fieldValue('renal-scr'), scrUnit);
      var sex = fieldValue('renal-sex');
      if (!Number.isFinite(age) || age < 18 || !Number.isFinite(weight) || weight <= 0 || !Number.isFinite(scr) || scr <= 0) {
        setResult(result, '<h3>Dữ liệu chưa hợp lệ</h3><p>Nhập tuổi từ 18 trở lên, cân nặng dương và creatinine huyết thanh &gt;0.</p>', 'is-error');
        return;
      }
      var crcl = calculateCrCl(age, weight, scr, sex);
      var egfr = calculateEgfr(scr, age, sex);
      var egfrAbsolute = calculateEgfrAbsolute(egfr, height, weight);
      var band = renalBand(crcl);
      var drug = findRenalDrug(fieldValue('renal-drug'), data.renalAdjustment);
      var dialysis = document.getElementById('renal-dialysis');
      var dialysisChecked = !!(dialysis && dialysis.checked);
      var absoluteText = Number.isFinite(egfrAbsolute) ? '<div class="clinical-metric"><span>eGFR quy đổi theo BSA</span><strong>' + format(egfrAbsolute) + ' mL/phút</strong></div>' : '';
      var stage = egfrStage(egfr);
      var riskText = '<div class="clinical-metrics clinical-metrics-secondary"><div class="clinical-metric"><span>Phân loại eGFR (CKD-EPI 2021)</span><strong>' + escapeHtml(stage.stage + ' — ' + stage.label) + '</strong></div><div class="clinical-metric"><span>Mức giảm theo CrCl</span><strong>' + escapeHtml(crclRiskShort(crcl)) + '</strong></div></div>';
      setResult(result, '<h3>Kết quả ước tính</h3><div class="clinical-metrics"><div class="clinical-metric"><span>CrCl Cockcroft–Gault</span><strong>' + format(crcl) + ' mL/phút</strong></div><div class="clinical-metric"><span>eGFR CKD-EPI 2021</span><strong>' + format(egfr) + ' mL/phút/1,73 m²</strong></div>' + absoluteText + '<div class="clinical-metric"><span>Nhóm cảnh báo</span><strong>' + escapeHtml(band) + '</strong></div></div>' + riskText + renderRenalDetail(drug, crcl, dialysisChecked) + '<p class="clinical-help">Creatinine đã được quy đổi về mg/dL để tính. CrCl và eGFR là các ước tính khác nhau; bảng liều là hướng dẫn sàng lọc theo CrCl, không thay thế nhãn thuốc, TDM hoặc phác đồ bệnh viện.</p>', band === 'normal' ? 'is-success' : 'is-warning');
      writeHistory('renal', { title: (drug ? drug.name : 'Đánh giá chức năng thận'), summary: 'CrCl ' + format(crcl) + ' mL/phút · eGFR ' + format(egfr) + ' mL/phút/1,73 m²', time: nowText() });
      renderHistory('renal', history);
    });
    document.getElementById('renal-clear-history').addEventListener('click', function () { window.localStorage.removeItem(historyKey('renal')); renderHistory('renal', history); });
  }

  function findDrugProfile(item) {
    var profiles = vpmedDrugProfiles();
    if (!profiles) return null;
    var name = normalize(item.name || '');
    var active = normalize(item.active || '');
    var byBrand = profiles.filter(function (p) { return normalize(p.brand || '') === name; })[0];
    if (byBrand) return byBrand;
    var byActive = profiles.filter(function (p) { return normalize(p.active || '') === active; })[0];
    if (byActive) return byActive;
    var loose = profiles.filter(function (p) {
      var b = normalize(p.brand || '');
      var a = normalize(p.active || '');
      return (b && name.indexOf(b) !== -1) || (b && b.indexOf(name) !== -1) || (a && active.indexOf(a) !== -1);
    })[0];
    return loose || null;
  }

  function profileRenalBands(renal) {
    var bands = [];
    var notes = [];
    (renal || []).forEach(function (line) {
      var match = String(line).match(/^(CrCl\s+[^:]+):\s*(.+)$/i);
      if (match) bands.push({ label: match[1], dose: match[2] });
      else if (String(line).trim()) notes.push(line);
    });
    return { bands: bands, notes: notes };
  }

  function profileInteractionMatches(profile) {
    var bigList = vpmedInteractions();
    if (!bigList || !profile) return [];
    var raw = normalize(String(profile.active || '').replace(/\*/g, '').replace(/hydrochloride/g, ''));
    var keys = raw.split(/\s+\+\s+/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 3; });
    var brand = normalize(profile.brand || '');
    return bigList.filter(function (item) {
      var z = normalize(item.name || '');
      return keys.some(function (k) { return z.indexOf(k) !== -1 || k.indexOf(z) !== -1; }) || (brand && z.indexOf(brand) !== -1);
    }).slice(0, 4);
  }

  function renderProfileDetail(profile) {
    if (!profile) return '<p class="clinical-history-empty">Sản phẩm này chưa có hồ sơ chi tiết trong bộ 34 hồ sơ nội trú.</p>';
    var renal = profileRenalBands(profile.renal);
    var renalTable = renal.bands.length
      ? '<div class="clinical-table-wrap"><table class="clinical-table"><thead><tr><th>CrCl</th><th>Liều</th></tr></thead><tbody>' + renal.bands.map(function (b) { return '<tr><td>' + escapeHtml(b.label) + '</td><td>' + escapeHtml(b.dose) + '</td></tr>'; }).join('') + '</tbody></table></div>'
      : '';
    var renalNotes = renal.notes.map(function (n) { return '<li>' + escapeHtml(n) + '</li>'; }).join('');
    var indications = (profile.indications || []).map(function (x) { return '<li>' + escapeHtml(x) + '</li>'; }).join('');
    var interactions = profileInteractionMatches(profile).map(function (x) { return '<li><strong>' + escapeHtml(x.name) + '</strong> (' + escapeHtml(x.level || '') + '): ' + escapeHtml(x.management || x.consequence || '') + '</li>'; }).join('');
    return '<div class="clinical-result is-warning"><h3>' + escapeHtml(profile.brand) + ' <small>' + escapeHtml(profile.active || '') + ' · ' + escapeHtml(profile.strength || '') + ' · ' + escapeHtml(profile.route || '') + '</small></h3>'
      + '<p><strong>Nhóm:</strong> ' + escapeHtml(profile.group || '—') + '</p>'
      + '<p><strong>Cơ chế:</strong> ' + escapeHtml(profile.mechanism || '—') + '</p>'
      + (indications ? '<p><strong>Chỉ định:</strong></p><ul class="clinical-list">' + indications + '</ul>' : '')
      + '<p><strong>PK/PD:</strong> ' + escapeHtml(profile.pkpd || '—') + '</p>'
      + '<p><strong>Liều chuẩn:</strong> ' + escapeHtml(profile.standard || '—') + '</p>'
      + (renalTable ? '<p><strong>Hiệu chỉnh theo CrCl:</strong></p>' + renalTable : '')
      + (renalNotes ? '<ul class="clinical-list">' + renalNotes + '</ul>' : '')
      + '<p><strong>HD:</strong> ' + escapeHtml(profile.hd || '—') + '</p>'
      + '<p><strong>CRRT:</strong> ' + escapeHtml(profile.crrt || '—') + '</p>'
      + '<p><strong>Pha truyền:</strong> ' + escapeHtml(profile.infusion || '—') + '</p>'
      + '<p><strong>Chống chỉ định/cảnh báo:</strong> ' + escapeHtml(profile.contra || '—') + '</p>'
      + '<p><strong>ADR quan trọng:</strong> ' + escapeHtml(profile.adr || '—') + '</p>'
      + '<p><strong>TDM/theo dõi:</strong> ' + escapeHtml(profile.tdm || '—') + '</p>'
      + (profile.notes ? '<p class="clinical-help">' + escapeHtml(profile.notes) + '</p>' : '')
      + (interactions ? '<p><strong>Tương tác cần rà soát (tối đa 4):</strong></p><ul class="clinical-list">' + interactions + '</ul>' : '')
      + '</div>';
  }

  function parseExpiryDate(text) {
    var m = String(text || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    var time = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
    return isFinite(time) ? time : null;
  }

  function formularyStockStatus(expiryArray, todayMs) {
    var today = todayMs != null ? todayMs : new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
    var lots = (expiryArray || []).map(function (text) {
      var time = parseExpiryDate(text);
      if (time == null) return { expiry: text, daysLeft: null, status: 'unknown' };
      var daysLeft = Math.floor((time - today) / 86400000);
      var status = daysLeft < 0 ? 'expired' : daysLeft < 180 ? 'soon' : 'ok';
      return { expiry: text, daysLeft: daysLeft, status: status };
    });
    var overall = 'ok';
    if (lots.some(function (l) { return l.status === 'expired'; })) overall = 'expired';
    else if (lots.some(function (l) { return l.status === 'soon'; })) overall = 'soon';
    else if (!lots.length || lots.every(function (l) { return l.status === 'unknown'; })) overall = 'unknown';
    return { lots: lots, lotCount: lots.length, overall: overall };
  }

  var formularyDetailIndex = -1;

  function setupFormularyTool() {
    var search = document.getElementById('formulary-search');
    var wrap = document.getElementById('formulary-wrap');
    var count = document.getElementById('formulary-count');
    if (!search || !wrap) return;
    var hasProfiles = !!vpmedDrugProfiles();
    var currentItems = [];
    function renderFormulary() {
      var query = normalize(search.value);
      var items = data.formulary || [];
      if (query) {
        items = items.filter(function (item) {
          var haystack = normalize(item.name + ' ' + item.active + ' ' + (item.strength || '') + ' ' + (item.route || ''));
          return haystack.indexOf(query) !== -1;
        });
      }
      currentItems = items;
      if (count) count.textContent = items.length + ' sản phẩm' + (query ? ' (khớp \u201c' + search.value + '\u201d)' : '/ ' + (data.formulary || []).length + ' sản phẩm') + (hasProfiles ? ' · bấm tên để xem hồ sơ chi tiết' : '');
      if (!items.length) {
        wrap.innerHTML = '<p class="clinical-history-empty">Không tìm thấy sản phẩm khớp tên trong danh mục nội trú.</p>';
        return;
      }
      var rows = items.slice(0, 200).map(function (item, i) {
        var stock = formularyStockStatus(item.expiry || []);
        var expiryText = stock.lots.map(function (lot) {
          if (lot.status === 'expired') return lot.expiry + ' (HẾT HẠN)';
          if (lot.status === 'soon') return lot.expiry + ' (còn ' + lot.daysLeft + ' ngày)';
          if (lot.status === 'ok') return lot.expiry + ' (còn ' + lot.daysLeft + ' ngày)';
          return lot.expiry;
        }).join('; ') || '—';
        var stockBadge = stock.overall === 'expired'
          ? '<br><strong style="color:#a12723">⛔ Có lô hết hạn</strong>'
          : stock.overall === 'soon'
            ? '<br><strong style="color:#8a5a00">⚠ Sắp hết hạn (&lt;180 ngày)</strong>'
            : '';
        var nameCell = hasProfiles
          ? '<button type="button" data-formulary-detail="' + i + '" style="background:none;border:0;padding:0;cursor:pointer;text-align:left"><strong style="text-decoration:underline">' + escapeHtml(item.name) + '</strong></button>'
          : '<strong>' + escapeHtml(item.name) + '</strong>';
        var detail = (formularyDetailIndex === i) ? '<tr><td colspan="5">' + renderProfileDetail(findDrugProfile(item)) + '</td></tr>' : '';
        return '<tr><td>' + nameCell + '<br><span style="color:var(--slate-600);font-size:0.76rem">' + escapeHtml(item.active) + '</span></td><td>' + escapeHtml(item.strength || '—') + '</td><td>' + escapeHtml(item.route || '—') + '</td><td>' + escapeHtml(item.packaging || '—') + '</td><td>' + escapeHtml(expiryText) + stockBadge + '<br><span style="color:var(--slate-600);font-size:0.76rem">' + stock.lotCount + ' lô</span></td></tr>' + detail;
      }).join('');
      wrap.innerHTML = '<div class="clinical-table-wrap"><table class="clinical-table"><thead><tr><th>Tên sản phẩm / Hoạt chất</th><th>Hàm lượng</th><th>Đường dùng</th><th>Quy cách</th><th>Hạn dùng / Tồn kho</th></tr></thead><tbody>' + rows + '</tbody></table></div><p class="clinical-help">Trạng thái HSD tính tại thời điểm mở trang (sắp hết hạn &lt;180 ngày). Dữ liệu hiện có số lô + HSD từng lô; chưa có số lượng tồn tuyệt đối và hạn mức min/max nên chưa hiển thị các mức này.</p>';
      Array.prototype.forEach.call(wrap.querySelectorAll('[data-formulary-detail]'), function (btn) {
        btn.addEventListener('click', function () {
          var idx = Number(btn.getAttribute('data-formulary-detail'));
          formularyDetailIndex = (formularyDetailIndex === idx) ? -1 : idx;
          renderFormulary();
        });
      });
    }
    search.addEventListener('input', function () { formularyDetailIndex = -1; renderFormulary(); });
    renderFormulary();
  }

  function vpmedNelson() {
    return window.VPMED_NELSON || null;
  }

  function nelsonPatientGroup(ageDays, months) {
    if (ageDays <= 60) return 'neonate';
    if (months < 12) return 'infant';
    return 'child';
  }

  function nelsonRowsMatch(rows, ageDays, months, weightKg) {
    var group = nelsonPatientGroup(ageDays, months);
    var matched = [];
    var skippedLab = 0;
    (rows || []).forEach(function (row) {
      if (row.scrRequired || row.gaRequired) { skippedLab += 1; return; }
      var rg = row.ageGroup || 'child';
      if (rg === 'neonate' && group !== 'neonate') return;
      if (rg === 'infant' && group !== 'infant') return;
      if (rg === 'child' && group === 'neonate') return;
      if (row.ageDays && (ageDays < row.ageDays[0] || ageDays > row.ageDays[1])) return;
      if (row.weightMax != null && weightKg > row.weightMax) return;
      if (row.weightMin != null && weightKg < row.weightMin) return;
      matched.push(row);
    });
    return { matched: matched, skippedLab: skippedLab };
  }

  function nelsonParseDose(doseStr) {
    var m = String(doseStr || '').match(/([\d.]+)\s*(?:–\s*([\d.]+))?\s*mg(?:\s+([^\/]+))?\/kg/i);
    if (!m) return null;
    var lo = parseFloat(m[1]);
    var hi = m[2] ? parseFloat(m[2]) : lo;
    if (!isFinite(lo)) return null;
    return { lo: lo, hi: hi, comp: m[3] ? m[3].trim() : null };
  }

  function nelsonParseIntervals(intervalStr) {
    return (String(intervalStr || '').match(/([\d.]+)/g) || []).map(Number).filter(isFinite);
  }

  function nelsonCalcRow(row, weightKg) {
    var parsed = nelsonParseDose(row.dose);
    if (!parsed) return null;
    var out = { dailyLo: parsed.lo * weightKg, dailyHi: parsed.hi * weightKg, comp: parsed.comp };
    var hours = nelsonParseIntervals(row.interval);
    var perDay = hours.map(function (h) { return h > 0 ? 24 / h : NaN; }).filter(isFinite);
    if (perDay.length) {
      var maxN = Math.max.apply(null, perDay);
      var minN = Math.min.apply(null, perDay);
      out.dosesPerDay = perDay;
      out.perDoseLo = out.dailyLo / maxN;
      out.perDoseHi = out.dailyHi / minN;
    }
    return out;
  }

  function nelsonMicThresholds(drug, rows) {
    var out = [];
    var texts = (rows || []).map(function (r) { return r.notes || ''; });
    if (drug.generalNotes) texts.push(drug.generalNotes);
    texts.join('\n').replace(/MIC\s*[≤<]\s*([\d.]+)/g, function (m, v) { out.push(parseFloat(v)); return m; });
    return out.filter(isFinite);
  }

  function nelsonPkpdTarget(drugClass) {
    var c = String(drugClass || '');
    if (/beta.lactam|penicillin|cephalosporin|carbapenem|monobactam/i.test(c)) return 'Beta-lactam: mục tiêu tham khảo 50–100% fT > MIC (nhiễm khuẩn nặng: 100% fT > 4×MIC).';
    if (/glycopeptide|vancomycin/i.test(c)) return 'Vancomycin: mục tiêu tham khảo AUC/MIC 400–600 (cần TDM).';
    if (/aminoglycoside|gentamicin|amikacin|tobramycin/i.test(c)) return 'Aminoglycoside: mục tiêu tham khảo Cmax/MIC 8–10 khi dùng liều 1 lần/ngày (cần TDM).';
    return 'Đối chiếu mục tiêu PK/PD theo nhóm thuốc, breakpoint và HDSD của đúng chế phẩm.';
  }

  function nelsonMicAssessment(thresholds, mic) {
    if (!isFinite(mic) || mic <= 0) return null;
    if (!thresholds.length) return { verdict: 'unknown', text: 'Đã nhập MIC ' + mic + ' mg/L. Phác đồ này không ghi ngưỡng MIC cụ thể — đối chiếu breakpoint và mục tiêu PK/PD trước khi chốt liều.' };
    var minT = Math.min.apply(null, thresholds);
    if (mic <= minT) return { verdict: 'ok', text: 'MIC ' + mic + ' mg/L ≤ ngưỡng ' + minT + ' mg/L của phác đồ — phù hợp để áp dụng.' };
    return { verdict: 'high', text: 'MIC ' + mic + ' mg/L vượt ngưỡng ' + minT + ' mg/L của phác đồ — cần hội chẩn, cân nhắc đổi thuốc hoặc tăng cường liều theo phác đồ đơn vị.' };
  }

  function renderNelsonResult(drug, matchRes, weightKg, mic) {
    var rows = matchRes.matched.map(function (row) {
      var calc = nelsonCalcRow(row, weightKg);
      var doseCell;
      if (!calc) {
        doseCell = escapeHtml(row.dose || '—') + '<br><span class="clinical-help">Không quy đổi tự động được — đối chiếu bảng gốc.</span>';
      } else {
        var unit = calc.comp ? ' mg ' + escapeHtml(calc.comp) : ' mg';
        var daily = (calc.dailyLo === calc.dailyHi ? format(calc.dailyLo, 1) : format(calc.dailyLo, 1) + '–' + format(calc.dailyHi, 1)) + unit + '/ngày';
        var perDose = '';
        if (calc.perDoseLo != null) {
          perDose = '<br><strong>Mỗi lần:</strong> ' + (calc.perDoseLo === calc.perDoseHi ? format(calc.perDoseLo, 1) : format(calc.perDoseLo, 1) + '–' + format(calc.perDoseHi, 1)) + unit + ' (' + escapeHtml(row.interval || '') + ')';
        }
        doseCell = '<strong>Tổng/ngày:</strong> ' + daily + perDose;
      }
      return '<tr><td><strong>' + escapeHtml(row.label || '') + '</strong>' + (row.notes ? '<br><span class="clinical-help">' + escapeHtml(row.notes.replace(/<[^>]+>/g, '')) + '</span>' : '') + '</td><td>' + escapeHtml(row.route || '—') + '</td><td>' + escapeHtml(row.dose || '—') + '</td><td>' + doseCell + '</td></tr>';
    }).join('');
    var micBlock = '';
    if (mic != null) {
      var verdict = nelsonMicAssessment(nelsonMicThresholds(drug, matchRes.matched), mic);
      if (verdict) {
        micBlock = '<div class="clinical-result ' + (verdict.verdict === 'high' ? 'is-error' : verdict.verdict === 'ok' ? 'is-success' : 'is-warning') + '"><h3>Đánh giá theo MIC (' + escapeHtml(mic) + ' mg/L)</h3><p>' + escapeHtml(verdict.text) + '</p><p class="clinical-help">' + escapeHtml(nelsonPkpdTarget(drug.drugClass)) + '</p></div>';
      }
    } else {
      micBlock = '<p class="clinical-help">Nhập MIC từ kháng sinh đồ để đánh giá sự phù hợp của phác đồ. ' + escapeHtml(nelsonPkpdTarget(drug.drugClass)) + '</p>';
    }
    return '<h3>' + escapeHtml(drug.name) + ' <small>(Nelson 2026 — ' + escapeHtml(drug.source === 'ch2' ? 'Sơ sinh' : 'Nhi khoa') + ')</small></h3>'
      + '<div class="clinical-table-wrap"><table class="clinical-table"><thead><tr><th>Phác đồ</th><th>Đường dùng</th><th>Liều mg/kg/ngày (bảng gốc)</th><th>Liều quy đổi theo cân nặng</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + micBlock
      + (matchRes.skippedLab ? '<p class="clinical-help">Đã bỏ qua ' + matchRes.skippedLab + ' hàng liều phân tầng theo creatinin/tuổi thai — các hàng này cần bác sĩ/dược sĩ chọn thủ công theo xét nghiệm.</p>' : '')
      + (drug.maxDose ? '<p><strong>Liều tối đa:</strong> ' + escapeHtml(drug.maxDose) + '</p>' : '')
      + (drug.generalNotes ? '<p><strong>Ghi chú:</strong> ' + escapeHtml(drug.generalNotes.replace(/<[^>]+>/g, '')) + '</p>' : '')
      + (drug.indications ? '<p><strong>Chỉ định:</strong> ' + escapeHtml(drug.indications) + '</p>' : '')
      + (drug.citation ? '<p class="clinical-help">Nguồn bảng liều: ' + escapeHtml(drug.citation) + '</p>' : '');
  }

  var pediatricConditionalRuleIds = ['high-dose', 'meningitis', 'appendicitis', 'synergy', 'serious', 'febrile-neutropenia-young', 'febrile-neutropenia-older', 'cystic-fibrosis', 'ntm', 'aom-sinusitis', 'pharyngitis-tonsillitis', 'severe'];

  function pediatricRuleKind(rule) {
    if (pediatricConditionalRuleIds.indexOf(rule.id) !== -1 || pediatricConditionalRuleIds.indexOf(rule.regimen) !== -1) return 'conditional';
    if (rule.id === 'enteral' || rule.id === 'iv') return 'route';
    return 'baseline';
  }

  function pediatricRuleMatchesAge(rule, ageMonths) {
    return (rule.minAgeMonths == null || ageMonths >= rule.minAgeMonths) && (rule.maxAgeMonths == null || ageMonths <= rule.maxAgeMonths);
  }

  function pediatricNeonatalMatches(rule, pma, pna) {
    return (rule.minPmaWeeks == null || pma >= rule.minPmaWeeks) &&
      (rule.maxPmaWeeks == null || pma <= rule.maxPmaWeeks) &&
      (rule.minPnaDays == null || pna >= rule.minPnaDays) &&
      (rule.maxPnaDays == null || pna <= rule.maxPnaDays);
  }

  function pediatricEligibleRules(drug, context) {
    var rules = context.mode === 'neonate'
      ? (drug.neonatalRules || []).filter(function (rule) { return pediatricNeonatalMatches(rule, context.pma, context.days); })
      : (drug.childRules || []).filter(function (rule) { return pediatricRuleMatchesAge(rule, context.months); });
    var priority = { baseline: 0, route: 1, conditional: 2 };
    return rules.map(function (rule, index) { return { rule: rule, index: index, kind: pediatricRuleKind(rule) }; })
      .sort(function (a, b) { return priority[a.kind] - priority[b.kind] || a.index - b.index; });
  }

  function pediatricRuleLabel(drug, rule, mode) {
    if (rule.label) return rule.label;
    if (mode === 'neonate' && rule.regimen) {
      var regimen = (drug.neonatalRegimens || []).filter(function (item) { return item.id === rule.regimen; })[0];
      if (regimen) return regimen.label;
    }
    return mode === 'neonate' ? 'Liều Sơ sinh theo PMA và tuổi sau sinh' : 'Liều theo tuổi';
  }

  function pediatricClinicalProfile(store, drug, rule, mode) {
    var group = (store.clinicalProfiles && store.clinicalProfiles[drug.id]) || {};
    var base = group.default || {
      indication: 'Nhiễm khuẩn do tác nhân nhạy cảm khi kháng sinh này phù hợp với chẩn đoán và quy trình của đơn vị.',
      criteria: 'Xác nhận bệnh cảnh, dị ứng, chức năng gan–thận, bệnh phẩm và kháng sinh đồ trước khi áp dụng.',
      sources: []
    };
    var key = rule.id || rule.regimen || '';
    var specific = (group.rules && group.rules[key]) || {};
    var ids = (specific.sources || base.sources || []).slice();
    return {
      indication: specific.indication || base.indication,
      criteria: specific.criteria || base.criteria,
      sources: ids.map(function (id) { return store.clinicalSources && store.clinicalSources[id]; }).filter(Boolean)
    };
  }

  function pediatricSourceText(source) {
    var parts = [source.title || 'Nguồn đối chiếu'];
    if (source.type) parts.push(source.type);
    if (source.scope) parts.push(source.scope);
    if (source.organization) parts.push(source.organization);
    return parts.join(' — ');
  }

  function pediatricVerifiedSources(drug) {
    var injectables = vpmedInjectables();
    if (!injectables) return [];
    var codes = {};
    (drug.stockCodes || []).forEach(function (code) { codes[code] = true; });
    var out = [];
    var seen = {};
    injectables.filter(function (item) { return codes[item.code] && item.status === 'verified_exact'; }).forEach(function (item) {
      (item.sources || []).forEach(function (source) {
        var scope = String(source.scope || '');
        if (/khác SĐK/i.test(scope)) return;
        if (!/(hoàn nguyên|pha loãng|dung môi|ổn định|cách dùng|thời gian truyền)/i.test(scope)) return;
        var key = source.title || '';
        if (!key || seen[key]) return;
        seen[key] = true;
        out.push(source);
      });
    });
    return out;
  }

  function calculatePediatricVpmed(store, input) {
    var drug = (store.drugs || []).filter(function (item) { return item.id === input.drug; })[0];
    var weight = Number(input.weight);
    if (!drug) return { error: 'Không tìm thấy kháng sinh đã chọn trong bảng liều Nhi mở rộng.' };
    if (!isFinite(weight) || weight < 0.2 || weight > 200) return { error: 'Cân nặng phải trong khoảng 0,2–200 kg.' };
    var months = input.months;
    var days = input.days;
    var pma = input.pma;
    if (!isFinite(months) || months < 0) return { error: 'Hãy nhập tuổi từ 0 trở lên.' };
    if (months > 216) return { error: 'Công cụ chỉ áp dụng đến 18 tuổi.' };
    var mode = null;
    if (isFinite(pma) && pma >= 20 && pma <= 44) mode = 'neonate';
    else if (months < 1) mode = 'neonate';
    else mode = 'child';
    if (mode === 'neonate' && !(isFinite(pma) && pma >= 20 && pma <= 44)) {
      return { error: 'Trẻ dưới 1 tháng tuổi cần nhập tuổi thai lúc sinh và tuổi sau sinh để tính PMA (20–44 tuần) và tra bảng liều Sơ sinh.', mode: mode };
    }
    var context = { mode: mode, months: months, days: days, pma: pma };
    var matches = pediatricEligibleRules(drug, context);
    if (!matches.length) return { error: 'Không có quy tắc liều phù hợp với tuổi/PMA đã nhập trong nguồn tính liều.', mode: mode, drug: drug };
    var loading = (mode === 'neonate' && drug.neonatalLoadingDoseMgKg) ? weight * drug.neonatalLoadingDoseMgKg : null;
    return { drug: drug, mode: mode, context: context, matches: matches, loading: loading, weight: weight };
  }

  function renderPediatricVpmed(store, calc) {
    var kindLabels = { baseline: 'Liều nền theo tuổi', route: 'Theo đường dùng', conditional: 'Lựa chọn đặc biệt' };
    var cards = calc.matches.map(function (entry) {
      var rule = entry.rule;
      var rawDose = calc.weight * rule.doseMgKg;
      var finalDose = rule.maxMg ? Math.min(rawDose, rule.maxMg) : rawDose;
      var capped = !!(rule.maxMg && rawDose > rule.maxMg);
      var clinical = pediatricClinicalProfile(store, calc.drug, rule, calc.mode);
      var sources = (clinical.sources || []).map(function (s) { return '<li>' + escapeHtml(pediatricSourceText(s)) + '</li>'; }).join('');
      var note = [rule.note, entry.kind === 'conditional' ? 'Chỉ áp dụng khi bệnh cảnh đã được xác định và phù hợp với hướng dẫn điều trị của đơn vị.' : ''].filter(Boolean).join(' ');
      return '<div class="clinical-result is-success"><h3>' + escapeHtml(pediatricRuleLabel(calc.drug, rule, calc.mode)) + ' <small>(' + escapeHtml(kindLabels[entry.kind]) + ')</small></h3>'
        + '<div class="clinical-metrics"><div class="clinical-metric"><span>Liều mỗi lần</span><strong>' + format(finalDose, 1) + ' mg</strong></div>'
        + '<div class="clinical-metric"><span>Khoảng cách</span><strong>Mỗi ' + escapeHtml(rule.intervalHours) + ' giờ</strong></div>'
        + '<div class="clinical-metric"><span>Cơ sở</span><strong>' + format(rule.doseMgKg, 1) + ' mg/kg/lần</strong></div></div>'
        + '<p><strong>Đường dùng:</strong> ' + escapeHtml(rule.route || 'Theo nguồn/nhãn') + (rule.maxMg ? ' · <strong>Tối đa:</strong> ' + format(rule.maxMg, 0) + ' mg/lần' : '') + '</p>'
        + (capped ? '<p class="clinical-help"><strong>Đã giới hạn</strong> từ ' + format(rawDose, 1) + ' mg xuống liều tối đa của nguồn.</p>' : '')
        + (note ? '<p>' + escapeHtml(note) + '</p>' : '')
        + '<p><strong>Bệnh cảnh áp dụng:</strong> ' + escapeHtml(clinical.indication) + '</p>'
        + '<p><strong>Chỉ chuyển sang mức này khi:</strong> ' + escapeHtml(clinical.criteria) + '</p>'
        + (sources ? '<p><strong>Nguồn đối chiếu (tra cứu thủ công theo tên tài liệu):</strong></p><ul class="clinical-list">' + sources + '</ul>' : '')
        + '</div>';
    }).join('');
    var loading = calc.loading != null ? '<p><strong>Liều nạp Sơ sinh:</strong> ' + format(calc.loading, 1) + ' mg.</p>' : '';
    var verified = pediatricVerifiedSources(calc.drug).map(function (s) { return '<li>' + escapeHtml(pediatricSourceText(s)) + '</li>'; }).join('');
    return '<h3>' + escapeHtml(calc.drug.name) + ' — ' + escapeHtml(calc.mode === 'neonate' ? 'Bảng Sơ sinh' : 'Bảng Nhi khoa') + '</h3>' + loading + cards
      + (verified ? '<p><strong>Nguồn pha/bảo quản đúng chế phẩm (tra cứu thủ công theo tên tài liệu):</strong></p><ul class="clinical-list">' + verified + '</ul>' : '');
  }

  function setupPediatricTool() {
    var form = document.getElementById('pediatric-form');
    var result = document.getElementById('pediatric-result');
    var history = document.getElementById('pediatric-history');
    var drugSelect = document.getElementById('pediatric-drug');
    var pkpdSelect = document.getElementById('pediatric-pkpd-target');
    if (!form) return;
    var store = vpmedPediatric();
    var nelson = vpmedNelson();
    function currentSource() {
      var el = document.getElementById('pediatric-source');
      return el ? el.value : (store ? 'vpmed' : 'legacy');
    }
    function isLegacySelection() {
      return currentSource() === 'legacy';
    }
    function legacyId() {
      return String(drugSelect.value || '').replace(/^legacy:/, '');
    }
    function nelsonId() {
      return String(drugSelect.value || '').replace(/^nls:/, '');
    }
    var pediatricGrid = form.querySelector('.clinical-form-grid');
    if (pediatricGrid && !document.getElementById('pediatric-source')) {
      pediatricGrid.insertAdjacentHTML('afterbegin', '<div class="clinical-field full"><label for="pediatric-source">Nguồn bảng liều</label><select id="pediatric-source"></select></div>');
    }
    if (pediatricGrid && !document.getElementById('pediatric-mic')) {
      pediatricGrid.insertAdjacentHTML('beforeend', '<div class="clinical-field" data-mic-block><label for="pediatric-mic">MIC (mg/L = µg/mL, tùy chọn)</label><input id="pediatric-mic" type="number" min="0.001" step="0.001" placeholder="Nhập kết quả kháng sinh đồ"><small>MIC là nồng độ ức chế tối thiểu; dùng để đánh giá sự phù hợp phác đồ theo ngưỡng PK/PD.</small></div><div class="clinical-field" data-mic-block data-pkpd-block><label for="pediatric-pkpd-target">Đích PK/PD theo MIC</label><select id="pediatric-pkpd-target"><option value="">— Chọn sau khi chọn thuốc —</option></select><small>Áp dụng cho nhóm beta-lactam đang có trong danh mục.</small></div>');
      pkpdSelect = document.getElementById('pediatric-pkpd-target');
    }
    function refreshSourceOptions() {
      var sel = document.getElementById('pediatric-source');
      if (!sel) return;
      var prev = sel.value;
      var opts = [];
      if (store) opts.push({ value: 'vpmed', text: 'Bảng kho nội trú (16 thuốc)' });
      if (nelson) opts.push({ value: 'nelson', text: 'Nelson 2026 (100 phác đồ)' });
      opts.push({ value: 'legacy', text: 'Bảng cơ bản (3 thuốc)' });
      sel.innerHTML = opts.map(function (o) { return '<option value="' + o.value + '">' + escapeHtml(o.text) + '</option>'; }).join('');
      sel.value = opts.some(function (o) { return o.value === prev; }) ? prev : opts[0].value;
    }
    function refreshDrugOptions() {
      var src = currentSource();
      var prev = drugSelect.value;
      var list = [];
      if (src === 'nelson' && nelson) {
        list = nelson.map(function (d) { return { value: 'nls:' + d.id, text: d.name + (d.source === 'ch2' ? ' (Sơ sinh)' : ' (Nhi)') }; });
      } else if (src === 'vpmed' && store) {
        list = (store.drugs || []).map(function (d) { return { value: d.id, text: d.name + ' (' + (d.stock || []).length + ' thuốc kho)' }; });
      } else {
        list = data.pediatric.map(function (d) { return { value: 'legacy:' + d.id, text: d.name + ' — ' + d.basis }; });
      }
      drugSelect.innerHTML = '<option value="">— Chọn thuốc —</option>' + list.map(function (o) { return '<option value="' + escapeHtml(o.value) + '">' + escapeHtml(o.text) + '</option>'; }).join('');
      var stillThere = list.some(function (o) { return o.value === prev; });
      if (stillThere) drugSelect.value = prev;
      toggleMicBlocks();
      renderPkpdTargets();
    }
    function toggleMicBlocks() {
      var showPkpd = isLegacySelection();
      Array.prototype.forEach.call(form.querySelectorAll('[data-pkpd-block]'), function (el) { el.style.display = showPkpd ? '' : 'none'; });
    }
    function renderPkpdTargets() {
      if (!pkpdSelect) return;
      pkpdSelect.innerHTML = '<option value="">— Chọn đích PK/PD —</option>';
      var drug = isLegacySelection()
        ? data.pediatric.filter(function (item) { return item.id === legacyId(); })[0]
        : null;
      var targets = drug ? ((data.pediatricPkpd && data.pediatricPkpd[drug.pkpd]) || []) : [];
      targets.forEach(function (target) { var option = document.createElement('option'); option.value = target.id; option.textContent = target.label; pkpdSelect.appendChild(option); });
      pkpdSelect.disabled = !targets.length;
    }
    refreshSourceOptions();
    refreshDrugOptions();
    var sourceSel = document.getElementById('pediatric-source');
    if (sourceSel) sourceSel.addEventListener('change', refreshDrugOptions);
    if (drugSelect) drugSelect.addEventListener('change', function () { toggleMicBlocks(); renderPkpdTargets(); });
    renderHistory('pediatric', history);
    function patientContext() {
      var ageYears = number(fieldValue('pediatric-age-years')) || 0;
      var ageMonths = number(fieldValue('pediatric-age-months')) || 0;
      var pnaDays = number(fieldValue('pediatric-pna'));
      var gaWeeks = number(fieldValue('pediatric-ga'));
      var months = ageYears * 12 + ageMonths;
      var days = Number.isFinite(pnaDays) ? pnaDays : months * 30.4375;
      var pma = (Number.isFinite(gaWeeks) && Number.isFinite(pnaDays)) ? gaWeeks + pnaDays / 7 : NaN;
      return { months: months, days: days, pma: pma, weight: number(fieldValue('pediatric-weight')), mic: number(fieldValue('pediatric-mic')) };
    }
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var ctx = patientContext();
      var src = currentSource();
      if (src === 'nelson' && nelson) {
        var drug = nelson.filter(function (d) { return d.id === nelsonId(); })[0];
        if (!drug) { setResult(result, '<h3>Không thể tính tự động</h3><p>Chưa chọn phác đồ Nelson.</p>', 'is-error'); return; }
        if (!isFinite(ctx.weight) || ctx.weight < 0.2 || ctx.weight > 200) { setResult(result, '<h3>Không thể tính tự động</h3><p>Cân nặng phải trong khoảng 0,2–200 kg.</p>', 'is-error'); return; }
        if (!isFinite(ctx.months) || ctx.months < 0 || ctx.months > 216) { setResult(result, '<h3>Không thể tính tự động</h3><p>Tuổi phải trong khoảng 0–216 tháng (đến 18 tuổi).</p>', 'is-error'); return; }
        var matchRes = nelsonRowsMatch(drug.dosingRows, ctx.days, ctx.months, ctx.weight);
        if (!matchRes.matched.length) { setResult(result, '<h3>Không thể tính tự động</h3><p>Không có hàng liều Nelson phù hợp với tuổi/cân nặng đã nhập.</p>', 'is-error'); return; }
        var mic = Number.isFinite(ctx.mic) && ctx.mic > 0 ? ctx.mic : null;
        setResult(result, '<h3>Kết quả liều Nhi (Nelson 2026) — phân biệt mg/kg/ngày và mg/kg/lần</h3><p><strong>Bệnh nhân:</strong> ' + format(ctx.months, 1) + ' tháng tuổi · ' + format(ctx.weight, 2) + ' kg</p>' + renderNelsonResult(drug, matchRes, ctx.weight, mic) + '<p class="clinical-help">Liều tính theo cân nặng thực tế; đối chiếu chỉ định, dị ứng, chức năng gan–thận và kháng sinh đồ trước khi áp dụng.</p>', 'is-success');
        var firstCalc = nelsonCalcRow(matchRes.matched[0], ctx.weight);
        writeHistory('pediatric', { title: drug.name + ' (Nelson)', summary: firstCalc ? format(firstCalc.dailyLo, 1) + ' mg/ngày' : matchRes.matched[0].label, time: nowText() });
        renderHistory('pediatric', history);
        return;
      }
      if (src === 'vpmed' && store && !isLegacySelection()) {
        var calculation = calculatePediatricVpmed(store, { drug: fieldValue('pediatric-drug'), weight: ctx.weight, months: ctx.months, days: ctx.days, pma: ctx.pma });
        if (calculation.error) { setResult(result, '<h3>Không thể tính tự động</h3><p>' + escapeHtml(calculation.error) + '</p>', 'is-error'); return; }
        var mic = Number.isFinite(ctx.mic) && ctx.mic > 0 ? ctx.mic : null;
        var micNote = '';
        if (mic != null) {
          var thresholds = [];
          calculation.matches.forEach(function (entry) {
            (entry.rule.note || '').replace(/MIC\s*[≤<]\s*([\d.]+)/g, function (m, v) { thresholds.push(parseFloat(v)); return m; });
          });
          var verdict = nelsonMicAssessment(thresholds, mic);
          if (verdict) micNote = '<div class="clinical-result ' + (verdict.verdict === 'high' ? 'is-error' : verdict.verdict === 'ok' ? 'is-success' : 'is-warning') + '"><h3>Đánh giá theo MIC (' + escapeHtml(mic) + ' mg/L)</h3><p>' + escapeHtml(verdict.text) + '</p><p class="clinical-help">' + escapeHtml(nelsonPkpdTarget(calculation.drug.id)) + '</p></div>';
        }
        setResult(result, '<h3>Kết quả liều Nhi theo bảng tuổi/PMA</h3>' + renderPediatricVpmed(store, calculation) + micNote + '<p class="clinical-help">Liều tính theo cân nặng thực tế; đối chiếu chỉ định, dị ứng, chức năng gan–thận và kháng sinh đồ trước khi áp dụng.</p>', 'is-success');
        var firstRule = calculation.matches[0].rule;
        writeHistory('pediatric', { title: calculation.drug.name, summary: format(calculation.weight * firstRule.doseMgKg, 1) + ' mg/lần · mỗi ' + firstRule.intervalHours + ' giờ', time: nowText() });
        renderHistory('pediatric', history);
        return;
      }
      var calculation = calculatePediatric({ ageYears: fieldValue('pediatric-age-years'), ageMonths: fieldValue('pediatric-age-months'), pnaDays: fieldValue('pediatric-pna'), gaWeeks: fieldValue('pediatric-ga'), weight: fieldValue('pediatric-weight'), drug: legacyId(), mic: fieldValue('pediatric-mic'), pkpdTarget: fieldValue('pediatric-pkpd-target') }, data.pediatric);
      if (calculation.error) { setResult(result, '<h3>Không thể tính tự động</h3><p>' + escapeHtml(calculation.error) + '</p>', 'is-error'); return; }
      var drug = calculation.drug;
      var pmaText = Number.isFinite(calculation.pma) ? format(calculation.pma, 1) + ' tuần' : 'chưa đủ dữ liệu';
      var micBlock = calculation.micAssessment ? '<div class="clinical-metrics clinical-metrics-secondary"><div class="clinical-metric"><span>MIC</span><strong>' + format(calculation.micAssessment.mic, 3) + ' mg/L</strong></div><div class="clinical-metric"><span>Ngưỡng cần đạt theo mục tiêu</span><strong>' + format(calculation.micAssessment.threshold, 3) + ' mg/L</strong></div></div><p class="clinical-help"><strong>PK/PD:</strong> ' + escapeHtml(calculation.micAssessment.target.label) + '. Đây là ngưỡng phơi nhiễm cần kiểm tra, không phải nồng độ huyết thanh đo được và không tự động thay thế quyết định liều.</p>' : '<p class="clinical-help">Có thể nhập MIC từ kháng sinh đồ để mở phần kiểm tra mục tiêu PK/PD.</p>';
      setResult(result, '<h3>Kết quả tham khảo có kiểm soát</h3><div class="clinical-metrics"><div class="clinical-metric"><span>Liều mỗi lần</span><strong>' + format(calculation.doseLow) + '–' + format(calculation.doseHigh) + ' mg</strong></div><div class="clinical-metric"><span>Tổng/ngày</span><strong>' + format(calculation.dailyLow) + '–' + format(calculation.dailyHigh) + ' mg/ngày</strong></div><div class="clinical-metric"><span>Tần suất</span><strong>' + drug.frequency + ' lần/ngày</strong></div></div>' + micBlock + '<p><strong>Cơ sở:</strong> ' + escapeHtml(drug.basis) + ' · <strong>PMA:</strong> ' + escapeHtml(pmaText) + '</p><p class="clinical-help">' + escapeHtml(drug.note) + '</p>', 'is-success');
      writeHistory('pediatric', { title: drug.name, summary: format(calculation.doseLow) + '–' + format(calculation.doseHigh) + ' mg/lần · ' + format(calculation.dailyLow) + '–' + format(calculation.dailyHigh) + ' mg/ngày', time: nowText() });
      renderHistory('pediatric', history);
    });
    document.getElementById('pediatric-clear-history').addEventListener('click', function () { window.localStorage.removeItem(historyKey('pediatric')); renderHistory('pediatric', history); });
  }

  function setupPetTool() {
    var form = document.getElementById('pet-form');
    var result = document.getElementById('pet-result');
    var history = document.getElementById('pet-history');
    var select = document.getElementById('pet-nuclide');
    var targetInput = document.getElementById('pet-target');
    var factorInput = document.getElementById('pet-dose-factor');
    var unitSelect = document.getElementById('pet-dose-unit');
    if (!form) return;
    var petGrid = form.querySelector('.clinical-form-grid');
    if (petGrid && !document.getElementById('pet-weight')) {
      petGrid.insertAdjacentHTML('afterbegin', '<div class="clinical-field"><label for="pet-weight">Cân nặng (kg, tùy chọn)</label><input id="pet-weight" type="number" min="0.1" step="0.1" placeholder="Dùng khi tính theo hệ số/kg"></div><div class="clinical-field"><label for="pet-dose-factor">Hệ số liều (tùy chọn)</label><input id="pet-dose-factor" type="number" min="0.001" step="0.001" placeholder="Ví dụ 4,0 MBq/kg"></div><div class="clinical-field"><label for="pet-dose-unit">Đơn vị hệ số</label><select id="pet-dose-unit"><option value="MBq/kg">MBq/kg</option><option value="mCi/kg">mCi/kg</option></select></div>');
      targetInput = document.getElementById('pet-target');
      factorInput = document.getElementById('pet-dose-factor');
      unitSelect = document.getElementById('pet-dose-unit');
    }
    if (targetInput) {
      targetInput.removeAttribute('required');
      var targetLabel = targetInput.closest('.clinical-field').querySelector('label');
      if (targetLabel) targetLabel.textContent = 'Hoạt độ đích tại lúc tiêm (MBq, tùy chọn nếu nhập cân nặng × hệ số)';
    }
    data.radionuclides.forEach(function (item) { var option = document.createElement('option'); option.value = item.id; option.textContent = item.name + ' — T½ ' + item.halfLife + ' phút'; select.appendChild(option); });
    select.addEventListener('change', function () {
      var nuclide = data.radionuclides.find(function (item) { return item.id === select.value; });
      if (nuclide && factorInput && nuclide.defaultDoseFactor) factorInput.value = nuclide.defaultDoseFactor;
      if (nuclide && unitSelect && nuclide.defaultDoseUnit) unitSelect.value = nuclide.defaultDoseUnit;
    });
    renderHistory('pet', history);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var calculation = calculatePet({ nuclide: fieldValue('pet-nuclide'), targetActivity: fieldValue('pet-target'), weight: fieldValue('pet-weight'), doseFactor: fieldValue('pet-dose-factor'), doseUnit: fieldValue('pet-dose-unit'), residualActivity: fieldValue('pet-residual'), stockActivity: fieldValue('pet-stock-activity'), stockVolume: fieldValue('pet-stock-volume'), calibrationTime: fieldValue('pet-calibration'), drawTime: fieldValue('pet-draw'), administrationTime: fieldValue('pet-administration') }, data.radionuclides);
      if (calculation.error) { setResult(result, '<h3>Không thể tính</h3><p>' + escapeHtml(calculation.error) + '</p>', 'is-error'); return; }
      setResult(result, '<h3>Kết quả hiệu chỉnh phân rã</h3><div class="clinical-metrics"><div class="clinical-metric"><span>Hoạt độ cần tại lúc tiêm</span><strong>' + format(calculation.syringeActivityAtAdministration) + ' MBq</strong></div><div class="clinical-metric"><span>Hoạt độ cần lúc rút</span><strong>' + format(calculation.requiredAtDraw) + ' MBq</strong></div><div class="clinical-metric"><span>Thể tích cần rút</span><strong>' + format(calculation.volume, 3) + ' mL</strong></div></div><p>Cơ sở hoạt độ đích: <strong>' + escapeHtml(calculation.targetBasis) + '</strong>. Nồng độ nguồn tại lúc rút: <strong>' + format(calculation.concentrationAtDraw, 3) + ' MBq/mL</strong> · Hệ số bù phân rã: <strong>×' + format(calculation.correctionFactor, 3) + '</strong>.</p><p class="clinical-help">Kiểm tra lại hoạt độ thực tế bằng thiết bị đo, sai số thời gian, thể tích chết và hoạt độ tồn dư trước khi tiêm.</p>', 'is-success');
      writeHistory('pet', { title: calculation.nuclide.name + ' PET/CT', summary: format(calculation.volume, 3) + ' mL · ' + format(calculation.syringeActivityAtAdministration) + ' MBq tại lúc tiêm', time: nowText() });
      renderHistory('pet', history);
    });
    document.getElementById('pet-clear-history').addEventListener('click', function () { window.localStorage.removeItem(historyKey('pet')); renderHistory('pet', history); });
  }

  var api = { normalize: normalize, findInteractions: findInteractions, findAllInteractions: findAllInteractions, calculateCrCl: calculateCrCl, calculateEgfr: calculateEgfr, calculateEgfrAbsolute: calculateEgfrAbsolute, convertCreatinine: convertCreatinine, renalBand: renalBand, crclBand: crclBand, egfrStage: egfrStage, crclRiskShort: crclRiskShort, matchInteractionPair: matchInteractionPair, findAllVpmedInteractions: findAllVpmedInteractions, calculatePediatric: calculatePediatric, calculatePediatricVpmed: calculatePediatricVpmed, nelsonRowsMatch: nelsonRowsMatch, nelsonCalcRow: nelsonCalcRow, nelsonMicThresholds: nelsonMicThresholds, nelsonMicAssessment: nelsonMicAssessment, nelsonPkpdTarget: nelsonPkpdTarget, formularyStockStatus: formularyStockStatus, decay: decay, calculatePet: calculatePet };
  window.KHOA_DUOC_CLINICAL_TOOLS = api;

  document.addEventListener('DOMContentLoaded', function () {
    var tool = document.body.getAttribute('data-clinical-tool');
    if (tool === 'interaction') setupInteractionTool();
    if (tool === 'renal') setupRenalTool();
    if (tool === 'pediatric') setupPediatricTool();
    if (tool === 'pet') setupPetTool();
    if (document.getElementById('formulary-wrap')) setupFormularyTool();
  });
}(window, document));
