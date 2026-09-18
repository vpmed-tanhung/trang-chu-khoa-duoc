'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const auth = fs.readFileSync(path.join(root, 'assets/js/global-auth.js'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'assets/platform-shell.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/mobile-only-fix.css'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/06_LUU_LICH_SU_CONG_CU.sql'), 'utf8');
const renal = fs.readFileSync(path.join(root, 'assets/vpmed-renal-audit.js'), 'utf8');
const pediatric = fs.readFileSync(path.join(root, 'assets/stock_clinical_tools.js'), 'utf8');

assert(shell.includes('assets/petct-qc-supabase-config.js?v=20260918-qc-live-v2'));
assert(!shell.includes('CAU_HINH_SUPABASE.js?v='), 'PET/CT không được nạp cấu hình mẫu ở thư mục gốc');

assert(auth.includes('window.VPMED_AUTH = bridge'));
assert(auth.includes('var bridge = Object.freeze'));
assert(auth.includes("window.dispatchEvent(new CustomEvent('vpmed-auth-ready'"));
assert(auth.includes("rpc('get_my_pharmacy_staff_profile')"));
assert(auth.includes('getAccessToken()'), 'REST audit bridge phải dùng access token hiện tại');

assert(sql.includes('create table if not exists public.renal_lookup_logs'));
assert(sql.includes('public.pharmacy_staff_members'));
assert(sql.includes('create or replace function public.get_my_pharmacy_staff_profile'));
assert(sql.includes('alter table public.renal_lookup_logs enable row level security'));

assert(renal.includes('06_LUU_LICH_SU_CONG_CU.sql'));
assert(pediatric.includes('06_LUU_LICH_SU_CONG_CU.sql'));
assert(css.includes('#view-dose .history-card'));
assert(css.includes('.stock-pediatric-history'));
assert(css.includes('.petct-qc-table'));
assert(css.includes('content: attr(data-label)'));

console.log('Mobile/Supabase recovery tests: OK');
