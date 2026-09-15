const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const dataContext = { window: {}, document: { readyState: 'loading', addEventListener() {} }, console };
dataContext.window.window = dataContext.window;
vm.createContext(dataContext);
['assets/data.js', 'assets/js/antibiotic-susceptibility-data.js', 'assets/js/antibiotic-susceptibility.js'].forEach((relativePath) => {
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), dataContext, { filename: relativePath });
});

const unified = fs.readFileSync(path.join(root, 'assets/unified.js'), 'utf8');
const helperStart = unified.indexOf('function antibioticSusceptibilityHtml');
const helperEnd = unified.indexOf('\nasync function copyTextToClipboard', helperStart);
assert(helperStart >= 0 && helperEnd > helperStart, 'Không tìm thấy hàm ghép bảng AMR trong unified.js');
const helperContext = { window: dataContext.window };
vm.createContext(helperContext);
vm.runInContext(`${unified.slice(helperStart, helperEnd)}\nthis.renderAmr = antibioticSusceptibilityHtml;`, helperContext);

const products = dataContext.window.VPMED_DRUGS;
const vancomycin = products.find((drug) => /vancomycin/i.test(drug.active));
const meropenem = products.find((drug) => /meropenem/i.test(drug.active));
assert(vancomycin && meropenem, 'Thiếu chế phẩm kiểm thử Vancomycin/Meropenem');

const vancomycinHtml = helperContext.renderAmr(vancomycin);
assert(vancomycinHtml.includes('class="amr-summary-card"'), 'Kết quả tính Vancomycin chưa có card AMR');
assert(vancomycinHtml.includes('Staphylococcus aureus (MRSA)'), 'Bảng Vancomycin thiếu MRSA');
assert(vancomycinHtml.includes('84,2%') && vancomycinHtml.includes('73,8%'), 'Bảng Vancomycin thiếu tỷ lệ theo ảnh tham chiếu');

const meropenemHtml = helperContext.renderAmr(meropenem);
assert(meropenemHtml.includes('data-amr-open="meropenem"'), 'Đổi sang Meropenem chưa đổi bảng AMR');
assert(!meropenemHtml.includes('data-amr-open="vancomycin"'), 'Bảng Vancomycin bị giữ lại khi đổi thuốc');

const unsupported = products.find((drug) => /metronidazol/i.test(drug.active));
assert(unsupported, 'Thiếu chế phẩm Metronidazole kiểm thử trạng thái thiếu nguồn');
const unsupportedHtml = helperContext.renderAmr(unsupported);
assert(unsupportedHtml.includes('không có số liệu'), 'Thuốc ngoài báo cáo phải hiện trạng thái thiếu dữ liệu');

console.log('Renal calculation output and AMR rendering flow tests passed.');
