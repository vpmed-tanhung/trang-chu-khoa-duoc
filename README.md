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

## Bổ sung danh mục tương tác thuốc

- `interactions.html`: giao diện tra cứu tương tác.
- `data/interactions.json`: dữ liệu nhập từ tệp `Dm TT CCĐ.xls`.
- `js/interactions.js`: logic tìm kiếm và kiểm tra cặp thuốc.
- Các module đang hoạt động khác được giữ nguyên.

## Bổ sung tên thuốc theo danh mục nội trú
- Ô kiểm tra tương tác nhận cả **tên biệt dược nội trú** và **tên hoạt chất**.
- Danh sách gợi ý hiển thị theo dạng: `Biệt dược — Hoạt chất (hàm lượng)`.
- Khi kiểm tra, hệ thống tự quy đổi biệt dược sang hoạt chất tương ứng.
- Kết quả tương tác hiển thị kèm tên biệt dược nội trú nếu hoạt chất có trong danh mục.


## Cập nhật giao diện
- Tất cả nội dung chi tiết của tương tác được thu gọn mặc định.
- Chỉ hiển thị Mức độ, Hậu quả, Cơ chế, Cách xử trí và Nguồn khi người dùng nhấp từng mục.
- Danh sách chỉ hiển thị tên cặp thuốc; không hiển thị sẵn mức độ hay nội dung.

## Bảo mật trang cập nhật thuốc

- Trang chủ đã ẩn hoàn toàn thẻ và liên kết **Cập nhật thuốc mới**.
- Truy cập quản trị qua URL riêng: `admin-login.html`.
- Trang `admin.html` yêu cầu đăng nhập Firebase Authentication trước khi hiển thị.
- Tài khoản không được đăng ký trong danh sách email/tên miền nội bộ sẽ bị đăng xuất.

### Thiết lập một lần

1. Tạo project tại Firebase Console.
2. Vào **Authentication → Sign-in method** và bật **Email/Password**.
3. Vào **Authentication → Users** để tạo tài khoản nội bộ. Không bật chức năng tự đăng ký công khai.
4. Tạo Web App trong Firebase, sao chép cấu hình vào `js/auth-config.js`.
5. Khai báo `allowedEmails` hoặc `allowedDomains` trong cùng file.
6. Thêm tên miền GitHub Pages của bạn vào **Authentication → Settings → Authorized domains**.

> GitHub Pages là website tĩnh. Lớp này xác thực người dùng trước khi mở giao diện quản trị. Trang cập nhật vẫn xuất JSON để Khoa Dược duyệt và Commit/Push; website không tự ghi trực tiếp vào repository.


## Thanh công cụ và quyền quản trị

- Trang chủ và trang tương tác có mục **🔒 Cập nhật thuốc mới** trên thanh công cụ.
- Liên kết này mở `admin-login.html`; chỉ tài khoản Firebase Authentication nằm trong `allowedEmails` hoặc `allowedDomains` mới được chuyển tới `admin.html`.
- Thẻ cập nhật thuốc ở khu vực ứng dụng bên dưới vẫn được ẩn.

## Bảo vệ mã nguồn

GitHub Pages là website tĩnh: mọi HTML/CSS/JavaScript gửi tới trình duyệt đều có thể được xem bằng công cụ phát triển. Không đưa mật khẩu, khóa quản trị, GitHub token hoặc dữ liệu bí mật vào mã nguồn. Để hạn chế người khác **chỉnh sửa kho mã**, đặt repository ở chế độ private nếu gói GitHub của đơn vị hỗ trợ Pages riêng tư, giới hạn collaborator, bật branch protection và yêu cầu pull request. Muốn ẩn hoàn toàn logic quản trị/dữ liệu nhạy cảm cần chuyển phần quản trị sang backend hoặc cổng nội bộ có kiểm soát truy cập.
