const assert = require('assert');
const fs = require('fs');

const auth = fs.readFileSync('assets/js/global-auth.js', 'utf8');
const shell = fs.readFileSync('assets/platform-shell.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const medicalUi = fs.readFileSync('assets/css/medical-ui-v2.css', 'utf8');
const documents = fs.readFileSync('thong-tin-thuoc.html', 'utf8');
const instructions = fs.readFileSync('huong-dan-su-dung.html', 'utf8');

for (const feature of ['dose', 'interactions', 'pediatric-dose', 'antibiotics', 'cap-cuu-phan-ve', 'pharmacovigilance', 'sources']) {
  assert(auth.includes(`'${feature}'`), `Danh sách truy cập khách phải có ${feature}`);
}
assert(shell.indexOf('!auth.canAccessFeature(name)') < shell.indexOf('setCardLoading(name, true)'),
  'Router guard phải chạy trước khi module bắt đầu tải');
assert(shell.includes("auth.openLogin({message: 'Công cụ này dành cho tài khoản Khoa Dược."),
  'Module khóa phải mở modal đăng nhập toàn cục');
assert(index.indexOf('assets/js/server-config.js') < index.indexOf('assets/js/global-auth.js') &&
  index.indexOf('assets/js/global-auth.js') < index.indexOf('assets/platform-shell.js'),
  'Global Auth phải tải sau cấu hình máy chủ và trước router');
assert(!index.includes('post-login-dialog') && !documents.includes('staff-login-dialog') && !instructions.includes('staff-login-dialog'),
  'Không được còn modal đăng nhập rời rạc trong các trang');
assert(!documents.includes('data-requires-staff="true"') && !instructions.includes('data-requires-staff="true"'),
  'Thông tin thuốc và Hướng dẫn sử dụng phải mở công khai cho khách');
for (const category of ['Cảnh báo an toàn', 'Tương tác thuốc', 'Thông báo nội bộ']) {
  assert(index.includes(`>${category}</a>`), `Chuyên mục ${category} phải là liên kết công khai`);
}
assert(index.includes('<b>Quản lý kháng sinh</b>') && index.includes('<h1>Quản lý kháng sinh</h1>'),
  'Tên Quản lý kháng sinh phải đồng bộ ở card và tiêu đề');
for (const feature of ['inpatient-order', 'prescription-check', 'antibiotic-consultation', 'diseases', 'injectable-guide', 'pregnancy-lactation', 'hepatotoxicity', 'icd10-bhyt', 'petct-dose']) {
  const cardPattern = new RegExp(`<button[^>]*data-open="${feature}"[^>]*hidden`);
  assert(cardPattern.test(index), `Card nội bộ ${feature} phải ẩn sẵn với khách`);
}
for (const feature of ['dose', 'interactions', 'pediatric-dose', 'antibiotics', 'cap-cuu-phan-ve', 'pharmacovigilance', 'sources']) {
  const publicCard = index.match(new RegExp(`<button[^>]*data-open="${feature}"[^>]*>[\\s\\S]*?</button>`));
  const openingTag = publicCard && publicCard[0].slice(0, publicCard[0].indexOf('>') + 1);
  assert(publicCard && !/\shidden(?:\s|>|=)/.test(openingTag), `Card công khai ${feature} không được ẩn`);
  assert(!/<em>/.test(publicCard[0]), `Card ${feature} không được có nhãn trạng thái truy cập`);
}
assert(index.includes('data-open="sources">Nguồn dữ liệu hệ thống</a>'), 'Menu phải mở Nguồn dữ liệu hệ thống');
assert(index.includes('data-clinical-tool-count>7 công cụ</span>'), 'Khách phải thấy đúng bảy công cụ');
assert(auth.includes('node.hidden = hiddenForGuest'), 'Global Auth phải ẩn hiện module nội bộ theo phiên đăng nhập');
assert(medicalUi.includes('min-height: 0 !important') && medicalUi.includes('.feature-card[data-open][hidden]'),
  'CSS phải bỏ chiều cao 100vh và ưu tiên ẩn card nội bộ');

console.log('Global authentication and access-control tests: OK');
