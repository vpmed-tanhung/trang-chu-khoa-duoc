(function () {
  const cfg = window.VPMED_AUTH_CONFIG || {};
  const firebaseConfig = cfg.firebaseConfig || {};
  const configured = firebaseConfig.apiKey && !String(firebaseConfig.apiKey).startsWith('PASTE_');
  const root = document.documentElement;

  function normalize(v){ return String(v || '').trim().toLowerCase(); }
  function isAllowed(email){
    const e = normalize(email);
    const emails = (cfg.allowedEmails || []).map(normalize);
    const domains = (cfg.allowedDomains || []).map(normalize);
    if (!emails.length && !domains.length) return true;
    if (emails.includes(e)) return true;
    const domain = e.split('@')[1] || '';
    return domains.includes(domain);
  }
  function block(message){
    document.body.innerHTML = `
      <main style="max-width:720px;margin:70px auto;padding:24px;font-family:Arial,sans-serif">
        <section style="background:#fff;border:1px solid #d8e4ef;border-radius:18px;padding:28px;box-shadow:0 12px 32px rgba(15,23,42,.12)">
          <h1 style="color:#9f1239;margin-top:0">Không thể truy cập trang quản trị</h1>
          <p style="line-height:1.6">${message}</p>
          <p><a href="index.html" style="color:#0b63a5;font-weight:700">Quay lại trang chủ</a></p>
        </section>
      </main>`;
    root.classList.remove('auth-pending');
  }

  if (!configured) {
    document.addEventListener('DOMContentLoaded', () => block('Chưa cấu hình Firebase Authentication. Hãy mở <code>js/auth-config.js</code>, dán cấu hình Firebase và khai báo tài khoản hoặc tên miền nội bộ được phép.'));
    return;
  }

  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    firebase.auth().onAuthStateChanged(async (user) => {
      const onLogin = location.pathname.endsWith('admin-login.html');
      if (!user) {
        if (!onLogin) location.replace('admin-login.html');
        else root.classList.remove('auth-pending');
        return;
      }
      if (!isAllowed(user.email)) {
        await firebase.auth().signOut();
        if (onLogin) {
          const el = document.getElementById('loginMessage');
          if (el) el.textContent = 'Tài khoản này không nằm trong danh sách nội bộ được phép.';
          root.classList.remove('auth-pending');
        } else location.replace('admin-login.html?denied=1');
        return;
      }
      if (onLogin) location.replace('admin.html');
      else {
        root.classList.remove('auth-pending');
        const who = document.getElementById('currentUser');
        if (who) who.textContent = user.email || 'Tài khoản nội bộ';
      }
    });
  } catch (err) {
    document.addEventListener('DOMContentLoaded', () => block('Không khởi tạo được xác thực: ' + (err.message || err)));
  }

  window.vpmedLogout = function(){
    firebase.auth().signOut().then(() => location.replace('admin-login.html'));
  };
})();
