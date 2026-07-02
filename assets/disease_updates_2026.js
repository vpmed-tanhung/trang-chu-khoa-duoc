(function () {
  'use strict';

  // 1) Bỏ đúng hai khung: "Nhận diện và đánh giá ban đầu"
  // và "Xét nghiệm và bệnh phẩm" trong mục Kháng sinh theo bệnh lý.
  const style = document.createElement('style');
  style.textContent = `
    #diseaseProfile .disease-grid > section:nth-child(1),
    #diseaseProfile .disease-grid > section:nth-child(2) {
      display: none !important;
    }
  `;
  document.head.appendChild(style);

  // 2) Cập nhật nguồn chuyên môn theo bản hiện hành/mới nhất tìm thấy đến 02/07/2026.
  // Chỉ thay nguồn hiển thị; không thay đổi phác đồ, liều, dữ liệu thuốc hay chức năng khác.
  const SOURCE_MAP = {
    cap: [
      ['NICE NG250 (2025)', 'Pneumonia: diagnosis and management – viêm phổi cộng đồng và viêm phổi bệnh viện.', 'https://www.nice.org.uk/guidance/ng250'],
      ['ERS/ESICM/ESCMID/ALAT (2023)', 'Hướng dẫn quốc tế về viêm phổi cộng đồng nặng ở người lớn.', 'https://erj.ersjournals.com/content/61/4/2200735']
    ],
    hap: [
      ['NICE NG250 (2025)', 'Pneumonia: diagnosis and management – phần viêm phổi bệnh viện.', 'https://www.nice.org.uk/guidance/ng250'],
      ['ATS/IDSA – HAP/VAP', 'Trang hướng dẫn chính thức đang được ATS/IDSA duy trì cho viêm phổi bệnh viện và liên quan thở máy.', 'https://www.idsociety.org/practice-guideline/hap_vap/']
    ],
    aecopd: [
      ['GOLD Report 2026', 'Global Strategy for Prevention, Diagnosis and Management of COPD – bản 2026.', 'https://goldcopd.org/2026-gold-report-and-pocket-guide/']
    ],
    cystitis: [
      ['EAU Urological Infections Guidelines 2026', 'Hướng dẫn cập nhật của European Association of Urology về nhiễm khuẩn tiết niệu.', 'https://uroweb.org/guidelines/urological-infections/summary-of-changes/2026']
    ],
    pyelo: [
      ['EAU Urological Infections Guidelines 2026', 'Hướng dẫn cập nhật về nhiễm khuẩn tiết niệu khu trú và toàn thân, gồm viêm bể thận.', 'https://uroweb.org/guidelines/urological-infections/summary-of-changes/2026']
    ],
    sepsis: [
      ['Surviving Sepsis Campaign – Adult Guidelines', 'Trang hướng dẫn chính thức hiện hành của Society of Critical Care Medicine.', 'https://www.sccm.org/clinical-resources/surviving-sepsis-campaign-guidelines-2021']
    ],
    cellulitis: [
      ['NICE NG141 – Cellulitis and erysipelas', 'Hướng dẫn kê đơn kháng sinh chính thức, trang được NICE duy trì và cập nhật.', 'https://www.nice.org.uk/guidance/ng141']
    ],
    abscess: [
      ['IDSA – Skin and Soft Tissue Infections', 'Trang hướng dẫn chính thức hiện hành về nhiễm khuẩn da và mô mềm.', 'https://www.idsociety.org/practice-guideline/skin-and-soft-tissue-infections/']
    ],
    dfi: [
      ['IWGDF/IDSA 2023', 'Hướng dẫn chẩn đoán và điều trị nhiễm khuẩn bàn chân liên quan đái tháo đường.', 'https://www.idsociety.org/practice-guideline/diabetic-foot-infections/']
    ],
    cholangitis: [
      ['Tokyo Guidelines – Acute Cholangitis and Cholecystitis', 'Nguồn đồng thuận quốc tế đang được sử dụng rộng rãi cho viêm đường mật và viêm túi mật cấp.', 'https://pubmed.ncbi.nlm.nih.gov/29032610/']
    ],
    iai: [
      ['IDSA Guideline Update 2024', 'Cập nhật đánh giá nguy cơ, chẩn đoán hình ảnh và vi sinh trong nhiễm khuẩn ổ bụng phức tạp.', 'https://www.idsociety.org/practice-guideline/intra-abdominal-infections/']
    ],
    meningitis: [
      ['WHO Guidelines 2025', 'Hướng dẫn WHO về chẩn đoán, điều trị và chăm sóc viêm màng não.', 'https://www.who.int/publications/i/item/9789240108042'],
      ['WHO Practical Manual 2026', 'Sổ tay thực hành triển khai hướng dẫn viêm màng não – công bố tháng 5/2026.', 'https://www.who.int/publications/i/item/9789240121027']
    ],
    osteomyelitis: [
      ['IDSA – Vertebral Osteomyelitis', 'Trang hướng dẫn chính thức đang được IDSA duy trì cho viêm xương tủy đốt sống ở người lớn.', 'https://www.idsociety.org/practice-guideline/vertebral-osteomyelitis/']
    ],
    septicarthritis: [
      ['SANJO Guideline 2023 – EBJIS', 'Hướng dẫn của European Bone and Joint Infection Society về viêm khớp nhiễm khuẩn khớp tự nhiên.', 'https://jbji.copernicus.org/articles/8/29/2023/']
    ],
    pelvic: [
      ['CDC STI Treatment Guidelines – PID', 'Trang hướng dẫn điều trị viêm vùng chậu được CDC duy trì và cập nhật trực tuyến.', 'https://www.cdc.gov/std/treatment-guidelines/pid.htm']
    ],
    surgical: [
      ['SHEA/IDSA/APIC Practice Recommendation (2022 update)', 'Chiến lược phòng ngừa nhiễm khuẩn vết mổ tại bệnh viện – bản cập nhật công bố 2023.', 'https://www.cambridge.org/core/journals/infection-control-and-hospital-epidemiology/article/strategies-to-prevent-surgical-site-infections-in-acutecare-hospitals-2022-update/2A5B10B6B8A67B3B9A38B2B86A1D0D78']
    ]
  };

  const diseases = window.VPMED_DISEASES || [];
  diseases.forEach(function (item) {
    if (SOURCE_MAP[item.id]) item.sources = SOURCE_MAP[item.id];
  });

  // Làm mới phần bệnh lý nếu mã chính đã tải xong.
  if (typeof window.renderDiseaseProfile === 'function') {
    window.renderDiseaseProfile();
  }

  // Bảo đảm hai khung vẫn bị loại bỏ sau mỗi lần chọn bệnh lý.
  const profile = document.getElementById('diseaseProfile');
  if (profile) {
    const observer = new MutationObserver(function () {
      const sections = profile.querySelectorAll('.disease-grid > section');
      if (sections[0]) sections[0].style.display = 'none';
      if (sections[1]) sections[1].style.display = 'none';
    });
    observer.observe(profile, { childList: true, subtree: true });
  }
})();
