/**
 * API trung gian an toàn cho nút "Cập nhật dữ liệu" trên GitHub Pages.
 * GitHub token chỉ lưu trong Script Properties, không xuất hiện trong mã web.
 */

const PV_DEFAULTS = Object.freeze({
  owner: 'vpmed-tanhung',
  repo: 'trang-chu-khoa-duoc',
  workflow: 'cap-nhat-canh-bao-duoc.yml',
  ref: 'main',
  cooldownSeconds: 60
});

function doGet() {
  return jsonOutput_({
    ok: true,
    service: 'VPMED pharmacovigilance refresh bridge',
    ready: Boolean(getRequiredProperty_('GITHUB_TOKEN', false)),
    time: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    const body = parseBody_(e);
    if (body.action !== 'refreshPharmacovigilance') {
      return jsonOutput_({ ok: false, message: 'Hành động không hợp lệ.' });
    }

    enforceCooldown_();
    dispatchWorkflow_();

    return jsonOutput_({
      ok: true,
      accepted: true,
      message: 'Đã gửi yêu cầu cập nhật tới GitHub Actions.',
      requestedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(error);
    return jsonOutput_({
      ok: false,
      message: String(error && error.message ? error.message : error)
    });
  }
}

function dispatchWorkflow_() {
  const props = PropertiesService.getScriptProperties();
  const owner = props.getProperty('GITHUB_OWNER') || PV_DEFAULTS.owner;
  const repo = props.getProperty('GITHUB_REPO') || PV_DEFAULTS.repo;
  const workflow = props.getProperty('GITHUB_WORKFLOW') || PV_DEFAULTS.workflow;
  const ref = props.getProperty('GITHUB_REF') || PV_DEFAULTS.ref;
  const token = getRequiredProperty_('GITHUB_TOKEN', true);

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ ref: ref }),
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'VPMED-Pharmacovigilance-Refresh-Bridge'
    },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  if (code !== 204) {
    const detail = response.getContentText().slice(0, 500);
    throw new Error(`GitHub từ chối yêu cầu (${code}): ${detail}`);
  }
}

function enforceCooldown_() {
  const cache = CacheService.getScriptCache();
  const key = 'PV_REFRESH_COOLDOWN';
  if (cache.get(key)) {
    throw new Error('Hệ thống vừa nhận một yêu cầu cập nhật. Vui lòng chờ khoảng 1 phút rồi thử lại.');
  }
  cache.put(key, '1', PV_DEFAULTS.cooldownSeconds);
}

function parseBody_(e) {
  const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
  try {
    return JSON.parse(raw);
  } catch (_) {
    throw new Error('Dữ liệu gửi lên không hợp lệ.');
  }
}

function getRequiredProperty_(name, required) {
  const value = PropertiesService.getScriptProperties().getProperty(name) || '';
  if (required && !value) {
    throw new Error(`Chưa cấu hình Script Property ${name}.`);
  }
  return value;
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
