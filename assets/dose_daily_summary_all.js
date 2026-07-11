(function () {
  'use strict';

  const VERSION = '20260711.2';
  const MODULE_ID = 'vpmedDailyDoseAll';

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
  const norm = (value) => String(value == null ? '' : value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
  const num = (value) => {
    const n = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  };
  const fmt = (value, digits = 2) => Number(value).toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  });
  const fmtMg = (mg) => mg >= 1000 ? `${fmt(mg / 1000, 2)} g` : `${fmt(mg, 1)} mg`;

  function selectedDrug() {
    const select = $('drug');
    const drugs = Array.isArray(window.VPMED_DRUGS) ? window.VPMED_DRUGS : [];
    if (!select) return null;
    return drugs.find((d) => String(d && d.id) === String(select.value)) || null;
  }

  function patientData() {
    const age = num($('age') && $('age').value);
    const weight = num($('wt') && $('wt').value);
    const scrUmol = num($('scr') && $('scr').value);
    const sex = norm($('sex') && $('sex').value);
    if (!(age > 0) || !(weight > 0) || !(scrUmol > 0)) return null;
    const scrMgDl = scrUmol / 88.4;
    let crcl = ((140 - age) * weight) / (72 * scrMgDl);
    if (sex === 'f' || sex === 'female' || sex === 'nu') crcl *= 0.85;
    return { age, weight, scrUmol, crcl: Math.max(0, crcl) };
  }

  function ensureDialysisSelector() {
    const checkbox = $('dialysis');
    if (!checkbox || $('vpmedDialysisTypeWrap')) return;
    const host = checkbox.closest('label') || checkbox.parentElement;
    if (!host) return;
    const wrap = document.createElement('label');
    wrap.id = 'vpmedDialysisTypeWrap';
    wrap.className = 'vpmed-dialysis-type-wrap';
    wrap.innerHTML = `Hình thức lọc máu
      <select id="vpmedDialysisType" aria-label="Hình thức lọc máu">
        <option value="hd">Thẩm tách máu chu kỳ (HD)</option>
        <option value="crrt">Lọc máu liên tục (CRRT)</option>
      </select>`;
    host.insertAdjacentElement('afterend', wrap);
    const update = () => wrap.classList.toggle('is-visible', checkbox.checked);
    checkbox.addEventListener('change', update);
    update();
  }

  function dialysisMode() {
    const checkbox = $('dialysis');
    if (!checkbox || !checkbox.checked) return 'none';
    return ($('vpmedDialysisType') && $('vpmedDialysisType').value) === 'crrt' ? 'crrt' : 'hd';
  }

  function getRenalResult(drug, crcl) {
    if (!drug || typeof window.VPMED_GET_RENAL_DOSE !== 'function') return null;
    try { return window.VPMED_GET_RENAL_DOSE(drug.active, crcl); }
    catch (error) { return null; }
  }

  function parseStrengthPerUnit(drug) {
    const raw = String(drug && drug.strength || '').replace(/\s+/g, ' ');
    const low = norm(raw);
    if (!raw || /mg\s*\/\s*(?:1\s*)?ml|mg\/ml|g\/ml|iu\/ml/.test(low)) return null;
    const values = [];
    const re = /(\d+(?:[.,]\d+)?)\s*(mg|g)\b/gi;
    let m;
    while ((m = re.exec(raw)) !== null) {
      const n = num(m[1]);
      if (!(n > 0)) continue;
      values.push(m[2].toLowerCase() === 'g' ? n * 1000 : n);
    }
    if (!values.length) return null;
    const totalMg = values.reduce((a, b) => a + b, 0);
    const route = norm(drug.route);
    let unit = 'đơn vị';
    if (route.includes('uong')) unit = 'viên/gói';
    else if (route.includes('tiem') || route.includes('truyen')) unit = 'lọ/ống';
    return { totalMg, unit, label: raw };
  }

  function splitClauses(text) {
    return String(text || '')
      .replace(/\r/g, '\n')
      .replace(/\s*[;•]\s*/g, '\n')
      .replace(/(?=Nếu phác đồ)/gi, '\n')
      .split(/\n+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function unitToMg(amount, unit, weightKg, perKg) {
    if (!(amount > 0)) return NaN;
    let mg = unit.toLowerCase() === 'g' ? amount * 1000 : amount;
    if (perKg) mg *= weightKg;
    return mg;
  }

  function exactRegimen(label, doseMg, intervalHours, extra = {}) {
    if (!(doseMg > 0) || !(intervalHours > 0)) return null;
    const dosesPerDay = 24 / intervalHours;
    return {
      type: 'exact',
      label,
      doseMg,
      intervalHours,
      dosesPerDay,
      dailyMg: doseMg * dosesPerDay,
      ...extra
    };
  }

  function rangeRegimen(label, minDoseMg, maxDoseMg, minInterval, maxInterval, extra = {}) {
    if (!(minDoseMg > 0) || !(maxDoseMg > 0) || !(minInterval > 0) || !(maxInterval > 0)) return null;
    return {
      type: 'range',
      label,
      minDoseMg,
      maxDoseMg,
      minInterval,
      maxInterval,
      minDailyMg: minDoseMg * (24 / maxInterval),
      maxDailyMg: maxDoseMg * (24 / minInterval),
      ...extra
    };
  }

  function parseCombinedPair(clause) {
    const pair = clause.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*mg\b/i);
    if (!pair) return null;
    return num(pair[1]) + num(pair[2]);
  }

  function parseClause(clause, weightKg) {
    const source = String(clause || '').replace(/\u00a0/g, ' ').trim();
    if (!source) return [];
    const normalized = norm(source);
    const results = [];

    // Với câu có liều đầu rồi mới đến liều duy trì, chỉ tính liều duy trì/24 giờ.
    const maintenance = source.match(/(?:sau đó|duy trì)\s*[:：]?\s*(.+)$/i);
    const body = maintenance ? maintenance[1] : source;
    const bodyNorm = norm(body);
    const loading = maintenance ? source.slice(0, maintenance.index).trim() : '';

    // Cặp hàm lượng phối hợp kiểu 500/100 mg mỗi 12 giờ.
    const combinedMg = parseCombinedPair(body);
    const combinedInterval = body.match(/(?:mỗi|\/|cách)\s*(\d+(?:[.,]\d+)?)\s*(?:giờ|h)\b/i);
    if (combinedMg && combinedInterval) {
      const r = exactRegimen(source, combinedMg, num(combinedInterval[1]), { loading, source });
      if (r) results.push(r);
      return results;
    }

    // Liều cố định hoặc theo cân nặng, có thể là khoảng liều/khoảng cách.
    const re = /(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s*(mg|g)\s*(\/\s*kg)?\s*(?:mỗi|\/|cách)\s*(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s*(?:giờ|h)\b/gi;
    let m;
    while ((m = re.exec(body)) !== null) {
      const perKg = Boolean(m[4]);
      const minDose = unitToMg(num(m[1]), m[3], weightKg, perKg);
      const maxDose = unitToMg(num(m[2] || m[1]), m[3], weightKg, perKg);
      const intA = num(m[5]);
      const intB = num(m[6] || m[5]);
      const route = bodyNorm.includes('uong') ? 'Uống' : bodyNorm.includes('iv') || bodyNorm.includes('tiem') ? 'IV/tiêm' : '';
      if (minDose === maxDose && intA === intB) {
        const r = exactRegimen(source, minDose, intA, { perKg, route, loading, source });
        if (r) results.push(r);
      } else {
        const r = rangeRegimen(source, Math.min(minDose, maxDose), Math.max(minDose, maxDose), Math.min(intA, intB), Math.max(intA, intB), { perKg, route, loading, source });
        if (r) results.push(r);
      }
    }

    // Liều một lần/ngày: 400 mg/ngày, 2 g/ngày.
    const daily = body.match(/(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s*(mg|g)\s*(?:\/\s*ngày|mỗi\s*ngày|ngày)/i);
    if (!results.length && daily) {
      const a = unitToMg(num(daily[1]), daily[3], weightKg, false);
      const b = unitToMg(num(daily[2] || daily[1]), daily[3], weightKg, false);
      if (a === b) results.push(exactRegimen(source, a, 24, { loading, source }));
      else results.push(rangeRegimen(source, Math.min(a, b), Math.max(a, b), 24, 24, { loading, source }));
    }

    return results;
  }

  function uniqueRegimens(items) {
    const seen = new Set();
    return items.filter((item) => {
      if (!item) return false;
      const key = item.type === 'exact'
        ? `e|${item.doseMg}|${item.intervalHours}|${item.route || ''}`
        : `r|${item.minDoseMg}|${item.maxDoseMg}|${item.minInterval}|${item.maxInterval}|${item.route || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function standardRegimens(drug, rr, weightKg) {
    const texts = [rr && rr.standard, drug && drug.standard].filter(Boolean);
    return uniqueRegimens(texts.flatMap((text) => splitClauses(text).flatMap((clause) => parseClause(clause, weightKg))));
  }

  function deriveFromPercent(hitText, base) {
    const m = String(hitText || '').match(/(\d+(?:[.,]\d+)?)\s*%\s*liều/i);
    if (!m || !base.length) return [];
    const ratio = num(m[1]) / 100;
    return base.map((r) => {
      if (r.type === 'exact') return exactRegimen(`${m[1]}% liều chuẩn: ${r.label}`, r.doseMg * ratio, r.intervalHours, { source: hitText });
      return rangeRegimen(`${m[1]}% liều chuẩn: ${r.label}`, r.minDoseMg * ratio, r.maxDoseMg * ratio, r.minInterval, r.maxInterval, { source: hitText });
    });
  }

  function deriveSpecifiedInterval(hitText, base) {
    if (!/liều theo chỉ định|liều thông thường/i.test(String(hitText || '')) || !base.length) return [];
    const m = String(hitText).match(/mỗi\s*(\d+(?:[.,]\d+)?)(?:\s*[–—-]\s*(\d+(?:[.,]\d+)?))?\s*(?:giờ|h)/i);
    if (!m) return [];
    const intA = num(m[1]);
    const intB = num(m[2] || m[1]);
    return base.map((r) => {
      const minDose = r.type === 'exact' ? r.doseMg : r.minDoseMg;
      const maxDose = r.type === 'exact' ? r.doseMg : r.maxDoseMg;
      if (minDose === maxDose && intA === intB) return exactRegimen(`${fmt(minDose, 1)} mg mỗi ${fmt(intA, 1)} giờ`, minDose, intA, { source: hitText });
      return rangeRegimen('Khoảng liều theo chỉ định và khoảng cách hiệu chỉnh', minDose, maxDose, Math.min(intA, intB), Math.max(intA, intB), { source: hitText });
    });
  }

  function buildRegimens(drug, rr, mode, weightKg) {
    const standard = standardRegimens(drug, rr, weightKg);
    let text = '';
    let source = '';

    if (mode === 'hd') {
      text = rr && rr.hd || drug && drug.hd || '';
      source = 'HD';
    } else if (mode === 'crrt') {
      text = rr && rr.crrt || drug && drug.crrt || '';
      source = 'CRRT';
    } else {
      text = rr && rr.hit && rr.hit.text || '';
      source = rr && rr.hit && rr.hit.label || 'Theo CrCl';
    }

    let regimens = splitClauses(text).flatMap((clause) => parseClause(clause, weightKg));
    if (!regimens.length && /không hiệu chỉnh|không cần hiệu chỉnh|100% liều/i.test(text)) regimens = standard;
    if (!regimens.length) regimens = deriveFromPercent(text, standard);
    if (!regimens.length) regimens = deriveSpecifiedInterval(text, standard);

    return {
      regimens: uniqueRegimens(regimens),
      ruleText: text,
      ruleLabel: source,
      sourceText: [
        rr && rr.hit && rr.hit.source,
        rr && rr.verified,
        drug && drug.renalVerified,
        drug && drug.clinicalSourceNote
      ].filter(Boolean).join(' · ')
    };
  }

  function unitSummary(regimen, drug) {
    const pack = parseStrengthPerUnit(drug);
    if (!pack || regimen.type !== 'exact') return '';
    const perDose = regimen.doseMg / pack.totalMg;
    const perDay = regimen.dailyMg / pack.totalMg;
    if (!(perDose > 0) || !(perDay > 0) || perDose > 50 || perDay > 100) return '';
    return `<div><span>Quy đổi theo hàm lượng ${esc(pack.label)}</span><strong>${fmt(perDose, 2)} ${esc(pack.unit)}/lần · ${fmt(perDay, 2)} ${esc(pack.unit)}/24 giờ</strong></div>`;
  }

  function regimenHtml(regimen, drug, index) {
    if (regimen.type === 'exact') {
      return `<article class="vpmed-regimen-card">
        <div class="vpmed-regimen-no">${index + 1}</div>
        <div class="vpmed-regimen-body">
          <h4>${esc(regimen.route ? `${regimen.route} – ${regimen.label}` : regimen.label)}</h4>
          ${regimen.loading ? `<p class="vpmed-loading"><b>Liều đầu:</b> ${esc(regimen.loading)}</p>` : ''}
          <div class="vpmed-regimen-grid">
            <div><span>Liều mỗi lần</span><strong>${fmtMg(regimen.doseMg)}</strong></div>
            <div><span>Khoảng cách</span><strong>Mỗi ${fmt(regimen.intervalHours, 1)} giờ</strong></div>
            <div><span>Số lần/24 giờ</span><strong>${fmt(regimen.dosesPerDay, 2)} lần</strong></div>
            <div class="vpmed-total"><span>Tổng liều/24 giờ</span><strong>${fmtMg(regimen.dailyMg)}</strong></div>
            ${unitSummary(regimen, drug)}
          </div>
        </div>
      </article>`;
    }
    return `<article class="vpmed-regimen-card vpmed-regimen-card--range">
      <div class="vpmed-regimen-no">${index + 1}</div>
      <div class="vpmed-regimen-body">
        <h4>${esc(regimen.label)}</h4>
        <div class="vpmed-regimen-grid">
          <div><span>Liều mỗi lần theo nguồn</span><strong>${fmtMg(regimen.minDoseMg)} – ${fmtMg(regimen.maxDoseMg)}</strong></div>
          <div><span>Khoảng cách theo nguồn</span><strong>Mỗi ${fmt(regimen.minInterval, 1)}–${fmt(regimen.maxInterval, 1)} giờ</strong></div>
          <div class="vpmed-total"><span>Phạm vi tổng liều/24 giờ</span><strong>${fmtMg(regimen.minDailyMg)} – ${fmtMg(regimen.maxDailyMg)}</strong></div>
        </div>
        <p class="vpmed-range-warning"><b>Chưa phải liều chốt:</b> nguồn đang cho khoảng liều hoặc nhiều khoảng cách. Bác sĩ phải chọn phác đồ theo chỉ định và mức độ nhiễm khuẩn; hệ thống không lấy trung bình.</p>
      </div>
    </article>`;
  }

  function sourceHtml(info, drug, patient, mode) {
    const modeText = mode === 'hd' ? 'HD' : mode === 'crrt' ? 'CRRT' : `CrCl ${fmt(patient.crcl, 1)} mL/phút`;
    return `<div class="vpmed-source-box">
      <div><b>Căn cứ đang dùng:</b> ${esc(info.ruleLabel)} — ${esc(info.ruleText || 'Chưa có nội dung liều số.')}</div>
      <div><b>Thông số:</b> cân nặng ${fmt(patient.weight, 1)} kg; ${esc(modeText)}.</div>
      <div><b>Nguồn/mức xác minh:</b> ${esc(info.sourceText || 'Chưa ghi rõ nguồn xác minh cho dòng dữ liệu này.')}</div>
      <div><b>Nguyên tắc an toàn:</b> chỉ thực hiện phép nhân/chia từ dữ liệu liều đã có trong hồ sơ thuốc; không tự tạo liều, không lấy trung bình và không suy đoán bằng AI.</div>
    </div>`;
  }

  function render() {
    const output = $('output');
    const drug = selectedDrug();
    const patient = patientData();
    if (!output || !drug || !patient || output.classList.contains('empty-state')) return;

    const rr = getRenalResult(drug, patient.crcl);
    const mode = dialysisMode();
    const info = buildRegimens(drug, rr, mode, patient.weight);
    const existing = output.querySelector(`[data-module="${MODULE_ID}"]`);
    if (existing) existing.remove();

    const holder = document.createElement('section');
    holder.dataset.module = MODULE_ID;
    holder.dataset.version = VERSION;
    holder.className = 'vpmed-daily-all';

    const title = `${drug.brand || drug.active || 'Kháng sinh'} — ${drug.active || ''}`;
    const content = info.regimens.length
      ? `<div class="vpmed-regimen-list">${info.regimens.map((r, i) => regimenHtml(r, drug, i)).join('')}</div>`
      : `<div class="vpmed-no-calc"><b>Không đủ dữ liệu số để tính tổng liều 24 giờ.</b><span>Hồ sơ hiện tại chưa có một phác đồ liều mỗi lần và khoảng cách dùng đủ rõ, hoặc thuốc bắt buộc TDM/phác đồ riêng. Hệ thống giữ nguyên nội dung nguồn và không tự suy đoán liều.</span></div>`;

    holder.innerHTML = `<div class="vpmed-daily-head">
        <div><span>Tính liều 24 giờ cho toàn bộ danh mục</span><h3>${esc(title)}</h3></div>
        <b>Tính số học · Không dùng AI</b>
      </div>
      ${content}
      ${sourceHtml(info, drug, patient, mode)}`;

    const anchor = output.querySelector('.dose-decision') || output.querySelector('.selected-drug-banner') || output.firstElementChild;
    if (anchor) anchor.insertAdjacentElement('afterend', holder);
    else output.prepend(holder);
  }

  function injectStyles() {
    if ($('vpmedDailyDoseAllStyles')) return;
    const style = document.createElement('style');
    style.id = 'vpmedDailyDoseAllStyles';
    style.textContent = `
      .vpmed-dialysis-type-wrap{display:none;margin-top:10px}.vpmed-dialysis-type-wrap.is-visible{display:block}.vpmed-dialysis-type-wrap select{width:100%}
      .vpmed-daily-all{margin:14px 0;padding:16px;border:1px solid #b9d7ca;border-left:6px solid #13795b;border-radius:16px;background:#f8fffb;box-shadow:0 8px 24px rgba(20,78,59,.08)}
      .vpmed-daily-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}.vpmed-daily-head span{display:block;color:#13795b;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}.vpmed-daily-head h3{margin:4px 0 0;color:#163c31;font-size:20px;line-height:1.3}.vpmed-daily-head>b{white-space:nowrap;background:#e3f4ec;color:#116247;border-radius:999px;padding:7px 10px;font-size:12px}
      .vpmed-regimen-list{display:grid;gap:10px}.vpmed-regimen-card{display:grid;grid-template-columns:34px 1fr;gap:10px;padding:12px;border:1px solid #d5e9df;border-radius:13px;background:#fff}.vpmed-regimen-card--range{border-color:#ead8af;background:#fffdf7}.vpmed-regimen-no{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#e5f5ed;color:#116247;font-weight:900}.vpmed-regimen-body h4{margin:2px 0 10px;color:#173d32;font-size:14px;line-height:1.4}.vpmed-regimen-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.vpmed-regimen-grid>div{min-width:0;padding:9px;border-radius:10px;background:#f4f8f6}.vpmed-regimen-grid span{display:block;margin-bottom:3px;color:#66766f;font-size:11px;font-weight:800}.vpmed-regimen-grid strong{display:block;color:#183a31;font-size:14px;overflow-wrap:anywhere}.vpmed-regimen-grid .vpmed-total{background:#e3f5ec}.vpmed-regimen-grid .vpmed-total strong{color:#0a6847;font-size:17px}.vpmed-loading{margin:0 0 9px;padding:8px 10px;background:#eef4ff;border-radius:9px;color:#29466e;font-size:12px}.vpmed-range-warning{margin:9px 0 0;padding:9px 10px;background:#fff4dc;border-left:4px solid #c98512;border-radius:8px;color:#70480b;font-size:12px;line-height:1.45}
      .vpmed-no-calc{display:grid;gap:6px;padding:13px;border-radius:12px;background:#fff5f5;border-left:5px solid #c43b3b;color:#7e2626}.vpmed-no-calc b{font-size:15px}.vpmed-no-calc span{font-size:13px;line-height:1.5}.vpmed-source-box{display:grid;gap:5px;margin-top:11px;padding:11px 12px;border-radius:11px;background:#eef5f2;color:#345249;font-size:12px;line-height:1.45}
      @media(max-width:900px){.vpmed-regimen-grid{grid-template-columns:1fr 1fr}.vpmed-daily-head{display:block}.vpmed-daily-head>b{display:inline-block;margin-top:8px}}
      @media(max-width:520px){.vpmed-daily-all{padding:13px}.vpmed-regimen-grid{grid-template-columns:1fr}.vpmed-regimen-card{grid-template-columns:1fr}.vpmed-regimen-no{display:none}}
    `;
    document.head.appendChild(style);
  }

  function bind() {
    ensureDialysisSelector();
    const calc = $('calc');
    const drug = $('drug');
    const mode = $('vpmedDialysisType');
    const dialysis = $('dialysis');
    if (calc) calc.addEventListener('click', () => window.setTimeout(render, 0));
    if (drug) drug.addEventListener('change', () => window.setTimeout(render, 0));
    if (mode) mode.addEventListener('change', () => window.setTimeout(render, 0));
    if (dialysis) dialysis.addEventListener('change', () => window.setTimeout(render, 0));
  }

  function init() {
    injectStyles();
    bind();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
