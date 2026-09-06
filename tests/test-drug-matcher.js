const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'assets', 'js', 'drug-documents.js'),
  'utf8'
);

const context = {
  window: {
    KHOA_DUOC_SERVER: {},
    addEventListener() {}
  },
  document: {
    addEventListener() {}
  },
  URL,
  Blob,
  Headers,
  fetch() {
    return Promise.reject(new Error('Không gọi mạng trong kiểm thử.'));
  },
  localStorage: {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  },
  sessionStorage: {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  },
  console,
  setTimeout,
  clearTimeout
};

vm.createContext(context);
vm.runInContext(source, context);
const matcher = context.window.KHOA_DUOC_DRUG_MATCHER;

assert.ok(matcher, 'Phải công khai bộ đối chiếu để kiểm thử.');

function match(documentTitle, instructions) {
  return matcher.findMatchingInstruction(
    { title: documentTitle },
    instructions.map(function (item) {
      return typeof item === 'string' ? { title: item } : item;
    })
  );
}

assert.strictEqual(
  match('Thuốc kháng sinh Meropenem 1g', [
    'HƯỚNG DẪN SỬ DỤNG THUỐC BỘT PHA TIÊM MEROPENEM 1g'
  ]).title,
  'HƯỚNG DẪN SỬ DỤNG THUỐC BỘT PHA TIÊM MEROPENEM 1g'
);

assert.strictEqual(
  match('Thuốc kháng sinh Meropenem 1 g', [
    'Meropenem Kabi 1g',
    'Thuốc bột pha tiêm Meropenem 1g'
  ]).title,
  'Thuốc bột pha tiêm Meropenem 1g',
  'Ưu tiên HDSD có tên thuốc trùng chính xác hơn tên có thêm nhãn hiệu.'
);

assert.strictEqual(
  match('Meropenem 1000 mg', ['Meropenem 1 g']).title,
  'Meropenem 1 g',
  '1 g phải tương đương 1000 mg.'
);

assert.strictEqual(
  match('Meropenem 500 mg', ['Meropenem 1 g']),
  null,
  'Không được ghép khi hàm lượng khác nhau.'
);

assert.strictEqual(
  match('Amoxicillin Clavulanat 1g', [
    'Amoxicillin 1g',
    'Clavulanat 1g'
  ]),
  null,
  'Không được tự ghép khi có hai kết quả ngang điểm nhưng khác thuốc.'
);

assert.strictEqual(
  match('Thuốc kháng sinh Meropenem 1g', [{
    title: 'Tờ hướng dẫn sử dụng',
    keywords: 'Meropenem 1 g'
  }]).keywords,
  'Meropenem 1 g',
  'Phải đối chiếu cả từ khóa/hoạt chất của HDSD.'
);

const cefoperazonMatch = match('Thông tin thuốc mới Thuốc kháng sinh Cefoperazon 1000 mg', [{
  title: 'SUNEWTAM 2g',
  keywords: 'Cefoperazon 1000 mg Sulbactam 1000 mg'
}, {
  title: 'HƯỚNG DẪN SỬ DỤNG THUỐC CEFOPERAZONE 1000 CEFOPERAZONE 2000',
  keywords: ''
}]);

assert.strictEqual(
  cefoperazonMatch.title,
  'HƯỚNG DẪN SỬ DỤNG THUỐC CEFOPERAZONE 1000 CEFOPERAZONE 2000',
  'Cefoperazon phải ghép với HDSD Cefoperazone, không được ghép SUNEWTAM theo từ khóa.'
);

assert.strictEqual(
  match('Thuốc kháng sinh Cefoperazon 1000 mg', [{
    title: 'SUNEWTAM 2g',
    keywords: 'Cefoperazon 1000 mg Sulbactam 1000 mg'
  }]),
  null,
  'Không được dùng hoạt chất trong từ khóa để ghép HDSD mang tên thuốc khác.'
);

const recentContent = matcher.buildRecentContent(
  [{ title: 'Tài liệu thuốc', signedDate: '2026-07-10', createdAt: '2026-07-10T08:00:00Z' }],
  [{ title: 'Tờ hướng dẫn', signedDate: '2026-07-11', createdAt: '2026-07-11T08:00:00Z', url: '/hdsd.pdf' }],
  [{ title: 'Bài cảnh báo', publishDate: '2026-07-12', createdAt: '2026-07-12T08:00:00Z', url: '/post.pdf' }]
);

assert.deepStrictEqual(
  Array.from(recentContent, function (item) { return item.type; }),
  ['post', 'instruction', 'document'],
  'Bài viết mới phải tổng hợp và sắp xếp đủ bài viết, HDSD và Thông tin thuốc.'
);
assert.strictEqual(matcher.groupRecentContentByMonth(recentContent)['2026-07'], 3);

console.log('Đã kiểm tra bộ đối chiếu thuốc/HDSD: OK');
