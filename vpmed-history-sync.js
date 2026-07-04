/*
  VPMED - Đồng bộ lịch sử tra cứu liều sang Google Sheet Khoa Dược
  Cách hoạt động: theo dõi localStorage key của mục tính liều, khi có lịch sử mới thì gửi về Apps Script.
  Không sửa, không can thiệp logic tính liều trong assets/unified.js.
*/
(function () {
  'use strict';

  const HISTORY_KEY = 'vpmed_dose_history_v6';
  const SENT_KEY = 'vpmed_history_last_sent_signature_v1';
  const HISTORY_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwgt3wEKmSUlVCHvReMsRo1bW8QBsHyPYq-FUAPztD4uibx-Rv-u1HnTO4aJM45d4hC0w/exec';

  function safeString(value) {
    return value == null ? '' : String(value).trim();
  }

  function makePayload(item) {
    return {
      time: safeString(item.time) || new Date().toLocaleString('vi-VN'),
      crcl: safeString(item.crcl),
      egfr: safeString(item.egfr),
      drug: safeString(item.drug),
      advice: safeString(item.advice)
    };
  }

  function makeSignature(payload) {
    return [payload.time, payload.crcl, payload.egfr, payload.drug, payload.advice].join('|');
  }

  function postHistory(payload) {
    if (!HISTORY_WEB_APP_URL) return;

    fetch(HISTORY_WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).catch(function () {
      // Không làm gián đoạn chức năng tính liều nếu Google Sheet tạm thời không phản hồi.
    });
  }

  function syncLatestHistory() {
    let rows;
    try {
      rows = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch (err) {
      return;
    }

    if (!Array.isArray(rows) || !rows.length) return;

    const latest = rows[0];
    const payload = makePayload(latest);
    if (!payload.drug && !payload.crcl && !payload.egfr && !payload.advice) return;

    const signature = makeSignature(payload);
    if (localStorage.getItem(SENT_KEY) === signature) return;

    localStorage.setItem(SENT_KEY, signature);
    postHistory(payload);
  }

  // Theo dõi khi file tính liều gốc ghi lịch sử vào localStorage.
  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    const result = originalSetItem(key, value);
    if (key === HISTORY_KEY) {
      setTimeout(syncLatestHistory, 0);
    }
    return result;
  };

  // Đồng bộ một lần khi mở trang nếu đã có lịch sử mới nhưng chưa gửi.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(syncLatestHistory, 800);
    });
  } else {
    setTimeout(syncLatestHistory, 800);
  }
})();
