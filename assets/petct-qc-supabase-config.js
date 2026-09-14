(function () {
  'use strict';

  // Điền hai giá trị này từ Project Settings > API trong Supabase.
  // Chỉ dùng anon/public hoặc publishable key; tuyệt đối không dùng service_role key trên trình duyệt.
  const SUPABASE_URL = 'https://jaswtdcgrfbygmdxvumu.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_O6LzzHIKE9nWoSxhLQNlsw_shxEqdLC';

  window.PETCT_QC_SUPABASE_CONFIG = Object.freeze({
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY
  });
})();
