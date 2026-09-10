'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/<!--[\s\S]*?-->/g, '');

function localReferences(attribute, extension) {
  const pattern = new RegExp(`${attribute}=["']([^"']+\\${extension}(?:\\?[^"']*)?)["']`, 'g');
  return [...html.matchAll(pattern)]
    .map((match) => match[1])
    .filter((url) => !/^https?:/i.test(url));
}

const scripts = localReferences('src', '.js');
const styles = localReferences('href', '.css');

for (const forbidden of [
  'assets/hepatotoxicity.js',
  'assets/pregnancy_lactation.js',
  'assets/injectable_guide.js',
  'assets/pharmacovigilance_integration.js',
  'assets/prescription-check.js',
  'assets/inpatient-order-review.js',
  'assets/petct-tool.js'
]) {
  assert(!scripts.some((url) => url.split('?')[0] === forbidden), `${forbidden} phải được lazy-load`);
}

const shell = fs.readFileSync(path.join(root, 'assets/platform-shell.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.ok(index.includes('data-open="antibiotic-consultation"'), 'Trang chủ phải giữ card Kháng sinh cần hội chẩn khi dùng');
assert.ok(index.includes('Kháng sinh cần hội chẩn khi dùng'), 'Không được làm mất tên card hội chẩn kháng sinh');
assert.ok(shell.includes("'antibiotic-consultation': {"), 'Card hội chẩn phải có bundle riêng để mở trực tiếp từ trang chủ');
for (const contract of [
  'requestIdleCallback', 'saveData', 'effectiveType', 'beforeinstallprompt',
  'vpmed:shell-ready', 'vpmed:feature-open', 'vpmed:calculation-complete',
  'vpmed:data-version-changed', 'resourceLoads',
  'Promise.all(bundle.scripts.map(loadScript))', "schedulePrefetch('dose')"
]) {
  assert(shell.includes(contract), `Platform Shell thiếu contract ${contract}`);
}

// index.html là sandbox công khai, không còn yêu cầu đăng nhập nên không còn nạp
// Supabase Auth hay màn hình loading kiểm tra phiên đăng nhập.
assert(index.includes('id="clinical-workspace"'), 'index.html phải chứa workspace lâm sàng tích hợp');
assert(!index.includes('systemLoader'), 'index.html không được còn màn hình loading khởi động');
assert(!index.includes('vpmed-auth-checking'), 'index.html không được còn cờ kiểm tra xác thực khi khởi chạy');

// tai-khoan.html (đăng nhập) và cong-cu-duoc-lam-sang.html (trang lẻ không dùng)
// đã được gỡ bỏ khỏi dự án cùng với toàn bộ luồng Supabase Auth.

console.log('Hub loading contract tests: OK');
