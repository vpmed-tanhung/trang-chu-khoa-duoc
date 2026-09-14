(function () {
  'use strict';

  // Điền hai giá trị này từ Project Settings > API trong Supabase.
  // Chỉ dùng anon/public hoặc publishable key; tuyệt đối không dùng service_role key trên trình duyệt.
  const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
  const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

  window.PETCT_QC_SUPABASE_CONFIG = Object.freeze({
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY
  });
})();
