# 💊 Website Khoa Dược

Website cung cấp thông tin và tài liệu chuyên môn phục vụ hoạt động của Khoa Dược.

## 📚 Nội dung chính

- Thông tin thuốc
- Hướng dẫn sử dụng thuốc
- Tài liệu chuyên môn
- Thông báo và bài viết mới
- Tra cứu tài liệu trực tuyến

## 🎯 Mục đích

Hệ thống được xây dựng nhằm hỗ trợ việc:

- Quản lý và tra cứu tài liệu chuyên môn
- Cung cấp thông tin thuốc thuận tiện
- Hỗ trợ nhân viên y tế tiếp cận tài liệu nhanh chóng
- Tập trung tài liệu của Khoa Dược tại một địa chỉ thống nhất

## 🌐 Website

Website được triển khai trực tuyến thông qua GitHub Pages và tên miền riêng.

## Bản tin Dược lâm sàng và Supabase

Trang chủ không chứa bài viết mẫu. `assets/js/posts.js` truy vấn đúng 5 bản ghi mới nhất bằng `order=created_at.desc&limit=5`.

Tài khoản được cấp trong `pharmacy_staff_members` là admin của luồng bản tin. Admin tải PDF lên ngay tại khu vực Bản tin; tệp được lưu vào Storage, còn metadata được ghi vào bảng `posts` với `author = 'admin'`.

Luồng ngày/tuần dùng các hàm `extractDateFromText`, `extractDateFromFile`, `weekOfMonth` và `normalizedTitle` trong `assets/js/posts.js`. Hệ thống ưu tiên ngày trong tên tệp/PDF, sau đó dùng ngày tải lên; tuần được tính theo các khoảng 1–7, 8–14, 15–21, 22–28 và 29 trở đi.

## 📱 Khả năng sử dụng

Website được tối ưu để sử dụng trên:

- Máy tính
- Máy tính bảng
- Điện thoại di động

## ⚠️ Lưu ý

Thông tin trên website phục vụ mục đích tham khảo và hỗ trợ chuyên môn.

Việc sử dụng thuốc và các quyết định điều trị phải căn cứ vào tình trạng người bệnh, hướng dẫn chuyên môn hiện hành và chỉ định của nhân viên y tế có thẩm quyền.

---

**Khoa Dược**
