# Hướng dẫn thêm Supabase cho Công cụ QC PET/CT

## Lưu ý bảo mật trước khi làm

SQL mẫu cấp quyền `SELECT`, `INSERT` và `DELETE` cho vai trò `anon` để công cụ có thể hoạt động chỉ bằng Project URL và anon/publishable key. Vì vậy, chỉ áp dụng cấu hình này khi trang PET/CT được giới hạn trong mạng hoặc khu vực nội bộ. Nếu website mở công khai, bất kỳ người truy cập nào cũng có thể gọi thao tác xóa. Không nhập thông tin định danh người bệnh vào bảng QC.

Không bao giờ đưa `service_role` key vào mã nguồn trình duyệt.

## Bước 1: Tạo bảng

1. Mở dự án Supabase.
2. Chọn **SQL Editor** → **New query**.
3. Mở tệp `supabase/qc_records.sql` trong mã nguồn.
4. Sao chép toàn bộ SQL, dán vào SQL Editor và bấm **Run** một lần.

SQL đã thực hiện các việc sau:

- Tạo bảng `public.qc_records` tương thích với biểu mẫu QC.
- Chặn số đo âm và mẫu số bằng 0 ở tầng cơ sở dữ liệu.
- Bật Row Level Security (RLS).
- Cấp `SELECT`, `INSERT` và `DELETE`; không cấp `UPDATE` cho anon/authenticated.

## Bước 2: Lấy URL và key

Trong Supabase, mở phần thiết lập API của dự án và sao chép:

- Project URL.
- Publishable key hoặc anon public key.

## Bước 3: Điền cấu hình vào website

Mở tệp **ngay ngoài thư mục gốc**, nằm cùng cấp với `index.html`:

`CAU_HINH_SUPABASE.js`

Thay đúng hai dòng sau:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

Ví dụ định dạng:

```js
const SUPABASE_URL = 'https://ma-du-an.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xxxxxxxxxxxxxxxxx';
```

Giữ nguyên tên hai hằng số và không sửa các phần khác của tệp.

## Bước 4: Đẩy toàn bộ mã nguồn lên Git/hosting

Phải tải lên đồng thời các tệp đã cập nhật, đặc biệt:

- `index.html`
- `CAU_HINH_SUPABASE.js`
- `assets/petct-qc.js`
- `assets/platform-shell.js`
- `assets/style.css`
- `sw.js`
- `assets/app-version.json`

Không chỉ thay riêng một tệp JavaScript vì service worker và cache-buster cũng đã được cập nhật.

## Bước 5: Kiểm tra hoạt động

1. Mở Công cụ PET/CT → Công cụ QC.
2. Trạng thái phải chuyển từ “Supabase chưa cấu hình” sang “Đã đồng bộ Supabase”.
3. Nhập một phiếu hợp lệ và bấm **Lưu kết quả QC**.
4. Kiểm tra Table Editor → `qc_records`: phải có bản ghi mới.
5. Tắt mạng, lưu thêm một phiếu: giao diện phải báo đã lưu trên thiết bị và đang chờ đồng bộ.
6. Bật mạng hoặc bấm **Làm mới / Đồng bộ**: bản ghi chờ phải được đưa lên Supabase.

## Cách đọc trạng thái

- **Supabase**: bản ghi đã có trên đám mây.
- **Chờ đồng bộ**: bản ghi đã lưu trong `localStorage`, chưa gửi được lên Supabase.
- **Supabase chưa cấu hình**: hai hằng số vẫn đang để giá trị mẫu.
- **Không kết nối được Supabase**: kiểm tra mạng, URL/key, bảng `qc_records` và RLS.

## Xóa dữ liệu

- Nút **×** tại từng dòng xóa bản ghi tương ứng trên cả thiết bị và Supabase.
- Nút **Xóa toàn bộ dữ liệu** xóa toàn bộ bảng `qc_records` và toàn bộ lịch sử cục bộ.
- Với dữ liệu đã đồng bộ, công cụ chỉ xóa bản sao cục bộ sau khi Supabase xác nhận xóa thành công.
- Khi mất mạng hoặc Supabase từ chối quyền `DELETE`, thao tác sẽ dừng và dữ liệu cục bộ được giữ nguyên để tránh báo xóa sai.
- Thao tác xóa không thể hoàn tác.
