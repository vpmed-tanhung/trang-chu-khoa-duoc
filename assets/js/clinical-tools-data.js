(function (window) {
  'use strict';

  window.KHOA_DUOC_CLINICAL_DATA = {
    featuredTools: [
      {
        id: 'kiem-tra-tuong-tac-thuoc',
        title: 'Kiểm tra tương tác thuốc',
        desc: 'Kiểm tra giữa hai thuốc hoặc quét toàn bộ danh mục thuốc.',
        status: 'SẴN SÀNG',
        badgeText: 'SẴN SÀNG',
        actionText: 'Tra cứu công cụ',
        link: 'cong-cu-tuong-tac-thuoc.html',
        icon: 'scanner'
      },
      {
        id: 'tinh-lieu-khang-sinh-crcl',
        title: 'Tính liều kháng sinh & CrCl/eGFR',
        desc: 'Ước tính chức năng thận, cảnh báo chỉnh liều và lưu lịch sử.',
        status: 'SẴN SÀNG',
        badgeText: 'SẴN SÀNG',
        actionText: 'Mở công cụ',
        link: 'cong-cu-lieu-khang-sinh.html',
        icon: 'document'
      },
      {
        id: 'tinh-lieu-khang-sinh-nhi',
        title: 'Tính liều kháng sinh Nhi',
        desc: 'Tính theo tuổi, PMA, cân nặng; phân biệt mg/kg/ngày và mg/kg/lần.',
        status: 'SẴN SÀNG',
        badgeText: 'SẴN SÀNG',
        actionText: 'Mở công cụ',
        link: 'cong-cu-lieu-nhi.html',
        icon: 'user'
      },
      {
        id: 'tinh-lieu-pet-ct',
        title: 'Tính liều PET/CT',
        desc: 'Tính hoạt độ, bù phân rã và thể tích rút theo mốc thời gian.',
        status: 'SẴN SÀNG',
        badgeText: 'SẴN SÀNG',
        actionText: 'Mở công cụ',
        link: 'cong-cu-pet-ct.html',
        icon: 'target'
      }
    ],
    source: {
      name: 'Hệ thống Hỗ trợ Dược lâm sàng | VPMED Tân Hưng',
      url: 'https://hotrolamsang.io.vn/',
      checkedAt: '2026-09-07',
      interactionPairCount: 633,
      priority: [
        'Tờ hướng dẫn sử dụng đúng chế phẩm',
        'Hướng dẫn chuyên môn Bộ Y tế',
        'Dược thư Quốc gia Việt Nam',
        'Quy trình được Hội đồng Thuốc và Điều trị phê duyệt'
      ]
    },
    interactions: [
      { a: ['warfarin'], b: ['trimethoprim', 'sulfamethoxazole', 'cotrimoxazole'], severity: 'cao', title: 'Tăng nguy cơ chảy máu', advice: 'Theo dõi INR sát và đánh giá nhu cầu phối hợp; cân nhắc lựa chọn thay thế theo chỉ định.' },
      { a: ['warfarin'], b: ['metronidazole'], severity: 'cao', title: 'Tăng tác dụng chống đông', advice: 'Theo dõi INR và dấu hiệu chảy máu; cần đánh giá điều chỉnh chống đông bởi bác sĩ.' },
      { a: ['simvastatin'], b: ['clarithromycin', 'erythromycin'], severity: 'cao', title: 'Tăng nguy cơ độc tính cơ', advice: 'Tránh phối hợp nếu có thể; xem xét statin khác hoặc kháng sinh thay thế theo phác đồ.' },
      { a: ['linezolid'], b: ['sertraline', 'fluoxetine', 'paroxetine', 'escitalopram', 'citalopram'], severity: 'cao', title: 'Nguy cơ hội chứng serotonin', advice: 'Đánh giá lợi ích/nguy cơ, theo dõi triệu chứng thần kinh và tự chủ; cần ý kiến bác sĩ.' },
      { a: ['methotrexate'], b: ['trimethoprim', 'sulfamethoxazole', 'cotrimoxazole'], severity: 'cao', title: 'Tăng độc tính methotrexate', advice: 'Tránh phối hợp nếu không có chỉ định chuyên khoa và kế hoạch theo dõi độc tính.' },
      { a: ['digoxin'], b: ['amiodarone', 'clarithromycin'], severity: 'cao', title: 'Tăng nồng độ digoxin', advice: 'Theo dõi nồng độ/độc tính digoxin và nhịp tim; có thể cần điều chỉnh liều.' },
      { a: ['ace inhibitor', 'lisinopril', 'enalapril', 'perindopril', 'ramipril'], b: ['spironolactone', 'potassium', 'kali clorid'], severity: 'trung bình', title: 'Tăng nguy cơ tăng kali máu', advice: 'Theo dõi kali và chức năng thận, đặc biệt ở người bệnh suy thận.' },
      { a: ['nsaid', 'ibuprofen', 'diclofenac', 'ketorolac', 'naproxen'], b: ['lisinopril', 'enalapril', 'perindopril', 'ramipril'], severity: 'trung bình', title: 'Có thể làm giảm chức năng thận', advice: 'Đánh giá nguy cơ mất nước, huyết áp và chức năng thận; tránh phối hợp không cần thiết.' },
      { a: ['ceftriaxone'], b: ['calcium', 'calcium gluconate'], severity: 'cao', title: 'Nguy cơ tạo kết tủa ceftriaxone–calci ở trẻ sơ sinh', advice: 'Đặc biệt không phối hợp ở trẻ sơ sinh ≤28 ngày khi có dung dịch calci tĩnh mạch; kiểm tra hướng dẫn sản phẩm.' }
    ],
    renalAdjustment: [
      { name: 'Amoxicillin/clavulanate', aliases: ['amoxicillin', 'augmentin', 'amoxicillin clavulanate'], guidance: { normal: 'Dùng theo phác đồ; kiểm tra hàm lượng và chỉ định.', mild: 'Xem xét giảm liều hoặc kéo dài khoảng cách theo chế độ liều; không dùng hàm lượng 875 mg khi CrCl <30 mL/phút.', moderate: 'Cần chọn chế độ liều theo CrCl và hàm lượng chế phẩm; không tự suy ra từ eGFR.', severe: 'Cần phác đồ suy thận cụ thể; đánh giá tích lũy và chỉ định.' } },
      { name: 'Cefepime', aliases: ['cefepime'], guidance: { normal: 'Dùng theo phác đồ.', mild: 'Cần điều chỉnh liều/khoảng cách khi CrCl ≤60 mL/phút.', moderate: 'Điều chỉnh liều theo CrCl; theo dõi độc tính thần kinh.', severe: 'Điều chỉnh bắt buộc theo CrCl và lịch lọc máu nếu có.' } },
      { name: 'Ceftazidime', aliases: ['ceftazidime'], guidance: { normal: 'Dùng theo phác đồ.', mild: 'Cần điều chỉnh theo CrCl khi chức năng thận giảm.', moderate: 'Giảm liều hoặc kéo dài khoảng cách theo phác đồ suy thận.', severe: 'Điều chỉnh bắt buộc; chú ý lịch lọc máu.' } },
      { name: 'Ciprofloxacin', aliases: ['ciprofloxacin', 'cipro'], guidance: { normal: 'Dùng theo phác đồ và loại nhiễm khuẩn.', mild: 'Xem xét điều chỉnh theo CrCl và đường dùng.', moderate: 'Điều chỉnh liều/khoảng cách theo chế phẩm.', severe: 'Cần phác đồ suy thận và đánh giá tương tác/QT.' } },
      { name: 'Levofloxacin', aliases: ['levofloxacin'], guidance: { normal: 'Dùng theo phác đồ.', mild: 'Cần điều chỉnh khi CrCl <50 mL/phút.', moderate: 'Giảm liều hoặc kéo dài khoảng cách theo chế độ liều.', severe: 'Điều chỉnh bắt buộc và đánh giá nguy cơ tích lũy.' } },
      { name: 'Meropenem', aliases: ['meropenem', 'meronem'], guidance: { normal: 'Dùng theo phác đồ.', mild: 'Cần điều chỉnh khi CrCl ≤50 mL/phút.', moderate: 'Giảm liều hoặc kéo dài khoảng cách theo chế độ liều.', severe: 'Điều chỉnh bắt buộc; kiểm tra lịch lọc máu.' } },
      { name: 'Piperacillin/tazobactam', aliases: ['piperacillin', 'tazobactam', 'pip/tazo', 'tazocin'], guidance: { normal: 'Dùng theo phác đồ.', mild: 'Cần đánh giá điều chỉnh khi CrCl ≤40 mL/phút.', moderate: 'Điều chỉnh liều/khoảng cách theo CrCl và cách truyền.', severe: 'Điều chỉnh bắt buộc; kiểm tra chế độ lọc máu.' } },
      { name: 'Vancomycin', aliases: ['vancomycin'], guidance: { normal: 'Cần cá thể hóa theo cân nặng, chức năng thận và TDM.', mild: 'Theo dõi nồng độ/AUC hoặc nồng độ đáy theo quy trình bệnh viện.', moderate: 'Điều chỉnh liều và khoảng cách; ưu tiên TDM.', severe: 'Không suy ra liều chỉ từ công thức; cần phác đồ chuyên khoa và TDM.' } }
    ],
    pediatric: [
      { id: 'amoxicillin', name: 'Amoxicillin', basis: 'mg/kg/ngày', min: 40, max: 90, frequency: 2, maxDaily: 4000, pkpd: 'beta-lactam', note: 'Khoảng liều thay đổi theo chỉ định và mức độ nhiễm khuẩn; cần chọn đúng phác đồ.' },
      { id: 'ceftriaxone', name: 'Ceftriaxone', basis: 'mg/kg/ngày', min: 50, max: 75, frequency: 1, maxDaily: 2000, lockNeonate: true, pkpd: 'beta-lactam', note: 'Không dùng kết quả tự động này để vượt qua chống chỉ định ở trẻ sơ sinh hoặc trẻ tăng bilirubin.' },
      { id: 'meropenem', name: 'Meropenem', basis: 'mg/kg/lần', min: 10, max: 40, frequency: 3, maxDose: 2000, requiresThreeMonths: true, pkpd: 'beta-lactam', note: 'Chọn mức 10/20/40 mg/kg/lần theo loại nhiễm khuẩn; dữ liệu nhãn có giới hạn ở trẻ <3 tháng.' }
    ],
    pediatricPkpd: {
      'beta-lactam': [
        { id: 'ft-mic-50', label: '≥50% fT > MIC', multiple: 1, note: 'Mục tiêu PK/PD cơ bản; cần đối chiếu thuốc, vị trí nhiễm khuẩn và phác đồ.' },
        { id: 'ft-mic-100', label: '100% fT > MIC', multiple: 1, note: 'Mục tiêu tăng cường; không tự suy ra liều nếu chưa có mô hình PK/TDM.' },
        { id: 'ft-4mic-100', label: '100% fT > 4×MIC', multiple: 4, note: 'Mục tiêu nghiêm ngặt; chỉ áp dụng khi phác đồ/hội đồng chuyên môn quy định.' }
      ]
    },
    radionuclides: [
      { id: 'F-18', name: 'F-18 FDG', halfLife: 109.8, defaultDoseFactor: 4, defaultDoseUnit: 'MBq/kg' },
      { id: 'Ga-68', name: 'Ga-68 DOTATATE', halfLife: 68.3, defaultDoseFactor: 2, defaultDoseUnit: 'MBq/kg' },
      { id: 'C-11', name: 'C-11 Choline', halfLife: 20.4, defaultDoseFactor: 4, defaultDoseUnit: 'MBq/kg' },
      { id: 'N-13', name: 'N-13 Ammonia', halfLife: 10, defaultDoseFactor: 10, defaultDoseUnit: 'MBq/kg' },
      { id: 'O-15', name: 'O-15', halfLife: 2.04 }
    ]
  };
}(window));
