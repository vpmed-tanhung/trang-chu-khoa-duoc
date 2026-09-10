'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps-script', 'inpatient-order-review.gs'), 'utf8');
const context = {console};
vm.createContext(context);
vm.runInContext(source, context);
context.requestGemini = () => JSON.stringify({
  status: 'VALID', clinical_alerts: [],
  pk_pd_evaluation: {optimization_recommendations: 'Giữ khuyến nghị PK/PD có kiểm soát.'},
  pharmacist_counseling: {}
});

const capped = context.handlePediatricDosing({
  weightKg: 80, ageMonths: 120, drugName: 'Ceftriaxone', indication: 'Viêm phổi',
  concentrationMgPerMl: 100, currentPrescribedDoseMg: 2500, micValue: 1,
  pathogenName: 'S. pneumoniae', infectionSeverity: 'severe'
});
assert.strictEqual(capped.status, 'CRITICAL_ERROR');
assert.strictEqual(capped.dosing_analysis.calculated_total_daily_dose_mg, 2000);
assert.strictEqual(capped.dosing_analysis.is_capped_at_adult_limit, true);
assert(capped.clinical_alerts.some(item => item.type === 'PRESCRIBED_DOSE_OVER_CAP'));

const neonate = context.handlePediatricDosing({
  weightKg: 3, ageMonths: 0.2, isNeonate: true, gestationalAgeWeeks: 38,
  postnatalAgeDays: 6, drugName: 'Ceftriaxone', indication: 'Nhiễm khuẩn huyết',
  concentrationMgPerMl: 100, currentPrescribedDoseMg: 150, micValue: 0.5,
  infectionSeverity: 'severe', receivingCalciumIv: true
});
assert.strictEqual(neonate.status, 'CRITICAL_ERROR');
assert(neonate.clinical_alerts.some(item => item.type === 'NEONATAL_CEFTRIAXONE'));

const vancomycin = context.handlePediatricDosing({
  weightKg: 20, ageMonths: 72, drugName: 'Vancomycin', indication: 'MRSA nặng',
  currentPrescribedDoseMg: 1200, micValue: 1, measuredAuc24: 680,
  measuredTroughMgL: 18, infectionSeverity: 'severe'
});
assert.strictEqual(vancomycin.status, 'WARNING');
assert.match(vancomycin.pk_pd_evaluation.estimated_achievement, /vượt đích/i);
assert(vancomycin.clinical_alerts.some(item => item.type === 'VANCOMYCIN_AUC_TOXICITY'));

const client = fs.readFileSync(path.join(root, 'assets', 'pediatric-dosing.js'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'assets', 'platform-shell.js'), 'utf8');
assert(client.includes("'Content-Type': 'text/plain;charset=utf-8'"));
assert(client.includes("var ACTION = 'calculate_pediatric_antibiotic'"));
assert(shell.includes('assets/pediatric-dosing.js?v=20260910-pkpd-mic-v1'));
assert(shell.includes('assets/pediatric-dosing.css?v=20260910-pkpd-mic-v1'));

console.log('Pediatric PK/PD module tests passed.');
