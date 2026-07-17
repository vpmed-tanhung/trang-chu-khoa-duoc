(() => {
  'use strict';

  const COMPONENT_SELECTOR = 'vpmed-pharmacovigilance';
  const BUTTON_ID = 'vpmedPvRefreshButton';
  const STATUS_ID = 'vpmedPvRefreshStatus';
  const SOURCE_URL = 'https://canhgiacduoc.org.vn/CanhGiacDuoc/DiemTinCGD.aspx';
  const SOURCE_NAME = 'Trung tâm Quốc gia về Thông tin thuốc và Theo dõi phản ứng có hại của thuốc';
  const DETAIL_PATH_RE = /\/CanhGiacDuoc\/DiemTin\/\d+\//i;
  const DATE_RE = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;

  const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  function formatDateTime(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour12: false
    }).formatToParts(date).reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
    return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}/${parts.year}`;
  }

  function normalizeDate(value) {
    const match = String(value || '').match(DATE_RE);
    if (!match) return '';
    return `${String(Number(match[1])).padStart(2, '0')}/${String(Number(match[2])).padStart(2, '0')}/${match[3]}`;
  }

  function dateSortValue(value) {
    const match = String(value || '').match(DATE_RE);
    if (!match) return 0;
    return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime();
  }

  function canonicalUrl(value) {
    try {
      const url = new URL(value, SOURCE_URL);
      url.protocol = 'https:';
      url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
      url.hash = '';
      url.search = '';
      return url.href.replace(/\/$/, '').toLowerCase();
    } catch (_) {
      return cleanText(value).toLowerCase().replace(/^http:/, 'https:').replace(/\/$/, '');
    }
  }

  function stableId(value) {
    let hash = 5381;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
    }
    return `live-${(hash >>> 0).toString(16)}`;
  }

  function makeAutoAlert(title, url, date, order) {
    const normalizedDate = normalizeDate(date);
    const titleKey = normalizeText(title);
    const draft = {
      id: stableId(canonicalUrl(url) || titleKey),
      level: 'green',
      year: normalizedDate ? normalizedDate.slice(-4) : '',
      date: normalizedDate,
      category: 'Bản tin mới từ nguồn chính thức',
      system: 'Chưa phân loại',
      interaction: /\b(tuong tac|interaction)\b/.test(titleKey),
      title: cleanText(title),
      drugs: 'Thuốc/nhóm thuốc nêu trong tiêu đề và nguồn gốc.',
      summary: 'Bản tin mới được kiểm tra trực tiếp từ nguồn chính thức. Mở nội dung gốc để đọc đầy đủ và rà soát chuyên môn.',
      quick: 'Rà soát nội dung cảnh báo và nguồn gốc trước khi áp dụng lâm sàng.',
      risk: [],
      signs: [],
      action: [],
      monitor: [],
      source: SOURCE_NAME,
      url: new URL(url, SOURCE_URL).href.replace(/^http:/, 'https:'),
      auto: true,
      reviewed: false,
      _sourceOrder: order
    };
    const editor = window.VPMED_PHARMACOVIGILANCE_AUTO_EDIT;
    return typeof editor === 'function' ? editor(draft) : draft;
  }

  function nearbyDate(anchor) {
    let node = anchor?.parentElement || null;
    for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
      const text = cleanText(node.textContent);
      if (text.length > 2500) break;
      const date = normalizeDate(text);
      if (date) return date;
    }
    return '';
  }

  function uniqueAlerts(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = canonicalUrl(item.url) || normalizeText(item.title);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function parseHtml(html) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const alerts = [];
    Array.from(doc.querySelectorAll('a[href]')).forEach((anchor, index) => {
      const title = cleanText(anchor.textContent);
      let url;
      try { url = new URL(anchor.getAttribute('href') || '', SOURCE_URL); } catch (_) { return; }
      if (!DETAIL_PATH_RE.test(url.pathname) || !title || /^xem\s*tiếp/i.test(title)) return;
      alerts.push(makeAutoAlert(title, url.href, nearbyDate(anchor), index));
    });
    return uniqueAlerts(alerts).slice(0, 30);
  }

  function parseMarkdown(markdown) {
    const text = String(markdown || '');
    const alerts = [];
    const re = /\[([^\]]+)\]\((https?:\/\/(?:www\.)?canhgiacduoc\.org\.vn\/CanhGiacDuoc\/DiemTin\/\d+\/[^)\s]*)\)/gi;
    let match;
    let index = 0;
    while ((match = re.exec(text)) !== null) {
      const title = cleanText(match[1].replace(/[*_`#]/g, ''));
      if (!title || /^xem\s*tiếp/i.test(title)) continue;
      const around = text.slice(Math.max(0, match.index - 220), match.index + match[0].length + 260);
      alerts.push(makeAutoAlert(title, match[2], normalizeDate(around), index));
      index += 1;
    }
    return uniqueAlerts(alerts).slice(0, 30);
  }

  async function fetchCandidate(candidate) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(candidate.url, {
        cache: 'no-store',
        signal: controller.signal,
        headers: { Accept: 'text/html, text/plain, application/json;q=0.9, */*;q=0.8' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let content = await response.text();
      if (candidate.kind === 'allorigins-json') {
        content = String(JSON.parse(content)?.contents || '');
      }
      const alerts = candidate.kind === 'markdown' ? parseMarkdown(content) : parseHtml(content);
      if (!alerts.length) throw new Error('Không đọc được danh sách bản tin');
      return alerts;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function fetchLiveAlerts() {
    const stamp = Date.now();
    const source = `${SOURCE_URL}?vpmed_refresh=${stamp}`;
    const candidates = [
      { kind: 'html', url: source },
      { kind: 'html', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(source)}` },
      { kind: 'allorigins-json', url: `https://api.allorigins.win/get?url=${encodeURIComponent(source)}` },
      { kind: 'markdown', url: `https://r.jina.ai/http://canhgiacduoc.org.vn/CanhGiacDuoc/DiemTinCGD.aspx?vpmed_refresh=${stamp}` }
    ];

    if (typeof Promise.any === 'function') {
      try {
        return await Promise.any(candidates.map(fetchCandidate));
      } catch (_) {
        throw new Error('Không thể kết nối nguồn trực tiếp');
      }
    }

    let lastError;
    for (const candidate of candidates) {
      try { return await fetchCandidate(candidate); } catch (error) { lastError = error; }
    }
    throw lastError || new Error('Không thể kết nối nguồn trực tiếp');
  }

  async function fetchDetailCandidate(candidate) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 16000);
    try {
      const response = await fetch(candidate.url, {
        cache: 'no-store', signal: controller.signal,
        headers: { Accept: 'text/html, text/plain, application/json;q=0.9, */*;q=0.8' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let content = await response.text();
      if (candidate.kind === 'allorigins-json') content = String(JSON.parse(content)?.contents || '');
      if (candidate.kind === 'markdown') {
        return cleanText(content.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#*_`>|]/g, ' '));
      }
      const doc = new DOMParser().parseFromString(content, 'text/html');
      doc.querySelectorAll('script,style,nav,header,footer,form').forEach((node) => node.remove());
      const blocks = Array.from(doc.querySelectorAll('article,main,[class*="detail"],[class*="content"],[id*="content"]'));
      const best = blocks.sort((a, b) => cleanText(b.textContent).length - cleanText(a.textContent).length)[0] || doc.body;
      const text = cleanText(best?.textContent);
      if (text.length < 120) throw new Error('Nội dung chi tiết quá ngắn');
      return text;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function fetchDetailText(url) {
    const target = String(url || '').replace(/^http:/, 'https:');
    const candidates = [
      { kind: 'html', url: target },
      { kind: 'html', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}` },
      { kind: 'allorigins-json', url: `https://api.allorigins.win/get?url=${encodeURIComponent(target)}` },
      { kind: 'markdown', url: `https://r.jina.ai/http://${target.replace(/^https?:\/\//, '')}` }
    ];
    if (typeof Promise.any === 'function') return Promise.any(candidates.map(fetchDetailCandidate));
    for (const candidate of candidates) {
      try { return await fetchDetailCandidate(candidate); } catch (_) { /* thử nguồn kế tiếp */ }
    }
    throw new Error('Không đọc được nội dung chi tiết');
  }

  async function editNewAlerts(component, items) {
    const existing = new Set((component.alerts || []).map(alertKey).filter(Boolean));
    const editor = window.VPMED_PHARMACOVIGILANCE_AUTO_EDIT;
    const newItems = items.filter((item) => !existing.has(alertKey(item))).slice(0, 12);
    return Promise.all(newItems.map(async (item) => {
      if (typeof editor !== 'function') return item;
      try { return editor(item, await fetchDetailText(item.url)); } catch (_) { return editor(item); }
    }));
  }

  function alertKey(item) {
    return canonicalUrl(item?.url || '') || normalizeText(item?.title || '');
  }

  function appendAutomaticAfterCurated(component, sourceAlerts) {
    const current = Array.isArray(component.alerts) ? component.alerts : [];
    const curated = current.filter((item) => !item.auto);
    const automatic = current.filter((item) => item.auto);
    const seen = new Set(current.map(alertKey).filter(Boolean));
    const added = [];

    sourceAlerts.forEach((item) => {
      const key = alertKey(item);
      if (!key || seen.has(key)) return;
      seen.add(key);
      added.push(item);
    });

    // Giữ nguyên đủ 42 cảnh báo biên tập và xếp toàn bộ danh sách theo ngày,
    // để bản tin vừa cập nhật luôn xuất hiện đúng vị trí mới nhất ở đầu.
    component.alerts = [...curated, ...automatic, ...added]
      .sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date));
    component.populateFilters?.();
    component.renderCategories?.();
    component.updateStats?.();
    component.render?.();
    component.updateFeatureCard?.();
    return { curatedCount: curated.length, addedCount: added.length };
  }

  async function refreshNow(component) {
    const button = component.shadowRoot?.getElementById(BUTTON_ID);
    const status = component.shadowRoot?.getElementById(STATUS_ID);
    const originalText = button?.textContent || '↻ Cập nhật dữ liệu';

    if (button) {
      button.disabled = true;
      button.textContent = 'Đang cập nhật…';
    }
    if (status) status.textContent = 'Đang tải dữ liệu mới nhất và kiểm tra trực tiếp nguồn chính thức…';

    try {
      // Trước hết tải lại dữ liệu đã được GitHub Actions đồng bộ lên website.
      if (typeof component.loadData === 'function') await component.loadData();

      // Sau đó kiểm tra trực tiếp nguồn ngay tại thời điểm bấm nút.
      const sourceAlerts = await editNewAlerts(component, await fetchLiveAlerts());
      const checkedAt = new Date();
      const result = appendAutomaticAfterCurated(component, sourceAlerts);
      component.lastSyncDate = formatDateTime(checkedAt);
      component.updateStats?.();
      component.updateFeatureCard?.();

      const syncNote = component.shadowRoot?.getElementById('syncNote');
      const autoCount = (component.alerts || []).filter((item) => item.auto).length;
      if (syncNote) {
        syncNote.textContent = `${result.curatedCount} cảnh báo biên tập · ${autoCount} bản tin tự động · Kiểm tra nguồn gần nhất: ${formatDateTime(checkedAt)}.`;
      }

      if (status) {
        status.textContent = result.addedCount > 0
          ? `Đã kiểm tra lúc ${formatDateTime(checkedAt)}; bổ sung ${result.addedCount} bản tin mới và đưa lên đầu theo ngày cập nhật.`
          : `Đã kiểm tra lúc ${formatDateTime(checkedAt)}; chưa phát hiện bản tin mới.`;
      }
      return { ok: true, ...result, checkedAt };
    } catch (error) {
      if (status) status.textContent = `Không kiểm tra trực tiếp được nguồn: ${error.message}. Dữ liệu cũ vẫn được giữ nguyên, không bị xóa hoặc thay thế.`;
      return { ok: false, error };
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
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
    button.title = 'Kiểm tra nguồn ngay; không thay thế dữ liệu đã biên tập';

    const status = document.createElement('span');
    status.id = STATUS_ID;
    status.style.cssText = 'grid-column:1/-1;font-size:12px;color:#62717d;margin-top:2px;line-height:1.45';
    status.textContent = 'Tự động mỗi ngày khoảng 06:00 sáng Việt Nam. Nhấn nút để kiểm tra nguồn ngay; dữ liệu đã biên tập được giữ nguyên.';

    searchRow.insertBefore(button, resetButton);
    searchRow.appendChild(status);
    button.addEventListener('click', () => refreshNow(component));
    return true;
  }

  function install() {
    const component = document.querySelector(COMPONENT_SELECTOR);
    if (component && injectButton(component)) return;
    const observer = new MutationObserver(() => {
      const current = document.querySelector(COMPONENT_SELECTOR);
      if (current && injectButton(current)) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 30000);
  }

  window.VPMED_PHARMACOVIGILANCE_REFRESH_NOW = () => {
    const component = document.querySelector(COMPONENT_SELECTOR);
    if (!component) return Promise.resolve({ ok: false, error: new Error('Không tìm thấy mô-đun cảnh báo dược') });
    return refreshNow(component);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
