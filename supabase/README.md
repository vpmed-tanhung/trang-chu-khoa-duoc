# Supabase SQL

## Dự án mới

1. Chạy `renal_lookup_audit.sql`.
2. Chạy các file bổ sung nghiệp vụ thực sự cần dùng.
3. Chạy `toi_uu_rls.sql`.
4. Luôn chạy `bao_mat_security_definer.sql` cuối cùng.
5. Kiểm tra lại RLS/Function bằng Database Advisors và RLS Tester trên dự án thật.

## Dự án đang hoạt động

Không chạy lại file cài mới. Chỉ chạy đúng file nâng cấp cần thiết, sau đó chạy
`toi_uu_rls.sql` rồi `bao_mat_security_definer.sql` cuối cùng. Hai file này
không xóa dữ liệu. File hardening
đặt `search_path` rỗng và thu hồi quyền gọi mặc định của các trigger/RPC đặc quyền.

Đối với project hiện đang cấu hình trong `assets/js/server-config.js` (dùng
`pharmacy_staff_members` và RPC `is_pharmacy_staff`), chạy một lần file
`06_LUU_LICH_SU_CONG_CU.sql` để tạo lịch sử dùng chung cho công cụ suy thận và
kháng sinh Nhi. Không dùng `renal_lookup_audit.sql` cho project này vì file cũ
thuộc kiến trúc tài khoản `profiles` khác.

Các file SQL trong thư mục này không tự động thay đổi database. Cần review và
chạy thủ công trên đúng Supabase project, sau đó xác minh kết quả truy vấn ở cuối
file hardening.
