# Module đơn BHYT không nhận và đối soát tồn kho

Module quản lý ba nhóm dữ liệu liên kết với nhau:

1. Lượt khám/đơn thuốc bệnh nhân không nhận.
2. Danh mục thuốc thuộc từng đơn, gồm mã thuốc, tên thuốc, đơn vị, số lượng, đơn giá, tổng tiền, BHYT trả và bệnh nhân trả.
3. Tồn kho theo tháng, gồm tồn đầu, nhập, xuất sổ, tồn cuối sổ và tồn kiểm kê thực tế.

## Nâng cấp cơ sở dữ liệu

1. Sao lưu dữ liệu Supabase trước khi chạy migration trên hệ thống thật.
2. Mở Supabase SQL Editor.
3. Chạy toàn bộ `supabase/001_bhyt_nonpickup_cases.sql`.
4. Không xóa bảng cũ. Migration dùng `add column if not exists` nên giữ lại dữ liệu đơn đã có.
5. Đăng nhập bằng một tài khoản nội bộ và kiểm tra các RPC:
   - `bhyt_get_dashboard`
   - `bhyt_import_nonpickup_cases`
   - `bhyt_upsert_monthly_inventory`

Migration tạo thêm:

- `bhyt_nonpickup_items`: chi tiết thuốc của từng đơn.
- `bhyt_monthly_inventory`: tồn kho theo mã thuốc và tháng.
- `bhyt_daily_nonpickup_summary`: tổng hợp ngày.
- `bhyt_monthly_nonpickup_summary`: tổng hợp tháng.
- `bhyt_monthly_inventory_reconciliation`: dữ liệu đối soát từng mã thuốc.

Mọi bảng chỉ mở cho vai trò `authenticated`. Tài khoản chưa đăng nhập không đọc hoặc ghi được dữ liệu bệnh nhân.

## Cấu hình frontend

Điền URL và anon key của dự án trong `config.js`. Không đưa `service_role key` vào frontend.

Nếu website chính đã khởi tạo Supabase và đã có phiên đăng nhập, gán client vào `window.existingSupabaseClient` trước khi nạp `assets/js/nonpickup.js`. Khi đó module dùng chung phiên đăng nhập và không tạo client thứ hai.

## File Excel đơn không nhận

Module tự tìm dòng tiêu đề và cho phép ghép lại từng cột. Hai cột bắt buộc là:

- Họ và tên.
- Lý do / ghi chú.

Các cột thuốc nên có: mã thuốc, tên thuốc, đơn vị tính, số lượng, đơn giá, tổng tiền, BHYT trả và bệnh nhân trả. Nếu tổng tiền để trống, hệ thống tính `số lượng × đơn giá`.

Để gom đúng nhiều dòng thuốc vào một đơn, ưu tiên có `Số đơn thuốc` hoặc `Mã lượt khám`. Nếu không có, hệ thống dùng ngày + STT + họ tên + SĐT. File thiếu toàn bộ các khóa này có nguy cơ gom nhầm hai đơn của cùng bệnh nhân trong cùng ngày.

Nhập lại cùng một đơn sẽ cập nhật thông tin đơn và thay thế danh mục thuốc cũ của đơn đó. Mã thuốc được cắt khoảng trắng và chuyển thành chữ in hoa trước khi đối soát.

## File Excel tồn kho

Hai cột bắt buộc:

- Mã thuốc.
- Tên thuốc.

Các cột còn lại: đơn vị tính, tồn đầu, nhập trong tháng, xuất sổ, tồn cuối sổ, tồn thực tế và cờ “Xuất sổ gồm đơn không nhận”.

## Ý nghĩa đối soát

- Nếu số xuất đã gồm đơn không nhận: `Tồn vật lý dự kiến = Tồn đầu + Nhập - Xuất + Thuốc treo`.
- Nếu số xuất chưa gồm đơn không nhận: `Tồn vật lý dự kiến = Tồn đầu + Nhập - Xuất`.
- `Lệch thô = Tồn thực tế - Tồn cuối sổ`.
- Khi có số kiểm kê: `Lệch sau đối soát = Tồn thực tế - Tồn vật lý dự kiến`.
- Khi chưa có số kiểm kê, hệ thống chỉ kiểm tra quan hệ giữa tồn tính toán, tồn sổ và thuốc treo; đây chưa phải kết luận về tồn thực tế.

Không nên dùng kết quả “lệch sau đối soát” để kết luận nguyên nhân khi chưa xác nhận cách phần mềm kho ghi nhận đơn bệnh nhân không lấy. Cảnh báo của module là công cụ rà soát, không thay thế biên bản kiểm kê.

## Hiệu năng

- Danh sách đơn phân trang 50 dòng và truy vấn đúng khoảng thời gian đang chọn.
- Dashboard tổng hợp bằng RPC phía PostgreSQL, không tải toàn bộ tháng về trình duyệt.
- DOM được cập nhật bằng `DocumentFragment` và `replaceChildren`.
- Chỉ khi xuất Excel, module mới tải tuần tự toàn bộ đơn theo từng lô 1.000 dòng.

## Cấu trúc giữ nguyên

```text
bhyt-khong-lay-thuoc/
├── index.html
├── config.js
├── assets/
│   ├── css/nonpickup.css
│   └── js/nonpickup.js
├── supabase/001_bhyt_nonpickup_cases.sql
└── README.md
```
