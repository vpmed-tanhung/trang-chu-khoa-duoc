(function () {
  'use strict';

  const root = document.getElementById('petctQcModule');
  if (!root) return;

  const calculator = window.PetctQcCalculator;
  const supabaseConfig = window.PETCT_QC_SUPABASE_CONFIG || {};
  const storageKey = 'vpmed-petct-qc-records-v1';
  const supabaseTable = 'qc_records';
  const supabaseColumns = [
    'id', 'client_record_id', 'created_at', 'mode', 'drug_name', 'performed_date',
    'lot_number', 'manufacturer', 'bound_activity_mci', 'aceton_top_uci',
    'aceton_bot_uci', 'nacl_top_uci', 'nacl_bot_uci', 'sep_pak_uci',
    'ethanol_uci', 'free_percent', 'hydrolyzed_percent', 'bound_percent', 'ph',
    'mo99_uci', 'aluminum_result', 'compounder', 'qc_operator'
  ].join(',');
  const byId = function (id) { return root.querySelector('#' + id); };
  let records = normalizeLocalRecords(loadRecords());
  let supabaseClient = null;
  let syncPromise = null;
  let cloudMutationInProgress = false;

  function fieldValue(id) {
    const element = byId(id);
    return element ? String(element.value || '').trim() : '';
  }

  function fieldNumber(id) {
    const value = fieldValue(id);
    if (value === '') return NaN;
    const number = Number(value.replace(',', '.'));
    return Number.isFinite(number) ? number : NaN;
  }

  function todayLocal() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function formatPercent(value) {
    return Number.isFinite(value)
      ? value.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '--';
  }

  function setMetric(id, value, applicable) {
    const output = byId(id);
    if (!output) return;
    output.textContent = applicable ? formatPercent(value) : '—';
    const unit = output.parentElement && output.parentElement.querySelector('small');
    if (unit) unit.textContent = applicable ? '%' : 'Không áp dụng';
  }

  function setCalculationStatus(message, state) {
    const status = byId('qcCalculationStatus');
    if (!status) return;
    status.className = 'petct-qc-status' + (state ? ' is-' + state : '');
    status.textContent = message;
  }

  function setFormMessage(message, state) {
    const output = byId('qcFormMessage');
    if (!output) return;
    output.className = 'petct-qc-form-message' + (state ? ' is-' + state : '');
    output.textContent = message;
  }

  function setCloudStatus(message, state) {
    const output = byId('qcCloudStatus');
    if (!output) return;
    output.className = 'petct-qc-cloud-status' + (state ? ' is-' + state : '');
    output.textContent = message;
  }

  function calculateCurrent() {
    if (!calculator) {
      setMetric('qcFreePercent', NaN, true);
      setMetric('qcHydrolyzedPercent', NaN, true);
      setMetric('qcBoundPercent', NaN, true);
      setCalculationStatus('Không tải được bộ tính QC. Vui lòng tải lại trang.', 'error');
      return { valid: false, error: 'CALCULATOR_UNAVAILABLE' };
    }

    const mode = fieldValue('qcMode');
    const result = mode === 'mibi-seppak'
      ? calculator.calculateMibi({ sepPak: fieldNumber('qcSepPak'), ethanol: fieldNumber('qcEthanol') })
      : calculator.calculateAcetonNacl({
          acetonTop: fieldNumber('qcAcetonTop'),
          acetonBot: fieldNumber('qcAcetonBot'),
          naclTop: fieldNumber('qcNaclTop'),
          naclBot: fieldNumber('qcNaclBot')
        });

    const standardMode = mode !== 'mibi-seppak';
    setMetric('qcFreePercent', result.freePercent, standardMode);
    setMetric('qcHydrolyzedPercent', result.hydrolyzedPercent, standardMode);
    setMetric('qcBoundPercent', result.boundPercent, true);

    if (result.valid) {
      setCalculationStatus('Đã tính theo số đo hiện tại. Không áp dụng ngưỡng đạt/không đạt tự động.', 'ok');
    } else if (result.error === 'ZERO_DENOMINATOR') {
      setCalculationStatus('Không thể tính: tổng số đo ở mẫu số phải lớn hơn 0.', 'error');
    } else {
      setCalculationStatus('Nhập đủ các số đo không âm của chế độ đang chọn.', '');
    }
    return result;
  }

  function updateMode() {
    const mibiMode = fieldValue('qcMode') === 'mibi-seppak';
    byId('qcAcetonNaclFields').hidden = mibiMode;
    byId('qcMibiFields').hidden = !mibiMode;
    setFormMessage('', '');
    calculateCurrent();
  }

  function aluminumText(value) {
    if (value === 'pass') return 'Đạt - màu mẫu thử nhạt hơn màu mẫu chuẩn';
    if (value === 'fail') return 'Không đạt - màu mẫu thử không nhạt hơn màu mẫu chuẩn';
    return '';
  }

  function loadRecords() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function normalizeLocalRecords(items) {
    return items.filter(function (record) {
      return record && typeof record === 'object' && record.id;
    }).map(function (record) {
      return Object.assign({}, record, {
        id: String(record.id),
        syncStatus: record.remoteId || record.syncStatus === 'synced' ? 'synced' : 'pending'
      });
    });
  }

  function persistRecords() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(records));
      return true;
    } catch (error) {
      setFormMessage('Không thể lưu vào trình duyệt này. Hãy kiểm tra quyền lưu trữ của website.', 'error');
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function displayValue(value) {
    return value === '' || value === null || value === undefined ? '—' : escapeHtml(value);
  }

  function storageCell(record) {
    const state = record.syncStatus === 'synced'
      ? '<span class="petct-qc-storage-state is-synced">Supabase</span>'
      : '<span class="petct-qc-storage-state is-pending">Chờ đồng bộ</span>';
    return state +
      '<button class="petct-qc-delete" type="button" data-qc-delete="' + escapeHtml(record.id) + '" aria-label="Xóa bản ghi trên thiết bị và Supabase">×</button>';
  }

  function renderRecords() {
    const body = byId('qcSavedBody');
    const count = byId('qcSavedCount');
    if (count) count.textContent = records.length + ' dòng';
    if (!body) return;
    if (!records.length) {
      body.innerHTML = '<tr class="petct-qc-empty"><td colspan="18">Chưa có kết quả QC được lưu.</td></tr>';
      return;
    }

    body.innerHTML = records.slice().sort(function (left, right) {
      return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
    }).map(function (record) {
      const aceton = record.mode === 'aceton-nacl';
      const mibi = record.mode === 'mibi-seppak';
      return '<tr>' +
        '<td>' + displayValue(record.drugName) + '</td>' +
        '<td>' + displayValue(record.date) + '</td>' +
        '<td>' + displayValue(record.lotNumber) + '</td>' +
        '<td>' + displayValue(record.manufacturer) + '</td>' +
        '<td>' + displayValue(record.boundActivity) + '</td>' +
        '<td>' + displayValue(aceton ? record.acetonTop : '') + '</td>' +
        '<td>' + displayValue(aceton ? record.acetonBot : '') + '</td>' +
        '<td>' + displayValue(aceton ? record.naclTop : '') + '</td>' +
        '<td>' + displayValue(aceton ? record.naclBot : '') + '</td>' +
        '<td>' + displayValue(mibi ? record.sepPak : '') + '</td>' +
        '<td>' + displayValue(mibi ? record.ethanol : '') + '</td>' +
        '<td><strong>' + formatPercent(Number(record.boundPercent)) + '</strong></td>' +
        '<td>' + displayValue(record.ph) + '</td>' +
        '<td>' + displayValue(record.mo99) + '</td>' +
        '<td>' + displayValue(aluminumText(record.aluminum)) + '</td>' +
        '<td>' + displayValue(record.compounder) + '</td>' +
        '<td>' + displayValue(record.operator) + '</td>' +
        '<td class="petct-qc-storage-cell">' + storageCell(record) + '</td>' +
        '</tr>';
    }).join('');
  }

  function currentRecord(result) {
    const mode = fieldValue('qcMode');
    return {
      id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 10),
      createdAt: new Date().toISOString(),
      syncStatus: 'pending',
      remoteId: '',
      mode,
      drugName: fieldValue('qcDrugName'),
      date: fieldValue('qcDate'),
      lotNumber: fieldValue('qcLotNumber'),
      manufacturer: fieldValue('qcManufacturer'),
      boundActivity: fieldValue('qcBoundActivity'),
      acetonTop: mode === 'aceton-nacl' ? fieldValue('qcAcetonTop') : '',
      acetonBot: mode === 'aceton-nacl' ? fieldValue('qcAcetonBot') : '',
      naclTop: mode === 'aceton-nacl' ? fieldValue('qcNaclTop') : '',
      naclBot: mode === 'aceton-nacl' ? fieldValue('qcNaclBot') : '',
      sepPak: mode === 'mibi-seppak' ? fieldValue('qcSepPak') : '',
      ethanol: mode === 'mibi-seppak' ? fieldValue('qcEthanol') : '',
      freePercent: Number.isFinite(result.freePercent) ? result.freePercent : null,
      hydrolyzedPercent: Number.isFinite(result.hydrolyzedPercent) ? result.hydrolyzedPercent : null,
      boundPercent: result.boundPercent,
      ph: fieldValue('qcPh'),
      mo99: fieldValue('qcMo99'),
      aluminum: fieldValue('qcAluminum'),
      compounder: fieldValue('qcCompounder'),
      operator: fieldValue('qcOperator')
    };
  }

  function optionalText(value) {
    const text = String(value === null || value === undefined ? '' : value).trim();
    return text === '' ? null : text;
  }

  function optionalNumber(value) {
    if (value === '' || value === null || value === undefined) return null;
    const number = Number(String(value).replace(',', '.'));
    return Number.isFinite(number) ? number : null;
  }

  function toSupabaseRow(record) {
    return {
      client_record_id: record.id,
      created_at: record.createdAt,
      mode: record.mode,
      drug_name: record.drugName,
      performed_date: record.date,
      lot_number: optionalText(record.lotNumber),
      manufacturer: optionalText(record.manufacturer),
      bound_activity_mci: optionalNumber(record.boundActivity),
      aceton_top_uci: optionalNumber(record.acetonTop),
      aceton_bot_uci: optionalNumber(record.acetonBot),
      nacl_top_uci: optionalNumber(record.naclTop),
      nacl_bot_uci: optionalNumber(record.naclBot),
      sep_pak_uci: optionalNumber(record.sepPak),
      ethanol_uci: optionalNumber(record.ethanol),
      free_percent: optionalNumber(record.freePercent),
      hydrolyzed_percent: optionalNumber(record.hydrolyzedPercent),
      bound_percent: optionalNumber(record.boundPercent),
      ph: optionalNumber(record.ph),
      mo99_uci: optionalNumber(record.mo99),
      aluminum_result: optionalText(record.aluminum),
      compounder: optionalText(record.compounder),
      qc_operator: optionalText(record.operator)
    };
  }

  function fromSupabaseRow(row) {
    return {
      id: String(row.client_record_id || row.id),
      createdAt: row.created_at || '',
      syncStatus: 'synced',
      remoteId: String(row.id || ''),
      mode: row.mode,
      drugName: row.drug_name,
      date: row.performed_date,
      lotNumber: row.lot_number || '',
      manufacturer: row.manufacturer || '',
      boundActivity: row.bound_activity_mci === null ? '' : row.bound_activity_mci,
      acetonTop: row.aceton_top_uci === null ? '' : row.aceton_top_uci,
      acetonBot: row.aceton_bot_uci === null ? '' : row.aceton_bot_uci,
      naclTop: row.nacl_top_uci === null ? '' : row.nacl_top_uci,
      naclBot: row.nacl_bot_uci === null ? '' : row.nacl_bot_uci,
      sepPak: row.sep_pak_uci === null ? '' : row.sep_pak_uci,
      ethanol: row.ethanol_uci === null ? '' : row.ethanol_uci,
      freePercent: row.free_percent === null ? null : Number(row.free_percent),
      hydrolyzedPercent: row.hydrolyzed_percent === null ? null : Number(row.hydrolyzed_percent),
      boundPercent: Number(row.bound_percent),
      ph: row.ph === null ? '' : row.ph,
      mo99: row.mo99_uci === null ? '' : row.mo99_uci,
      aluminum: row.aluminum_result || '',
      compounder: row.compounder || '',
      operator: row.qc_operator || ''
    };
  }

  function supabaseConfigured() {
    const url = String(supabaseConfig.url || '').trim();
    const key = String(supabaseConfig.anonKey || '').trim();
    return /^https:\/\//i.test(url) && !url.includes('YOUR_SUPABASE_') &&
      key.length >= 20 && !key.includes('YOUR_SUPABASE_');
  }

  function getSupabaseClient() {
    if (!supabaseConfigured()) return null;
    if (supabaseClient) return supabaseClient;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;
    supabaseClient = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    return supabaseClient;
  }

  function markRecordSynced(clientRecordId, remoteRow) {
    const index = records.findIndex(function (record) { return record.id === clientRecordId; });
    if (index < 0) return;
    records[index] = Object.assign({}, records[index], {
      syncStatus: 'synced',
      remoteId: String(remoteRow && remoteRow.id || records[index].remoteId || ''),
      createdAt: remoteRow && remoteRow.created_at || records[index].createdAt
    });
  }

  async function findRemoteRecord(client, clientRecordId) {
    const response = await client.from(supabaseTable)
      .select('id,client_record_id,created_at')
      .eq('client_record_id', clientRecordId)
      .maybeSingle();
    if (response.error) throw response.error;
    return response.data;
  }

  async function insertRemoteRecord(record) {
    const client = getSupabaseClient();
    if (!client) throw new Error('SUPABASE_UNAVAILABLE');
    const response = await client.from(supabaseTable)
      .insert(toSupabaseRow(record))
      .select('id,client_record_id,created_at')
      .single();
    if (!response.error) return response.data;
    if (String(response.error.code || '') === '23505') {
      const existing = await findRemoteRecord(client, record.id);
      if (existing) return existing;
    }
    throw response.error;
  }

  async function fetchAllCloudRecords(client) {
    const pageSize = 1000;
    let offset = 0;
    let cloudRows = [];
    while (true) {
      const response = await client.from(supabaseTable)
        .select(supabaseColumns)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (response.error) throw response.error;
      const page = Array.isArray(response.data) ? response.data : [];
      cloudRows = cloudRows.concat(page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }
    return cloudRows.map(fromSupabaseRow);
  }

  function mergeCloudRecords(cloudRecords) {
    const merged = new Map();
    records.filter(function (record) {
      return record.syncStatus !== 'synced';
    }).forEach(function (record) {
      merged.set(record.id, record);
    });
    cloudRecords.forEach(function (record) {
      merged.set(record.id, Object.assign({}, merged.get(record.id) || {}, record));
    });
    records = Array.from(merged.values());
  }

  async function deleteRemoteRecord(clientRecordId) {
    const client = getSupabaseClient();
    if (!client) throw new Error('SUPABASE_UNAVAILABLE');
    const response = await client.from(supabaseTable)
      .delete()
      .eq('client_record_id', clientRecordId);
    if (response.error) throw response.error;
  }

  async function deleteAllRemoteRecords() {
    const client = getSupabaseClient();
    if (!client) throw new Error('SUPABASE_UNAVAILABLE');
    const response = await client.from(supabaseTable)
      .delete()
      .neq('client_record_id', '');
    if (response.error) throw response.error;
  }

  async function syncPendingRecords() {
    const pending = records.filter(function (record) { return record.syncStatus !== 'synced'; });
    let syncedCount = 0;
    let failedCount = 0;
    for (const record of pending) {
      try {
        const remoteRow = await insertRemoteRecord(record);
        markRecordSynced(record.id, remoteRow);
        syncedCount += 1;
      } catch (error) {
        failedCount += 1;
      }
    }
    persistRecords();
    renderRecords();
    return { syncedCount, failedCount };
  }

  async function refreshAndSync(manual) {
    if (syncPromise) return syncPromise;
    const task = (async function () {
      const button = byId('qcSyncButton');
      if (button) button.disabled = true;
      try {
        if (!supabaseConfigured()) {
          setCloudStatus('Supabase chưa cấu hình. Dữ liệu hiện vẫn được lưu an toàn trên thiết bị.', 'local');
          if (manual) setFormMessage('Hãy điền SUPABASE_URL và SUPABASE_ANON_KEY trong tệp cấu hình QC.', '');
          return;
        }
        if (navigator.onLine === false) {
          setCloudStatus('Đang offline. Các bản ghi mới được giữ cục bộ và sẽ đồng bộ khi có mạng.', 'pending');
          if (manual) setFormMessage('Không có kết nối mạng; chưa thể làm mới Supabase.', '');
          return;
        }
        const client = getSupabaseClient();
        if (!client) {
          setCloudStatus('Không tải được Supabase Client từ CDN. Dữ liệu vẫn được lưu cục bộ.', 'error');
          return;
        }

        setCloudStatus('Đang gửi các bản ghi chờ và tải lịch sử từ Supabase…', 'pending');
        const result = await syncPendingRecords();
        const cloudRecords = await fetchAllCloudRecords(client);
        mergeCloudRecords(cloudRecords);
        persistRecords();
        renderRecords();
        if (result.failedCount) {
          setCloudStatus('Đã tải lịch sử Supabase; còn ' + result.failedCount + ' bản ghi cục bộ chờ đồng bộ.', 'pending');
          if (manual) setFormMessage('Đã làm mới lịch sử; còn bản ghi cục bộ chờ gửi lại.', '');
        } else {
          setCloudStatus('Đã đồng bộ Supabase · ' + cloudRecords.length + ' bản ghi trên đám mây.', 'ok');
          if (manual) setFormMessage('Đã làm mới và đồng bộ lịch sử QC.', 'ok');
        }
      } catch (error) {
        setCloudStatus('Không kết nối được Supabase. Dữ liệu cục bộ không bị mất và sẽ được thử lại.', 'error');
        if (manual) setFormMessage('Đồng bộ thất bại. Kiểm tra mạng, URL/key, bảng qc_records và chính sách RLS.', 'error');
      } finally {
        const button = byId('qcSyncButton');
        if (button) button.disabled = false;
      }
    })();
    syncPromise = task;
    try {
      return await task;
    } finally {
      if (syncPromise === task) syncPromise = null;
    }
  }

  async function saveRecord(event) {
    event.preventDefault();
    if (cloudMutationInProgress) {
      setFormMessage('Một thao tác lưu/xóa Supabase đang chạy. Vui lòng chờ hoàn tất.', 'error');
      return;
    }
    const drugName = fieldValue('qcDrugName');
    const date = fieldValue('qcDate');
    if (!drugName || !date) {
      setFormMessage('Cần nhập Tên dược chất và Ngày thực hiện trước khi lưu.', 'error');
      return;
    }

    const result = calculateCurrent();
    if (!result.valid) {
      setFormMessage('Chưa thể lưu: kiểm tra lại các số đo dùng để tính hệ số gắn.', 'error');
      return;
    }

    const record = currentRecord(result);
    records.push(record);
    if (!persistRecords()) {
      records.pop();
      return;
    }
    renderRecords();
    setFormMessage('Đã lưu cục bộ. Đang kiểm tra đồng bộ Supabase…', 'ok');
    window.VPMED_PLATFORM?.calculationComplete({ feature: 'petct-qc', mode: fieldValue('qcMode') });

    if (!supabaseConfigured()) {
      setCloudStatus('Supabase chưa cấu hình. Bản ghi đang được giữ cục bộ trên thiết bị.', 'local');
      setFormMessage('Đã lưu trên thiết bị; chưa gửi Supabase vì chưa có URL/key.', 'ok');
      return;
    }
    if (navigator.onLine === false) {
      setCloudStatus('Đang offline. Bản ghi mới đang chờ đồng bộ.', 'pending');
      setFormMessage('Đã lưu trên thiết bị; sẽ tự đồng bộ khi có mạng.', 'ok');
      return;
    }

    cloudMutationInProgress = true;
    try {
      const remoteRow = await insertRemoteRecord(record);
      markRecordSynced(record.id, remoteRow);
      persistRecords();
      renderRecords();
      const remaining = records.filter(function (item) { return item.syncStatus !== 'synced'; }).length;
      setCloudStatus(remaining
        ? 'Đã lưu Supabase; còn ' + remaining + ' bản ghi cục bộ chờ đồng bộ.'
        : 'Đã kết nối Supabase. Không có bản ghi mới đang chờ.', remaining ? 'pending' : 'ok');
      setFormMessage('Đã lưu đồng thời trên thiết bị và Supabase.', 'ok');
    } catch (error) {
      setCloudStatus('Chưa gửi được Supabase. Bản ghi vẫn an toàn trên thiết bị và đang chờ đồng bộ.', 'pending');
      setFormMessage('Đã lưu trên thiết bị; đồng bộ Supabase thất bại và sẽ được thử lại.', 'ok');
    } finally {
      cloudMutationInProgress = false;
    }
  }

  function resetForm() {
    byId('petctQcForm').reset();
    byId('qcDate').value = todayLocal();
    updateMode();
    setFormMessage('Đã xóa dữ liệu nhập.', '');
  }

  function csvCell(value) {
    return '"' + String(value === null || value === undefined ? '' : value).replace(/"/g, '""') + '"';
  }

  function exportCsv() {
    if (!records.length) {
      setFormMessage('Chưa có dòng kết quả nào để xuất CSV.', 'error');
      return;
    }

    const headers = [
      'Tên dược chất', 'Ngày thực hiện', 'Số lô sx', 'Hãng sx', 'HĐ gắn (mCi)',
      'DM Aceton TOP (µCi)', 'DM Aceton BOT (µCi)',
      'DM NaCl 0.9% Top (µCi)', 'DM NaCl 0.9% BOT (µCi)',
      'DM Ethanol 96% Sep-Pak (µCi)', 'DM Ethanol 96% Ethanol (µCi)',
      'HS gắn % (B*)', 'pH', 'Mo-99 (µCi)', 'Nhôm tạp chất (so màu)',
      'Người pha chế', 'Người QC'
    ];
    const rows = records.slice().sort(function (left, right) {
      return String(left.createdAt || '').localeCompare(String(right.createdAt || ''));
    }).map(function (record) {
      const aceton = record.mode === 'aceton-nacl';
      const mibi = record.mode === 'mibi-seppak';
      return [
        record.drugName, record.date, record.lotNumber, record.manufacturer, record.boundActivity,
        aceton ? record.acetonTop : '', aceton ? record.acetonBot : '',
        aceton ? record.naclTop : '', aceton ? record.naclBot : '',
        mibi ? record.sepPak : '', mibi ? record.ethanol : '',
        Number(record.boundPercent).toFixed(2), record.ph, record.mo99,
        aluminumText(record.aluminum), record.compounder, record.operator
      ];
    });
    const csv = '\uFEFFsep=;\r\n' + [headers].concat(rows).map(function (row) {
      return row.map(csvCell).join(';');
    }).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'QC-duoc-chat-phong-xa-' + todayLocal() + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    setFormMessage('Đã xuất CSV UTF-8 theo đúng thứ tự cột của biểu mẫu lab.', 'ok');
  }

  async function deleteRecord(id) {
    if (cloudMutationInProgress) {
      setFormMessage('Một thao tác lưu/xóa Supabase đang chạy. Vui lòng chờ hoàn tất.', 'error');
      return;
    }
    const record = records.find(function (item) { return item.id === id; });
    if (!record) return;
    if (!window.confirm('Xóa vĩnh viễn bản ghi QC này trên thiết bị và Supabase?')) return;

    if (syncPromise) await syncPromise;
    const requiresCloudDelete = record.syncStatus === 'synced' || supabaseConfigured();
    if (requiresCloudDelete) {
      if (!supabaseConfigured()) {
        setFormMessage('Không thể xóa: bản ghi có trên Supabase nhưng cấu hình URL/key hiện không khả dụng.', 'error');
        return;
      }
      if (navigator.onLine === false) {
        setFormMessage('Cần kết nối mạng để xóa đồng thời bản ghi trên Supabase. Dữ liệu chưa bị xóa.', 'error');
        return;
      }
      setFormMessage('Đang xóa bản ghi trên Supabase…', '');
      cloudMutationInProgress = true;
      try {
        await deleteRemoteRecord(id);
      } catch (error) {
        setFormMessage('Xóa thất bại trên Supabase. Dữ liệu trên thiết bị được giữ nguyên.', 'error');
        setCloudStatus('Không xóa được dữ liệu. Kiểm tra mạng và chính sách DELETE của bảng qc_records.', 'error');
        return;
      } finally {
        cloudMutationInProgress = false;
      }
    }

    records = records.filter(function (item) { return item.id !== id; });
    persistRecords();
    renderRecords();
    setFormMessage(requiresCloudDelete
      ? 'Đã xóa bản ghi trên thiết bị và Supabase.'
      : 'Đã xóa bản ghi cục bộ chưa từng đồng bộ.', 'ok');
    if (requiresCloudDelete) setCloudStatus('Đã xóa bản ghi khỏi Supabase.', 'ok');
  }

  async function clearAllRecords() {
    if (cloudMutationInProgress) {
      setFormMessage('Một thao tác lưu/xóa Supabase đang chạy. Vui lòng chờ hoàn tất.', 'error');
      return;
    }
    const hasSyncedRecords = records.some(function (record) { return record.syncStatus === 'synced'; });
    if (!records.length && !supabaseConfigured()) {
      setFormMessage('Không có dữ liệu QC để xóa.', '');
      return;
    }
    if (!window.confirm('Xóa vĩnh viễn TOÀN BỘ lịch sử QC trên thiết bị và Supabase? Thao tác này không thể hoàn tác.')) return;

    if (syncPromise) await syncPromise;
    if (supabaseConfigured()) {
      if (navigator.onLine === false) {
        setFormMessage('Cần kết nối mạng để xóa toàn bộ dữ liệu trên Supabase. Chưa có dữ liệu nào bị xóa.', 'error');
        return;
      }
      setFormMessage('Đang xóa toàn bộ lịch sử QC trên Supabase…', '');
      cloudMutationInProgress = true;
      try {
        await deleteAllRemoteRecords();
      } catch (error) {
        setFormMessage('Không thể xóa toàn bộ dữ liệu trên Supabase. Dữ liệu cục bộ được giữ nguyên.', 'error');
        setCloudStatus('Xóa thất bại. Kiểm tra mạng và chính sách DELETE của bảng qc_records.', 'error');
        return;
      } finally {
        cloudMutationInProgress = false;
      }
    } else if (hasSyncedRecords) {
      setFormMessage('Không thể xóa hết: lịch sử có dữ liệu Supabase nhưng URL/key hiện chưa được cấu hình.', 'error');
      return;
    }

    records = [];
    persistRecords();
    renderRecords();
    setFormMessage(supabaseConfigured()
      ? 'Đã xóa toàn bộ dữ liệu QC trên thiết bị và Supabase.'
      : 'Đã xóa toàn bộ dữ liệu QC chỉ tồn tại trên thiết bị.', 'ok');
    setCloudStatus(supabaseConfigured()
      ? 'Supabase hiện không còn bản ghi QC.'
      : 'Supabase chưa cấu hình; bộ nhớ QC trên thiết bị đã được xóa.', supabaseConfigured() ? 'ok' : 'local');
  }

  byId('petctQcForm').addEventListener('submit', saveRecord);
  byId('qcMode').addEventListener('change', updateMode);
  byId('qcResetButton').addEventListener('click', resetForm);
  byId('qcExportButton').addEventListener('click', exportCsv);
  byId('qcClearSavedButton').addEventListener('click', clearAllRecords);
  byId('qcSyncButton').addEventListener('click', function () { refreshAndSync(true); });
  root.addEventListener('input', function (event) {
    if (event.target.matches('#qcAcetonTop,#qcAcetonBot,#qcNaclTop,#qcNaclBot,#qcSepPak,#qcEthanol')) {
      calculateCurrent();
      setFormMessage('', '');
    }
  });
  byId('qcSavedBody').addEventListener('click', function (event) {
    const button = event.target.closest('[data-qc-delete]');
    if (button) deleteRecord(button.getAttribute('data-qc-delete'));
  });
  window.addEventListener('storage', function (event) {
    if (event.key !== storageKey) return;
    records = normalizeLocalRecords(loadRecords());
    renderRecords();
  });
  window.addEventListener('online', function () { refreshAndSync(false); });
  window.addEventListener('offline', function () {
    setCloudStatus('Đang offline. Các bản ghi mới được giữ cục bộ và sẽ đồng bộ khi có mạng.', 'pending');
  });

  if (!fieldValue('qcDate')) byId('qcDate').value = todayLocal();
  updateMode();
  renderRecords();
  refreshAndSync(false);
})();
