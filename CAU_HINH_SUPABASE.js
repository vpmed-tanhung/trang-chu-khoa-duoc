(function () {
  'use strict';

  // DÁN PROJECT URL VÀ PUBLISHABLE/ANON KEY CỦA SUPABASE VÀO HAI DÒNG DƯỚI.
  // Không dùng service_role hoặc secret key trong website.
  const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
  const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

  window.PETCT_QC_SUPABASE_CONFIG = Object.freeze({
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY
  });
})();
