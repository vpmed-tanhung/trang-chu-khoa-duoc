# Website Khoa Dược – Bệnh viện VPMED Tân Hưng

Website cổng thông tin và hệ thống công cụ hỗ trợ chuyên môn của Khoa Dược. Dự án được triển khai theo mô hình website tĩnh (HTML/CSS/JavaScript), tích hợp Supabase cho các chức năng cần lưu trữ và phân quyền, đồng thời hỗ trợ PWA để sử dụng thuận tiện trên máy tính và thiết bị di động.

## Chức năng chính

- Giới thiệu Khoa Dược, chức năng – nhiệm vụ và cơ cấu tổ chức.
- Quản lý, tra cứu **Thông tin thuốc** và **Hướng dẫn sử dụng** dạng PDF.
- Đăng tải bản tin, thông báo và tài liệu chuyên môn.
- Cung cấp các công cụ dược lâm sàng: rà soát đơn/y lệnh, chỉnh liều, tương tác thuốc, liều Nhi, PET/CT và hỗ trợ cấp cứu phản vệ.
- Tích hợp Supabase cho dữ liệu dùng chung, đăng nhập, phân quyền nhân viên và quản trị.
- Hỗ trợ PWA, cache dữ liệu chuyên môn và giao diện responsive.

> **Lưu ý chuyên môn:** Nội dung và kết quả từ các công cụ chỉ phục vụ tham khảo, tra cứu và hỗ trợ chuyên môn; không thay thế đánh giá lâm sàng, hướng dẫn hiện hành hoặc quyết định của nhân viên y tế có thẩm quyền.

## Cấu trúc thư mục

```text
trang-chu-khoa-duoc-main/
├── index.html                      # Trang chủ và không gian công cụ tích hợp
├── thong-tin-thuoc.html            # Chuyên mục Thông tin thuốc
├── huong-dan-su-dung.html          # Chuyên mục Hướng dẫn sử dụng
├── cap-cuu-phan-ve.html            # Công cụ hỗ trợ cấp cứu phản vệ
├── cong-cu-*.html                  # Các trang công cụ lâm sàng độc lập
├── assets/
│   ├── css/                        # CSS nền tảng và CSS dùng chung
│   ├── js/                         # Logic giao diện, dữ liệu và tích hợp
│   ├── clinical-tools/             # Mô-đun nghiệp vụ dược lâm sàng
│   ├── cong-cu-modules/            # Mô-đun cho các công cụ tích hợp
│   ├── documents/                  # PDF Thông tin thuốc/Hướng dẫn sử dụng
│   └── images/                     # Logo, banner và hình ảnh giao diện
├── bhyt-khong-lay-thuoc/           # Phân hệ đối soát bệnh nhân BHYT
├── data/                           # Dữ liệu tra cứu cục bộ
├── sources/                        # Tài liệu nguồn chuyên môn
├── apps-script/                    # Mã Google Apps Script
├── supabase/                       # SQL khởi tạo, phân quyền và nâng cấp
├── scripts/                        # Tiện ích cập nhật/kiểm tra dữ liệu
├── tests/                          # Kiểm thử JavaScript và Python
├── docs/                           # Hướng dẫn, báo cáo và lịch sử thay đổi
├── manifest.json                   # Cấu hình PWA
├── sw.js                           # Service Worker và cache ngoại tuyến
├── CNAME                           # Tên miền tùy chỉnh khi triển khai
├── .gitignore                      # Quy tắc loại trừ tệp khỏi Git
└── README.md                       # Tài liệu dự án
```

## Yêu cầu môi trường

- Git.
- Trình duyệt hiện đại (Chrome, Edge, Firefox hoặc Safari phiên bản còn được hỗ trợ).
- Một HTTP server cục bộ. Có thể dùng Node.js 18+, Yarn, Python 3 hoặc tiện ích Live Server.
- Python 3 và các gói trong `requirements-dev.txt` nếu cần chạy bộ kiểm thử Python.

Dự án hiện không có `package.json` và không cần bước biên dịch để chạy giao diện chính.

## Cài đặt và chạy local

### 1. Lấy mã nguồn

```bash
git clone <URL_REPOSITORY>
cd trang-chu-khoa-duoc-main
```

### 2. Khởi chạy bằng npm

```bash
npx serve . --listen 5500
```

Hoặc bằng Yarn:

```bash
yarn dlx serve . --listen 5500
```

Mở `http://localhost:5500` trên trình duyệt.

### 3. Khởi chạy bằng Python

```bash
python -m http.server 5500
```

### 4. Khởi chạy bằng Live Server

Mở thư mục dự án trong Visual Studio Code, cài tiện ích **Live Server**, sau đó chọn **Open with Live Server** tại `index.html`.

Không nên mở trực tiếp bằng đường dẫn `file://` vì Service Worker, tải dữ liệu và một số chính sách bảo mật trình duyệt chỉ hoạt động đúng qua HTTP/HTTPS.

## Cấu hình Supabase

1. Đọc hướng dẫn tại `supabase/README.md`.
2. Chạy các tệp SQL cần thiết trong Supabase SQL Editor theo đúng thứ tự được mô tả trong hướng dẫn.
3. Cấu hình URL dự án và khóa `anon` công khai tại tệp cấu hình phía trình duyệt đang được dự án sử dụng.
4. Không đưa `service_role`, mật khẩu, token quản trị hoặc tệp `.env` lên Git.
5. Kiểm tra Row Level Security (RLS) và quyền Storage trước khi dùng trên môi trường thật.

## Kiểm thử

Kiểm thử JavaScript bằng Node.js:

```bash
node --test tests/*.js
```

Kiểm thử Python:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m pytest tests/*.py
```

Sau khi thay đổi giao diện, cần kiểm tra tối thiểu các trang `index.html`, `thong-tin-thuoc.html`, `huong-dan-su-dung.html` trên cả desktop và mobile; đồng thời kiểm tra điều hướng, đăng nhập, mở PDF và trạng thái ngoại tuyến.

## Build và deploy

### Build

Website là dự án tĩnh nên không có bước build bắt buộc. Thư mục gốc chính là thư mục xuất bản. Trước khi deploy:

1. Chạy toàn bộ kiểm thử.
2. Kiểm tra không có khóa bí mật hoặc tệp `.env` trong commit.
3. Kiểm tra đường dẫn tài nguyên phân biệt chữ hoa/chữ thường.
4. Kiểm tra `manifest.json`, `sw.js`, `CNAME` và phiên bản cache khi có thay đổi PWA.

### GitHub Pages

- Đẩy mã nguồn lên nhánh triển khai.
- Trong **Settings → Pages**, chọn nguồn từ nhánh và thư mục gốc `/`.
- Giữ `CNAME` nếu sử dụng tên miền tùy chỉnh.

### Vercel, Netlify hoặc máy chủ web tĩnh

- Framework preset: **Other/Static**.
- Build command: để trống.
- Output/Publish directory: `.` (thư mục gốc).
- Bật HTTPS để PWA và Service Worker hoạt động ổn định.

## Quy trình cập nhật đề xuất

```bash
git checkout -b fix/ten-thay-doi
git add .
git commit -m "fix: mô tả ngắn thay đổi"
git push origin fix/ten-thay-doi
```

Chỉ hợp nhất vào nhánh triển khai sau khi kiểm thử đạt và đã đối chiếu tài nguyên nghiệp vụ.

## Bản quyền và phạm vi sử dụng

Mã nguồn và dữ liệu được xây dựng phục vụ hoạt động của Khoa Dược – Bệnh viện VPMED Tân Hưng. Việc tái sử dụng, phát hành hoặc chỉnh sửa dữ liệu chuyên môn phải tuân theo quy định nội bộ và quy định pháp luật liên quan.
