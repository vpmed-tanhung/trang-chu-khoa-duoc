'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath));
}

function extract(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  assert(start >= 0, `Không tìm thấy mốc bắt đầu: ${startMarker}`);
  const end = text.indexOf(endMarker, start);
  assert(end >= 0, `Không tìm thấy mốc kết thúc: ${endMarker}`);
  return text.slice(start, end + endMarker.length);
}

assert.strictEqual(
  sha256(read('assets/disclaimer-gate.js')),
  '80f573e9d0031b33003a0d57415989b9cf58228718d5985e91bdf30d74e202b6',
  'Không được thay đổi logic Tuyên bố trách nhiệm đã duyệt'
);
assert.strictEqual(
  sha256(read('assets/disclaimer-gate.css')),
  '4dabd9868c2bc97099e00cde91cc795670c8f5b7e4bad96eb3d9d867f230f109',
  'Không được thay đổi giao diện Tuyên bố trách nhiệm đã duyệt'
);

const html = read('index.html').toString('utf8');
const modal = extract(
  html,
  '<div class="disclaimer-gate" id="disclaimerGate" hidden>',
  '  </section>\n</div>'
);
assert.strictEqual(
  sha256(modal),
  '7948daecccf6bb69395248057089a4cf7630e4e4fd96659e54f8d03337312ddd',
  'Không được thay đổi nội dung modal Tuyên bố trách nhiệm đã duyệt'
);
assert.ok(!html.includes('home-responsibility-note'), 'Thanh nhắc tĩnh phải được gỡ khỏi trang chủ');
assert.ok(!html.includes('reopenDisclaimerBtn'), 'Nút mở lại thanh nhắc tĩnh phải được gỡ khỏi trang chủ');

console.log('Disclaimer integrity tests: OK');
