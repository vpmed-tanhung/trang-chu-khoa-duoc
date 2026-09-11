(() => {
  "use strict";

  const config = window.BHYT_CONFIG || {};
  const TABLES = {
    cases: config.casesTable || config.tableName || "bhyt_nonpickup_cases",
    items: config.itemsTable || "bhyt_nonpickup_items",
    inventoryView: config.inventoryView || "bhyt_monthly_inventory_reconciliation"
  };
  const PAGE_SIZE = 50;
  const GROUPS = ["Quên/không lấy", "Mua ngoài", "Không biết/chưa rõ", "Không liên lạc được", "Không đi khám/nghỉ", "Khác"];
  const DIRECT_NONPICKUP_RULES = [
    ["Mua ngoài", /mua\s*(thuoc\s*)?(ngoai|o ngoai|o nha)|ra\s*ngoai\s*mua/],
    ["Quên/không lấy", /khong\s*lay|ko\s*lay|k\s*lay|chua\s*lay|khong\s*nhan/]
  ];
  const SUPPORTING_RULES = [
    ["Không liên lạc được", /khong\s*nghe|ko\s*nghe|k\s*nghe|khong\s*goi|thue\s*bao|sai\s*so|nham\s*so|may\s*ban|khong\s*nhac\s*may|khong\s*tra\s*loi/],
    ["Không biết/chưa rõ", /khong\s*biet|ko\s*biet|k\s*biet|khong\s*nho|ko\s*nho|chua\s*ro/],
    ["Không đi khám/nghỉ", /khong\s*di\s*kham|ko\s*di\s*kham|khong\s*kham|\bnghi\b/],
    ["Quên/không lấy", /\bquen\b/]
  ];
  const EXCLUDED_RULE = /da\s*lay|co\s*lay|da\s*nhan|nhan\s*thuoc\s*binh\s*thuong|\buong\b/;

  const CASE_MAPPINGS = [
    { key: "serial_no", label: "STT", regex: /^(stt|so tt|so thu tu)$/ },
    { key: "visit_code", label: "Mã lượt khám", regex: /ma luot|ma kham|visit/ },
    { key: "prescription_no", label: "Số đơn thuốc", regex: /so don|ma don|prescription/ },
    { key: "insurance_code", label: "Mã thẻ BHYT", regex: /ma the|so the|bhyt/ },
    { key: "patient_name", label: "Họ và tên", regex: /ho va ten|ho ten|ten benh nhan|benh nhan/, required: true },
    { key: "dispense_date", label: "Ngày cấp phát", regex: /ngay cap|ngay phat|ngay/ },
    { key: "phone", label: "SĐT", regex: /sdt|so dien thoai|dien thoai/ },
    { key: "diagnosis", label: "Chẩn đoán", regex: /chan doan|icd/ },
    { key: "reason", label: "Lý do / ghi chú", regex: /ly do|ghi chu|phan hoi|khong lay/, required: true },
    { key: "drug_code", label: "Mã thuốc", regex: /ma thuoc|ma duoc|drug code/ },
    { key: "drug_name", label: "Tên thuốc", regex: /ten thuoc|ten duoc|hoat chat/ },
    { key: "unit", label: "Đơn vị tính", regex: /don vi tinh|dvt|don vi/ },
    { key: "quantity", label: "Số lượng", regex: /so luong|sl cap|tong sl/ },
    { key: "unit_price", label: "Đơn giá", regex: /don gia|gia thuoc/ },
    { key: "total_amount", label: "Tổng tiền", regex: /tong tien|thanh tien/ },
    { key: "insurance_amount", label: "BHYT trả", regex: /bhyt tra|quy bhyt|bao hiem tra/ },
    { key: "patient_amount", label: "BN chi trả", regex: /bn tra|bn chi|benh nhan tra|cung chi tra/ }
  ];
  const INVENTORY_MAPPINGS = [
    { key: "drug_code", label: "Mã thuốc", regex: /ma thuoc|ma duoc|drug code/, required: true },
    { key: "drug_name", label: "Tên thuốc", regex: /ten thuoc|ten duoc|hoat chat/, required: true },
    { key: "unit", label: "Đơn vị tính", regex: /don vi tinh|dvt|don vi/ },
    { key: "opening_quantity", label: "Tồn đầu", regex: /ton dau/ },
    { key: "received_quantity", label: "Nhập trong tháng", regex: /nhap trong|so luong nhap|^nhap$/ },
    { key: "actual_issued_quantity", label: "Xuất thực tế", regex: /xuat thuc te|xuat so|so luong xuat|^xuat$/ },
    { key: "book_closing_quantity", label: "Tồn cuối sổ", regex: /ton cuoi so|ton so sach|ton cuoi/ },
    { key: "physical_closing_quantity", label: "Tồn thực tế", regex: /ton thuc te|kiem ke/ },
    { key: "nonpickup_in_issued", label: "Xuất sổ gồm đơn không nhận", regex: /gom don khong nhan|don khong lay|thuoc treo/ }
  ];

  const state = {
    client: null,
    orders: [],
    orderCount: 0,
    inventory: [],
    dashboard: {},
    page: 1,
    reviewPage: 1,
    workbookRows: [],
    parsedCases: [],
    inventoryRows: [],
    reviewFilter: "included",
    searchTimer: null,
    sourceFile: ""
  };

  const $ = id => document.getElementById(id);
  const els = {
    periodMode: $("periodMode"), workDate: $("workDate"), reportMonth: $("reportMonth"),
    dayFilterWrap: $("dayFilterWrap"), monthFilterWrap: $("monthFilterWrap"), connectionBadge: $("connectionBadge"),
    patientTotal: $("patientTotal"), suspendedTotal: $("suspendedTotal"), medicineValue: $("medicineValue"),
    insuranceValue: $("insuranceValue"), patientShare: $("patientShare"), periodCaption: $("periodCaption"),
    inventoryAlertTotal: $("inventoryAlertTotal"), inventoryVariance: $("inventoryVariance"), inventoryAlertCard: $("inventoryAlertCard"),
    orderCaption: $("orderCaption"), orderTableBody: $("orderTableBody"), orderEmpty: $("orderEmpty"),
    orderPager: $("orderPager"), pageInfo: $("pageInfo"), previousPageBtn: $("previousPageBtn"), nextPageBtn: $("nextPageBtn"),
    searchInput: $("searchInput"), inventoryTableBody: $("inventoryTableBody"), inventoryEmpty: $("inventoryEmpty"), inventoryCaption: $("inventoryCaption"),
    importDialog: $("importDialog"), uploadStep: $("uploadStep"), mappingStep: $("mappingStep"), reviewStep: $("reviewStep"),
    fileInput: $("fileInput"), dropzone: $("dropzone"), sheetInfo: $("sheetInfo"), caseMappingGrid: $("caseMappingGrid"),
    reviewSummary: $("reviewSummary"), reviewTableBody: $("reviewTableBody"), inventoryDialog: $("inventoryDialog"),
    reviewPager: $("reviewPager"), reviewPageInfo: $("reviewPageInfo"), reviewPreviousBtn: $("reviewPreviousBtn"), reviewNextBtn: $("reviewNextBtn"),
    inventoryMonth: $("inventoryMonth"), inventoryFileInput: $("inventoryFileInput"), inventoryMappingSection: $("inventoryMappingSection"),
    inventoryMappingGrid: $("inventoryMappingGrid"), inventorySheetInfo: $("inventorySheetInfo"), caseDialog: $("caseDialog"),
    itemEditorBody: $("itemEditorBody"), caseItemTotal: $("caseItemTotal"), toast: $("toast")
  };

  function normalize(value) {
    return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function canonicalDrugCode(value) { return String(value ?? "").trim().toUpperCase(); }

  function todayIso() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function monthIso(date = todayIso()) { return String(date).slice(0, 7); }
  function monthStart(month) { return `${month}-01`; }
  function nextMonth(month) {
    const [year, value] = month.split("-").map(Number);
    return new Date(Date.UTC(year, value, 1)).toISOString().slice(0, 10);
  }
  function formatDate(iso) { const [y, m, d] = String(iso || "").split("-"); return y && m && d ? `${d}/${m}/${y}` : "—"; }
  function formatNumber(value, digits = 3) { return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(Number(value) || 0); }
  function formatMoney(value) { return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value) || 0)} ₫`; }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]); }
  function numberOrNull(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    let text = String(value ?? "").trim().replace(/\s|₫|đ/gi, "");
    if (!text) return null;
    const comma = text.lastIndexOf(",");
    const dot = text.lastIndexOf(".");
    if (comma >= 0 && dot >= 0) {
      const decimal = comma > dot ? "," : ".";
      const thousand = decimal === "," ? /\./g : /,/g;
      text = text.replace(thousand, "").replace(decimal, ".");
    } else if (comma >= 0) {
      const decimals = text.length - comma - 1;
      text = decimals > 0 && decimals <= 2 ? text.replace(",", ".") : text.replace(/,/g, "");
    } else if (dot >= 0) {
      const decimals = text.length - dot - 1;
      if (decimals === 3 && /^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
    }
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function calculateTotals(items) {
    return (items || []).reduce((total, item) => {
      const quantity = numberOrNull(item.quantity) || 0;
      const unitPrice = numberOrNull(item.unit_price) || 0;
      const suppliedTotal = numberOrNull(item.total_amount);
      total.quantity += quantity;
      total.totalAmount += suppliedTotal === null ? Math.round(quantity * unitPrice * 100) / 100 : suppliedTotal;
      total.insuranceAmount += numberOrNull(item.insurance_amount) || 0;
      total.patientAmount += numberOrNull(item.patient_amount) || 0;
      return total;
    }, { quantity: 0, totalAmount: 0, insuranceAmount: 0, patientAmount: 0 });
  }

  function excelDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    }
    if (typeof value === "number" && window.XLSX) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
    const text = String(value ?? "").trim();
    const match = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (match) return `${match[3].length === 2 ? `20${match[3]}` : match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
  }

  function classify(reason) {
    const text = normalize(reason);
    for (const [group, regex] of DIRECT_NONPICKUP_RULES) if (regex.test(text)) return { status: "included", group };
    if (EXCLUDED_RULE.test(text)) return { status: "excluded", group: "Đã lấy thuốc" };
    for (const [group, regex] of SUPPORTING_RULES) if (regex.test(text)) return { status: "included", group };
    return { status: "review", group: "Khác" };
  }

  function recordKey(item) {
    const identity = item.prescription_no || item.visit_code || `${item.serial_no || ""}|${item.patient_name}|${item.phone || ""}`;
    return normalize(`${item.dispense_date}|${identity}`).replace(/\s/g, "-");
  }

  function showToast(message, error = false) {
    els.toast.textContent = message;
    els.toast.className = `toast show${error ? " error" : ""}`;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { els.toast.className = "toast"; }, 3500);
  }

  function connectSupabase() {
    const supplied = window.existingSupabaseClient || window.supabaseClient;
    if (supplied) state.client = supplied;
    else {
      const valid = config.supabaseUrl && config.supabaseAnonKey && !String(config.supabaseUrl).includes("YOUR_") && !String(config.supabaseAnonKey).includes("YOUR_");
      if (valid && window.supabase) state.client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    }
    els.connectionBadge.textContent = state.client ? "Đã kết nối" : "Chưa cấu hình Supabase";
    els.connectionBadge.className = `badge ${state.client ? "badge-ok" : "badge-warn"}`;
    return Boolean(state.client);
  }

  async function requireSession() {
    if (!state.client) { showToast("Chưa cấu hình kết nối Supabase.", true); return false; }
    const { data, error } = await state.client.auth.getSession();
    if (error || !data.session) { showToast("Cần đăng nhập tài khoản nội bộ trước khi xem hoặc lưu dữ liệu.", true); return false; }
    return true;
  }

  function selectedPeriod() {
    if (els.periodMode.value === "month") return { start: monthStart(els.reportMonth.value), end: nextMonth(els.reportMonth.value), month: monthStart(els.reportMonth.value) };
    const date = els.workDate.value;
    const next = new Date(`${date}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    return { start: date, end: next.toISOString().slice(0, 10), month: monthStart(monthIso(date)) };
  }

  async function loadData() {
    if (!(await requireSession())) { clearRenderedData(); return; }
    const period = selectedPeriod();
    const offset = (state.page - 1) * PAGE_SIZE;
    let query = state.client.from(TABLES.cases)
      .select("*, bhyt_nonpickup_items(*)", { count: "exact" })
      .gte("dispense_date", period.start).lt("dispense_date", period.end)
      .order("dispense_date", { ascending: false }).order("serial_no", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    const search = els.searchInput.value.trim();
    if (search) {
      const safe = search.replace(/[^\p{L}\p{N}\s._-]/gu, " ").trim();
      query = query.or(`patient_name.ilike.%${safe}%,phone.ilike.%${safe}%,prescription_no.ilike.%${safe}%,visit_code.ilike.%${safe}%`);
    }
    const dashboardParams = els.periodMode.value === "month" ? { p_date: null, p_month: period.month } : { p_date: period.start, p_month: null };
    const [ordersResult, dashboardResult, inventoryResult] = await Promise.all([
      query,
      state.client.rpc("bhyt_get_dashboard", dashboardParams),
      state.client.from(TABLES.inventoryView).select("*").eq("inventory_month", period.month).order("drug_code", { ascending: true })
    ]);
    const error = ordersResult.error || dashboardResult.error || inventoryResult.error;
    if (error) { showToast(error.message || "Không tải được dữ liệu.", true); return; }
    state.orders = (ordersResult.data || []).map(order => ({ ...order, items: order.bhyt_nonpickup_items || [] }));
    state.orderCount = ordersResult.count || 0;
    state.dashboard = (dashboardResult.data || [])[0] || {};
    state.inventory = inventoryResult.data || [];
    renderDashboard();
    renderOrders();
    renderInventory();
  }

  function clearRenderedData() {
    state.orders = []; state.orderCount = 0; state.dashboard = {}; state.inventory = [];
    renderDashboard(); renderOrders(); renderInventory();
  }

  function renderDashboard() {
    const d = state.dashboard;
    els.patientTotal.textContent = formatNumber(d.patient_count, 0);
    els.suspendedTotal.textContent = formatNumber(d.suspended_quantity);
    els.medicineValue.textContent = formatMoney(d.total_amount);
    els.insuranceValue.textContent = formatMoney(d.insurance_amount);
    els.patientShare.textContent = `BN chi trả: ${formatMoney(d.patient_amount)}`;
    const alerts = Number(d.inventory_alert_count) || 0;
    els.inventoryAlertTotal.textContent = formatNumber(alerts, 0);
    els.inventoryVariance.textContent = `Chênh lệch chưa giải thích: ${formatNumber(d.unexplained_variance)}`;
    els.inventoryAlertCard.classList.toggle("has-alert", alerts > 0);
    els.periodCaption.textContent = els.periodMode.value === "month" ? `Tháng ${els.reportMonth.value.slice(5)}/${els.reportMonth.value.slice(0, 4)}` : `Ngày ${formatDate(els.workDate.value)}`;
  }

  function appendCell(row, label, content, className = "") {
    const cell = document.createElement("td");
    cell.dataset.label = label;
    if (className) cell.className = className;
    if (content instanceof Node) cell.append(content); else cell.textContent = content;
    row.append(cell);
    return cell;
  }

  function renderOrders() {
    const fragment = document.createDocumentFragment();
    for (const order of state.orders) {
      const row = document.createElement("tr");
      appendCell(row, "Ngày", formatDate(order.dispense_date));
      appendCell(row, "STT", order.serial_no || "—");
      const patient = document.createElement("div"); patient.className = "patient-cell";
      patient.innerHTML = `<strong>${escapeHtml(order.patient_name)}</strong><small>${escapeHtml([order.phone, order.prescription_no && `Đơn: ${order.prescription_no}`, order.visit_code && `Lượt: ${order.visit_code}`].filter(Boolean).join(" · ") || "—")}</small>`;
      appendCell(row, "Bệnh nhân / đơn", patient);
      const drugs = document.createElement("div"); drugs.className = "drug-cell";
      const preview = order.items.slice(0, 3).map(item => `${escapeHtml(item.drug_code || "—")} · ${escapeHtml(item.drug_name)}`).join("<br>");
      drugs.innerHTML = preview || "—";
      if (order.items.length > 3) drugs.innerHTML += `<small>+ ${order.items.length - 3} thuốc khác</small>`;
      appendCell(row, "Thuốc", drugs);
      appendCell(row, "Số lượng", formatNumber(order.total_quantity), "numeric");
      appendCell(row, "Giá trị", formatMoney(order.total_amount), "numeric");
      appendCell(row, "BHYT trả", formatMoney(order.insurance_amount), "numeric");
      const reason = document.createElement("div"); reason.className = "drug-cell";
      reason.innerHTML = `<strong>${escapeHtml(order.reason_group)}</strong><small>${escapeHtml(order.reason)}</small>`;
      appendCell(row, "Lý do", reason);
      const actions = document.createElement("div"); actions.className = "table-actions";
      actions.innerHTML = `<button class="table-action" type="button" data-edit="${escapeHtml(order.record_key)}">Sửa</button><button class="table-action delete" type="button" data-delete="${escapeHtml(order.record_key)}">Xóa</button>`;
      appendCell(row, "Thao tác", actions);
      fragment.append(row);
    }
    els.orderTableBody.replaceChildren(fragment);
    els.orderEmpty.classList.toggle("hidden", state.orders.length > 0);
    const pages = Math.max(1, Math.ceil(state.orderCount / PAGE_SIZE));
    els.orderPager.classList.toggle("hidden", state.orderCount <= PAGE_SIZE);
    els.pageInfo.textContent = `Trang ${state.page}/${pages} · ${state.orderCount} đơn`;
    els.previousPageBtn.disabled = state.page <= 1;
    els.nextPageBtn.disabled = state.page >= pages;
    els.orderCaption.textContent = `${state.orderCount} đơn trong ${els.periodMode.value === "month" ? `tháng ${els.reportMonth.value.slice(5)}/${els.reportMonth.value.slice(0, 4)}` : `ngày ${formatDate(els.workDate.value)}`}`;
  }

  function isInventoryAlert(row) {
    return Boolean(row.missing_inventory) || Math.abs(Number(row.book_formula_variance) || 0) > .001 || (row.unexplained_variance !== null && Math.abs(Number(row.unexplained_variance) || 0) > .001);
  }

  function renderInventory() {
    const fragment = document.createDocumentFragment();
    for (const item of state.inventory) {
      const alert = isInventoryAlert(item);
      const row = document.createElement("tr");
      const drug = document.createElement("div"); drug.className = "drug-cell";
      drug.innerHTML = `<strong>${escapeHtml(item.drug_code)}</strong><small>${escapeHtml(item.drug_name)} · ${escapeHtml(item.unit)}</small>`;
      appendCell(row, "Thuốc", drug);
      appendCell(row, "Tồn đầu", formatNumber(item.opening_quantity), "numeric");
      appendCell(row, "Nhập", formatNumber(item.received_quantity), "numeric");
      appendCell(row, "Xuất thực tế", formatNumber(item.actual_issued_quantity), "numeric");
      appendCell(row, "Tồn cuối sổ", formatNumber(item.book_closing_quantity), "numeric");
      appendCell(row, "Tồn thực tế", item.physical_closing_quantity === null ? "—" : formatNumber(item.physical_closing_quantity), "numeric");
      appendCell(row, "Thuốc treo", formatNumber(item.suspended_quantity), "numeric");
      appendCell(row, "Lệch thô", item.physical_book_variance === null ? "—" : formatNumber(item.physical_book_variance), `numeric ${Math.abs(Number(item.physical_book_variance) || 0) > .001 ? "variance-bad" : "variance-good"}`);
      appendCell(row, "Lệch sau đối soát", item.unexplained_variance === null ? "—" : formatNumber(item.unexplained_variance), `numeric ${alert ? "variance-bad" : "variance-good"}`);
      const status = document.createElement("span"); status.className = `status ${alert ? "status-warning" : "status-ok"}`; status.textContent = item.missing_inventory ? "Thiếu dữ liệu kho" : alert ? "Cần kiểm tra" : "Khớp";
      appendCell(row, "Kết quả", status);
      fragment.append(row);
    }
    els.inventoryTableBody.replaceChildren(fragment);
    els.inventoryEmpty.classList.toggle("hidden", state.inventory.length > 0);
    const month = selectedPeriod().month;
    els.inventoryCaption.textContent = `Tháng ${month.slice(5, 7)}/${month.slice(0, 4)} · ${state.inventory.length} mã thuốc`;
  }

  async function readWorkbook(file, type) {
    if (!window.XLSX) { showToast("Bộ đọc Excel chưa tải được.", true); return; }
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
      const headerIndex = matrix.slice(0, 30).findIndex(row => row.some(value => {
        const text = normalize(value);
        return type === "cases" ? /ho.*ten|benh.*nhan/.test(text) : /ma.*thuoc|ten.*thuoc|ton.*dau/.test(text);
      }));
      if (headerIndex < 0) throw new Error("Không tìm thấy dòng tiêu đề phù hợp.");
      const headers = matrix[headerIndex].map((value, index) => String(value || `Cột ${index + 1}`).trim());
      if (type === "cases") {
        state.workbookRows = matrix.slice(headerIndex + 1);
        state.sourceFile = file.name;
        buildMapping(els.caseMappingGrid, "caseMap", CASE_MAPPINGS, headers);
        els.sheetInfo.textContent = `${file.name} · ${state.workbookRows.length} dòng · ${workbook.SheetNames[0]}`;
        els.uploadStep.classList.add("hidden"); els.mappingStep.classList.remove("hidden"); els.reviewStep.classList.add("hidden");
      } else {
        state.inventoryRows = matrix.slice(headerIndex + 1);
        buildMapping(els.inventoryMappingGrid, "inventoryMap", INVENTORY_MAPPINGS, headers);
        els.inventorySheetInfo.textContent = `${file.name} · ${state.inventoryRows.length} dòng`;
        els.inventoryMappingSection.classList.remove("hidden");
      }
    } catch (error) { showToast(error.message || "Không đọc được file Excel.", true); }
  }

  function buildMapping(container, prefix, definitions, headers) {
    const fragment = document.createDocumentFragment();
    for (const definition of definitions) {
      const label = document.createElement("label");
      if (definition.required) label.className = "mapping-required";
      const span = document.createElement("span"); span.textContent = definition.label;
      const select = document.createElement("select"); select.id = `${prefix}_${definition.key}`;
      select.innerHTML = '<option value="">— Không có —</option>' + headers.map((header, index) => `<option value="${index}">${escapeHtml(header)}</option>`).join("");
      const guessed = headers.findIndex(header => definition.regex.test(normalize(header)));
      if (guessed >= 0) select.value = String(guessed);
      label.append(span, select); fragment.append(label);
    }
    container.replaceChildren(fragment);
  }

  function readMapping(prefix, definitions) {
    return Object.fromEntries(definitions.map(definition => {
      const value = $(`${prefix}_${definition.key}`).value;
      return [definition.key, value === "" ? null : Number(value)];
    }));
  }

  function analyzeRows() {
    const map = readMapping("caseMap", CASE_MAPPINGS);
    if (!Number.isInteger(map.patient_name) || !Number.isInteger(map.reason)) { showToast("Cần chọn cột Họ và tên và Lý do / ghi chú.", true); return; }
    const grouped = new Map();
    let current = null;
    for (const row of state.workbookRows) {
      const name = String(row[map.patient_name] ?? "").trim();
      if (name) {
        const candidate = {
          serial_no: valueAt(row, map.serial_no), visit_code: valueAt(row, map.visit_code), prescription_no: valueAt(row, map.prescription_no),
          insurance_code: valueAt(row, map.insurance_code), patient_name: name, dispense_date: excelDate(valueAt(row, map.dispense_date)) || els.workDate.value,
          phone: valueAt(row, map.phone), diagnosis: valueAt(row, map.diagnosis), reasons: [], items: [], source_file: state.sourceFile
        };
        const key = recordKey(candidate);
        current = grouped.get(key) || candidate;
        if (!grouped.has(key)) grouped.set(key, current);
      }
      if (!current) continue;
      const reason = valueAt(row, map.reason);
      if (reason && !current.reasons.includes(reason)) current.reasons.push(reason);
      const drugName = valueAt(row, map.drug_name);
      if (drugName) current.items.push({
        drug_code: canonicalDrugCode(valueAt(row, map.drug_code)), drug_name: drugName, unit: valueAt(row, map.unit) || "viên",
        quantity: numberOrNull(valueAt(row, map.quantity)) || 0, unit_price: numberOrNull(valueAt(row, map.unit_price)) || 0,
        total_amount: numberOrNull(valueAt(row, map.total_amount)), insurance_amount: numberOrNull(valueAt(row, map.insurance_amount)) || 0,
        patient_amount: numberOrNull(valueAt(row, map.patient_amount)) || 0
      });
    }
    state.parsedCases = Array.from(grouped.values()).map(item => {
      item.reason = item.reasons.join("; ");
      const result = classify(item.reason);
      const totals = calculateTotals(item.items);
      return { ...item, ...totals, reason_group: result.group, status: result.status, selected: result.status === "included", record_key: recordKey(item) };
    }).filter(item => item.reason);
    state.reviewFilter = "included";
    state.reviewPage = 1;
    document.querySelectorAll("[data-review-filter]").forEach(button => button.classList.toggle("active", button.dataset.reviewFilter === state.reviewFilter));
    renderReview();
    els.mappingStep.classList.add("hidden"); els.reviewStep.classList.remove("hidden");
  }

  function valueAt(row, index) { return Number.isInteger(index) ? String(row[index] ?? "").trim() : ""; }

  function renderReview() {
    const counts = { included: 0, review: 0, excluded: 0 };
    state.parsedCases.forEach(item => { counts[item.status] += 1; });
    els.reviewSummary.textContent = `${counts.included} không lấy · ${counts.review} cần rà soát · ${counts.excluded} đã lấy`;
    const filtered = state.parsedCases.map((item, index) => ({ item, index })).filter(entry => entry.item.status === state.reviewFilter);
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (state.reviewPage > pages) state.reviewPage = pages;
    const start = (state.reviewPage - 1) * PAGE_SIZE;
    const fragment = document.createDocumentFragment();
    filtered.slice(start, start + PAGE_SIZE).forEach(({ item, index }) => {
      const row = document.createElement("tr");
      const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = item.selected; checkbox.dataset.selectIndex = index;
      appendCell(row, "Chọn", checkbox); appendCell(row, "STT", item.serial_no || "—"); appendCell(row, "Bệnh nhân", item.patient_name);
      appendCell(row, "Ngày", formatDate(item.dispense_date)); appendCell(row, "Số thuốc", String(item.items.length));
      appendCell(row, "Số lượng", formatNumber(item.quantity), "numeric"); appendCell(row, "Giá trị", formatMoney(item.totalAmount), "numeric");
      appendCell(row, "Ghi chú", item.reason);
      const status = document.createElement("span"); status.className = `status ${item.status === "included" ? "status-ok" : item.status === "excluded" ? "status-muted" : "status-warning"}`;
      status.textContent = item.status === "included" ? "Không lấy" : item.status === "excluded" ? "Đã lấy" : "Cần rà soát";
      appendCell(row, "Kết quả", status); fragment.append(row);
    });
    els.reviewTableBody.replaceChildren(fragment);
    els.reviewPager.classList.toggle("hidden", filtered.length <= PAGE_SIZE);
    els.reviewPageInfo.textContent = `Trang ${state.reviewPage}/${pages}`;
    els.reviewPreviousBtn.disabled = state.reviewPage <= 1;
    els.reviewNextBtn.disabled = state.reviewPage >= pages;
  }

  function cleanCaseForRpc(item) {
    return {
      record_key: item.record_key, dispense_date: item.dispense_date, serial_no: item.serial_no || "", visit_code: item.visit_code || "",
      prescription_no: item.prescription_no || "", insurance_code: item.insurance_code || "", patient_name: item.patient_name,
      phone: item.phone || "", diagnosis: item.diagnosis || "", reason: item.reason, reason_group: item.reason_group,
      source_file: item.source_file || "", items: (item.items || []).map((drug, index) => ({
        line_no: index + 1, drug_code: canonicalDrugCode(drug.drug_code), drug_name: drug.drug_name, unit: drug.unit || "viên",
        quantity: numberOrNull(drug.quantity) || 0, unit_price: numberOrNull(drug.unit_price) || 0,
        total_amount: numberOrNull(drug.total_amount), insurance_amount: numberOrNull(drug.insurance_amount) || 0,
        patient_amount: numberOrNull(drug.patient_amount) || 0
      }))
    };
  }

  async function saveSelected() {
    const cases = state.parsedCases.filter(item => item.selected).map(cleanCaseForRpc);
    if (!cases.length) { showToast("Chưa chọn đơn nào để lưu.", true); return; }
    if (!(await requireSession())) return;
    try {
      const saved = await runRpcInChunks("bhyt_import_nonpickup_cases", "p_cases", cases, 100);
      els.importDialog.close(); resetImport(); state.page = 1; showToast(`Đã lưu ${saved} đơn và chi tiết thuốc.`); await loadData();
    } catch (error) { showToast(error.message || "Không lưu được dữ liệu.", true); }
  }

  async function runRpcInChunks(functionName, rowsParam, rows, chunkSize, fixedParams = {}) {
    let saved = 0;
    for (let index = 0; index < rows.length; index += chunkSize) {
      const chunk = rows.slice(index, index + chunkSize);
      const { data, error } = await state.client.rpc(functionName, { ...fixedParams, [rowsParam]: chunk });
      if (error) throw error;
      saved += Number(data) || chunk.length;
    }
    return saved;
  }

  function resetImport() {
    state.workbookRows = []; state.parsedCases = []; state.sourceFile = ""; els.fileInput.value = "";
    els.uploadStep.classList.remove("hidden"); els.mappingStep.classList.add("hidden"); els.reviewStep.classList.add("hidden");
  }

  async function saveInventory() {
    const map = readMapping("inventoryMap", INVENTORY_MAPPINGS);
    if (!Number.isInteger(map.drug_code) || !Number.isInteger(map.drug_name)) { showToast("Cần chọn cột Mã thuốc và Tên thuốc.", true); return; }
    const rows = state.inventoryRows.map(row => ({
      drug_code: canonicalDrugCode(valueAt(row, map.drug_code)), drug_name: valueAt(row, map.drug_name), unit: valueAt(row, map.unit) || "viên",
      opening_quantity: numberOrNull(valueAt(row, map.opening_quantity)) || 0,
      received_quantity: numberOrNull(valueAt(row, map.received_quantity)) || 0,
      actual_issued_quantity: numberOrNull(valueAt(row, map.actual_issued_quantity)) || 0,
      book_closing_quantity: numberOrNull(valueAt(row, map.book_closing_quantity)) || 0,
      physical_closing_quantity: numberOrNull(valueAt(row, map.physical_closing_quantity)),
      nonpickup_in_issued: parseBoolean(valueAt(row, map.nonpickup_in_issued), true)
    })).filter(row => row.drug_code && row.drug_name);
    if (!rows.length) { showToast("Không có dòng tồn kho hợp lệ.", true); return; }
    if (!(await requireSession())) return;
    try {
      const saved = await runRpcInChunks("bhyt_upsert_monthly_inventory", "p_rows", rows, 500, { p_month: monthStart(els.inventoryMonth.value) });
      els.inventoryDialog.close(); els.reportMonth.value = els.inventoryMonth.value; showToast(`Đã lưu ${saved} mã thuốc tồn kho.`); await loadData();
    } catch (error) { showToast(error.message || "Không lưu được tồn kho.", true); }
  }

  function parseBoolean(value, defaultValue) {
    const text = normalize(value);
    if (!text) return defaultValue;
    if (["0", "false", "khong", "no"].includes(text)) return false;
    if (["1", "true", "co", "yes", "x"].includes(text)) return true;
    return defaultValue;
  }

  function resetCaseForm(order = null) {
    $("caseForm").reset();
    $("caseOriginalKey").value = order?.record_key || "";
    $("caseDate").value = order?.dispense_date || els.workDate.value;
    $("caseSerial").value = order?.serial_no || ""; $("caseName").value = order?.patient_name || "";
    $("casePhone").value = order?.phone || ""; $("caseVisitCode").value = order?.visit_code || "";
    $("casePrescription").value = order?.prescription_no || ""; $("caseInsuranceCode").value = order?.insurance_code || "";
    $("caseDiagnosis").value = order?.diagnosis || ""; $("caseReason").value = order?.reason || "";
    $("caseReasonGroup").value = order?.reason_group || GROUPS[0];
    $("caseDialogTitle").textContent = order ? "Chỉnh sửa đơn không nhận" : "Thêm đơn không nhận";
    els.itemEditorBody.replaceChildren();
    (order?.items?.length ? order.items : [{}]).forEach(addItemRow);
    updateCaseEditorTotals();
  }

  function addItemRow(item = {}) {
    const row = document.createElement("tr");
    const fields = [
      ["drug_code", item.drug_code || "", "text", ""], ["drug_name", item.drug_name || "", "text", "item-name"],
      ["unit", item.unit || "viên", "text", ""], ["quantity", item.quantity ?? "", "number", ""],
      ["unit_price", item.unit_price ?? "", "number", ""], ["insurance_amount", item.insurance_amount ?? "", "number", ""],
      ["patient_amount", item.patient_amount ?? "", "number", ""]
    ];
    for (const [field, value, type, className] of fields) {
      const cell = document.createElement("td"); const input = document.createElement("input");
      input.dataset.itemField = field; input.value = value; input.type = type; if (type === "number") { input.min = "0"; input.step = "any"; }
      if (field === "drug_name") input.required = true; if (className) input.className = className;
      cell.append(input); row.append(cell);
    }
    const action = document.createElement("td"); action.innerHTML = '<button class="remove-item" type="button" aria-label="Xóa thuốc">Xóa</button>'; row.append(action);
    els.itemEditorBody.append(row);
  }

  function readItemEditor() {
    return Array.from(els.itemEditorBody.rows).map(row => {
      const item = {};
      row.querySelectorAll("[data-item-field]").forEach(input => { item[input.dataset.itemField] = input.value.trim(); });
      const quantity = numberOrNull(item.quantity) || 0; const unitPrice = numberOrNull(item.unit_price) || 0;
      return { ...item, drug_code: canonicalDrugCode(item.drug_code), quantity, unit_price: unitPrice, total_amount: Math.round(quantity * unitPrice * 100) / 100, insurance_amount: numberOrNull(item.insurance_amount) || 0, patient_amount: numberOrNull(item.patient_amount) || 0 };
    }).filter(item => item.drug_name);
  }

  function updateCaseEditorTotals() {
    const items = readItemEditor(); const totals = calculateTotals(items);
    els.caseItemTotal.textContent = `${items.length} thuốc · ${formatNumber(totals.quantity)} đơn vị · ${formatMoney(totals.totalAmount)}`;
  }

  async function saveCase(event) {
    event.preventDefault();
    const items = readItemEditor();
    if (!items.length) { showToast("Đơn phải có ít nhất một thuốc.", true); return; }
    const data = {
      dispense_date: $("caseDate").value, serial_no: $("caseSerial").value.trim(), patient_name: $("caseName").value.trim(),
      phone: $("casePhone").value.trim(), visit_code: $("caseVisitCode").value.trim(), prescription_no: $("casePrescription").value.trim(),
      insurance_code: $("caseInsuranceCode").value.trim(), diagnosis: $("caseDiagnosis").value.trim(), reason: $("caseReason").value.trim(),
      reason_group: $("caseReasonGroup").value, source_file: "Nhập thủ công", items
    };
    data.record_key = $("caseOriginalKey").value || recordKey(data);
    if (!(await requireSession())) return;
    const { error } = await state.client.rpc("bhyt_import_nonpickup_cases", { p_cases: [cleanCaseForRpc(data)] });
    if (error) { showToast(error.message, true); return; }
    els.caseDialog.close(); showToast("Đã lưu đơn và chi tiết thuốc."); await loadData();
  }

  async function deleteCase(key) {
    if (!confirm("Xóa đơn này và toàn bộ chi tiết thuốc?")) return;
    if (!(await requireSession())) return;
    const { error } = await state.client.from(TABLES.cases).delete().eq("record_key", key);
    if (error) { showToast(error.message, true); return; }
    if (state.orders.length === 1 && state.page > 1) state.page -= 1;
    showToast("Đã xóa đơn."); await loadData();
  }

  async function fetchAllOrders() {
    const period = selectedPeriod(); const result = []; let from = 0;
    while (true) {
      const { data, error } = await state.client.from(TABLES.cases).select("*, bhyt_nonpickup_items(*)").gte("dispense_date", period.start).lt("dispense_date", period.end).order("dispense_date").range(from, from + 999);
      if (error) throw error;
      result.push(...(data || []));
      if (!data || data.length < 1000) break;
      from += 1000;
    }
    return result;
  }

  async function exportReport() {
    if (!(await requireSession())) return;
    if (!window.XLSX) { showToast("Bộ xuất Excel chưa tải được.", true); return; }
    try {
      const orders = await fetchAllOrders();
      if (!orders.length && !state.inventory.length) { showToast("Không có dữ liệu để xuất.", true); return; }
      const summary = [{
        "Kỳ báo cáo": els.periodMode.value === "month" ? els.reportMonth.value : formatDate(els.workDate.value),
        "Số BN không lấy": Number(state.dashboard.patient_count) || 0,
        "Tổng thuốc treo": Number(state.dashboard.suspended_quantity) || 0,
        "Tổng giá trị": Number(state.dashboard.total_amount) || 0,
        "BHYT trả": Number(state.dashboard.insurance_amount) || 0,
        "BN chi trả": Number(state.dashboard.patient_amount) || 0,
        "Số cảnh báo kho": Number(state.dashboard.inventory_alert_count) || 0,
        "Lệch chưa giải thích": Number(state.dashboard.unexplained_variance) || 0
      }];
      const orderRows = orders.map(order => ({
        "Ngày cấp phát": formatDate(order.dispense_date), STT: order.serial_no, "Mã lượt khám": order.visit_code,
        "Số đơn": order.prescription_no, "Mã thẻ BHYT": order.insurance_code, "Họ và tên": order.patient_name,
        SĐT: order.phone, "Chẩn đoán": order.diagnosis, "Lý do": order.reason, "Nhóm lý do": order.reason_group,
        "Tổng thuốc treo": Number(order.total_quantity) || 0, "Tổng tiền": Number(order.total_amount) || 0,
        "BHYT trả": Number(order.insurance_amount) || 0, "BN trả": Number(order.patient_amount) || 0
      }));
      const itemRows = orders.flatMap(order => (order.bhyt_nonpickup_items || []).map(item => ({
        "Ngày cấp phát": formatDate(order.dispense_date), "Số đơn": order.prescription_no, "Họ và tên": order.patient_name,
        "Mã thuốc": item.drug_code, "Tên thuốc": item.drug_name, ĐVT: item.unit, "Số lượng": Number(item.quantity) || 0,
        "Đơn giá": Number(item.unit_price) || 0, "Tổng tiền": Number(item.total_amount) || 0,
        "BHYT trả": Number(item.insurance_amount) || 0, "BN trả": Number(item.patient_amount) || 0
      })));
      const inventoryRows = state.inventory.map(item => ({
        "Mã thuốc": item.drug_code, "Tên thuốc": item.drug_name, ĐVT: item.unit,
        "Tồn đầu": Number(item.opening_quantity) || 0, Nhập: Number(item.received_quantity) || 0,
        "Xuất thực tế": Number(item.actual_issued_quantity) || 0, "Tồn cuối sổ": Number(item.book_closing_quantity) || 0,
        "Tồn thực tế": item.physical_closing_quantity === null ? "" : Number(item.physical_closing_quantity),
        "Thuốc treo": Number(item.suspended_quantity) || 0, "Lệch thô": item.physical_book_variance === null ? "" : Number(item.physical_book_variance),
        "Lệch sau đối soát": item.unexplained_variance === null ? "" : Number(item.unexplained_variance),
        "Kết quả": isInventoryAlert(item) ? "Cần kiểm tra" : "Khớp"
      }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), "Tổng hợp");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(orderRows), "Đơn không nhận");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(itemRows), "Chi tiết thuốc");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(inventoryRows), "Đối soát kho");
      const suffix = els.periodMode.value === "month" ? els.reportMonth.value : els.workDate.value;
      XLSX.writeFile(workbook, `bao-cao-bhyt-khong-lay-thuoc-${suffix}.xlsx`);
    } catch (error) { showToast(error.message || "Không xuất được báo cáo.", true); }
  }

  function handlePeriodChange() {
    const monthly = els.periodMode.value === "month";
    els.dayFilterWrap.classList.toggle("hidden", monthly);
    els.monthFilterWrap.classList.toggle("hidden", !monthly);
    if (!monthly) els.reportMonth.value = monthIso(els.workDate.value);
    state.page = 1; loadData();
  }

  function bindEvents() {
    $("refreshBtn").addEventListener("click", loadData);
    els.periodMode.addEventListener("change", handlePeriodChange);
    els.workDate.addEventListener("change", () => { els.reportMonth.value = monthIso(els.workDate.value); state.page = 1; loadData(); });
    els.reportMonth.addEventListener("change", () => { state.page = 1; loadData(); });
    els.searchInput.addEventListener("input", () => { clearTimeout(state.searchTimer); state.searchTimer = setTimeout(() => { state.page = 1; loadData(); }, 300); });
    els.previousPageBtn.addEventListener("click", () => { state.page -= 1; loadData(); });
    els.nextPageBtn.addEventListener("click", () => { state.page += 1; loadData(); });
    $("openImportBtn").addEventListener("click", () => { resetImport(); els.importDialog.showModal(); });
    $("openInventoryBtn").addEventListener("click", () => { els.inventoryMonth.value = selectedPeriod().month.slice(0, 7); els.inventoryFileInput.value = ""; els.inventoryMappingSection.classList.add("hidden"); els.inventoryDialog.showModal(); });
    $("openManualBtn").addEventListener("click", () => { resetCaseForm(); els.caseDialog.showModal(); });
    $("exportBtn").addEventListener("click", exportReport);
    els.fileInput.addEventListener("change", event => event.target.files[0] && readWorkbook(event.target.files[0], "cases"));
    els.inventoryFileInput.addEventListener("change", event => event.target.files[0] && readWorkbook(event.target.files[0], "inventory"));
    els.dropzone.addEventListener("dragover", event => { event.preventDefault(); els.dropzone.classList.add("dragging"); });
    els.dropzone.addEventListener("dragleave", () => els.dropzone.classList.remove("dragging"));
    els.dropzone.addEventListener("drop", event => { event.preventDefault(); els.dropzone.classList.remove("dragging"); if (event.dataTransfer.files[0]) readWorkbook(event.dataTransfer.files[0], "cases"); });
    $("analyzeBtn").addEventListener("click", analyzeRows);
    $("backToMappingBtn").addEventListener("click", () => { els.reviewStep.classList.add("hidden"); els.mappingStep.classList.remove("hidden"); });
    $("saveSelectedBtn").addEventListener("click", saveSelected);
    $("saveInventoryBtn").addEventListener("click", saveInventory);
    document.querySelectorAll("[data-review-filter]").forEach(button => button.addEventListener("click", () => { state.reviewFilter = button.dataset.reviewFilter; state.reviewPage = 1; document.querySelectorAll("[data-review-filter]").forEach(item => item.classList.toggle("active", item === button)); renderReview(); }));
    els.reviewPreviousBtn.addEventListener("click", () => { state.reviewPage -= 1; renderReview(); });
    els.reviewNextBtn.addEventListener("click", () => { state.reviewPage += 1; renderReview(); });
    els.reviewTableBody.addEventListener("change", event => { if (event.target.matches("[data-select-index]")) state.parsedCases[Number(event.target.dataset.selectIndex)].selected = event.target.checked; });
    els.orderTableBody.addEventListener("click", event => {
      const edit = event.target.closest("[data-edit]"); const remove = event.target.closest("[data-delete]");
      if (edit) { const order = state.orders.find(item => item.record_key === edit.dataset.edit); if (order) { resetCaseForm(order); els.caseDialog.showModal(); } }
      if (remove) deleteCase(remove.dataset.delete);
    });
    $("caseForm").addEventListener("submit", saveCase);
    $("addItemBtn").addEventListener("click", () => { addItemRow(); updateCaseEditorTotals(); });
    els.itemEditorBody.addEventListener("input", updateCaseEditorTotals);
    els.itemEditorBody.addEventListener("click", event => { const button = event.target.closest(".remove-item"); if (button) { button.closest("tr").remove(); if (!els.itemEditorBody.rows.length) addItemRow(); updateCaseEditorTotals(); } });
    document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => $(button.dataset.close).close()));
  }

  function init() {
    els.workDate.value = todayIso(); els.reportMonth.value = monthIso(); els.inventoryMonth.value = monthIso();
    $("caseReasonGroup").innerHTML = GROUPS.map(group => `<option>${escapeHtml(group)}</option>`).join("");
    bindEvents(); connectSupabase(); loadData();
  }

  window.BHYTNonPickup = Object.freeze({ calculateTotals, classify, numberOrNull });
  init();
})();
