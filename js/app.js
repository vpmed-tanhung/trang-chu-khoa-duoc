async function loadAntibiotics() {
  const res = await fetch('./data/antibiotics.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Không tải được data/antibiotics.json');
  return await res.json();
}

function normalizeText(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function safeText(value, fallback = 'Chưa nhập') {
  return value && value.toString().trim() ? value : fallback;
}

function renderList(items) {
  if (!items || !items.length) return '<li>Chưa nhập dữ liệu.</li>';
  return items.map(item => `<li>${item}</li>`).join('');
}

function renderAntibioticCard(item) {
  const crcl = item.lieu_goi_y?.hieu_chinh_crcl || {};
  const interactions = (item.canh_bao_tuong_tac || [])
    .map(x => `<li><b>${safeText(x.cap, 'Cặp tương tác')}</b> <span class="badge">${safeText(x.muc_do, 'Theo dõi')}</span>: ${safeText(x.canh_bao, '')}<br><small>Xử trí: ${safeText(x.xu_tri, 'Theo dõi và đánh giá lâm sàng.')}</small></li>`)
    .join('');

  const crclRows = Object.entries(crcl)
    .map(([key, value]) => `<tr><td><b>${key}</b></td><td>${safeText(value)}</td></tr>`)
    .join('');

  const references = (item.nguon_tham_khao || []).join(', ');

  return `
    <article class="abx-card">
      <div class="abx-title">
        <div>
          <h3>${safeText(item.ten_thuoc_biet_duoc, item.hoat_chat)}</h3>
          <div><b>Hoạt chất:</b> ${safeText(item.hoat_chat)}</div>
        </div>
        <div><b>STT nội trú:</b> ${safeText(item.stt_noi_tru, '')}</div>
      </div>

      <p><b>Nhóm:</b> ${safeText(item.nhom_khang_sinh)} &nbsp; | &nbsp; <b>AWaRe:</b> ${safeText(item.aware)}</p>
      <p><b>Hàm lượng:</b> ${safeText(item.ham_luong_nong_do)} &nbsp; | &nbsp; <b>Đường dùng:</b> ${safeText(item.duong_dung)}</p>

      <h4>Cảnh báo tương tác thuốc</h4>
      <ul>${interactions || '<li>Chưa nhập dữ liệu tương tác có ý nghĩa lâm sàng cao.</li>'}</ul>

      <h4>Liều gợi ý</h4>
      <p><b>Liều truyền thống:</b> ${safeText(item.lieu_goi_y?.lieu_truyen_thong)}</p>
      <p><b>ODA / truyền kéo dài:</b> ${safeText(item.lieu_goi_y?.oda_keo_dai)}</p>
      <table>
        <thead><tr><th>CrCl / lọc máu</th><th>Gợi ý hiệu chỉnh</th></tr></thead>
        <tbody>${crclRows || '<tr><td colspan="2">Chưa nhập dữ liệu hiệu chỉnh liều.</td></tr>'}</tbody>
      </table>

      <h4>Cách pha truyền</h4>
      <p><b>Dung môi:</b> ${safeText(item.cach_pha_truyen?.dung_moi)}</p>
      <p><b>Tốc độ truyền:</b> ${safeText(item.cach_pha_truyen?.toc_do)}</p>
      <p><b>Lưu ý pha truyền:</b> ${safeText(item.cach_pha_truyen?.luu_y)}</p>

      <h4>Lưu ý quan trọng</h4>
      <p><b>TDM:</b> ${item.tdm?.can ? 'Có / ưu tiên' : 'Không thường quy'} ${safeText(item.tdm?.muc_tieu, '')}</p>
      <ul>${renderList(item.luu_y_quan_trong)}</ul>
      <p class="note"><b>Trạng thái dữ liệu:</b> ${safeText(item.trang_thai_du_lieu)}. <b>Nguồn:</b> ${safeText(references)}.</p>
    </article>`;
}

function setupAntibioticSearch(data) {
  const input = document.querySelector('#abxSearch');
  const list = document.querySelector('#abxList');
  const result = document.querySelector('#abxResult');
  if (!input || !list || !result) return;

  const options = data
    .slice()
    .sort((a, b) => normalizeText(a.hoat_chat).localeCompare(normalizeText(b.hoat_chat)))
    .map(x => `<option value="${x.ten_thuoc_biet_duoc}">${x.hoat_chat}</option><option value="${x.hoat_chat}">${x.ten_thuoc_biet_duoc}</option>`)
    .join('');
  list.innerHTML = options;

  function refresh() {
    const q = normalizeText(input.value);
    if (!q) {
      result.innerHTML = `<p class="note">Đã tải ${data.length} kháng sinh nội trú. Nhập tên thuốc hoặc hoạt chất để xem chi tiết.</p>`;
      return;
    }

    const matched = data.filter(x =>
      normalizeText(x.ten_thuoc_biet_duoc).includes(q) ||
      normalizeText(x.hoat_chat).includes(q) ||
      normalizeText(x.nhom_khang_sinh).includes(q)
    );

    if (matched.length === 1) {
      result.innerHTML = renderAntibioticCard(matched[0]);
      return;
    }

    if (matched.length > 1) {
      result.innerHTML = `
        <p class="note">Tìm thấy ${matched.length} kết quả. Chọn đúng biệt dược/hoạt chất để xem chi tiết.</p>
        <div class="app-grid">
          ${matched.slice(0, 8).map(x => `
            <article class="app-card">
              <div class="app-icon">💊</div>
              <h3>${x.ten_thuoc_biet_duoc}</h3>
              <p><b>${x.hoat_chat}</b><br>${safeText(x.nhom_khang_sinh)}</p>
              <button class="card-link" type="button" data-drug="${x.id}">Xem chi tiết</button>
            </article>
          `).join('')}
        </div>`;
      document.querySelectorAll('[data-drug]').forEach(btn => {
        btn.addEventListener('click', () => {
          const selected = data.find(x => x.id === btn.dataset.drug);
          if (selected) {
            input.value = selected.ten_thuoc_biet_duoc;
            result.innerHTML = renderAntibioticCard(selected);
          }
        });
      });
      return;
    }

    result.innerHTML = '<p class="error">Không tìm thấy thuốc phù hợp trong danh mục hiện tại.</p>';
  }

  input.addEventListener('input', refresh);
  refresh();
}

document.addEventListener('DOMContentLoaded', async () => {
  const result = document.querySelector('#abxResult');
  try {
    const data = await loadAntibiotics();
    setupAntibioticSearch(data);
  } catch (error) {
    console.error(error);
    if (result) result.innerHTML = '<p class="error">Lỗi tải dữ liệu kháng sinh. Kiểm tra file data/antibiotics.json đã upload đúng vị trí chưa.</p>';
  }
});
