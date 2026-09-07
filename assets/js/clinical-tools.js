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

  function setupInteractionTool() {
    var form = document.getElementById('interaction-form');
    var result = document.getElementById('interaction-result');
    var history = document.getElementById('interaction-history');
    var items = document.getElementById('interaction-list');
    if (!form) return;
    renderHistory('interaction', history);
    function renderRules(matches) {
      if (!matches.length) {
        setResult(result, '<h3>Chưa phát hiện trong bộ quy tắc đang tích hợp</h3><p>Điều này không đồng nghĩa là không có tương tác. Cơ sở dữ liệu hiện tại là bộ quy tắc có cấu trúc, chưa thay thế Micromedex/Lexicomp hoặc quy trình tra cứu của bệnh viện.</p>', 'is-success');
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
      var matches = findInteractions(first, second, data.interactions).map(function (rule) { return { first: first, second: second, rule: rule }; });
      renderRules(matches);
      writeHistory('interaction', { title: first + ' + ' + second, summary: matches.length ? matches.length + ' cảnh báo trong bộ quy tắc' : 'Chưa phát hiện trong bộ quy tắc', time: nowText() });
      renderHistory('interaction', history);
    });
    items.addEventListener('input', function () {
      var values = items.value.split(/\n|,|;/).map(function (value) { return value.trim(); }).filter(Boolean);
      var matches = findAllInteractions(values, data.interactions);
      if (values.length < 2) {
        setResult(result, '<h3>Chưa đủ dữ liệu</h3><p>Nhập từ hai thuốc trở lên, mỗi thuốc một dòng hoặc ngăn cách bằng dấu phẩy.</p>', 'is-warning');
      } else {
        renderRules(matches);
      }
    });
    document.getElementById('interaction-clear-history').addEventListener('click', function () { window.localStorage.removeItem(historyKey('interaction')); renderHistory('interaction', history); });
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
    data.renalAdjustment.forEach(function (drug) { var option = document.createElement('option'); option.value = drug.name; option.textContent = drug.name; drugSelect.appendChild(option); });
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
      var advice = drug ? drug.guidance[band] : 'Chọn một thuốc để xem cảnh báo theo nhóm chức năng thận.';
      var dialysis = document.getElementById('renal-dialysis');
      var dialysisNote = dialysis && dialysis.checked ? '<p class="clinical-help"><strong>HD/CRRT:</strong> cần lịch lọc, loại màng và phác đồ riêng; không dùng CrCl/eGFR để tự chốt liều.</p>' : '';
      var absoluteText = Number.isFinite(egfrAbsolute) ? '<div class="clinical-metric"><span>eGFR quy đổi theo BSA</span><strong>' + format(egfrAbsolute) + ' mL/phút</strong></div>' : '';
      setResult(result, '<h3>Kết quả ước tính</h3><div class="clinical-metrics"><div class="clinical-metric"><span>CrCl Cockcroft–Gault</span><strong>' + format(crcl) + ' mL/phút</strong></div><div class="clinical-metric"><span>eGFR CKD-EPI 2021</span><strong>' + format(egfr) + ' mL/phút/1,73 m²</strong></div>' + absoluteText + '<div class="clinical-metric"><span>Nhóm cảnh báo</span><strong>' + escapeHtml(band) + '</strong></div></div><p><strong>' + escapeHtml(drug ? drug.name : 'Thuốc chưa chọn') + ':</strong> ' + escapeHtml(advice) + '</p>' + dialysisNote + '<p class="clinical-help">Creatinine đã được quy đổi về mg/dL để tính. CrCl và eGFR là các ước tính khác nhau; quyết định liều phải theo đúng nhãn thuốc và quy trình bệnh viện.</p>', band === 'normal' ? 'is-success' : 'is-warning');
      writeHistory('renal', { title: (drug ? drug.name : 'Đánh giá chức năng thận'), summary: 'CrCl ' + format(crcl) + ' mL/phút · eGFR ' + format(egfr) + ' mL/phút/1,73 m²', time: nowText() });
      renderHistory('renal', history);
    });
    document.getElementById('renal-clear-history').addEventListener('click', function () { window.localStorage.removeItem(historyKey('renal')); renderHistory('renal', history); });
  }

  function setupPediatricTool() {
    var form = document.getElementById('pediatric-form');
    var result = document.getElementById('pediatric-result');
    var history = document.getElementById('pediatric-history');
    var drugSelect = document.getElementById('pediatric-drug');
    var pkpdSelect = document.getElementById('pediatric-pkpd-target');
    if (!form) return;
    var pediatricGrid = form.querySelector('.clinical-form-grid');
    if (pediatricGrid && !document.getElementById('pediatric-mic')) {
      pediatricGrid.insertAdjacentHTML('beforeend', '<div class="clinical-field"><label for="pediatric-mic">MIC (mg/L = µg/mL, tùy chọn)</label><input id="pediatric-mic" type="number" min="0.001" step="0.001" placeholder="Nhập kết quả kháng sinh đồ"><small>MIC là nồng độ ức chế tối thiểu; không tự suy ra liều nếu thiếu mô hình PK/TDM.</small></div><div class="clinical-field"><label for="pediatric-pkpd-target">Đích PK/PD theo MIC</label><select id="pediatric-pkpd-target"><option value="">— Chọn sau khi chọn thuốc —</option></select><small>Áp dụng cho nhóm beta-lactam đang có trong danh mục.</small></div>');
      pkpdSelect = document.getElementById('pediatric-pkpd-target');
    }
    data.pediatric.forEach(function (drug) { var option = document.createElement('option'); option.value = drug.id; option.textContent = drug.name + ' — ' + drug.basis; drugSelect.appendChild(option); });
    function renderPkpdTargets() {
      if (!pkpdSelect) return;
      pkpdSelect.innerHTML = '<option value="">— Chọn đích PK/PD —</option>';
      var drug = data.pediatric.find(function (item) { return item.id === drugSelect.value; });
      var targets = drug ? ((data.pediatricPkpd && data.pediatricPkpd[drug.pkpd]) || []) : [];
      targets.forEach(function (target) { var option = document.createElement('option'); option.value = target.id; option.textContent = target.label; pkpdSelect.appendChild(option); });
      pkpdSelect.disabled = !targets.length;
    }
    if (drugSelect) drugSelect.addEventListener('change', renderPkpdTargets);
    renderPkpdTargets();
    renderHistory('pediatric', history);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var calculation = calculatePediatric({ ageYears: fieldValue('pediatric-age-years'), ageMonths: fieldValue('pediatric-age-months'), pnaDays: fieldValue('pediatric-pna'), gaWeeks: fieldValue('pediatric-ga'), weight: fieldValue('pediatric-weight'), drug: fieldValue('pediatric-drug'), mic: fieldValue('pediatric-mic'), pkpdTarget: fieldValue('pediatric-pkpd-target') }, data.pediatric);
      if (calculation.error) { setResult(result, '<h3>Không thể tính tự động</h3><p>' + escapeHtml(calculation.error) + '</p>', 'is-error'); return; }
      var drug = calculation.drug;
      var pmaText = Number.isFinite(calculation.pma) ? format(calculation.pma, 1) + ' tuần' : 'chưa đủ dữ liệu';
      var micBlock = calculation.micAssessment ? '<div class="clinical-metrics clinical-metrics-secondary"><div class="clinical-metric"><span>MIC</span><strong>' + format(calculation.micAssessment.mic, 3) + ' mg/L</strong></div><div class="clinical-metric"><span>Ngưỡng cần đạt theo mục tiêu</span><strong>' + format(calculation.micAssessment.threshold, 3) + ' mg/L</strong></div></div><p class="clinical-help"><strong>PK/PD:</strong> ' + escapeHtml(calculation.micAssessment.target.label) + '. Đây là ngưỡng phơi nhiễm cần kiểm tra, không phải nồng độ huyết thanh đo được và không tự động thay thế quyết định liều.</p>' : '<p class="clinical-help">Có thể nhập MIC từ kháng sinh đồ để mở phần kiểm tra mục tiêu PK/PD.</p>';
      setResult(result, '<h3>Kết quả tham khảo có kiểm soát</h3><div class="clinical-metrics"><div class="clinical-metric"><span>Liều mỗi lần</span><strong>' + format(calculation.doseLow) + '–' + format(calculation.doseHigh) + ' mg</strong></div><div class="clinical-metric"><span>Tổng/ngày</span><strong>' + format(calculation.dailyLow) + '–' + format(calculation.dailyHigh) + ' mg</strong></div><div class="clinical-metric"><span>Tần suất</span><strong>' + drug.frequency + ' lần/ngày</strong></div></div>' + micBlock + '<p><strong>Cơ sở:</strong> ' + escapeHtml(drug.basis) + ' · <strong>PMA:</strong> ' + escapeHtml(pmaText) + '</p><p class="clinical-help">' + escapeHtml(drug.note) + '</p>', 'is-success');
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

  var api = { normalize: normalize, findInteractions: findInteractions, findAllInteractions: findAllInteractions, calculateCrCl: calculateCrCl, calculateEgfr: calculateEgfr, calculateEgfrAbsolute: calculateEgfrAbsolute, convertCreatinine: convertCreatinine, renalBand: renalBand, calculatePediatric: calculatePediatric, decay: decay, calculatePet: calculatePet };
  window.KHOA_DUOC_CLINICAL_TOOLS = api;

  document.addEventListener('DOMContentLoaded', function () {
    var tool = document.body.getAttribute('data-clinical-tool');
    if (tool === 'interaction') setupInteractionTool();
    if (tool === 'renal') setupRenalTool();
    if (tool === 'pediatric') setupPediatricTool();
    if (tool === 'pet') setupPetTool();
  });
}(window, document));
