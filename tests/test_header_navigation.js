'use strict';

const assert = require('assert');
const fs = require('fs');

const index = fs.readFileSync('index.html', 'utf8');
const integration = fs.readFileSync('assets/js/clinical-integration.js', 'utf8');
const medicalUi = fs.readFileSync('assets/css/medical-ui-v2.css', 'utf8');

const navMatch = index.match(/<nav class="main-nav"[\s\S]*?<\/nav>/);
assert(navMatch, 'Không tìm thấy thanh điều hướng chính');
const nav = navMatch[0];
const introMatch = nav.match(/<div class="nav-dropdown-menu intro-nav-menu"[\s\S]*?<\/div>/);
assert(introMatch, 'Giới thiệu phải có menu xổ xuống');
for (const href of ['#gioi-thieu', '#chuc-nang', '#to-chuc', '#ban-tin']) {
  assert(introMatch[0].includes(`href="${href}"`), `${href} phải nằm trong menu Giới thiệu`);
}
assert(!/<li><a href="#(?:chuc-nang|to-chuc|ban-tin)"/.test(nav),
  'Chức năng, Cơ cấu và Bản tin không được còn đứng riêng trên thanh điều hướng');
assert(integration.includes("querySelectorAll('.nav-dropdown-item')") && integration.includes('closeAll(item)'),
  'Logic menu phải quản lý đồng thời Giới thiệu và Công cụ lâm sàng');
assert(medicalUi.includes('.site-header .brand { flex: 0 0 auto; min-width: 335px; }') &&
  medicalUi.includes('white-space: nowrap; overflow-wrap: normal;'),
  'Logo và tên Khoa Dược phải được khóa chống co thành cột dọc');
for (const removedCopy of [
  'Công cụ Dược lâm sàng',
  'Tra cứu nhanh, hỗ trợ quyết định an toàn',
  'Bốn công cụ thiết yếu dành cho bác sĩ và nhân viên y tế'
]) {
  assert(!index.includes(removedCopy), `Phải xóa bảng giới thiệu thừa: ${removedCopy}`);
}

console.log('Header navigation and no-wrap tests: OK');
