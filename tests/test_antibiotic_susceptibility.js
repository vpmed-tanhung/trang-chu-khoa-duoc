const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = {
  window: {},
  document: { readyState: 'loading', addEventListener() {} },
  console,
};
context.window.window = context.window;
vm.createContext(context);

function load(relativePath) {
  const filename = path.join(root, relativePath);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
}

load('assets/js/clinical-tools-data.js');
load('assets/js/antibiotic-susceptibility-data.js');
load('assets/js/antibiotic-susceptibility.js');

const data = context.window.KHOA_DUOC_AMR_DATA;
const moduleApi = context.window.KHOA_DUOC_AMR;
const clinicalData = context.window.KHOA_DUOC_CLINICAL_DATA;

assert(data, 'Thiếu dữ liệu AMR');
assert(moduleApi, 'Thiếu module hiển thị AMR');
assert.strictEqual(data.antibiotics.length, 19, 'Phải đủ 19 kháng sinh trong nguồn');
assert.strictEqual(data.organisms.length, 12, 'Phải đủ 12 nhóm vi khuẩn');
assert.strictEqual(data.specimens.length, 7, 'Phải đủ 7 nhóm bệnh phẩm được trích xuất');
assert.strictEqual(data.antibiotics.reduce((sum, item) => sum + item.rows.length, 0), 333, 'Phải đủ 333 dòng số liệu');

data.antibiotics.forEach((antibiotic) => {
  assert(antibiotic.rows.length > 0, `Kháng sinh ${antibiotic.id} không có dữ liệu`);
  assert.strictEqual(moduleApi.findAntibiotic(antibiotic.name).id, antibiotic.id, `Không ánh xạ được ${antibiotic.name}`);
  antibiotic.rows.forEach((row) => {
    assert(Number.isInteger(row[0]) && row[0] >= 0 && row[0] < data.organisms.length, `Sai chỉ số vi khuẩn: ${antibiotic.id}`);
    assert(Number.isInteger(row[1]) && row[1] >= 0 && row[1] < data.specimens.length, `Sai chỉ số bệnh phẩm: ${antibiotic.id}`);
    assert(Number.isFinite(row[2]) && row[2] >= 0 && row[2] <= 100, `Sai tỷ lệ %S: ${antibiotic.id}`);
    assert(row[3] == null || (Number.isInteger(row[3]) && row[3] > 0), `Sai cỡ mẫu: ${antibiotic.id}`);
  });
  const specimenIds = [...new Set(antibiotic.rows.map((row) => row[1]))];
  const summarySpecimen = specimenIds.includes(0) ? 0 : specimenIds[0];
  const expectedRows = antibiotic.rows.filter((row) => row[1] === summarySpecimen).length;
  const summary = moduleApi.renderSummary(antibiotic.name);
  assert.strictEqual((summary.match(/<progress /g) || []).length, expectedRows, `Sai số dòng tóm tắt: ${antibiotic.id}`);
  assert(summary.includes(`data-amr-open="${antibiotic.id}"`), `Thiếu nút chi tiết: ${antibiotic.id}`);
});

const renalCoverage = clinicalData.renalAdjustment.map((drug) => ({
  name: drug.name,
  matched: Boolean(moduleApi.findAntibiotic(drug.name)),
}));
assert.strictEqual(renalCoverage.filter((item) => item.matched).length, 10, 'Sai số kháng sinh chỉnh liều có dữ liệu AMR');
assert.strictEqual(
  renalCoverage.filter((item) => !item.matched).map((item) => item.name).join('|'),
  'Colistin (CMS)|Metronidazole',
  'Thuốc không có số liệu nguồn phải được nhận diện rõ',
);

const vancomycin = moduleApi.renderSummary('Vancomycin');
['Staphylococcus aureus (MRSA)', '84,2%', 'Streptococcus pneumoniae', '96,3%', 'Enterococcus faecium', '73,8%'].forEach((text) => {
  assert(vancomycin.includes(text), `Thiếu dữ liệu Vancomycin: ${text}`);
});
assert(moduleApi.renderSummary('Colistin (CMS)').includes('không có số liệu'), 'Không hiển thị trạng thái thiếu dữ liệu nguồn');

load('assets/data.js');
const currentProducts = context.window.VPMED_DRUGS;
assert.strictEqual(currentProducts.length, 34, 'Sai số chế phẩm trong công cụ tính liều hiện tại');
const mappedProducts = currentProducts.filter((drug) => moduleApi.findAntibiotic(drug.active || drug.brand));
assert.strictEqual(mappedProducts.length, 22, 'Sai số chế phẩm ánh xạ được dữ liệu AMR nguồn');
currentProducts.forEach((drug) => {
  const html = moduleApi.renderSummary(drug.active || drug.brand);
  assert(html.includes('Mức nhạy cảm kháng sinh'), `Thiếu khối AMR cho ${drug.brand}`);
  if (moduleApi.findAntibiotic(drug.active || drug.brand)) assert(html.includes('<progress '), `Thiếu số liệu AMR cho ${drug.brand}`);
  else assert(html.includes('không có số liệu'), `Thuốc ngoài nguồn phải báo thiếu số liệu: ${drug.brand}`);
});

const shell = fs.readFileSync(path.join(root, 'assets/platform-shell.js'), 'utf8');
assert(shell.includes("'assets/antibiotic-susceptibility.css?v=20260915-amr-v1'"), 'Module liều chưa nạp CSS AMR');
assert(shell.includes("'assets/js/antibiotic-susceptibility-data.js?v=20260915-amr-v1'"), 'Module liều chưa nạp dữ liệu AMR');
assert(shell.includes("'assets/js/antibiotic-susceptibility.js?v=20260915-amr-v1'"), 'Module liều chưa nạp renderer AMR');

const unified = fs.readFileSync(path.join(root, 'assets/unified.js'), 'utf8');
assert(unified.includes('function antibioticSusceptibilityHtml(d)'), 'Thiếu hàm ghép bảng AMR vào kết quả thực tế');
const warningEnd = unified.indexOf('</section>\n    ${antibioticSusceptibilityHtml(d)}');
assert(warningEnd >= 0, 'Bảng AMR phải nằm ngay sau khối LƯU Ý trong kết quả tính liều');
assert(unified.indexOf('<section class="result-source-row"', warningEnd) > warningEnd, 'Bảng AMR phải nằm trước dòng nguồn/kết thúc kết quả');

console.log('Antibiotic susceptibility data, mapping, summary, and page integration tests passed.');
