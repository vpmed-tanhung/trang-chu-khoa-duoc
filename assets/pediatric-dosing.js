(function () {
  'use strict';

  var ACTION = 'calculate_pediatric_antibiotic';
  var DRUGS = [
    'Amoxicillin/clavulanate', 'Ampicillin', 'Ampicillin/sulbactam', 'Ceftriaxone', 'Cefotaxime',
    'Ceftazidime', 'Cefepime', 'Cefixime', 'Cefpodoxime', 'Piperacillin/tazobactam', 'Meropenem',
    'Imipenem/cilastatin', 'Gentamicin', 'Amikacin', 'Vancomycin', 'Co-trimoxazole',
    'Doxycycline', 'Tetracycline', 'Ciprofloxacin', 'Levofloxacin'
  ];

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char];
    });
  }

  function numberOrNull(value) {
    if (value === '' || value == null) return null;
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function ageMonths(value, unit) {
    var factors = {day: 1 / 30.4375, month: 1, year: 12};
    return Number(value) * factors[unit];
  }

  function statusLabel(status) {
    return status === 'VALID' ? 'HỢP LỆ CÓ ĐIỀU KIỆN' : status === 'WARNING' ? 'CẦN RÀ SOÁT' : 'LỖI NGHIÊM TRỌNG';
  }

  function init() {
    var host = document.getElementById('stockPediatricTool');
    if (!host || host.querySelector('#pediatricPkPdModule')) return;
    var module = document.createElement('section');
    module.id = 'pediatricPkPdModule';
    module.className = 'section-card pediatric-pkpd-module';
    module.innerHTML = [
      '<div class="section-heading"><div><span class="kicker">PK/PD · MIC · Adult Max Dose Cap</span><h2>Tính liều kháng sinh Nhi khoa chuẩn hóa</h2><p>Phép tính tức thời chỉ để sàng lọc. Kết quả xác nhận áp dụng khóa trần liều người lớn và kiểm tra chống chỉ định theo tuổi.</p></div></div>',
      '<div class="pediatric-pkpd-grid">',
      '<form id="pediatricPkPdForm" class="pediatric-pkpd-form" novalidate>',
      '<div class="pediatric-field-grid">',
      '<label>Cân nặng (kg)<input id="pedPkWeight" type="number" min="0.2" max="200" step="0.01" required></label>',
      '<label>Tuổi sau sinh<span class="pediatric-age-input"><input id="pedPkAge" type="number" min="0" step="0.1" required><select id="pedPkAgeUnit"><option value="day">Ngày</option><option value="month" selected>Tháng</option><option value="year">Năm</option></select></span></label>',
      '<label class="pediatric-check"><input id="pedPkNeonate" type="checkbox"> Sơ sinh (&lt; 28 ngày)</label>',
      '<label>GA (tuần)<input id="pedPkGa" type="number" min="20" max="44" step="1" placeholder="Bắt buộc nếu sơ sinh"></label>',
      '<label>PNA (ngày)<input id="pedPkPna" type="number" min="0" max="60" step="1" placeholder="Bắt buộc nếu sơ sinh"></label>',
      '<label>Kháng sinh<select id="pedPkDrug" required>' + DRUGS.map(function (drug) { return '<option>' + esc(drug) + '</option>'; }).join('') + '</select></label>',
      '<label class="pediatric-wide">Chỉ định<input id="pedPkIndication" type="text" maxlength="240" required placeholder="Ví dụ: viêm màng não do vi khuẩn"></label>',
      '<label>Liều cơ bản (mg/kg/ngày)<input id="pedPkBaseDose" type="number" min="0" step="0.1" placeholder="Xem trước tức thời"></label>',
      '<label>Nồng độ sau pha (mg/mL)<input id="pedPkConcentration" type="number" min="0.001" step="0.001" placeholder="Ví dụ 25 = 125 mg/5 mL"></label>',
      '<label>Tổng liều đang kê (mg/ngày)<input id="pedPkCurrentDose" type="number" min="0" step="0.1"></label>',
      '<label>MIC (mg/L)<input id="pedPkMic" type="number" min="0" step="0.01"></label>',
      '<label>Chủng vi khuẩn<input id="pedPkPathogen" type="text" maxlength="160" placeholder="Ví dụ: P. aeruginosa"></label>',
      '<label>Mức độ nhiễm khuẩn<select id="pedPkSeverity"><option value="mild">Nhẹ</option><option value="moderate" selected>Trung bình</option><option value="severe">Nặng</option><option value="septic shock">Sốc nhiễm khuẩn</option><option value="neutropenia">Hạ bạch cầu</option></select></label>',
      '<label>AUC24 đo được (tùy chọn)<input id="pedPkAuc" type="number" min="0" step="1"></label>',
      '<label>Đáy vancomycin, mg/L (tùy chọn)<input id="pedPkTrough" type="number" min="0" step="0.1"></label>',
      '<label>Cmax đo được, mg/L (tùy chọn)<input id="pedPkPeak" type="number" min="0" step="0.1"></label>',
      '<label class="pediatric-check"><input id="pedPkCalcium" type="checkbox"> Đang/dự kiến dùng dịch IV chứa Ca²⁺</label>',
      '<label class="pediatric-check"><input id="pedPkBilirubin" type="checkbox"> Tăng bilirubin máu</label>',
      '</div>',
      '<div id="pedPkInstant" class="pediatric-instant" aria-live="polite">Nhập cân nặng và liều cơ bản để xem nhanh.</div>',
      '<button id="pedPkSubmit" class="btn btn-primary full" type="submit">Phân tích PK/PD &amp; MIC</button>',
      '<p class="pediatric-safety-note">Không dùng kết quả để kê đơn khi chưa đối chiếu chức năng thận/gan, dị ứng, kháng sinh đồ, HDSD đúng chế phẩm và phác đồ đã phê duyệt.</p>',
      '</form>',
      '<div id="pedPkResult" class="pediatric-pkpd-result empty-state"><div>🧬</div><b>Chưa có phân tích PK/PD</b><span>Nhập dữ liệu lâm sàng và chọn Phân tích.</span></div>',
      '</div>'
    ].join('');
    host.appendChild(module);

    var form = module.querySelector('#pediatricPkPdForm');
    var weight = module.querySelector('#pedPkWeight');
    var baseDose = module.querySelector('#pedPkBaseDose');
    var instant = module.querySelector('#pedPkInstant');
    var neonate = module.querySelector('#pedPkNeonate');
    var age = module.querySelector('#pedPkAge');
    var ageUnit = module.querySelector('#pedPkAgeUnit');

    function renderInstant() {
      var weightValue = numberOrNull(weight.value);
      var doseValue = numberOrNull(baseDose.value);
      if (weightValue == null || doseValue == null) {
        instant.textContent = 'Nhập cân nặng và liều cơ bản để xem nhanh.';
        return;
      }
      instant.innerHTML = '<b>Xem nhanh:</b> ' + esc((weightValue * doseValue).toLocaleString('vi-VN', {maximumFractionDigits: 1})) + ' mg/ngày trước khi áp trần liều người lớn.';
    }

    function syncNeonate() {
      var value = numberOrNull(age.value);
      if (value != null) neonate.checked = ageMonths(value, ageUnit.value) < 28 / 30.4375;
      module.classList.toggle('is-neonate', neonate.checked);
    }

    [weight, baseDose].forEach(function (input) { input.addEventListener('input', renderInstant); });
    age.addEventListener('input', syncNeonate);
    ageUnit.addEventListener('change', syncNeonate);
    neonate.addEventListener('change', function () { module.classList.toggle('is-neonate', neonate.checked); });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      submit(module);
    });
  }

  function payloadFrom(module) {
    var value = function (id) { return module.querySelector('#' + id).value.trim(); };
    var checked = function (id) { return module.querySelector('#' + id).checked; };
    var rawAge = numberOrNull(value('pedPkAge'));
    var unit = value('pedPkAgeUnit');
    return {
      action: ACTION,
      weightKg: numberOrNull(value('pedPkWeight')),
      ageMonths: rawAge == null ? null : ageMonths(rawAge, unit),
      isNeonate: checked('pedPkNeonate'),
      gestationalAgeWeeks: numberOrNull(value('pedPkGa')),
      postnatalAgeDays: numberOrNull(value('pedPkPna')),
      drugName: value('pedPkDrug'), indication: value('pedPkIndication'),
      concentrationMgPerMl: numberOrNull(value('pedPkConcentration')),
      currentPrescribedDoseMg: numberOrNull(value('pedPkCurrentDose')),
      micValue: numberOrNull(value('pedPkMic')), pathogenName: value('pedPkPathogen'),
      infectionSeverity: value('pedPkSeverity'), measuredAuc24: numberOrNull(value('pedPkAuc')),
      measuredTroughMgL: numberOrNull(value('pedPkTrough')), measuredPeakMgL: numberOrNull(value('pedPkPeak')),
      receivingCalciumIv: checked('pedPkCalcium'), hyperbilirubinemia: checked('pedPkBilirubin')
    };
  }

  async function submit(module) {
    var result = module.querySelector('#pedPkResult');
    var button = module.querySelector('#pedPkSubmit');
    var payload = payloadFrom(module);
    if (!payload.weightKg || payload.ageMonths == null || !payload.indication) {
      result.className = 'pediatric-pkpd-result pediatric-error';
      result.textContent = 'Cần nhập cân nặng, tuổi và chỉ định.';
      return;
    }
    var endpoint = window.KHOA_DUOC_SERVER && window.KHOA_DUOC_SERVER.clinicalReviewWebAppUrl;
    if (!endpoint) {
      result.className = 'pediatric-pkpd-result pediatric-error';
      result.textContent = 'Chưa cấu hình URL Apps Script dùng chung.';
      return;
    }
    button.disabled = true;
    button.textContent = 'Đang phân tích…';
    result.className = 'pediatric-pkpd-result pediatric-loading';
    result.textContent = 'Đang áp khóa an toàn và phân tích PK/PD…';
    try {
      var response = await fetch(endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'text/plain;charset=utf-8'},
        body: JSON.stringify(payload),
        redirect: 'follow'
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var data = await response.json();
      render(result, data && data.result ? data.result : data);
    } catch (error) {
      result.className = 'pediatric-pkpd-result pediatric-error';
      result.innerHTML = '<b>Không gọi được dịch vụ phân tích.</b><span>' + esc(error.message || error) + '</span>';
    } finally {
      button.disabled = false;
      button.textContent = 'Phân tích PK/PD & MIC';
    }
  }

  function render(target, data) {
    if (!data || !data.dosing_analysis || !data.pk_pd_evaluation) {
      target.className = 'pediatric-pkpd-result pediatric-error';
      target.textContent = 'Phản hồi không đúng cấu trúc bắt buộc.';
      return;
    }
    var dose = data.dosing_analysis;
    var pk = data.pk_pd_evaluation;
    var counseling = data.pharmacist_counseling || {};
    var alerts = Array.isArray(data.clinical_alerts) ? data.clinical_alerts : [];
    target.className = 'pediatric-pkpd-result status-' + String(data.status || 'WARNING').toLowerCase();
    target.innerHTML = [
      '<div class="pediatric-status"><b>' + esc(statusLabel(data.status)) + '</b><span>' + esc((data.patient_summary || {}).age_display) + ' · ' + esc((data.patient_summary || {}).weight_kg) + ' kg</span></div>',
      '<div class="table-wrap"><table><thead><tr><th>Kháng sinh</th><th>Dải mg/kg/ngày</th><th>Tổng mg/ngày</th><th>Trần người lớn</th><th>Liều/lần</th><th>Tần suất</th><th>Thể tích/lần</th><th>Đường dùng</th></tr></thead><tbody><tr>',
      '<td>' + esc(dose.drug_name) + '</td><td>' + esc(dose.recommended_range_mg_kg_day) + '</td><td><b>' + esc(dose.calculated_total_daily_dose_mg) + '</b></td>',
      '<td>' + esc(dose.max_daily_limit_mg) + ' mg' + (dose.is_capped_at_adult_limit ? '<strong class="pediatric-cap"> ĐÃ KHÓA TRẦN</strong>' : '') + '</td>',
      '<td>' + esc(dose.single_dose_mg) + ' mg</td><td>' + esc(dose.frequency) + '</td><td>' + (dose.recommended_volume_ml == null ? '—' : esc(dose.recommended_volume_ml) + ' mL') + '</td><td>' + esc(dose.administration_route) + '</td>',
      '</tr></tbody></table></div>',
      '<article class="pediatric-pk-card"><span>Chỉ số đích</span><h3>' + esc(pk.target_pk_pd_index) + '</h3><p><b>Đích:</b> ' + esc(pk.target_goal) + '</p><p><b>Đánh giá:</b> ' + esc(pk.estimated_achievement) + '</p><p><b>MIC:</b> ' + esc(pk.mic_interpretation) + '</p><p><b>Tối ưu:</b> ' + esc(pk.optimization_recommendations) + '</p></article>',
      alerts.length ? '<div class="pediatric-alerts"><h3>Cảnh báo lâm sàng</h3>' + alerts.map(function (alert) { return '<article><b>' + esc(alert.severity) + ' · ' + esc(alert.type) + '</b><p>' + esc(alert.detail) + '</p><small>' + esc(alert.mechanism) + '</small></article>'; }).join('') + '</div>' : '',
      '<div class="pediatric-counseling"><h3>Pha/truyền và theo dõi</h3><p><b>Hoàn nguyên/pha:</b> ' + esc(counseling.reconstitution_instructions) + '</p><p><b>Bảo quản:</b> ' + esc(counseling.storage) + '</p><p><b>Theo dõi:</b> ' + esc(counseling.monitoring_parameters) + '</p></div>'
    ].join('');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
  window.addEventListener('vpmed:feature-open', function (event) {
    if (event.detail && event.detail.feature === 'pediatric-dose') window.setTimeout(init, 0);
  });

  window.VPMED_PEDIATRIC_DOSING = Object.freeze({init: init, action: ACTION, payloadFrom: payloadFrom});
}());
