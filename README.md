# VPMED – Hệ thống Hỗ trợ Dược lâm sàng

## Nội dung đã triển khai
- 34 biệt dược kháng sinh nội trú, mỗi biệt dược là một hồ sơ riêng.
- Giao diện tra cứu rộng hơn, chữ lớn hơn, bảng tự xuống dòng và không tràn màn hình.
- Hồ sơ theo tab: Tổng quan, Liều & CrCl, Pha truyền, Chống chỉ định & ADR, Tương tác, Theo dõi & TDM, Nguồn.
- Hiệu chỉnh CrCl/lọc máu được chuẩn hóa lại cho các hoạt chất có dữ liệu phù hợp trong bảng BV Đại học Y Hà Nội ngày 21/05/2020 và đối chiếu tờ HDSD/Dược thư khi áp dụng.
- Trang `admin.html` cho phép thêm thuốc mới, nhập JSON/CSV, kiểm tra trường bắt buộc, test bằng localStorage và xuất lại `antibiotics.json`.

## Cách triển khai
1. Sao lưu repo hiện tại.
2. Copy toàn bộ nội dung thư mục này vào repo `trang-chu-khoa-duoc`.
3. Commit và Push bằng GitHub Desktop.
4. Mở GitHub Pages và nhấn Ctrl+F5.

## Cập nhật thuốc mới
GitHub Pages là web tĩnh, nên trang quản trị không thể tự ghi vào GitHub. Quy trình an toàn:
1. Mở `admin.html`.
2. Nhập hoặc import thuốc để test.
3. Xuất `antibiotics.json`.
4. Khoa Dược rà soát/phê duyệt.
5. Thay file `data/antibiotics.json`, Commit và Push.

## Nguồn hiệu chỉnh liều
- Bảng chỉnh liều thuốc kháng sinh, kháng nấm - BV Đại học Y Hà Nội, Khoa Cấp cứu & HSTC, 21/05/2020.
- Dược thư Quốc gia Việt Nam và tờ hướng dẫn sử dụng của chế phẩm/hoạt chất để đối chiếu khi áp dụng.

Công cụ hỗ trợ tra cứu; liều cuối cùng phụ thuộc chỉ định, mức độ nhiễm khuẩn, MIC/kháng sinh đồ, chức năng thận động học và phác đồ bệnh viện.


## Bản V7.1 Fixed

- Mở trực tiếp `index.html` trên Windows vẫn tải được đủ danh mục nhờ dữ liệu dự phòng nhúng.
- Khi chạy trên GitHub Pages, ứng dụng vẫn ưu tiên `data/antibiotics.json` để cập nhật dữ liệu mới.
- Trang quản trị có thể xuất tệp JSON cả khi đang mở bằng `file://`.
- Giữ nguyên dữ liệu chuyên môn và giao diện tra cứu của bản trước; chỉ sửa cơ chế tải dữ liệu và mẫu CSV.


## V7.2
- Đã bỏ khối “Trạng thái kiểm chứng” và ngày cập nhật khỏi giao diện người dùng.
- Giữ nguyên dữ liệu, nguồn tham khảo và chức năng tra cứu/cập nhật thuốc.


## V7.3 – Bổ sung chống chỉ định
- Mở rộng chống chỉ định riêng theo từng hoạt chất/biệt dược trong danh mục nội trú.
- Đồng bộ cả `data/antibiotics.json` và dữ liệu dự phòng mở local.
- Đối chiếu Dược thư Quốc gia Việt Nam lần 3 và tờ HDSD được phê duyệt; các chống chỉ định đặc thù chế phẩm/tá dược vẫn cần đối chiếu tờ HDSD đúng số đăng ký đang sử dụng tại bệnh viện.
