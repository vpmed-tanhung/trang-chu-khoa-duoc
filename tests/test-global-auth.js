const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pages = ['index.html', 'thong-tin-thuoc.html', 'huong-dan-su-dung.html', 'cong-cu-tuong-tac-thuoc.html', 'cong-cu-lieu-khang-sinh.html', 'cong-cu-lieu-nhi.html', 'cong-cu-pet-ct.html'];
const globalAuth = fs.readFileSync(path.join(root, 'assets/js/global-auth.js'), 'utf8');

assert.ok(globalAuth.includes('khoa-duoc-secure-staff-session'));
assert.ok(globalAuth.includes('is_pharmacy_staff'));
assert.ok(globalAuth.includes('khoa-duoc-auth-changed'));

// Quyền admin được xác thực riêng qua RPC is_pharmacy_admin (posts.js), không
// phụ thuộc vào is_pharmacy_staff trong global-auth.js.
const postsSource = fs.readFileSync(path.join(root, 'assets/js/posts.js'), 'utf8');
assert.ok(postsSource.includes('is_pharmacy_admin'), 'posts.js phải xác thực quyền admin qua RPC is_pharmacy_admin.');

pages.forEach(function (page) {
  const source = fs.readFileSync(path.join(root, page), 'utf8');
  assert.ok(source.includes('assets/js/global-auth.js'), page + ' phải dùng đăng nhập toàn trang.');
});

['index.html', 'thong-tin-thuoc.html', 'huong-dan-su-dung.html'].forEach(function (page) {
  const source = fs.readFileSync(path.join(root, page), 'utf8');
  ['open-post-login', 'post-login-dialog', 'open-staff-login', 'staff-login-dialog'].forEach(function (legacyId) {
    assert.ok(!source.includes('id="' + legacyId + '"'), page + ' còn điểm đăng nhập cũ: ' + legacyId);
  });
});

['drug-documents.js', 'posts.js', 'instructions-secure.js'].forEach(function (file) {
  const source = fs.readFileSync(path.join(root, 'assets/js', file), 'utf8');
  assert.ok(source.includes('KHOA_DUOC_AUTH'), file + ' phải dùng phiên đăng nhập chung.');
  // Cập nhật theo thay đổi đăng nhập có thể qua sự kiện DOM 'khoa-duoc-auth-changed'
  // hoặc qua KHOA_DUOC_AUTH.subscribe(...) — cả hai đều được setState() trong
  // global-auth.js kích hoạt đồng thời, nên cùng phản ánh đúng trạng thái đăng nhập.
  assert.ok(
    source.includes('khoa-duoc-auth-changed') || source.includes('KHOA_DUOC_AUTH.subscribe'),
    file + ' phải cập nhật theo sự kiện đăng nhập chung.'
  );
});

console.log('Đã kiểm tra đăng nhập toàn trang và một điểm đăng nhập duy nhất: OK');
