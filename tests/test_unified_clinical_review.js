'use strict';

const assert = require('assert');
const fs = require('fs');

const gs = fs.readFileSync('apps-script/inpatient-order-review.gs', 'utf8');
const rx = fs.readFileSync('assets/prescription-check.js', 'utf8');
const inpatient = fs.readFileSync('assets/inpatient-order-review.js', 'utf8');
const config = fs.readFileSync('assets/js/server-config.js', 'utf8');
const posts = fs.readFileSync('assets/js/posts.js', 'utf8');
const publicSql = fs.readFileSync('supabase/05_MO_CONG_KHAI_CHUYEN_MUC.sql', 'utf8');

assert(config.includes('clinicalReviewWebAppUrl'), 'Endpoint AI phải có một nguồn cấu hình chung');
assert(rx.includes("action:'review_bhyt'"), 'BHYT phải gọi action review_bhyt');
assert(inpatient.includes("action: 'review_inpatient'"), 'Nội trú phải gọi action review_inpatient');
assert(gs.includes("action === 'review_bhyt'") && gs.includes("action === 'review_inpatient'"), 'Apps Script phải định tuyến hai action');
assert(gs.includes('function doGet(e)') && gs.includes("action || 'health'"), 'Apps Script phải có health check');
assert(gs.includes('NGUY CƠ XUẤT TOÁN: thuốc BHYT không có mã ICD-10 tương ứng'), 'Backend phải có chốt an toàn thiếu ICD');
assert(gs.includes('BHYT-BHYT') && gs.includes('BHYT-Dịch vụ'), 'Prompt BHYT phải rà soát tương tác cùng nguồn và chéo');
assert(rx.includes("hit.first.payment==='BHYT'||hit.second.payment==='BHYT'"), 'Frontend phải giới hạn rà soát đơn vào các cặp có thuốc BHYT');
assert(gs.includes('highPriorityIssues') && gs.includes('patientRecord') && gs.includes('monitoringPlan'), 'Schema nội trú phải có ưu tiên, 5 phần bệnh án và theo dõi');
assert(inpatient.includes('io-review-table') && inpatient.includes('Tương tác thuốc và tương kỵ'), 'Frontend phải dựng các bảng lâm sàng');
assert(posts.includes('selectedCategory') && posts.includes('&category=eq.'), 'Danh sách bài phải hỗ trợ chuyên mục công khai');
for (const table of ['drug_documents', 'drug_instructions', 'posts']) {
  assert(publicSql.includes(`grant select on table public.${table} to anon, authenticated`), `${table} phải cho khách đọc`);
}
assert(!publicSql.includes('grant insert') && !publicSql.includes('grant update') && !publicSql.includes('grant delete'), 'Migration công khai không được mở quyền quản trị');

console.log('Unified clinical review and public categories tests: OK');
