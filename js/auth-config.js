/*
  CẤU HÌNH XÁC THỰC NỘI BỘ
  1) Tạo project tại https://console.firebase.google.com
  2) Bật Authentication > Sign-in method > Email/Password
  3) Tạo tài khoản nội bộ tại Authentication > Users
  4) Dán cấu hình Web App vào firebaseConfig bên dưới
  5) Khai báo email hoặc tên miền được phép truy cập trang quản trị
*/
window.VPMED_AUTH_CONFIG = {
  firebaseConfig: {
    apiKey: "PASTE_FIREBASE_API_KEY",
    authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
    projectId: "PASTE_PROJECT_ID",
    appId: "PASTE_FIREBASE_APP_ID"
  },
  // Ưu tiên danh sách email cụ thể. Ví dụ: ["duoc.lamsang@benhvien.vn"]
  allowedEmails: [],
  // Hoặc cho phép toàn bộ tài khoản thuộc tên miền nội bộ. Ví dụ: ["vpmed.vn"]
  allowedDomains: []
};
