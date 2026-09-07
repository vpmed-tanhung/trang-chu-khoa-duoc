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
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets/js/clinical-tools-data.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets/js/clinical-tools.js'), 'utf8'), context);

const api = context.window.KHOA_DUOC_CLINICAL_TOOLS;
const data = context.window.KHOA_DUOC_CLINICAL_DATA;

assert.strictEqual(api.findInteractions('Warfarin', 'Metronidazole', data.interactions).length, 1);
assert.strictEqual(api.findInteractions('Paracetamol', 'Amoxicillin', data.interactions).length, 0);
assert.ok(Math.abs(api.calculateCrCl(60, 70, 1.4, 'male') - 55.5555556) < 0.001);
assert.ok(api.calculateEgfr(1.4, 60, 'male') > 50);
assert.strictEqual(api.renalBand(55), 'mild');
assert.ok(Math.abs(api.convertCreatinine(88.4, 'umol-l') - 1) < 0.0001);
assert.ok(api.calculateEgfrAbsolute(api.calculateEgfr(1.4, 60, 'male'), 170, 70) > 40);

const amoxicillin = api.calculatePediatric({ ageYears: 2, ageMonths: 0, pnaDays: '', gaWeeks: '', weight: 20, drug: 'amoxicillin' }, data.pediatric);
assert.strictEqual(amoxicillin.error, undefined);
assert.strictEqual(amoxicillin.dailyLow, 800);
assert.strictEqual(amoxicillin.dailyHigh, 1800);
assert.strictEqual(amoxicillin.doseLow, 400);
assert.strictEqual(amoxicillin.doseHigh, 900);

const amoxicillinMic = api.calculatePediatric({ ageYears: 2, ageMonths: 0, pnaDays: '', gaWeeks: '', weight: 20, drug: 'amoxicillin', mic: 0.5, pkpdTarget: 'ft-4mic-100' }, data.pediatric);
assert.strictEqual(amoxicillinMic.micAssessment.threshold, 2);

const neonateCeftriaxone = api.calculatePediatric({ ageYears: 0, ageMonths: 0, pnaDays: 28, gaWeeks: 35, weight: 3, drug: 'ceftriaxone' }, data.pediatric);
assert.ok(neonateCeftriaxone.error.includes('≤28 ngày'));
const adultInPediatricTool = api.calculatePediatric({ ageYears: 18, ageMonths: 0, pnaDays: '', gaWeeks: '', weight: 70, drug: 'amoxicillin' }, data.pediatric);
assert.ok(adultInPediatricTool.error.includes('đủ 18 tuổi'));

const pet = api.calculatePet({
  nuclide: 'X', targetActivity: 100, residualActivity: 0, stockActivity: 1000, stockVolume: 10,
  calibrationTime: '2026-01-01T10:00', drawTime: '2026-01-01T10:30', administrationTime: '2026-01-01T11:00'
}, [{ id: 'X', name: 'X', halfLife: 60 }]);
assert.ok(Math.abs(pet.volume - 2) < 0.0001);

const petByWeight = api.calculatePet({
  nuclide: 'F-18', targetActivity: '', weight: 20, doseFactor: 4, doseUnit: 'MBq/kg', residualActivity: 0,
  stockActivity: 1000, stockVolume: 10, calibrationTime: '2026-01-01T10:00', drawTime: '2026-01-01T10:30', administrationTime: '2026-01-01T11:00'
}, [{ id: 'F-18', name: 'F-18', halfLife: 109.8 }]);
assert.strictEqual(petByWeight.target, 80);
assert.strictEqual(data.source.interactionPairCount, 633);

console.log('Đã kiểm tra 4 công cụ lâm sàng và các khóa an toàn: OK');
