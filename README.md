# 💊 Website Khoa Dược

Phiên bản hiện tại: **v1.2.4**

Website cung cấp thông tin và tài liệu chuyên môn phục vụ hoạt động của Khoa Dược.

## 📚 Nội dung chính

- Thông tin thuốc
- Hướng dẫn sử dụng thuốc
- Tài liệu chuyên môn
- Thông báo và bài viết mới
- Tra cứu tài liệu trực tuyến
- Bộ công cụ lâm sàng: tương tác thuốc, CrCl/eGFR, liều kháng sinh Nhi và PET/CT

## 🔐 Đăng nhập quản trị

Website dùng một điểm `Đăng nhập admin` duy nhất ở thanh header. Phiên Supabase được dùng chung cho Bản tin, Thông tin thuốc và Hướng dẫn sử dụng; đăng xuất ở header sẽ khóa quyền quản trị trên toàn bộ trang.

## 🧰 Cấu trúc bộ công cụ lâm sàng

- `cong-cu-tuong-tac-thuoc.html`: kiểm tra hai thuốc hoặc toàn bộ danh mục.
- `cong-cu-lieu-khang-sinh.html`: Cockcroft–Gault, CKD-EPI 2021 và cảnh báo chỉnh liều.
- `cong-cu-lieu-nhi.html`: liều theo tuổi/PMA/cân nặng, phân biệt mg/kg/ngày và mg/kg/lần, kiểm tra mục tiêu PK/PD theo MIC.
- `cong-cu-pet-ct.html`: hiệu chỉnh phân rã, tính thể tích rút và tùy chọn tính hoạt độ theo cân nặng × hệ số.
- `assets/css/clinical-tools.css`: giao diện dùng chung cho card và trang công cụ.
- `assets/js/clinical-tools-data.js`: dữ liệu quy tắc/tính liều có cấu trúc.
- `assets/js/clinical-tools.js`: logic tính toán, khóa an toàn và lịch sử cục bộ.

Lịch sử tra cứu được lưu trong `localStorage` của từng trình duyệt; chưa đồng bộ qua Supabase. Dữ liệu tham chiếu được đối chiếu với [Hệ thống Hỗ trợ Dược lâm sàng VPMED Tân Hưng](https://hotrolamsang.io.vn/) ngày 07/09/2026: công thức CrCl/eGFR, đầu vào HIS/chiều cao/µmol/L, nguyên tắc PET/CT và các giá trị chu kỳ bán rã. Nguồn công khai nêu 633 cặp tương tác nhưng không cung cấp MIC trong công cụ Nhi; vì vậy MIC được bổ sung dưới dạng kiểm tra đích PK/PD, không tự động ép tăng liều mg/kg. Tất cả dữ liệu vẫn cần được dược sĩ/bác sĩ cập nhật theo danh mục và phác đồ chính thức của bệnh viện trước khi dùng trong thực hành.

## 🎯 Mục đích

Hệ thống được xây dựng nhằm hỗ trợ việc:

- Quản lý và tra cứu tài liệu chuyên môn
- Cung cấp thông tin thuốc thuận tiện
- Hỗ trợ nhân viên y tế tiếp cận tài liệu nhanh chóng
- Tập trung tài liệu của Khoa Dược tại một địa chỉ thống nhất


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
