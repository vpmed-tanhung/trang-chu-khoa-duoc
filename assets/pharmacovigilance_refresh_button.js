(() => {
  'use strict';

  const COMPONENT_SELECTOR = 'vpmed-pharmacovigilance';
  const AUTO_DATA_URL = 'assets/pharmacovigilance_auto.json';
  const BUTTON_ID = 'vpmedPvRefreshButton';
  const STATUS_ID = 'vpmedPvRefreshStatus';

  const formatGeneratedAt = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  async function readAutoMetadata() {
    const response = await fetch(`${AUTO_DATA_URL}?v=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!response.ok) {
      throw new Error(`Không đọc được tệp tự động (${response.status})`);
    }
    const payload = await response.json();
    return {
      generatedAt: payload?.generated_at || '',
      count: Array.isArray(payload?.alerts) ? payload.alerts.length : 0
    };
  }

  function injectButton(component) {
    const shadow = component?.shadowRoot;
    if (!shadow || shadow.getElementById(BUTTON_ID)) return false;

    const resetButton = shadow.getElementById('resetBtn');
    const searchRow = resetButton?.parentElement;
    if (!searchRow) return false;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = BUTTON_ID;
    button.className = 'btn btn-soft';
    button.textContent = '↻ Cập nhật dữ liệu';
    button.title = 'Tải lại dữ liệu cảnh báo mới nhất đã được đồng bộ lên hệ thống';

    const status = document.createElement('span');
    status.id = STATUS_ID;
    status.style.cssText = [
      'grid-column:1/-1',
      'font-size:12px',
      'color:#62717d',
      'margin-top:2px'
    ].join(';');
    status.textContent = 'Nút này tải lại dữ liệu mới nhất trên hệ thống; không tự sửa nội dung chuyên môn đã biên tập.';

    searchRow.insertBefore(button, resetButton);
    searchRow.appendChild(status);

    button.addEventListener('click', async () => {
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = 'Đang kiểm tra…';
      status.textContent = 'Đang tải lại tệp dữ liệu và kiểm tra thời điểm đồng bộ gần nhất…';

      try {
        if (typeof component.loadData !== 'function') {
          throw new Error('Không tìm thấy hàm tải dữ liệu của mô-đun');
        }

        await component.loadData();
        const metadata = await readAutoMetadata();
        const timeText = formatGeneratedAt(metadata.generatedAt);

        status.textContent = metadata.count > 0
          ? `Đã tải lại. Tệp tự động có ${metadata.count} bản tin; đồng bộ gần nhất ${timeText || 'chưa rõ thời điểm'}.`
          : `Đã tải lại, nhưng tệp tự động hiện chưa có bản tin mới; đồng bộ gần nhất ${timeText || 'chưa rõ thời điểm'}.`;
      } catch (error) {
        status.textContent = `Không cập nhật được: ${error.message}. Dữ liệu biên tập cũ vẫn được giữ nguyên.`;
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });

    return true;
  }

  function install() {
    const component = document.querySelector(COMPONENT_SELECTOR);
    if (component && injectButton(component)) return;

    const observer = new MutationObserver(() => {
      const current = document.querySelector(COMPONENT_SELECTOR);
      if (current && injectButton(current)) observer.disconnect();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    window.setTimeout(() => observer.disconnect(), 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
