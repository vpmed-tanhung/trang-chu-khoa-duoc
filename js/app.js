async function loadAntibiotics() {
  const res = await fetch('./data/antibiotics.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Không tải được data/antibiotics.json');
  return await res.json();
}

const state = { data: [], selectedId: null };

function normalizeText(value) {
  return (value || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function safeText(value, fallback = 'Chưa có dữ liệu') {
  return value && value.toString().trim() ? value : fallback;
}
function renderList(items) {
  if (!items || !items.length) return '<li>Chưa có dữ liệu.</li>';
  return items.map(item => `<li>${item}</li>`).join('');
}
function sourceBadges(items) {
  return (items || []).map(x => `<span class="source-badge">${x}</span>`).join('');
}
function renderRows(obj) {
  return Object.entries(obj || {}).map(([key, value]) => `<tr><td><b>${key}</b></td><td>${safeText(value)}</td></tr>`).join('');
}
function renderInteractions(items) {
  if (!items || !items.length) return '<li>Chưa có cảnh báo tương tác ưu tiên mức độ cao trong danh mục hiện tại. Vẫn cần kiểm tra thêm theo bệnh cảnh và thuốc dùng đồng thời.</li>';
  return items.map(x => `<li><b>${safeText(x.cap, 'Cặp tương tác')}</b> <span class="badge ${normalizeText(x.muc_do)}">${safeText(x.muc_do, 'Theo dõi')}</span><br>${safeText(x.canh_bao, '')}<br><small><b>Xử trí:</b> ${safeText(x.xu_tri, 'Theo dõi và đánh giá lâm sàng.')}</small></li>`).join('');
}

function renderAntibioticCard(item) {
  const crcl = item.lieu_goi_y?.hieu_chinh_crcl || {};
  return `
    <article class="abx-card">
      <div class="abx-title">
        <div>
          <p class="eyebrow">STT nội trú: ${safeText(item.stt_noi_tru, '')}</p>
          <h3>${safeText(item.ten_thuoc_biet_duoc, item.hoat_chat)}</h3>
          <div><b>Hoạt chất:</b> ${safeText(item.hoat_chat)}</div>
        </div>
        <span class="aware-pill">${safeText(item.aware)}</span>
      </div>

      <div class="quick-meta">
        <span><b>Nhóm:</b> ${safeText(item.nhom_khang_sinh)}</span>
        <span><b>Hàm lượng:</b> ${safeText(item.ham_luong_nong_do)}</span>
        <span><b>Đường dùng:</b> ${safeText(item.duong_dung)}</span>
      </div>

      <div class="tab-grid">
        <section class="tab-card">
          <h4>📋 Tổng quan</h4>
          <ul>${renderList(item.chi_dinh_goi_y)}</ul>
          <h5>Chống chỉ định / thận trọng</h5>
          <ul>${renderList(item.chong_chi_dinh)}</ul>
        </section>

        <section class="tab-card wide">
          <h4>💉 Liều gợi ý & hiệu chỉnh CrCl</h4>
          <p><b>Liều truyền thống:</b> ${safeText(item.lieu_goi_y?.lieu_truyen_thong)}</p>
          <p><b>ODA / truyền kéo dài:</b> ${safeText(item.lieu_goi_y?.oda_keo_dai)}</p>
          <table><thead><tr><th>CrCl / lọc máu</th><th>Gợi ý hiệu chỉnh</th></tr></thead><tbody>${renderRows(crcl)}</tbody></table>
        </section>

        <section class="tab-card">
          <h4>🧪 Cách pha truyền</h4>
          <p><b>Dung môi:</b> ${safeText(item.cach_pha_truyen?.dung_moi)}</p>
          <p><b>Tốc độ:</b> ${safeText(item.cach_pha_truyen?.toc_do)}</p>
          <p><b>Lưu ý:</b> ${safeText(item.cach_pha_truyen?.luu_y)}</p>
        </section>

        <section class="tab-card">
          <h4>⚠️ Tương tác ưu tiên</h4>
          <ul>${renderInteractions(item.canh_bao_tuong_tac)}</ul>
        </section>

        <section class="tab-card">
          <h4>📈 TDM & theo dõi</h4>
          <p><b>TDM:</b> ${item.tdm?.can ? 'Có / ưu tiên' : 'Không thường quy'} ${item.tdm?.muc_tieu ? '· ' + item.tdm.muc_tieu : ''}</p>
          <ul>${renderList(item.theo_doi)}</ul>
        </section>

        <section class="tab-card">
          <h4>🚨 ADR cần lưu ý</h4>
          <ul>${renderList(item.adr_can_luu_y)}</ul>
        </section>
      </div>

      <div class="clinical-note">
        <b>Lưu ý:</b>
        <ul>${renderList(item.luu_y_quan_trong)}</ul>
      </div>
      <p class="note"><b>Trạng thái dữ liệu:</b> ${safeText(item.trang_thai_du_lieu)}<br><b>Nguồn:</b> ${sourceBadges(item.nguon_tham_khao)}</p>
    </article>`;
}

function filteredData() {
  const input = document.querySelector('#abxSearch');
  const select = document.querySelector('#groupFilter');
  const q = normalizeText(input?.value || '');
  const group = select?.value || '';
  return state.data.filter(x => {
    const matchesText = !q || normalizeText([x.ten_thuoc_biet_duoc, x.hoat_chat, x.nhom_khang_sinh, x.aware].join(' ')).includes(q);
    const matchesGroup = !group || x.nhom_khang_sinh === group;
    return matchesText && matchesGroup;
  });
}

function renderDrugList(items) {
  const panel = document.querySelector('#abxListPanel');
  if (!panel) return;
  if (!items.length) { panel.innerHTML = '<p class="error">Không tìm thấy thuốc phù hợp.</p>'; return; }
  panel.innerHTML = items.map(x => `
    <button class="drug-item ${state.selectedId === x.id ? 'selected' : ''}" type="button" data-drug="${x.id}">
      <b>${x.ten_thuoc_biet_duoc}</b>
      <span>${x.hoat_chat}</span>
      <small>${x.nhom_khang_sinh}</small>
    </button>`).join('');
  panel.querySelectorAll('[data-drug]').forEach(btn => btn.addEventListener('click', () => selectDrug(btn.dataset.drug)));
}

function selectDrug(id) {
  const result = document.querySelector('#abxResult');
  const item = state.data.find(x => x.id === id) || state.data.find(x => String(x.id) === String(id));
  if (!item || !result) return;
  state.selectedId = item.id;
  result.innerHTML = renderAntibioticCard(item);
  renderDrugList(filteredData());
}

function refreshSearch() {
  const items = filteredData();
  renderDrugList(items);
  const result = document.querySelector('#abxResult');
  if (!items.length) { if (result) result.innerHTML = '<p class="error">Không tìm thấy thuốc phù hợp trong danh mục hiện tại.</p>'; return; }
  const currentInList = items.some(x => x.id === state.selectedId);
  if (!currentInList) selectDrug(items[0].id);
}

function setupAntibioticSearch(data) {
  state.data = data;
  state.selectedId = data[0]?.id;
  const metric = document.querySelector('#metricTotal');
  if (metric) metric.textContent = data.length;

  const input = document.querySelector('#abxSearch');
  const datalist = document.querySelector('#abxList');
  const select = document.querySelector('#groupFilter');
  if (datalist) datalist.innerHTML = data.flatMap(x => [`<option value="${x.ten_thuoc_biet_duoc}">${x.hoat_chat}</option>`, `<option value="${x.hoat_chat}">${x.ten_thuoc_biet_duoc}</option>`]).join('');
  if (select) {
    const groups = [...new Set(data.map(x => x.nhom_khang_sinh).filter(Boolean))].sort((a,b)=>normalizeText(a).localeCompare(normalizeText(b)));
    select.innerHTML = '<option value="">Tất cả nhóm</option>' + groups.map(g => `<option value="${g}">${g}</option>`).join('');
    select.addEventListener('change', refreshSearch);
  }
  if (input) input.addEventListener('input', refreshSearch);
  refreshSearch();
}

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelector('.menu-toggle')?.addEventListener('click', () => document.querySelector('.nav')?.classList.toggle('open'));
  const result = document.querySelector('#abxResult');
  try {
    const data = await loadAntibiotics();
    setupAntibioticSearch(data);
  } catch (error) {
    console.error(error);
    if (result) result.innerHTML = '<p class="error">Lỗi tải dữ liệu kháng sinh. Kiểm tra file data/antibiotics.json đã upload đúng vị trí chưa.</p>';
  }
});
