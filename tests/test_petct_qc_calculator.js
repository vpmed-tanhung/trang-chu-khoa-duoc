'use strict';

const assert = require('assert');
const calculator = require('../assets/petct-qc-calculator.js');

const acetonNacl = calculator.calculateAcetonNacl({
  acetonTop: 0,
  acetonBot: 368,
  naclTop: 382,
  naclBot: 29
});
assert.strictEqual(acetonNacl.valid, true);
assert.strictEqual(acetonNacl.freePercent, 0);
assert.ok(Math.abs(acetonNacl.hydrolyzedPercent - 29 / 411 * 100) < 1e-12);
assert.ok(Math.abs(acetonNacl.boundPercent - 92.94403892944039) < 1e-12);

const mibi = calculator.calculateMibi({ sepPak: 10, ethanol: 90 });
assert.strictEqual(mibi.valid, true);
assert.strictEqual(mibi.freePercent, null);
assert.strictEqual(mibi.hydrolyzedPercent, null);
assert.strictEqual(mibi.boundPercent, 90);

assert.strictEqual(calculator.calculateAcetonNacl({ acetonTop: 0, acetonBot: 0, naclTop: 1, naclBot: 1 }).error, 'ZERO_DENOMINATOR');
assert.strictEqual(calculator.calculateAcetonNacl({ acetonTop: 1, acetonBot: 1, naclTop: 0, naclBot: 0 }).error, 'ZERO_DENOMINATOR');
assert.strictEqual(calculator.calculateMibi({ sepPak: 0, ethanol: 0 }).error, 'ZERO_DENOMINATOR');
assert.strictEqual(calculator.calculateMibi({ sepPak: -1, ethanol: 2 }).error, 'INCOMPLETE_OR_NEGATIVE');

console.log('PET/CT QC calculator tests: OK');
