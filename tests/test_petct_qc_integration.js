'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'assets/platform-shell.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const batchUi = fs.readFileSync(path.join(root, 'assets/petct-tool.js'), 'utf8');
const qcUi = fs.readFileSync(path.join(root, 'assets/petct-qc.js'), 'utf8');
const qcConfig = fs.readFileSync(path.join(root, 'assets/petct-qc-supabase-config.js'), 'utf8');
const qcSql = fs.readFileSync(path.join(root, 'supabase/qc_records.sql'), 'utf8');

const qcPosition = index.indexOf('id="petctQcModule"');
const batchPosition = index.indexOf('<h2>Kế hoạch hoạt độ nhiều ca</h2>');
assert(qcPosition >= 0, 'Thiếu mô-đun QC trong trang PET/CT');
assert(batchPosition > qcPosition, 'QC phải đứng ngay trước Kế hoạch hoạt độ nhiều ca');

for (const removedText of [
  'Tính đơn bệnh nhân theo từng bước',
  'Tính cho một bệnh nhân',
  'Kết quả tính đơn bệnh nhân',
  'Bảng diễn giải tính đơn bệnh nhân',
  'id="singleCondition"',
  'id="tracerSelect"',
  'id="weight"',
  'id="drawDate"'
]) {
  assert(!index.includes(removedText), 'Còn nội dung tính đơn: ' + removedText);
}

for (const removedCode of ['function calc(', 'function clearPatient(', 'const tracerData', 'function chooseTracer(', 'petctParseBloodPressure']) {
  assert(!batchUi.includes(removedCode), 'Còn logic tính đơn: ' + removedCode);
}

assert(shell.includes('assets/petct-qc-calculator.js?v=20260914-qc-v1'));
assert(shell.includes('assets/petct-qc-supabase-config.js?v=20260914-supabase-v1'));
assert(shell.includes('assets/petct-qc.js?v=20260914-supabase-delete-v2'));
assert(!shell.includes('petct_step_form.js'));
assert(worker.includes("'./assets/petct-qc-calculator.js'"));
assert(worker.includes("'./assets/petct-qc-supabase-config.js'"));
assert(worker.includes("'./assets/petct-qc.js'"));
assert(!worker.includes('petct_step_form.js'));

assert(index.includes('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'));
assert(index.includes('id="qcSyncButton"'));
assert(index.includes('Làm mới / Đồng bộ'));
assert(index.includes('id="qcClearSavedButton"'));
assert(index.includes('Xóa toàn bộ dữ liệu'));
assert(qcConfig.includes("const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';"));
assert(qcConfig.includes("const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';"));
assert(qcUi.includes("const supabaseTable = 'qc_records'"));
assert(qcUi.includes('.insert(toSupabaseRow(record))'));
assert(qcUi.includes(".delete()\n      .eq('client_record_id', clientRecordId)"));
assert(qcUi.includes(".delete()\n      .neq('client_record_id', '')"));
assert(qcUi.includes('async function deleteRecord(id)'));
assert(qcUi.includes('async function clearAllRecords()'));
assert(qcUi.includes('async function refreshAndSync(manual)'));
assert(qcUi.includes("window.addEventListener('online'"));
const saveBlock = qcUi.slice(qcUi.indexOf('async function saveRecord(event)'), qcUi.indexOf('function resetForm()'));
assert(saveBlock.indexOf('records.push(record)') < saveBlock.indexOf('await insertRemoteRecord(record)'), 'Phải lưu cục bộ trước khi INSERT Supabase');

assert(qcSql.includes('create table if not exists public.qc_records'));
assert(qcSql.includes('alter table public.qc_records enable row level security'));
assert(qcSql.includes('grant select, insert, delete on table public.qc_records to anon, authenticated'));
assert(qcSql.includes('create policy "qc_records_read_history"'));
assert(qcSql.includes('create policy "qc_records_insert_valid"'));
assert(qcSql.includes('create policy "qc_records_delete_history"'));
assert(!qcSql.includes('grant select, insert, update, delete'));

const deleteOneBlock = qcUi.slice(qcUi.indexOf('async function deleteRecord(id)'), qcUi.indexOf('async function clearAllRecords()'));
assert(deleteOneBlock.indexOf('await deleteRemoteRecord(id)') < deleteOneBlock.indexOf('records = records.filter'), 'Phải xóa Supabase thành công trước khi xóa cục bộ');
const deleteAllStart = qcUi.indexOf('async function clearAllRecords()');
const deleteAllBlock = qcUi.slice(deleteAllStart, qcUi.indexOf("byId('petctQcForm').addEventListener", deleteAllStart));
assert(deleteAllBlock.indexOf('await deleteAllRemoteRecords()') < deleteAllBlock.indexOf('records = []'), 'Phải xóa toàn bộ Supabase thành công trước khi xóa localStorage');

const expectedHeaders = [
  'Tên dược chất', 'Ngày thực hiện', 'Số lô sx', 'Hãng sx', 'HĐ gắn (mCi)',
  'DM Aceton TOP (µCi)', 'DM Aceton BOT (µCi)',
  'DM NaCl 0.9% Top (µCi)', 'DM NaCl 0.9% BOT (µCi)',
  'DM Ethanol 96% Sep-Pak (µCi)', 'DM Ethanol 96% Ethanol (µCi)',
  'HS gắn % (B*)', 'pH', 'Mo-99 (µCi)', 'Nhôm tạp chất (so màu)',
  'Người pha chế', 'Người QC'
];
let previousHeaderPosition = -1;
for (const header of expectedHeaders) {
  const position = qcUi.indexOf("'" + header + "'", previousHeaderPosition + 1);
  assert(position > previousHeaderPosition, 'Sai hoặc thiếu thứ tự cột CSV: ' + header);
  previousHeaderPosition = position;
}
assert(qcUi.includes("const storageKey = 'vpmed-petct-qc-records-v1'"));
assert(qcUi.includes("'\\uFEFFsep=;\\r\\n'"));

assert(!fs.existsSync(path.join(root, 'assets/petct_step_form.js')));
assert(!fs.existsSync(path.join(root, 'assets/js/module4-petct-dose.js')));

console.log('PET/CT QC integration tests: OK');
