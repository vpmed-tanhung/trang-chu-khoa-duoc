const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

const editorSource = read('assets/js/title-editor.js');
const context = { window: {}, document: {} };
vm.createContext(context);
vm.runInContext(editorSource, context);

assert.strictEqual(
  context.window.KHOA_DUOC_TITLE_EDITOR.normalizeTitle('  Tiêu đề   mới  '),
  'Tiêu đề mới',
  'Tiêu đề phải được loại khoảng trắng thừa trước khi lưu.'
);

const postsSource = read('assets/js/posts.js');
const documentsSource = read('assets/js/drug-documents.js');
const instructionsSource = read('assets/js/instructions-secure.js');
const instructionListSource = read('assets/js/instructions.js');
const policySource = read('supabase/04_CHO_PHEP_SUA_TIEU_DE.sql');

assert.ok(postsSource.includes("method: 'PATCH'"));
assert.ok(postsSource.includes("/rest/v1/posts?id=eq."));
assert.ok(postsSource.includes("edit.textContent = 'Sửa tiêu đề'"));

assert.ok(documentsSource.includes("/rest/v1/drug_documents?id=eq."));
assert.ok(documentsSource.includes("editButton.textContent = 'Sửa tiêu đề'"));

assert.ok(instructionsSource.includes("/rest/v1/drug_instructions?id=eq."));
assert.ok(instructionListSource.includes("edit.textContent = 'Sửa tiêu đề'"));

assert.ok(policySource.includes('Admin can update posts'));
assert.ok(policySource.includes('Pharmacy staff can update drug documents'));
assert.ok(policySource.includes('Pharmacy staff can update drug instructions'));

console.log('Đã kiểm tra sửa tiêu đề cho Bản tin Dược, Thông tin thuốc và HDSD: OK');
