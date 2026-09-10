const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = { window: {}, console };
vm.createContext(context);
for (const file of ['assets/data.js', 'assets/interaction-regulatory-data.js', 'assets/interaction-qd5948-only.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

const rules = context.window.VPMED_QD5948.rules;
assert.strictEqual(rules.length, 633, 'Phải giữ đủ 633 dòng Bảng 3.1 QĐ 5948');
assert(rules.every(rule => rule.sourceCode === '5948/QĐ-BYT'), 'Không được trộn nguồn ngoài QĐ 5948');
assert(rules.every(rule => /^contraindicated-/.test(rule.severity)), 'Chỉ được giữ mức chống chỉ định');
assert(rules.every(rule => rule.activeIngredients.length === 2 && rule.consequence && rule.mechanism && rule.recommendation),
  'Mỗi cảnh báo phải đủ cặp hoạt chất, hậu quả, cơ chế và khuyến cáo');
assert.strictEqual(rules.filter(rule => rule.stt === 321 || rule.stt === 322).length, 2,
  'Không được gộp các dòng trùng cặp nhưng khác điều kiện/đường dùng');
assert(context.window.VPMED_QD5948.matchPair('Aceclofenac', 'Ketorolac', rules[0]),
  'Bộ đối chiếu phải nhận diện đúng cặp hoạt chất chính thức');

console.log('QĐ 5948 contraindication-only tests: OK');
