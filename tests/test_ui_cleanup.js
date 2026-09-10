'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/medical-ui-v2.css'), 'utf8');
const cleanupCss = fs.readFileSync(path.join(root, 'assets/css/access-label-cleanup-v2.css'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'assets/js/global-auth.js'), 'utf8');
const unified = fs.readFileSync(path.join(root, 'assets/unified.js'), 'utf8');

assert.ok(!html.includes('>Công khai<'), 'Không được còn nhãn Công khai trên giao diện');
assert.ok(!html.includes('Truy cập công khai'), 'Không được còn tiêu đề Truy cập công khai');
assert.ok(!html.includes('clinical-system-footer'), 'Phải gỡ dòng phiên bản hệ thống ở cuối công cụ');
assert.ok(!html.includes('home-responsibility-note'), 'Phải gỡ khối cảnh báo tĩnh khỏi trang công cụ');
assert.ok(!html.includes('Công cụ hỗ trợ quyết định lâm sàng, không thay thế đánh giá chuyên môn trực tiếp'), 'Phải gỡ nội dung cảnh báo tĩnh');
assert.ok(!css.includes('content: "Công khai"'), 'CSS không được tự chèn nhãn vào menu');
assert.ok(!auth.includes("publicAccess ? 'Công khai'"), 'Auth không được khôi phục nhãn đã gỡ');
assert.ok(auth.includes("node.classList.remove('is-public-feature')"), 'Auth phải gỡ class có thể kích hoạt CSS cũ');
assert.ok(cleanupCss.includes('content: none !important'), 'Phải chặn pseudo-element còn lại từ cache cũ');
assert.ok(cleanupCss.includes('display: none !important'), 'Nhãn sinh từ CSS cũ phải bị ẩn tuyệt đối');
assert.ok(html.includes('assets/css/access-label-cleanup-v2.css'));
assert.ok(!html.includes('access-label-cleanup-v2.js'), 'Không được nạp observer dọn nhãn gây vòng lặp render');
assert.ok(auth.includes("if (badge && publicAccess) badge.remove()"), 'Auth phải xóa nhãn trên thẻ công cụ công khai');
assert.ok(css.includes('border-radius: 0 !important;'), 'Danh sách giới thiệu phải giữ thiết kế phẳng, không bo góc');
assert.ok(css.includes('box-shadow: none !important;'), 'Danh sách giới thiệu không được có bóng card');

assert.ok(
  unified.includes("<td>${esc(x.department||'—')}</td><td>${esc(x.crcl)} mL/ph</td>"),
  'Dòng lịch sử phải có cột Khoa/phòng trước CrCl'
);
assert.ok(unified.includes("['Thời gian','Mã bệnh nhân','Khoa/phòng sử dụng','CrCl','eGFR','Thuốc','Gợi ý']"));
assert.ok(unified.includes('manageVisible?8:7'), 'Dòng trống phải phủ đúng bảy hoặc tám cột theo quyền quản trị');

console.log('UI cleanup tests: OK');
