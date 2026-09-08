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
loadRepo('assets/clinical-tools/vpmed-injectables.js');
loadRepo('assets/js/clinical-tools-data.js');
loadRepo('assets/js/clinical-tools.js');

const api = context.window.KHOA_DUOC_CLINICAL_TOOLS;
const W = context.window;

// 1) Du lieu port tai du, chay cuc bo
assert.strictEqual((W.VPMED_INTERACTIONS || []).length, 633, 'phai co 633 cap tuong tac');
assert.strictEqual((W.VPMED_DRUGS || []).length, 34, 'phai co 34 ho so thuoc');
assert.strictEqual((W.VPMED_STOCK_PEDIATRIC.drugs || []).length, 16, 'phai co 16 thuoc nhi');
assert.strictEqual((W.VPMED_INJECTABLES_SLIM || []).length, 149, 'phai co 149 muc tiem');

// 2) Khop cap tuong tac (khong backend)
const ix = W.VPMED_INTERACTIONS;
let m = ix.filter((x) => api.matchInteractionPair('Aceclofenac', 'Ketorolac', x, {}));
assert.strictEqual(m.length, 1);
assert.strictEqual(m[0].level, 'Chống chỉ định');
m = ix.filter((x) => api.matchInteractionPair('Linezolid', 'Sertraline', x, {}));
assert.strictEqual(m.length, 1);
m = ix.filter((x) => api.matchInteractionPair('Xyzabc', 'Qwerty', x, {}));
assert.strictEqual(m.length, 0);
const all = api.findAllVpmedInteractions(['Aceclofenac', 'Ketorolac', 'Paracetamol'], ix, {});
assert.ok(all.length >= 1);

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

// 4) Phan loai G-stage / nguy co CrCl (so sanh tung truong do khac vm realm)
function stageOf(v) { const s = api.egfrStage(v); return s.stage + '|' + s.label; }
assert.strictEqual(stageOf(95), 'G1|Bình thường hoặc cao');
assert.strictEqual(stageOf(40), 'G3b|Giảm trung bình đến nặng');
assert.strictEqual(stageOf(10), 'G5|Suy thận');
assert.strictEqual(api.crclRiskShort(95), 'Bảo tồn');
assert.strictEqual(api.crclRiskShort(10), 'Rất nặng');

// 5) Ho so thuoc du truong phuc vu chi tiet formulary
const p0 = W.VPMED_DRUGS[0];
['brand', 'active', 'standard', 'renal', 'hd', 'crrt', 'infusion', 'contra', 'adr', 'tdm'].forEach((k) => {
  assert.ok(p0[k] !== undefined, 'thieu truong ' + k);
});

// 6) De-externalize: khong URL ngoai, khong iframe, khong supabase trong file port + logic moi
const portFiles = [
  'assets/clinical-tools/vpmed-interactions.js',
  'assets/clinical-tools/vpmed-drug-profiles.js',
  'assets/clinical-tools/vpmed-pediatric.js',
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

console.log('Port 4 cong cu (633 IX, 34 profiles, 16 nhi, G-stage): OK');
