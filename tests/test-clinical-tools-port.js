const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const context = {
  window: {},
  document: { addEventListener() {} },
  console,
  Date,
  Number,
  Intl,
  Math
};
context.window.window = context.window;
vm.createContext(context);

function loadRepo(rel) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'), context, { filename: rel });
}

loadRepo('assets/clinical-tools/vpmed-interactions.js');
loadRepo('assets/clinical-tools/vpmed-drug-profiles.js');
loadRepo('assets/clinical-tools/vpmed-pediatric.js');
loadRepo('assets/clinical-tools/vpmed-nelson.js');
loadRepo('assets/clinical-tools/vpmed-injectables.js');
loadRepo('assets/js/clinical-tools-data.js');
loadRepo('assets/js/clinical-tools.js');

const api = context.window.KHOA_DUOC_CLINICAL_TOOLS;
const W = context.window;

// 1) Du lieu port tai du, chay cuc bo
assert.strictEqual((W.VPMED_INTERACTIONS || []).length, 369, 'phai co 369 cap CCD');
assert.ok((W.VPMED_INTERACTIONS || []).every((x) => x.level === 'Chống chỉ định'), 'STRICT: 100% muc Chong chi dinh');
assert.strictEqual((W.VPMED_DRUGS || []).length, 34, 'phai co 34 ho so thuoc');
assert.strictEqual((W.VPMED_STOCK_PEDIATRIC.drugs || []).length, 16, 'phai co 16 thuoc nhi');
assert.strictEqual((W.VPMED_NELSON || []).length, 100, 'phai co 100 phac do Nelson');
assert.strictEqual((W.VPMED_INJECTABLES_SLIM || []).length, 149, 'phai co 149 muc tiem');

// 2) Khop cap tuong tac CCD (khong backend)
const ix = W.VPMED_INTERACTIONS;
let m = ix.filter((x) => api.matchInteractionPair('Aceclofenac', 'Ketorolac', x, {}));
assert.strictEqual(m.length, 1);
assert.strictEqual(m[0].level, 'Chống chỉ định');
m = ix.filter((x) => api.matchInteractionPair('Linezolid', 'Levodopa', x, {}));
assert.strictEqual(m.length, 1);
assert.strictEqual(m[0].level, 'Chống chỉ định');
m = ix.filter((x) => api.matchInteractionPair('Xyzabc', 'Qwerty', x, {}));
assert.strictEqual(m.length, 0);
const all = api.findAllVpmedInteractions(['Aceclofenac', 'Ketorolac', 'Paracetamol'], ix, {});
assert.ok(all.length >= 1);
assert.ok(all.every((x) => x.level === 'Chống chỉ định'));

// 3) Tinh lieu Nhi theo bang tuoi/PMA (khong backend)
const store = W.VPMED_STOCK_PEDIATRIC;
const amox = api.calculatePediatricVpmed(store, { drug: 'amoxicillin-clavulanate', weight: 20, months: 24, days: 24 * 30.4375, pma: NaN });
assert.strictEqual(amox.error, undefined);
assert.strictEqual(amox.mode, 'child');
assert.strictEqual(amox.matches.length, 2);
assert.strictEqual(amox.matches[0].rule.doseMgKg, 22.5);
const doseMg = 20 * amox.matches[0].rule.doseMgKg;
assert.strictEqual(doseMg, 450);
const neoErr = api.calculatePediatricVpmed(store, { drug: 'amoxicillin-clavulanate', weight: 3, months: 0, days: 10, pma: NaN });
assert.ok(neoErr.error && neoErr.error.includes('PMA'));
const adultErr = api.calculatePediatricVpmed(store, { drug: 'amoxicillin-clavulanate', weight: 70, months: 220, days: 6600, pma: NaN });
assert.ok(adultErr.error && adultErr.error.includes('18 tuổi'));

// 4) Nelson: phan biet mg/kg/NGAY vs mg/kg/LAN + MIC
const nelson = W.VPMED_NELSON;
const amoxN = nelson.filter((d) => d.id === 'amoxicillin_ch18')[0];
assert.ok(amoxN, 'co amoxicillin_ch18');
const res24 = api.nelsonRowsMatch(amoxN.dosingRows, 24 * 30.4375, 24, 20);
assert.strictEqual(res24.matched.length, 3);
const calc0 = api.nelsonCalcRow(res24.matched[0], 20);
assert.strictEqual(calc0.dailyLo, 800);
assert.strictEqual(calc0.dailyHi, 900);
assert.ok(Math.abs(calc0.perDoseLo - 800 / 3) < 0.01, 'moi lan = ngay / so lan (khoang 8h)');
assert.strictEqual(calc0.perDoseHi, 450);
const ampiNeo = nelson.filter((d) => d.id === 'ampicillin_neo')[0];
const tiny = api.nelsonRowsMatch(ampiNeo.dosingRows, 5, 0.16, 1.5);
assert.ok(tiny.matched.some((r) => r.label.indexOf('2000g, 0–7 ngày') !== -1), 'so sinh 1.5kg khop hang <=2000g');
const heavy = api.nelsonRowsMatch(ampiNeo.dosingRows, 5, 0.16, 2.5);
assert.ok(!heavy.matched.some((r) => r.label.indexOf('≤2000g, 0–7 ngày') !== -1), 'so sinh 2.5kg khong khop hang <=2000g');
const labRow = api.nelsonRowsMatch([{ ageGroup: 'child', scrRequired: true }], 730, 24, 20);
assert.strictEqual(labRow.matched.length, 0);
assert.strictEqual(labRow.skippedLab, 1);
const th = api.nelsonMicThresholds({}, [{ notes: 'Chỉ phù hợp khi MIC ≤ 4 mg/L' }]);
assert.deepStrictEqual(Array.from(th), [4]);
assert.strictEqual(api.nelsonMicAssessment([4], 2).verdict, 'ok');
assert.strictEqual(api.nelsonMicAssessment([4], 8).verdict, 'high');
assert.strictEqual(api.nelsonMicAssessment([4], NaN), null);
assert.ok(api.nelsonPkpdTarget('Beta-lactam – Penicillin').indexOf('fT') !== -1);
assert.ok(api.nelsonPkpdTarget('Glycopeptide').indexOf('AUC/MIC') !== -1);

// 5) Phan loai G-stage / nguy co CrCl (so sanh tung truong do khac vm realm)
function stageOf(v) { const s = api.egfrStage(v); return s.stage + '|' + s.label; }
assert.strictEqual(stageOf(95), 'G1|Bình thường hoặc cao');
assert.strictEqual(stageOf(40), 'G3b|Giảm trung bình đến nặng');
assert.strictEqual(stageOf(10), 'G5|Suy thận');
assert.strictEqual(api.crclRiskShort(95), 'Bảo tồn');
assert.strictEqual(api.crclRiskShort(10), 'Rất nặng');

// 6) Trang thai ton kho/HSD (ngay co dinh de test deterministic)
const DAY = 86400000;
const today = Date.UTC(2026, 8, 8);
function statusOf(s) { return api.formularyStockStatus(['30/06/2028', '01/01/2020', '10/09/2026'], today).lots.filter((l) => l.expiry === s)[0]; }
const okLot = statusOf('30/06/2028');
assert.strictEqual(okLot.status, 'ok');
assert.ok(okLot.daysLeft >= 659 && okLot.daysLeft <= 662, 'con ~661 ngay (tuy mui gio dia phuong)');
assert.strictEqual(statusOf('01/01/2020').status, 'expired');
assert.strictEqual(statusOf('10/09/2026').status, 'soon');
const overall = api.formularyStockStatus(['30/06/2028', '01/01/2020'], today);
assert.strictEqual(overall.overall, 'expired');
assert.strictEqual(overall.lotCount, 2);
assert.strictEqual(api.formularyStockStatus([], today).overall, 'unknown');

// 7) Ho so thuoc du truong phuc vu chi tiet formulary
const p0 = W.VPMED_DRUGS[0];
['brand', 'active', 'standard', 'renal', 'hd', 'crrt', 'infusion', 'contra', 'adr', 'tdm'].forEach((k) => {
  assert.ok(p0[k] !== undefined, 'thieu truong ' + k);
});

// 8) De-externalize: khong URL ngoai, khong iframe, khong supabase trong file port + logic moi
const portFiles = [
  'assets/clinical-tools/vpmed-interactions.js',
  'assets/clinical-tools/vpmed-drug-profiles.js',
  'assets/clinical-tools/vpmed-pediatric.js',
  'assets/clinical-tools/vpmed-nelson.js',
  'assets/clinical-tools/vpmed-injectables.js',
  'assets/js/clinical-tools.js'
];
portFiles.forEach((rel) => {
  const text = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  assert.ok(!/https?:\/\//.test(text), rel + ' khong duoc chua URL tuyet doi');
  assert.ok(!/hotrolamsang/i.test(text), rel + ' khong duoc tham chieu domain goc');
  assert.ok(!/<iframe/i.test(text), rel + ' khong duoc dung iframe');
  assert.ok(!/supabase/i.test(text), rel + ' khong duoc phu thuoc supabase');
});

console.log('Port 5 cong cu (369 CCD, 34 profiles, 16+100 nhi + MIC, ton kho): OK');
