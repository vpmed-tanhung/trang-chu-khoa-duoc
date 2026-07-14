/*!
 * VPMED - Thông báo cập nhật ứng dụng (kiểu cập nhật hệ thống trên điện thoại)
 * -----------------------------------------------------------------------
 * 1) Anh push code lên nhánh main như bình thường -> GitHub Actions tự ghi
 *    số phiên bản mới vào assets/app-version.json. Anh không cần thao tác
 *    gì thêm.
 * 2) Mọi tab đang mở tự phát hiện phiên bản mới và hiện 1 thông báo nhỏ:
 *    "Phiên bản mới sẽ được cập nhật tự động tối nay." Bác sĩ có thể đóng
 *    thông báo, không có nút tải lại ngay để tránh bấm nhầm mất dữ liệu
 *    đang nhập.
 * 3) Hệ thống KHÔNG tự tải lại trang khi bác sĩ đang thao tác (đang gõ,
 *    đang chọn ô nhập liệu, hoặc vừa thao tác trong vài phút gần đây).
 * 4) Trong khung giờ khoảng 05:00 - 05:59 sáng hôm sau (giờ Việt Nam), nếu
 *    phát hiện phiên bản mới và trang đang rảnh (không ai thao tác), tab
 *    sẽ tự nạp lại phiên bản mới nhất. Nếu vẫn đang bận trong khung giờ đó,
 *    hệ thống kiên nhẫn thử lại đến khi rảnh (tối đa đến 08:00 sáng).
 * 5) Sau khi tự cập nhật xong, tab hiện thông báo:
 *    "Ứng dụng đã được cập nhật thành công."
 * Không lưu bất kỳ dữ liệu bệnh nhân nào - chỉ lưu số phiên bản ứng dụng.
 */
(function () {
  'use strict';

  var VERSION_URL = 'assets/app-version.json';
  var STORAGE_KEY = 'vpmed_app_version_v1';          // phiên bản đang dùng trên máy này
  var PENDING_SEEN_KEY = 'vpmed_pending_seen_v1';     // đã hiện thông báo cho phiên bản chờ nào
  var SUCCESS_FLAG_KEY = 'vpmed_update_success_v1';   // đánh dấu vừa tự cập nhật xong, cần báo thành công
  var LAST_ACTIVITY_KEY = 'vpmedLastActivity';

  var CHECK_INTERVAL_MS = 3 * 60 * 1000;   // kiểm tra phiên bản mỗi 3 phút
  var IDLE_THRESHOLD_MS = 4 * 60 * 1000;   // coi là "đang rảnh" nếu không thao tác trong 4 phút
  var APPLY_HOUR_START = 5;                // 05:00 giờ VN
  var APPLY_HOUR_END = 8;                  // thử đến trước 08:00 nếu 5h vẫn đang bận

  var lastActivityAt = Date.now();

  function markActivity() { lastActivityAt = Date.now(); }
  ['pointerdown', 'keydown', 'input', 'touchstart', 'scroll'].forEach(function (evt) {
    window.addEventListener(evt, markActivity, { passive: true, capture: true });
  });

  function isUserBusy() {
    // Đang gõ / chọn vào ô nhập liệu -> chắc chắn đang thao tác
    var el = document.activeElement;
    if (el) {
      var tag = (el.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable) {
        return true;
      }
    }
    // Vừa có thao tác trong khoảng thời gian gần đây
    if (Date.now() - lastActivityAt < IDLE_THRESHOLD_MS) return true;
    return false;
  }

  function getVietnamHour() {
    try {
      var fmt = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', hour12: false, timeZone: 'Asia/Ho_Chi_Minh'
      });
      var parts = fmt.formatToParts(new Date());
      var hourPart = parts.filter(function (p) { return p.type === 'hour'; })[0];
      var h = hourPart ? parseInt(hourPart.value, 10) : new Date().getHours();
      return h === 24 ? 0 : h;
    } catch (e) {
      return new Date().getHours();
    }
  }

  function inApplyWindow() {
    var h = getVietnamHour();
    return h >= APPLY_HOUR_START && h < APPLY_HOUR_END;
  }

  function safeGet(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function safeSet(key, val) { try { window.localStorage.setItem(key, val); } catch (e) {} }
  function safeRemove(key) { try { window.localStorage.removeItem(key); } catch (e) {} }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = String(s || '');
    return d.innerHTML;
  }

  function injectStyles() {
    if (document.getElementById('vpmedUpdateNotifyStyle')) return;
    var css = ''
      + '.vpmed-update-toast{position:fixed;left:16px;right:16px;bottom:16px;'
      + 'max-width:400px;margin:0 auto;background:#fff;border:1px solid #d7e0ea;'
      + 'border-radius:16px;box-shadow:0 12px 32px rgba(15,23,42,.18);'
      + 'padding:13px 14px;z-index:99999;font-family:inherit;'
      + 'display:flex;gap:11px;align-items:flex-start;'
      + 'transform:translateY(24px);opacity:0;transition:transform .28s ease,opacity .28s ease;}'
      + '.vpmed-update-toast.is-visible{transform:translateY(0);opacity:1;}'
      + '.vpmed-update-toast__icon{flex:0 0 auto;width:34px;height:34px;border-radius:10px;'
      + 'display:flex;align-items:center;justify-content:center;}'
      + '.vpmed-update-toast__icon--pending{background:#0b5cad;box-shadow:0 2px 6px rgba(11,92,173,.35);}'
      + '.vpmed-update-toast__icon--success{background:#0f766e;box-shadow:0 2px 6px rgba(15,118,110,.35);}'
      + '.vpmed-update-toast__icon svg{width:18px;height:18px;}'
      + '.vpmed-update-toast__body{flex:1 1 auto;min-width:0;padding-top:2px;}'
      + '.vpmed-update-toast__title{font-weight:700;font-size:14px;color:#0f172a;margin:0;}'
      + '.vpmed-update-toast__msg{font-size:12.5px;color:#475569;line-height:1.4;margin:2px 0 0;}'
      + '.vpmed-update-toast__close{flex:0 0 auto;border:none;background:transparent;'
      + 'color:#94a3b8;font-size:16px;line-height:1;cursor:pointer;padding:2px 4px;margin-top:-2px;}'
      + '@media (max-width:480px){.vpmed-update-toast{left:10px;right:10px;bottom:10px;}}';
    var style = document.createElement('style');
    style.id = 'vpmedUpdateNotifyStyle';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function removeToast() {
    var el = document.getElementById('vpmedUpdateToast');
    if (!el) return;
    el.classList.remove('is-visible');
    window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
  }

  function showToast(kind, title, msg, autoHideMs) {
    removeToast();
    injectStyles();

    var iconSvg = kind === 'success'
      ? '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 12a8 8 0 10-2.34 5.66" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 7v5h-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    var toast = document.createElement('div');
    toast.id = 'vpmedUpdateToast';
    toast.className = 'vpmed-update-toast';
    toast.setAttribute('role', 'status');
    toast.innerHTML = ''
      + '<div class="vpmed-update-toast__icon vpmed-update-toast__icon--' + kind + '">' + iconSvg + '</div>'
      + '<div class="vpmed-update-toast__body">'
      + '<p class="vpmed-update-toast__title">' + esc(title) + '</p>'
      + '<p class="vpmed-update-toast__msg">' + esc(msg) + '</p>'
      + '</div>'
      + '<button type="button" class="vpmed-update-toast__close" data-action="close" aria-label="Đóng">×</button>';

    document.body.appendChild(toast);
    window.requestAnimationFrame(function () { toast.classList.add('is-visible'); });

    toast.addEventListener('click', function (ev) {
      if (ev.target.getAttribute('data-action') === 'close') removeToast();
    });

    if (autoHideMs) window.setTimeout(removeToast, autoHideMs);
  }

  function showPendingNotice() {
    showToast(
      'pending',
      'Có bản cập nhật mới',
      'Phiên bản mới sẽ được cập nhật tự động tối nay. Bạn cứ tiếp tục sử dụng bình thường.'
    );
  }

  function showSuccessNotice() {
    showToast(
      'success',
      'Đã cập nhật thành công',
      'Ứng dụng đã được cập nhật thành công.',
      6000
    );
  }

  function applyUpdate(newVersion) {
    // Đánh dấu để lần tải lại tiếp theo biết cần báo "cập nhật thành công"
    safeSet(SUCCESS_FLAG_KEY, newVersion);
    safeSet(STORAGE_KEY, newVersion);
    try {
      if (window.caches && caches.keys) {
        caches.keys().then(function (names) {
          names.forEach(function (n) { caches.delete(n); });
        }).catch(function () {});
      }
    } catch (e) {}
    window.location.reload();
  }

  function maybeShowSuccessAfterReload() {
    var pendingSuccess = safeGet(SUCCESS_FLAG_KEY);
    if (!pendingSuccess) return;
    safeRemove(SUCCESS_FLAG_KEY);
    showSuccessNotice();
  }

  function checkForUpdate() {
    var url = VERSION_URL + '?_=' + Date.now();
    fetch(url, { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !data.version) return;
        var stored = safeGet(STORAGE_KEY);

        if (!stored) {
          // Lần đầu mở app trên máy này: chỉ ghi nhận, không phải "có bản mới"
          safeSet(STORAGE_KEY, data.version);
          return;
        }

        if (stored === data.version) return; // đã là bản mới nhất, không có gì để làm

        // Có phiên bản mới hơn bản đang dùng trên máy này
        if (safeGet(PENDING_SEEN_KEY) !== data.version) {
          safeSet(PENDING_SEEN_KEY, data.version);
          showPendingNotice();
        }

        // Chỉ tự nạp lại trong khung giờ sáng sớm, và khi trang đang rảnh
        if (inApplyWindow() && !isUserBusy()) {
          applyUpdate(data.version);
        }
      })
      .catch(function () { /* im lặng nếu không tải được, không làm phiền người dùng */ });
  }

  function start() {
    maybeShowSuccessAfterReload();
    checkForUpdate();
    window.setInterval(checkForUpdate, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') checkForUpdate();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}());
