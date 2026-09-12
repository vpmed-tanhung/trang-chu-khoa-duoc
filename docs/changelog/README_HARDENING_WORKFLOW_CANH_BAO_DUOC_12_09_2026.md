# Hardening workflow cập nhật cảnh báo dược cho 4 tháng không giám sát — 12/09/2026

Tiếp theo phần sửa cú pháp YAML và tách 2 workflow (chính + dự phòng) đã làm
trước đó, lần này bổ sung các lớp bảo vệ để chạy ổn định khi không có ai theo
dõi trong thời gian dài (ví dụ đi học 4 tháng).

## 1. Gộp concurrency giữa 2 workflow

- `.github/workflows/du-phong-cap-nhat-canh-bao-duoc.yml` (workflow chạy tay
  dự phòng) nay dùng **chung 1 nhóm concurrency** (`cap-nhat-canh-bao-duoc`)
  với workflow chính, `cancel-in-progress: false`.
- Trước đây workflow dự phòng không khai báo concurrency nên có thể chạy
  song song với lịch tự động nếu ai đó bấm "Run workflow" đúng lúc — 2 lượt
  cùng ghi/đẩy dữ liệu dễ gây xung đột commit. Nay 2 workflow xếp hàng chờ
  nhau thay vì đè lên nhau.

## 2. Tự tạo/đóng GitHub Issue khi lỗi liên tục

Thêm 2 script dùng chung cho cả 2 workflow:

- `scripts/report_pharmacovigilance_failure.sh` — chạy khi job lỗi
  (`if: failure()`). Tự tạo nhãn `canh-bao-duoc-loi-tu-dong` nếu chưa có, rồi
  mở **một** Issue theo dõi lỗi; nếu issue đó đã tồn tại và còn mở, chỉ bình
  luận thêm vào issue cũ thay vì tạo issue mới mỗi ngày lỗi.
- `scripts/close_pharmacovigilance_failure_issue.sh` — chạy khi job thành
  công (`if: success()`). Tự bình luận xác nhận và đóng issue lỗi đang mở
  (nếu có).

Nhờ vậy khi quay lại sau vài tháng, chỉ cần mở tab **Issues** của repo thay
vì phải lục log từng lượt chạy trong Actions để biết có lỗi hay không.

Cả 2 workflow được cấp thêm quyền `issues: write` (giữ nguyên
`contents: write` để commit/push dữ liệu như trước).

## 3. Về rủi ro mạng thoáng qua

Việc gọi trang nguồn trong `scripts/update_pharmacovigilance.py` đã tự thử
lại (retry) ở tầng HTTP qua `urllib3.util.retry.Retry` (tối đa 3 lần, có
backoff, áp dụng cho các mã lỗi 429/500/502/503/504) — một lượt gặp lỗi mạng
thoáng qua thường tự phục hồi trong cùng lượt chạy mà không cần can thiệp.
Nếu lỗi vẫn vượt quá số lần thử lại đó (ví dụ trang nguồn đổi cấu trúc HTML
khiến parser không tìm thấy dữ liệu), job sẽ thất bại và kích hoạt Issue tự
động ở mục 2.

## Đã kiểm chứng

Bổ sung `tests/test_pharmacovigilance_failure_alerting.py`, chạy cùng bộ
test hiện có bằng pytest (không cần mạng, chỉ đọc lại nội dung 2 file
workflow và 2 script bằng regex):

- 2 workflow dùng chung đúng 1 nhóm concurrency và đều giữ
  `cancel-in-progress: false`.
- Cả 2 đều có quyền `issues: write` lẫn `contents: write`.
- Cả 2 đều gọi đúng 2 script tạo/đóng Issue ở đúng điều kiện
  `if: failure()` / `if: success()`, có truyền `GH_TOKEN`.
- 2 script dùng chung đúng 1 nhãn Issue (tránh tạo issue trùng lặp).

Toàn bộ 6 test liên quan đến workflow cùng 18 test hiện có của
`update_pharmacovigilance.py` đều PASS.

## Lưu ý khi đưa lên GitHub

- Cần **Settings → Actions → General → Workflow permissions** đặt là
  "Read and write permissions" (đã lưu ý từ lần sửa YAML trước) — quyền này
  áp dụng cho cả việc push dữ liệu lẫn việc tạo/đóng Issue tự động.
- Không cần thêm secret nào khác — `GH_TOKEN: ${{ github.token }}` dùng
  token mặc định `GITHUB_TOKEN` do GitHub cấp cho mỗi lượt chạy.
