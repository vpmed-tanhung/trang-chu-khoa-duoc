/**
 * HƯỚNG DẪN CÀI ĐẶT (mất khoảng 3–5 phút, làm 1 lần):
 *
 * 1. Vào https://sheets.google.com → tạo 1 Google Sheet mới, đặt tên tuỳ ý
 *    (ví dụ: "VPMED - Lich su tra cuu"). KHÔNG cần tạo sẵn cột/tiêu đề, script tự tạo.
 *
 * 2. Trong Sheet đó, vào menu Tiện ích mở rộng (Extensions) → Apps Script.
 *
 * 3. Xoá hết code mẫu, dán toàn bộ nội dung file này vào, rồi bấm Lưu (biểu tượng đĩa mềm).
 *
 * 4. Bấm nút "Triển khai" (Deploy) → "Triển khai mới" (New deployment).
 *    - Loại (Select type): chọn "Ứng dụng web" (Web app).
 *    - "Người thực thi" (Execute as): Tôi (email của anh).
 *    - "Người có quyền truy cập" (Who has access): Bất kỳ ai (Anyone).
 *    - Bấm Triển khai (Deploy) → cấp quyền (Authorize) theo yêu cầu của Google.
 *
 * 5. Copy đường link "URL ứng dụng web" (Web app URL) vừa được cấp
 *    (dạng: https://script.google.com/macros/s/XXXXXXXX/exec)
 *
 * 6. Dán URL đó vào biến CLOUD_URL trong file assets/unified.js (dòng có ghi chú
 *    "Dán URL Google Apps Script Web App vào đây").
 *
 * 7. Mỗi khi tính liều xong (trên điện thoại hoặc máy tính), kết quả sẽ tự động
 *    được ghi thêm 1 dòng vào Google Sheet này. Khi mở lại trang trên bất kỳ
 *    thiết bị nào, mục "Lịch sử tra cứu" sẽ tự tải dữ liệu mới nhất từ Sheet về.
 *
 * LƯU Ý AN TOÀN: Sheet này KHÔNG chứa tên bệnh nhân hay bất kỳ thông tin định danh
 * nào — chỉ có thời gian, CrCl, eGFR, tên thuốc và gợi ý liều. Nếu muốn xoá bớt
 * lịch sử, anh có thể xoá trực tiếp các dòng trong Google Sheet.
 */

const SHEET_NAME = 'History';
const HEADERS = ['time', 'crcl', 'egfr', 'drug', 'advice'];
const MAX_ROWS = 300; // giới hạn số dòng lưu trữ, dòng cũ nhất sẽ bị xoá bớt khi vượt quá

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function doGet(e) {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return ContentService.createTextOutput('[]').setMimeType(ContentService.MimeType.JSON);
  }
  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const data = rows
    .map(r => ({ time: r[0], crcl: r[1], egfr: r[2], drug: r[3], advice: r[4] }))
    .reverse(); // mới nhất lên đầu
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const sheet = getSheet_();
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'invalid_json' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  sheet.appendRow([body.time || '', body.crcl || '', body.egfr || '', body.drug || '', body.advice || '']);

  // Giữ tối đa MAX_ROWS dòng dữ liệu (không tính header), xoá bớt dòng cũ nhất nếu vượt quá
  const lastRow = sheet.getLastRow();
  const dataRows = lastRow - 1;
  if (dataRows > MAX_ROWS) {
    sheet.deleteRows(2, dataRows - MAX_ROWS);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
