const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'posts.js'), 'utf8');
const context = {
  window: { KHOA_DUOC_SERVER: {}, addEventListener() {} },
  document: { addEventListener() {} },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  Headers,
  URL,
  Date,
  Number,
  Promise,
  Uint8Array,
  setTimeout,
  clearTimeout
};

vm.createContext(context);
vm.runInContext(source, context);
const posts = context.window.KHOA_DUOC_POSTS;

assert.strictEqual(posts.formatDate('2026-09-06'), '06/09/2026');

assert.ok(!/Tuần\s+['"+]/.test(source), 'Không được tiếp tục tạo tiêu đề theo tuần.');
assert.ok(source.includes("link.textContent = 'Bản tin Dược'"));
assert.ok(source.includes("(item.author || 'admin') + ' - ' + formatDate(item.publish_date)"));
assert.ok(!source.includes('actualPostDateIso'), 'Không được thay ngày gốc bằng created_at.');

console.log('Đã kiểm tra ngày đăng thực tế và tiêu đề bản tin: OK');
