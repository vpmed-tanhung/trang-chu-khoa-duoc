(() => {
  'use strict';

  const COMPONENT_SELECTOR = 'vpmed-pharmacovigilance';
  const AUTO_DATA_URL = 'assets/pharmacovigilance_auto.json';
  const BUTTON_ID = 'vpmedPvRefreshButton';
  const STATUS_ID = 'vpmedPvRefreshStatus';
  const ACTIONS_PAGE = 'https://github.com/vpmed-tanhung/trang-chu-khoa-duoc/actions/workflows/cap-nhat-canh-bao-duoc.yml';
  const RUNS_API = 'https://api.github.com/repos/vpmed-tanhung/trang-chu-khoa-duoc/actions/workflows/cap-nhat-canh-bao-duoc.yml/runs?per_page=1';
  const POLL_INTERVAL_MS = 8000;
  const POLL_TIMEOUT_MS = 180000;

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

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

  const isTodayInVietnam = (value) => {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    return formatter.format(date) === formatter.format(new Date());
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
      count: Array.isArray(payload?.alerts) ? payload.alerts.length : 0,
      status: payload?.status || 'success',
      message: payload?.message || ''
    };
  }

  async function readLatestWorkflowRun() {
    try {
      const response = await fetch(`${RUNS_API}&v=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (!response.ok) return null;
      const payload = await response.json();
      const run = Array.isArray(payload?.workflow_runs) ? payload.workflow_runs[0] : null;
      if (!run) return null;
      return {
        status: run.status || '',
        conclusion: run.conclusion || '',
        createdAt: run.created_at || '',
        updatedAt: run.updated_at || '',
        event: run.event || '',
        htmlUrl: run.html_url || ACTIONS_PAGE
      };
    } catch (_) {
      return null;
    }
  }

  function configuredApiUrl() {
    return String(window.VPMED_PHARMACOVIGILANCE_REFRESH_API_URL || '').trim();
  }

  async function requestRefresh() {
    const apiUrl = configuredApiUrl();
    if (!apiUrl || !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(apiUrl)) {
      const error = new Error('Chưa cấu hình API cập nhật trực tiếp');
      error.code = 'REFRESH_API_NOT_CONFIGURED';
      throw error;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'refreshPharmacovigilance',
          requestedAt: new Date().toISOString(),
          source: location.href
        }),
        cache: 'no-store',
        signal: controller.signal
      });
      const text = await response.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch (_) {
        throw new Error('API cập nhật không trả về JSON hợp lệ');
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || `API cập nhật trả lỗi ${response.status}`);
      }
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('API cập nhật phản hồi quá lâu');
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function setStatus(status, text, link) {
    status.textContent = '';
    status.append(document.createTextNode(text));
    if (link?.href && link?.label) {
      status.append(document.createTextNode(' '));
      const anchor = document.createElement('a');
      anchor.href = link.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = link.label;
      anchor.style.cssText = 'font-weight:800;color:#075f9f;text-decoration:underline;';
      status.append(anchor);
    }
  }

  async function pollUntilUpdated(previousGeneratedAt, status) {
    const startedAt = Date.now();
    let lastRunText = '';

    while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
      await sleep(POLL_INTERVAL_MS);

      const [metadata, run] = await Promise.all([
        readAutoMetadata().catch(() => null),
        readLatestWorkflowRun()
      ]);

      if (metadata?.generatedAt && metadata.generatedAt !== previousGeneratedAt) {
        return metadata;
      }

      if (run?.status === 'in_progress' || run?.status === 'queued' || run?.status === 'waiting') {
        lastRunText = 'GitHub Actions đang lấy dữ liệu mới…';
      } else if (run?.status === 'completed') {
        lastRunText = run.conclusion === 'success'
          ? 'Quy trình đã hoàn tất, đang chờ GitHub Pages đồng bộ tệp mới…'
          : 'Quy trình cập nhật đã kết thúc nhưng có lỗi.';
      }

      setStatus(status, lastRunText || 'Đã gửi yêu cầu; đang chờ hệ thống cập nhật dữ liệu…');
    }

    throw new Error('Đã gửi yêu cầu nhưng chưa thấy tệp mới sau 3 phút');
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
    button.title = 'Yêu cầu hệ thống kiểm tra nguồn ngay và tải lại dữ liệu mới nhất';

    const status = document.createElement('span');
    status.id = STATUS_ID;
    status.style.cssText = [
      'grid-column:1/-1',
      'font-size:12px',
      'color:#62717d',
      'margin-top:2px',
      'line-height:1.45'
    ].join(';');
    status.textContent = 'Tự động mỗi ngày khoảng 06:00 sáng Việt Nam. Nhấn nút để yêu cầu kiểm tra ngay.';

    searchRow.insertBefore(button, resetButton);
    searchRow.appendChild(status);

    readAutoMetadata().then((metadata) => {
      const timeText = formatGeneratedAt(metadata.generatedAt);
      const prefix = isTodayInVietnam(metadata.generatedAt)
        ? 'Hệ thống đã kiểm tra nguồn hôm nay'
        : 'Dữ liệu tự động chưa được kiểm tra trong hôm nay';
      setStatus(status, `${prefix}${timeText ? ` lúc ${timeText}` : ''}. Tự động mỗi ngày khoảng 06:00 sáng Việt Nam.`);
    }).catch(() => {});

    button.addEventListener('click', async () => {
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = 'Đang yêu cầu…';

      try {
        const before = await readAutoMetadata();
        setStatus(status, 'Đang gửi yêu cầu cập nhật dữ liệu theo thời gian thực…');
        await requestRefresh();

        button.textContent = 'Đang cập nhật…';
        setStatus(status, 'Đã gửi yêu cầu; GitHub Actions đang chuẩn bị chạy…');
        const metadata = await pollUntilUpdated(before.generatedAt, status);

        if (typeof component.loadData !== 'function') {
          throw new Error('Không tìm thấy hàm tải dữ liệu của mô-đun');
        }
        await component.loadData();

        const timeText = formatGeneratedAt(metadata.generatedAt);
        setStatus(
          status,
          metadata.count > 0
            ? `Đã cập nhật lúc ${timeText || 'vừa xong'}; có ${metadata.count} bản tin tự động mới/chưa biên tập.`
            : `Đã kiểm tra nguồn lúc ${timeText || 'vừa xong'}; chưa phát hiện bản tin mới ngoài dữ liệu đã biên tập.`
        );
      } catch (error) {
        if (error?.code === 'REFRESH_API_NOT_CONFIGURED') {
          await component.loadData?.();
          const metadata = await readAutoMetadata().catch(() => null);
          const timeText = formatGeneratedAt(metadata?.generatedAt);
          setStatus(
            status,
            `Đã tải lại dữ liệu hiện có${timeText ? `; lần kiểm tra nguồn gần nhất ${timeText}` : ''}. Nút cập nhật trực tiếp chưa được kích hoạt bảo mật.`,
            { href: ACTIONS_PAGE, label: 'Mở GitHub Actions để chạy ngay ↗' }
          );
        } else {
          setStatus(
            status,
            `Không cập nhật được: ${error.message}. Dữ liệu biên tập cũ vẫn được giữ nguyên.`,
            { href: ACTIONS_PAGE, label: 'Kiểm tra GitHub Actions ↗' }
          );
        }
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
