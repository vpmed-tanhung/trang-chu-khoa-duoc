/**
 * Phân tích y lệnh dùng thuốc nội trú — Apps Script proxy
 * ----------------------------------------------------------------
 * MỤC ĐÍCH
 * Nhận ảnh y lệnh (base64) từ trình duyệt, gọi Gemini kèm
 * system prompt cố định, trả kết quả JSON đã phân tích về cho client.
 * API key KHÔNG BAO GIỜ nằm trong code client — chỉ lưu trong
 * Script Properties của dự án Apps Script này.
 *
 * CÁCH TRIỂN KHAI
 * 1. Mở dự án Apps Script hiện có (cùng dự án đang chạy
 *    clinical-update-secure-client.js / vpmed-history-sync.js), tạo thêm
 *    file .gs mới, dán toàn bộ nội dung này vào.
 * 2. Project Settings → Script Properties → thêm khóa:
 *      GEMINI_API_KEY = <API key Gemini của bạn>
 *    Proxy tự chuyển qua các model multimodal ổn định khi model chính hết
 *    quota hoặc tạm quá tải.
 * 3. Router doPost ở cuối file phục vụ chung review_bhyt, review_inpatient
 *    và calculate_pediatric_antibiotic trên cùng một Web App URL.
 * 4. Deploy → New deployment → Web app → Execute as: Me → Who has access:
 *    Anyone with the link. Copy URL /exec vào WEB_APP_URL trong
 *    assets/js/server-config.js; các client dùng chung cấu hình này.
 *
 * QUYỀN RIÊNG TƯ
 * - Ảnh y lệnh được gửi ra ngoài tới nhà cung cấp AI để phân tích — đây là
 *   ngoại lệ có chủ đích so với các module khác của hệ thống (vốn xử lý
 *   OCR hoàn toàn cục bộ). Giao diện client PHẢI hiển thị cảnh báo và yêu
 *   cầu người dùng xác nhận trước khi gửi (xem inpatient-order-review.js).
 * - Không ghi log nội dung ảnh hoặc kết quả phân tích vào Google Sheet hay
 *   nơi lưu trữ lâu dài; chỉ xử lý trong bộ nhớ của request rồi trả về.
 */

var GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite'
];

var PEDIATRIC_DOSING_PROMPT = [
  'VAI TRÒ: Dược sĩ lâm sàng Nhi khoa chuyên sâu PK/PD và quản lý kháng sinh.',
  'Mã chương trình đã tính liều, tần suất, thể tích và trần liều bằng quy tắc xác định. KHÔNG thay đổi các con số trong safetyEnvelope, không tự bịa mức đạt đích PK/PD.',
  'Đánh giá theo MIC: beta-lactam/carbapenem dùng %fT>MIC; aminoglycoside dùng Cmax/MIC; vancomycin dùng AUC24/MIC. Chỉ kết luận đạt/không đạt khi input có chỉ số đo tương ứng. Nếu thiếu TDM/PK, estimated_achievement phải nói rõ chưa thể xác định.',
  'Cảnh báo tuổi: ceftriaxone ở sơ sinh có tăng bilirubin hoặc đang dùng dịch IV chứa calci là CRITICAL_ERROR; co-trimoxazole dưới 2 tháng là CRITICAL_ERROR; tetracycline dưới 8 tuổi là WARNING (không coi doxycycline ngắn ngày là chống chỉ định tuyệt đối); fluoroquinolone là WARNING và phải cân nhắc lợi ích-nguy cơ.',
  'Hướng dẫn hoàn nguyên/pha truyền chỉ được nêu khi chắc chắn cho đúng hoạt chất, hàm lượng và dạng bào chế; nếu không đủ dữ liệu phải yêu cầu đối chiếu HDSD đúng chế phẩm.',
  'Chỉ trả một JSON object, không markdown, đúng schema được cung cấp.'
].join('\n');

var PEDIATRIC_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  required: ['status', 'patient_summary', 'dosing_analysis', 'pk_pd_evaluation', 'clinical_alerts', 'pharmacist_counseling'],
  properties: {
    status: { type: 'STRING', enum: ['VALID', 'WARNING', 'CRITICAL_ERROR'] },
    patient_summary: {
      type: 'OBJECT', required: ['age_display', 'weight_kg', 'indication'],
      properties: { age_display: { type: 'STRING' }, weight_kg: { type: 'NUMBER' }, indication: { type: 'STRING' } }
    },
    dosing_analysis: {
      type: 'OBJECT',
      required: ['drug_name', 'recommended_range_mg_kg_day', 'calculated_total_daily_dose_mg', 'is_capped_at_adult_limit', 'max_daily_limit_mg', 'frequency', 'single_dose_mg', 'recommended_volume_ml', 'administration_route'],
      properties: {
        drug_name: { type: 'STRING' }, recommended_range_mg_kg_day: { type: 'STRING' },
        calculated_total_daily_dose_mg: { type: 'NUMBER' }, is_capped_at_adult_limit: { type: 'BOOLEAN' },
        max_daily_limit_mg: { type: 'NUMBER' }, frequency: { type: 'STRING' }, single_dose_mg: { type: 'NUMBER' },
        recommended_volume_ml: { type: 'NUMBER', nullable: true }, administration_route: { type: 'STRING' }
      }
    },
    pk_pd_evaluation: {
      type: 'OBJECT', required: ['target_pk_pd_index', 'target_goal', 'estimated_achievement', 'mic_interpretation', 'optimization_recommendations'],
      properties: {
        target_pk_pd_index: { type: 'STRING' }, target_goal: { type: 'STRING' }, estimated_achievement: { type: 'STRING' },
        mic_interpretation: { type: 'STRING' }, optimization_recommendations: { type: 'STRING' }
      }
    },
    clinical_alerts: {
      type: 'ARRAY', items: { type: 'OBJECT', required: ['type', 'severity', 'detail', 'mechanism'], properties: {
        type: { type: 'STRING' }, severity: { type: 'STRING' }, detail: { type: 'STRING' }, mechanism: { type: 'STRING' }
      } }
    },
    pharmacist_counseling: {
      type: 'OBJECT', required: ['reconstitution_instructions', 'storage', 'monitoring_parameters'],
      properties: { reconstitution_instructions: { type: 'STRING' }, storage: { type: 'STRING' }, monitoring_parameters: { type: 'STRING' } }
    }
  }
};

/* Trần là tổng liều/ngày của hoạt chất hoặc toàn phối hợp như ghi ở name.
 * indicationMode chọn trần cao hơn chỉ khi bệnh cảnh đầu vào nêu rõ viêm màng não/CNS. */
var PEDIATRIC_ANTIBIOTIC_RULES = [
  { keys: ['amoxicillin', 'amoxicillin clavulanate', 'amoxicillin/clavulanate'], name: 'Amoxicillin/clavulanate (tính theo amoxicillin)', group: 'betalactam', range: [40, 90], doses: 2, cap: 4000, route: 'PO' },
  { keys: ['ampicillin', 'ampicilin'], name: 'Ampicillin', group: 'betalactam', range: [100, 200], doses: 4, cap: 12000, route: 'IV' },
  { keys: ['ampicillin sulbactam', 'ampicilin sulbactam'], name: 'Ampicillin/sulbactam (tổng phối hợp)', group: 'betalactam', range: [150, 300], doses: 4, cap: 12000, route: 'IV' },
  { keys: ['ceftriaxone'], name: 'Ceftriaxone', group: 'betalactam', range: [50, 100], doses: 1, cap: 2000, cnsCap: 4000, route: 'IV/IM' },
  { keys: ['cefotaxime', 'cefotaxim'], name: 'Cefotaxime', group: 'betalactam', range: [100, 200], doses: 4, cap: 12000, route: 'IV' },
  { keys: ['ceftazidime'], name: 'Ceftazidime', group: 'betalactam', range: [100, 150], doses: 3, cap: 6000, route: 'IV' },
  { keys: ['cefepime'], name: 'Cefepime', group: 'betalactam', range: [100, 150], doses: 3, cap: 6000, route: 'IV' },
  { keys: ['cefixime'], name: 'Cefixime', group: 'betalactam', range: [8, 8], doses: 1, cap: 400, route: 'PO' },
  { keys: ['cefpodoxime'], name: 'Cefpodoxime', group: 'betalactam', range: [10, 10], doses: 2, cap: 400, route: 'PO' },
  { keys: ['piperacillin tazobactam', 'piperacilin tazobactam'], name: 'Piperacillin/tazobactam (tổng phối hợp)', group: 'betalactam', range: [240, 400], doses: 4, cap: 18000, route: 'IV' },
  { keys: ['meropenem'], name: 'Meropenem', group: 'carbapenem', range: [60, 120], doses: 3, cap: 6000, route: 'IV' },
  { keys: ['imipenem cilastatin'], name: 'Imipenem/cilastatin (tổng phối hợp)', group: 'carbapenem', range: [60, 100], doses: 4, cap: 4000, route: 'IV' },
  { keys: ['gentamicin', 'gentamycin'], name: 'Gentamicin', group: 'aminoglycoside', range: [5, 7.5], doses: 1, cap: 560, route: 'IV/IM' },
  { keys: ['amikacin'], name: 'Amikacin', group: 'aminoglycoside', range: [15, 20], doses: 1, cap: 1500, route: 'IV/IM' },
  { keys: ['vancomycin'], name: 'Vancomycin', group: 'vancomycin', range: [40, 60], doses: 4, cap: 4000, route: 'IV' },
  { keys: ['trimethoprim sulfamethoxazole', 'co trimoxazole', 'cotrimoxazole', 'tmp smx'], name: 'Co-trimoxazole (tính theo trimethoprim)', group: 'other', range: [8, 12], doses: 2, cap: 640, route: 'PO/IV' },
  { keys: ['doxycycline'], name: 'Doxycycline', group: 'tetracycline', range: [2.2, 4.4], doses: 2, cap: 200, route: 'PO/IV' },
  { keys: ['tetracycline'], name: 'Tetracycline', group: 'tetracycline', range: [25, 50], doses: 4, cap: 2000, route: 'PO' },
  { keys: ['ciprofloxacin'], name: 'Ciprofloxacin', group: 'fluoroquinolone', range: [20, 30], doses: 2, cap: 1500, route: 'PO/IV' },
  { keys: ['levofloxacin'], name: 'Levofloxacin', group: 'fluoroquinolone', range: [10, 20], doses: 2, cap: 750, route: 'PO/IV' }
];

var BHYT_TEXT_PROMPT = [
  'VAI TRÒ: Dược sĩ lâm sàng kiểm tra đơn thuốc ngoại trú BHYT tại Việt Nam.',
  'INPUT chỉ là văn bản OCR đã được lọc thông tin định danh; có thể sai, thiếu hoặc lặp do OCR nhiều lượt.',
  'NHIỆM VỤ BẮT BUỘC: (1) tách từng đơn/nhóm thuốc thành BHYT, Dịch vụ hoặc Chưa xác định dựa trên tiêu đề và dấu hiệu chi trả thực sự; không mặc định thuốc không rõ là BHYT; (2) rà soát mọi cặp BHYT-BHYT và BHYT-Dịch vụ; không bỏ qua tương tác chéo; (3) với từng thuốc BHYT, kiểm tra mã ICD-10/chẩn đoán tương ứng.',
  'Nếu có ít nhất một thuốc BHYT nhưng OCR không có mã ICD-10/chẩn đoán tương ứng, bắt buộc tạo issue severity="cao", category="ICD-BHYT", finding bắt đầu bằng "NGUY CƠ XUẤT TOÁN: thuốc BHYT không có mã ICD-10 tương ứng". Nếu có mã nhưng không đủ dữ liệu chứng minh phù hợp, ghi rõ cần đối chiếu, không tự coi là hợp lệ.',
  'Không bịa dữ liệu bị thiếu, không tự chuyển thuốc Chưa xác định sang BHYT/Dịch vụ. Mọi nhận định phải yêu cầu đối chiếu đơn gốc, HDSD/SPC, phác đồ Bộ Y tế và quy định BHYT hiện hành. Đây là cảnh báo nguy cơ, không phải kết luận pháp lý cuối cùng.',
  'Chỉ trả một JSON object hợp lệ, không markdown, đúng cấu trúc:',
  '{"summary":"string","classification":{"bhytDrugs":["string"],"serviceDrugs":["string"],"unclassifiedDrugs":["string"]},"interactions":[{"drugs":["string","string"],"scope":"BHYT-BHYT|BHYT-Dịch vụ","severity":"chống chỉ định|nghiêm trọng|trung bình","mechanism":"string","recommendation":"string"}],"icdChecks":[{"drug":"string","icd10":["string"],"status":"phù hợp|không tương ứng|thiếu mã|chưa đủ dữ liệu","risk":"string","recommendation":"string"}],"issues":[{"category":"OCR|phân loại|thuốc|liều-cách dùng|tương tác|ICD-BHYT","severity":"cao|vừa|thấp","finding":"string","recommendation":"string"}],"confidence":"cao|trung bình|thấp","disclaimer":"string"}'
].join('\n');

var SYSTEM_PROMPT = [
  'VAI TRÒ: Bạn là Dược sĩ lâm sàng cấp cao (Senior Clinical Pharmacist), chuyên sâu Dược lâm sàng nội trú tại bệnh viện Việt Nam, dày kinh nghiệm đọc và rà soát y lệnh dùng thuốc trong bệnh án.',
  '',
  'NHIỆM VỤ: Đọc trực tiếp ảnh y lệnh và phân tích y lệnh dùng thuốc (không phải dịch pha truyền hay dịch pha thuốc) của một bệnh nhân nội trú trong CÙNG MỘT LƯỢT GỌI AI và CÙNG MỘT PHẢN HỒI JSON. Chỉ tập trung đúng 5 việc, không mở rộng phạm vi:',
  'MỤC TIÊU: bảo đảm Đúng chỉ định - Đủ hiệu quả - An toàn tối đa - Tối ưu chi phí. Kiến thức tham chiếu: AHFS, Micromedex, Lexicomp, Dược thư Quốc gia Việt Nam, hướng dẫn Bộ Y tế, KDIGO, IDSA, GOLD/GINA và hướng dẫn chuyên ngành phù hợp; không tuyên bố đã tra cứu trực tiếp nguồn nếu dữ liệu đầu vào không cung cấp nguồn.',
  'QUY TRÌNH BẮT BUỘC TRONG MỘT LƯỢT: Với từng dòng y lệnh, trước hết chép nguyên văn phần nhìn thấy vào identity.rawName và orderedDose; sau đó mới phân tích lâm sàng dựa đúng trên tên/hoạt chất vừa nhận diện. Không tách thành lượt nhận diện riêng và không dùng một thuốc khác để thay thế phần chữ trong ảnh.',
  'QUY TẮC NHẬN DIỆN: Từ tên đọc được trong ảnh, phải nhận diện cả tên biệt dược/tên thương mại do nhà sản xuất đặt và hoạt chất tương ứng. Không sửa tên nhìn thấy theo trí nhớ, không tự hoàn thiện chữ bị khuất/mờ và không chọn một tên gần giống khi ảnh không đủ rõ. identity.rawName chép nguyên văn toàn bộ cụm tên thuốc nhìn thấy; identity.brand chỉ ghi đúng tên thương mại thực sự xuất hiện trong cụm đó; identity.activeIngredient ghi hoạt chất thực sự được dùng cho toàn bộ đánh giá lâm sàng. Nếu dòng ghi hoạt chất rồi đặt biệt dược trong ngoặc, phải giữ cả cụm trong rawName và lấy đúng biệt dược trong ngoặc làm brand. Không được gắn thêm tên nhà sản xuất, hậu tố hoặc một biệt dược khác chỉ vì cùng hoạt chất. Không tự tạo catalogId: luôn để catalogId="".',
  'DANH MỤC NỘI BỘ CHỈ THAM KHẢO: AI phải tự đọc, tự nhận diện và phân tích thuốc dựa trên ảnh cùng kiến thức dược lâm sàng. Một thuốc không có trong danh mục nội bộ không có nghĩa là ngoài phạm vi phân tích và không được dùng làm lý do từ chối phân tích. Sau phản hồi AI, mã chương trình chỉ dùng danh mục để bổ sung cảnh báo đối chiếu; không được xóa hoặc khóa kết quả AI.',
  'ĐIỀU KIỆN PHÂN TÍCH: Khi tên thương mại/biệt dược được đọc rõ và hoạt chất được nhận diện đủ tin cậy, phải tiếp tục phân tích liều, cách dùng, tốc độ truyền, hiệu chỉnh thận và tương tác dù thuốc chưa có trong danh mục nội bộ. Chỉ khi chính chữ trong ảnh thật sự mờ, tên có nhiều cách hiểu hoặc không xác định được hoạt chất thì mới để trống phần không chắc và ghi cụ thể vào unclear thay vì đoán.',
  '1. Tính toán liều dùng — đối chiếu liều bác sĩ kê với liều khuyến cáo (theo cân nặng/tuổi/chức năng thận nếu có dữ liệu); tách rõ liều nạp và liều duy trì; nêu rõ khi liều bất thường và mức chênh lệch ước tính.',
  '2. Cách dùng — đường dùng, thời điểm dùng, số lần/ngày, điều kiện đói/no, tương thích dạng bào chế.',
  '3. Truyền thuốc — tính tốc độ truyền (mL/giờ hoặc giọt/phút) cho thuốc IV dựa trên liều, thời gian và thể tích đã ghi rõ; đánh giá dung môi NaCl 0,9%, Glucose 5% hoặc dung môi được ghi trong y lệnh và tương kỵ Y-site. Không tự bịa thể tích hoặc lập quy trình pha chế khi dữ liệu không có.',
  '4. Tương tác thuốc trong y lệnh — rà soát mọi cặp thuốc CÙNG có trong y lệnh đang phân tích; phân loại mức độ (chống chỉ định / nghiêm trọng cần theo dõi / cần lưu ý) kèm cơ chế và xử trí đề xuất.',
  '5. Cảnh báo bệnh nhân suy thận — ưu tiên rà soát NGAY mọi thuốc thải trừ qua thận hoặc độc thận. Với từng thuốc, nêu rõ cơ sở chọn mức liều (CrCl Cockcroft-Gault hay eGFR, giá trị và thời điểm SCr), liều nạp, liều duy trì/khoảng cách, theo dõi và thời điểm đánh giá lại. Chỉ đưa chế độ liều số khi đủ dữ liệu và nguồn áp dụng đúng chỉ định/đường dùng. Nếu AKI/SCr biến động, không áp một dải CrCl tĩnh: dùng xu hướng SCr, nước tiểu, TDM và yêu cầu đánh giá lại liên tiếp. Nếu IHD/CRRT, dùng khuyến cáo riêng theo phương thức/cường độ lọc và thời điểm dùng thuốc; không suy diễn từ CrCl.',
  'PHÂN TÍCH BẮT BUỘC BỔ SUNG: đánh giá chỉ định/chống chỉ định theo chẩn đoán, bệnh mắc kèm, dị ứng và tiền sử; phát hiện kê thiếu/thừa chỉ định; đánh giá tuổi, cân nặng, chức năng gan/Child-Pugh khi có; tối ưu PO/IV, dung môi và tương thích pha truyền, tốc độ truyền, trước/sau ăn, sáng/tối và cách xa ion đa hóa trị; rà soát tương kỵ Y-site; ADR hiện tại và trùng lặp điều trị; đề xuất Ngưng/Giảm-Tăng liều/Thay thế/Xuống thang IV-PO cùng kế hoạch theo dõi và tần suất.',
  'ƯU TIÊN: đưa highPriorityIssues lên đầu dữ liệu trả về. Tương tác phân cấp đúng thứ tự Chống chỉ định > Nghiêm trọng > Trung bình. Không hạ mức cảnh báo khi thiếu dữ liệu; ghi rõ cần xác minh.',
  'MẪU TIẾP NHẬN 5 PHẦN: patientRecord phải có generalInformation, diagnoses, laboratoryResults, medicationOrders, clinicalCourse; phần nào không đọc được phải để chuỗi/mảng rỗng và ghi vào unclear, tuyệt đối không bịa.',
  '',
  'BỐI CẢNH: Bệnh nhân đang điều trị nội trú tại khoa; y lệnh do bác sĩ kê trong bệnh án. Input là một hoặc nhiều ảnh y lệnh/trang bệnh án của cùng một bệnh nhân, cùng một đợt y lệnh, số lượng không giới hạn. Người dùng là dược sĩ lâm sàng trực khoa, dùng kết quả để rà soát nhanh — không phải kết luận thay thế quyết định lâm sàng.',
  'Nguồn tham chiếu bắt buộc, theo thứ tự ưu tiên khi xung đột: (1) HDSD/SPC đã phê duyệt của đúng hoạt chất, hàm lượng, dạng bào chế và đường dùng; (2) quy trình/phác đồ chỉnh liều đã được bệnh viện phê duyệt; (3) Dược thư Quốc gia Việt Nam hiện hành và hướng dẫn Bộ Y tế; (4) hướng dẫn chuyên ngành hiện hành (KDIGO dùng cho nguyên tắc đánh giá chức năng thận; UpToDate/Sanford/Renal Drug Handbook dùng khi có nội dung phù hợp). Nếu các nguồn xung đột, phải nêu rõ sự khác biệt.',
  '',
  'RÀNG BUỘC:',
  '- Không suy đoán thông tin không xuất hiện trong ảnh. Nếu chữ mờ/không đọc rõ, ghi "Không đọc rõ, cần xác minh thủ công" — tuyệt đối không tự bịa số liệu, không tự nối phần chữ thiếu và không dùng ngữ cảnh lâm sàng để đoán tên thuốc.',
  '- Tên thuốc, hàm lượng, liều, đường dùng và tần suất phải được đọc trực tiếp từ ảnh trong lượt phân tích này. identity.rawName phải giữ nguyên đúng phần chữ đọc được, kể cả khi chưa đầy đủ; catalogId luôn để trống để hệ thống đối chiếu sau. Không được bịa tên thuốc, sửa thành tên quen thuộc hơn hoặc đổi sang một biệt dược/generic khác.',
  '- identity.brand phải ghi tên biệt dược/tên thương mại nhận diện được; identity.activeIngredient phải là hoạt chất bạn đã dùng để đưa ra đánh giá lâm sàng. Không được bỏ qua thuốc chỉ vì tên thương mại chưa có trong danh mục nội bộ. Nếu chính việc nhận diện hoạt chất không chắc chắn thì để trống activeIngredient, đặt doseAssessment.status="không đủ dữ liệu để đánh giá", infusionRate.applicable=false, renalAdjustment.applicable=false và ghi rõ trong unclear.',
  '- Mọi kết luận về liều, truyền, thận và tương tác của một thuốc phải cùng dựa trên identity.rawName và identity.activeIngredient của chính thuốc đó. Không được phân tích theo một hoạt chất nhưng hiển thị tên thuốc khác.',
  '- Ghi chú có tiền tố "Dữ liệu thận do dược sĩ nhập" là dữ liệu có cấu trúc do người dùng cung cấp; dùng để kiểm chứng nhưng nếu xung đột với ảnh phải nêu xung đột, không tự chọn một giá trị im lặng.',
  '- Cockcroft-Gault/CKD-EPI chỉ phù hợp khi creatinine tương đối ổn định. Không đồng nhất giai đoạn CKD với ngưỡng chỉnh liều của từng thuốc. Ở thể trạng rất nhỏ/lớn, xem xét eGFR không chuẩn hóa BSA; với thuốc khoảng điều trị hẹp, ưu tiên cystatin C/mGFR hoặc TDM khi có.',
  '- Không chẩn đoán bệnh, không kê đơn thay bác sĩ, không tự quyết định ngừng/đổi thuốc.',
  '- Được đánh giá tương thích dung môi và Y-site; không tự bịa thể tích, nồng độ hoặc quy trình pha chế không có trong dữ liệu.',
  '- Mỗi cảnh báo phải ghi ngắn gọn nguồn đã dùng. Không ghi tên nguồn như thể đã xác minh nếu không chắc; khi đó ghi rõ cần đối chiếu HDSD/quy trình bệnh viện.',
  '- Luôn trả kèm dòng miễn trừ trách nhiệm.',
  '- Trả lời bằng tiếng Việt.',
  '',
  'ĐỊNH DẠNG ĐẦU RA: Trả về DUY NHẤT một object JSON hợp lệ, không kèm văn bản khác, không dùng markdown code fence, đúng khung sau (bỏ trống mảng/field không áp dụng, không tự thêm field mới):',
  '{"highPriorityIssues":[{"severity":"khẩn cấp|cao","issue":"string","recommendation":"string","monitoring":"string"}],"patientRecord":{"generalInformation":{"age":"string","sex":"string","weight":"string","height":"string","allergies":["string"],"history":["string"]},"diagnoses":["string"],"laboratoryResults":[{"test":"string","value":"string","time":"string","interpretation":"string"}],"medicationOrders":["string"],"clinicalCourse":["string"]},"patientContext":{"renalFunction":{"creatinine":"string hoặc null","crclOrEgfr":"string hoặc null","status":"ổn định|AKI/biến động|IHD|CRRT|chưa rõ","dataQuality":"đủ|thiếu|xung đột","note":"string"},"hepaticFunction":{"childPugh":"string hoặc null","status":"string","note":"string"},"otherRelevantConditions":["string"]},"indicationReview":[{"drug":"string","indication":"string","status":"phù hợp|thiếu chỉ định|thừa chỉ định|chống chỉ định|chưa đủ dữ liệu","detail":"string","source":"string"}],"drugs":[{"name":"string","identity":{"rawName":"tên chép nguyên văn từ ảnh","status":"exact|not_found|ambiguous|unreadable","catalogId":"string hoặc rỗng","brand":"string hoặc rỗng","activeIngredient":"string hoặc rỗng","strength":"string hoặc rỗng","route":"string hoặc rỗng","registrationNumber":"string hoặc rỗng"},"orderedDose":"string","route":"string","usageNote":"string","doseAssessment":{"status":"phù hợp|cao hơn khuyến cáo|thấp hơn khuyến cáo|không đủ dữ liệu để đánh giá","detail":"string","source":"string"},"administrationAssessment":{"routeOptimization":"string","diluentCompatibility":"string","timing":"string","ySite":"string"},"infusionRate":{"applicable":true,"rate":"string","basis":"string"},"renalAdjustment":{"applicable":true,"priority":"rà soát ngay|trong ca trực|theo dõi","warning":"string","method":"string","suggestedRegimen":"string hoặc để trống nếu chưa đủ dữ liệu","loadingDoseNote":"string","monitoring":"string","source":"string"},"hepaticAdjustment":{"applicable":true,"assessment":"string","recommendation":"string","source":"string"},"adrAndDuplication":{"findings":["string"],"recommendation":"string"}}],"interactions":[{"drugs":["string","string"],"severity":"chống chỉ định|nghiêm trọng|trung bình","mechanism":"string","recommendation":"string","ySiteCompatibility":"string","source":"string"}],"recommendations":[{"priority":"khẩn cấp|cao|trung bình|theo dõi","drug":"string","action":"Ngưng|Giảm liều|Tăng liều|Thay thế|IV sang PO|Theo dõi|Xác minh","detail":"string"}],"monitoringPlan":[{"parameter":"string","reason":"string","frequency":"string","targetOrTrigger":"string"}],"unclear":["string"],"disclaimer":"string"}',
  'Nếu ảnh không đọc được y lệnh nào hợp lệ, trả "drugs": [] và ghi rõ lý do trong "unclear".'
].join('\n');

function pediatricFold(value) {
  return String(value || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function pediatricNumber(value) {
  if (value === '' || value === null || typeof value === 'undefined') return null;
  var parsed = Number(value);
  return isFinite(parsed) ? parsed : null;
}

function pediatricRuleFor(drugName) {
  var name = pediatricFold(drugName);
  for (var i = 0; i < PEDIATRIC_ANTIBIOTIC_RULES.length; i++) {
    var rule = PEDIATRIC_ANTIBIOTIC_RULES[i];
    for (var j = 0; j < rule.keys.length; j++) {
      var key = pediatricFold(rule.keys[j]);
      if (name === key || name.indexOf(key) !== -1) return rule;
    }
  }
  return null;
}

function pediatricStatusRank(status) {
  return status === 'CRITICAL_ERROR' ? 2 : status === 'WARNING' ? 1 : 0;
}

function pediatricWorstStatus(left, right) {
  return pediatricStatusRank(left) >= pediatricStatusRank(right) ? left : right;
}

function pediatricAgeDisplay(ageMonths, isNeonate, ga, pna) {
  if (isNeonate) {
    return 'Sơ sinh' + (pna !== null ? ' ' + pna + ' ngày sau sinh' : '') + (ga !== null ? ' · GA ' + ga + ' tuần' : '');
  }
  if (ageMonths < 24) return ageMonths + ' tháng';
  return Math.round(ageMonths / 12 * 10) / 10 + ' tuổi';
}

function pediatricPkPd(rule, payload, mic) {
  var severity = pediatricFold(payload.infectionSeverity);
  var severe = /soc nhiem|shock|ha bach cau|neutrop|critical|nang/.test(severity);
  var result = { target_pk_pd_index: 'Không xác định', target_goal: 'Cần xác định theo nhóm thuốc', estimated_achievement: 'Chưa thể xác định nếu thiếu dữ liệu PK/TDM.', mic_interpretation: mic === null ? 'Chưa nhập MIC.' : 'MIC ' + mic + ' mg/L; phải đối chiếu breakpoint theo tác nhân, vị trí nhiễm và chuẩn CLSI/EUCAST đang áp dụng.', optimization_recommendations: 'Đối chiếu kháng sinh đồ, chức năng thận và đáp ứng lâm sàng.' };
  if (!rule) return result;
  if (rule.group === 'betalactam' || rule.group === 'carbapenem') {
    result.target_pk_pd_index = '%fT > MIC';
    result.target_goal = severe ? 'Ưu tiên 100% fT>MIC trong sốc nhiễm khuẩn/hạ bạch cầu theo quy trình đơn vị.' : (rule.group === 'carbapenem' ? 'Khoảng 40% fT>MIC; cân nhắc đích cao hơn ở ca nặng.' : 'Khoảng 40–70% fT>MIC tùy phân nhóm beta-lactam.');
    result.estimated_achievement = 'Không thể ước tính chỉ từ liều và MIC; cần phác đồ liều, thời gian truyền, thanh thải và/hoặc TDM beta-lactam.';
    result.optimization_recommendations = mic !== null && (mic >= 2 || severe) ? 'Cân nhắc truyền kéo dài 3–4 giờ hoặc truyền liên tục nếu ổn định thuốc và quy trình đơn vị cho phép; dùng liều nạp trước truyền liên tục.' : 'Duy trì khoảng cách liều phù hợp; cân nhắc truyền kéo dài khi xác suất đạt đích thấp.';
  } else if (rule.group === 'aminoglycoside') {
    var peak = pediatricNumber(payload.measuredPeakMgL);
    result.target_pk_pd_index = 'Cmax/MIC';
    result.target_goal = '8–10';
    result.estimated_achievement = peak !== null && mic !== null && mic > 0 ? ('Cmax/MIC đo được = ' + Math.round(peak / mic * 10) / 10 + ((peak / mic >= 8 && peak / mic <= 10) ? ' — trong đích.' : ' — ngoài đích 8–10.')) : 'Chưa thể xác định: cần Cmax đo được và MIC > 0.';
    result.optimization_recommendations = 'Ưu tiên chế độ liều giãn cách/1 lần mỗi ngày khi phù hợp tuổi và chức năng thận; TDM đỉnh/đáy, creatinin và độc tính thính giác.';
  } else if (rule.group === 'vancomycin') {
    var auc = pediatricNumber(payload.measuredAuc24);
    var ratio = auc !== null && mic !== null && mic > 0 ? auc / mic : null;
    result.target_pk_pd_index = 'AUC24/MIC';
    result.target_goal = '400–600 mg·h/L khi MIC = 1 mg/L (tương đương tỷ số AUC24/MIC 400–600).';
    result.estimated_achievement = ratio === null ? 'Chưa thể xác định: cần AUC24 (ưu tiên Bayesian/2 nồng độ) và MIC > 0.' : ('AUC24/MIC đo được = ' + Math.round(ratio) + (ratio >= 400 && ratio <= 600 ? ' — trong đích.' : ratio > 600 ? ' — vượt đích, tăng nguy cơ độc thận.' : ' — dưới đích.'));
    result.optimization_recommendations = 'Hiệu chỉnh theo AUC; theo dõi creatinin. Không dùng nồng độ đáy đơn thuần để thay thế AUC khi có điều kiện triển khai AUC-guided dosing.';
  }
  return result;
}

function pediatricDeterministicEnvelope(payload) {
  payload = payload || {};
  var weight = pediatricNumber(payload.weightKg);
  var ageMonths = pediatricNumber(payload.ageMonths);
  var pna = pediatricNumber(payload.postnatalAgeDays);
  var ga = pediatricNumber(payload.gestationalAgeWeeks);
  var mic = pediatricNumber(payload.micValue);
  var concentration = pediatricNumber(payload.concentrationMgPerMl);
  var prescribed = pediatricNumber(payload.currentPrescribedDoseMg);
  var measuredAuc = pediatricNumber(payload.measuredAuc24);
  var measuredTrough = pediatricNumber(payload.measuredTroughMgL);
  var isNeonate = payload.isNeonate === true || (pna !== null && pna < 28) || (ageMonths !== null && ageMonths < 28 / 30.4375);
  var indication = String(payload.indication || '').trim();
  var rule = pediatricRuleFor(payload.drugName);
  var alerts = [];
  var status = 'VALID';
  if (weight === null || weight < 0.2 || weight > 200) throw new Error('Cân nặng phải trong khoảng 0,2–200 kg.');
  if (ageMonths === null || ageMonths < 0 || ageMonths > 216) throw new Error('Tuổi phải trong khoảng 0–216 tháng.');
  if (!String(payload.drugName || '').trim()) throw new Error('Thiếu tên kháng sinh.');
  if (!indication) throw new Error('Thiếu chỉ định điều trị.');
  if (!rule) {
    status = 'CRITICAL_ERROR';
    alerts.push({ type: 'ADULT_MAX_CAP_UNAVAILABLE', severity: 'CRITICAL', detail: 'Chưa có quy tắc và trần liều người lớn đã chuẩn hóa cho thuốc này; hệ thống chặn khuyến nghị liều.', mechanism: 'Không thể bảo đảm liều mg/kg/ngày không vượt trần người lớn cùng chỉ định.' });
  }
  if (isNeonate && (ga === null || pna === null)) {
    status = pediatricWorstStatus(status, 'CRITICAL_ERROR');
    alerts.push({ type: 'NEONATAL_AGE_DATA', severity: 'CRITICAL', detail: 'Sơ sinh bắt buộc nhập đủ GA và PNA trước khi xác nhận liều.', mechanism: 'Thanh thải thuốc thay đổi mạnh theo tuổi thai và tuổi sau sinh.' });
  }
  var normalizedDrug = pediatricFold(payload.drugName);
  if (isNeonate && normalizedDrug.indexOf('ceftriaxone') !== -1) {
    if (payload.receivingCalciumIv === true || payload.hyperbilirubinemia === true) {
      status = 'CRITICAL_ERROR';
      alerts.push({ type: 'NEONATAL_CEFTRIAXONE', severity: 'CRITICAL', detail: 'Chống chỉ định ceftriaxone ở sơ sinh trong bối cảnh đã khai báo.', mechanism: payload.receivingCalciumIv === true ? 'Nguy cơ kết tủa ceftriaxone–calci gây biến cố nặng/tử vong.' : 'Ceftriaxone có thể đẩy bilirubin khỏi albumin, tăng nguy cơ bệnh não do bilirubin.' });
    } else {
      status = pediatricWorstStatus(status, 'WARNING');
      alerts.push({ type: 'NEONATAL_CEFTRIAXONE_SCREEN', severity: 'HIGH', detail: 'Phải xác nhận không tăng bilirubin và không dùng/không dự kiến dùng dịch IV chứa calci.', mechanism: 'Nguy cơ bilirubin tự do và kết tủa ceftriaxone–calci ở sơ sinh.' });
    }
  }
  if (ageMonths < 2 && /co trimoxazole|cotrimoxazole|trimethoprim sulfamethoxazole|tmp smx/.test(normalizedDrug)) {
    status = 'CRITICAL_ERROR';
    alerts.push({ type: 'AGE_CONTRAINDICATION', severity: 'CRITICAL', detail: 'Chống chỉ định co-trimoxazole ở trẻ dưới 2 tháng tuổi.', mechanism: 'Sulfonamide có thể làm tăng bilirubin tự do và nguy cơ kernicterus.' });
  }
  if (ageMonths < 96 && rule && rule.group === 'tetracycline') {
    status = pediatricWorstStatus(status, 'WARNING');
    alerts.push({ type: 'AGE_WARNING', severity: 'HIGH', detail: normalizedDrug.indexOf('doxycycline') !== -1 ? 'Trẻ dưới 8 tuổi: chỉ dùng doxycycline khi lợi ích vượt nguy cơ; liệu trình ngắn không đồng nhất với tetracycline cổ điển.' : 'Cảnh báo tetracycline ở trẻ dưới 8 tuổi.', mechanism: 'Tetracycline cổ điển liên quan nhuộm màu răng và ảnh hưởng mô đang phát triển.' });
  }
  if (rule && rule.group === 'fluoroquinolone') {
    status = pediatricWorstStatus(status, 'WARNING');
    alerts.push({ type: 'AGE_WARNING', severity: 'MODERATE', detail: 'Fluoroquinolone ở trẻ em chỉ cân nhắc khi có chỉ định phù hợp và lựa chọn an toàn hơn không đáp ứng.', mechanism: 'Nguy cơ ADR cơ-xương/khớp và các độc tính nghiêm trọng khác; cần đánh giá lợi ích-nguy cơ.' });
  }
  var severe = /soc nhiem|shock|ha bach cau|neutrop|critical|nang/.test(pediatricFold(payload.infectionSeverity));
  var cns = /viem mang nao|meningitis|cns|than kinh trung uong/.test(pediatricFold(indication));
  var rate = rule ? (severe ? rule.range[1] : rule.range[0]) : 0;
  var rawDaily = Math.round(weight * rate * 10) / 10;
  var cap = rule ? (cns && rule.cnsCap ? rule.cnsCap : rule.cap) : 0;
  var daily = cap ? Math.min(rawDaily, cap) : 0;
  var capped = Boolean(cap && rawDaily > cap);
  if (capped) alerts.push({ type: 'ADULT_MAX_CAP', severity: 'HIGH', detail: 'Liều theo cân nặng vượt trần người lớn cùng chỉ định và đã bị khóa tại ' + cap + ' mg/ngày.', mechanism: 'Áp dụng Adult Max Dose Cap trước khi chia liều.' });
  if (prescribed !== null && cap && prescribed > cap) {
    status = 'CRITICAL_ERROR';
    alerts.push({ type: 'PRESCRIBED_DOSE_OVER_CAP', severity: 'CRITICAL', detail: 'Tổng liều đang kê ' + prescribed + ' mg/ngày vượt trần ' + cap + ' mg/ngày; không chấp nhận liều này.', mechanism: 'Vượt trần liều người lớn cùng chỉ định.' });
  }
  if (rule && rule.group === 'vancomycin') {
    if (measuredAuc !== null && mic !== null && mic > 0 && measuredAuc / mic > 600) {
      status = pediatricWorstStatus(status, 'WARNING');
      alerts.push({ type: 'VANCOMYCIN_AUC_TOXICITY', severity: 'HIGH', detail: 'AUC24/MIC vượt 600; cần đánh giá giảm phơi nhiễm và chức năng thận.', mechanism: 'Phơi nhiễm vancomycin cao liên quan tăng nguy cơ độc thận.' });
    }
    if (measuredTrough !== null && measuredTrough > 15) {
      status = pediatricWorstStatus(status, 'WARNING');
      alerts.push({ type: 'VANCOMYCIN_TROUGH_WARNING', severity: 'HIGH', detail: 'Nồng độ đáy >15 mg/L; kiểm tra AUC24 và chức năng thận, không dùng đáy đơn thuần làm đích thay AUC.', mechanism: 'Nồng độ đáy 15–20 mg/L hoặc cao hơn thường đi kèm phơi nhiễm lớn và nguy cơ độc thận.' });
    }
  }
  if (isNeonate && rule) {
    status = pediatricWorstStatus(status, 'WARNING');
    alerts.push({ type: 'NEONATAL_PROTOCOL_REQUIRED', severity: 'HIGH', detail: 'Con số hiển thị là khung sàng lọc; liều sơ sinh phải chọn quy tắc cụ thể theo GA, PNA, cân nặng và chức năng thận tại đơn vị.', mechanism: 'Dược động học sơ sinh không thể đại diện bằng một dải mg/kg/ngày chung.' });
  }
  var doses = rule ? rule.doses : 1;
  var single = doses ? Math.round(daily / doses * 10) / 10 : 0;
  var volume = concentration && concentration > 0 ? Math.round(single / concentration * 100) / 100 : null;
  return {
    status: status,
    patient_summary: { age_display: pediatricAgeDisplay(ageMonths, isNeonate, ga, pna), weight_kg: weight, indication: indication },
    dosing_analysis: {
      drug_name: rule ? rule.name : String(payload.drugName || ''),
      recommended_range_mg_kg_day: rule ? (rule.range[0] === rule.range[1] ? String(rule.range[0]) : rule.range[0] + '–' + rule.range[1]) : 'Chưa chuẩn hóa',
      calculated_total_daily_dose_mg: daily, is_capped_at_adult_limit: capped,
      max_daily_limit_mg: cap, frequency: rule ? (doses === 1 ? 'Mỗi 24 giờ' : doses + ' lần/ngày') : 'Chưa xác định',
      single_dose_mg: single, recommended_volume_ml: volume, administration_route: rule ? rule.route : 'Chưa xác định'
    },
    pk_pd_evaluation: pediatricPkPd(rule, payload, mic), clinical_alerts: alerts,
    pharmacist_counseling: {
      reconstitution_instructions: 'Đối chiếu HDSD đúng chế phẩm/hàm lượng trước hoàn nguyên hoặc pha truyền; không suy diễn từ hoạt chất khác chế phẩm.',
      storage: 'Theo HDSD đúng chế phẩm và quy trình vô khuẩn của đơn vị; ưu tiên dùng ngay sau pha khi không có dữ liệu ổn định đã thẩm định.',
      monitoring_parameters: rule && rule.group === 'vancomycin' ? 'AUC24, creatinin, nước tiểu; đánh giá sớm trong 24–48 giờ.' : rule && rule.group === 'aminoglycoside' ? 'Cmax/Cmin theo quy trình TDM, creatinin, nước tiểu và thính giác.' : 'Đáp ứng lâm sàng, nhiệt độ, CRP/PCT khi phù hợp, công thức máu, gan-thận và kháng sinh đồ.'
    }
  };
}

function normalizePediatricAiResult(parsed, envelope) {
  parsed = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  var result = envelope;
  if (parsed.pk_pd_evaluation && typeof parsed.pk_pd_evaluation === 'object') {
    var recommendation = String(parsed.pk_pd_evaluation.optimization_recommendations || '').trim();
    if (recommendation) result.pk_pd_evaluation.optimization_recommendations = recommendation;
  }
  if (parsed.pharmacist_counseling && typeof parsed.pharmacist_counseling === 'object') {
    ['reconstitution_instructions', 'storage', 'monitoring_parameters'].forEach(function (key) {
      var value = String(parsed.pharmacist_counseling[key] || '').trim();
      if (value) result.pharmacist_counseling[key] = value;
    });
  }
  var aiAlerts = Array.isArray(parsed.clinical_alerts) ? parsed.clinical_alerts : [];
  aiAlerts.slice(0, 12).forEach(function (item) {
    if (!item || typeof item !== 'object') return;
    result.clinical_alerts.push({ type: String(item.type || 'CLINICAL_REVIEW'), severity: String(item.severity || 'MODERATE'), detail: String(item.detail || ''), mechanism: String(item.mechanism || '') });
  });
  var aiStatus = parsed.status === 'CRITICAL_ERROR' || parsed.status === 'WARNING' || parsed.status === 'VALID' ? parsed.status : 'WARNING';
  result.status = pediatricWorstStatus(result.status, aiStatus);
  return result;
}

function handlePediatricDosing(payload) {
  var envelope;
  try {
    envelope = pediatricDeterministicEnvelope(payload);
    var aiInput = { patient: payload || {}, safetyEnvelope: envelope };
    var text = requestGemini(PEDIATRIC_DOSING_PROMPT, [{ text: JSON.stringify(aiInput) }], 4096, PEDIATRIC_RESPONSE_SCHEMA);
    return normalizePediatricAiResult(parseModelJson(text), envelope);
  } catch (err) {
    if (envelope) {
      envelope.status = pediatricWorstStatus(envelope.status, 'WARNING');
      envelope.clinical_alerts.push({ type: 'AI_UNAVAILABLE', severity: 'MODERATE', detail: 'Không nhận được phần diễn giải AI; kết quả quy tắc xác định vẫn được giữ.', mechanism: String(err && err.message || err) });
      return envelope;
    }
    return {
      status: 'CRITICAL_ERROR', patient_summary: { age_display: '', weight_kg: 0, indication: String(payload && payload.indication || '') },
      dosing_analysis: { drug_name: String(payload && payload.drugName || ''), recommended_range_mg_kg_day: '', calculated_total_daily_dose_mg: 0, is_capped_at_adult_limit: false, max_daily_limit_mg: 0, frequency: '', single_dose_mg: 0, recommended_volume_ml: null, administration_route: '' },
      pk_pd_evaluation: { target_pk_pd_index: '', target_goal: '', estimated_achievement: '', mic_interpretation: '', optimization_recommendations: '' },
      clinical_alerts: [{ type: 'INVALID_INPUT', severity: 'CRITICAL', detail: String(err && err.message || err), mechanism: 'Dữ liệu đầu vào không hợp lệ hoặc không đủ để áp dụng khóa an toàn.' }],
      pharmacist_counseling: { reconstitution_instructions: '', storage: '', monitoring_parameters: '' }
    };
  }
}

/**
 * Điểm vào chính. payload = { images: [{mimeType, base64}], note?: string }
 * images: mảng ảnh y lệnh, không giới hạn số lượng (giới hạn thực tế do
 * Apps Script quota kích thước request — xem ghi chú cuối file).
 */
function handleAnalyzeInpatientOrder(payload) {
  var images = (payload && payload.images) || [];
  if (!images.length) {
    return { ok: false, message: 'Chưa nhận được ảnh y lệnh nào.' };
  }

  var drugCatalog = sanitizeDrugCatalog(payload && payload.drugCatalog);

  try {
    var resultText = callGeminiAnalysis(images, payload.note);

    var parsed = normalizeAnalysisResult(parseModelJson(resultText));
    if (!parsed) {
      return { ok: false, message: 'AI trả về định dạng phân tích không hợp lệ. Vui lòng thử lại.' };
    }
    return { ok: true, result: enforceCatalogIdentity(parsed, drugCatalog) };
  } catch (err) {
    var detail = err && err.message ? err.message : String(err);
    return buildGeminiErrorResponse(detail);
  }
}

function buildGeminiErrorResponse(detail) {
  var raw = String(detail || '');
  var normalized = raw.toLowerCase();
  var quotaLimited = /quota|rate.?limit|resource_exhausted|http 429/.test(normalized);
  var temporarilyBusy = /high demand|overload|unavailable|spike|http 5\d\d/.test(normalized);
  var response = {
    ok: false,
    errorCode: quotaLimited ? 'AI_QUOTA' : (temporarilyBusy ? 'AI_BUSY' : 'AI_UNAVAILABLE'),
    message: quotaLimited
      ? 'Dịch vụ AI đã chạm giới hạn sử dụng tạm thời. Vui lòng thử lại sau ít phút.'
      : (temporarilyBusy
        ? 'Dịch vụ AI đang quá tải tạm thời. Vui lòng thử lại sau ít phút.'
        : 'Dịch vụ AI tạm thời chưa thể phân tích. Vui lòng thử lại sau.')
  };
  var retryMatch = raw.match(/retry(?:Delay| in)?[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)\s*s/i);
  if (retryMatch) response.retryAfterSeconds = Math.ceil(Number(retryMatch[1]) || 0);
  return response;
}

function handleAnalyzeBhytPrescriptionText(payload) {
  var text = String(payload && payload.ocrText || '').trim();
  if (!text) return { ok: false, message: 'Chưa nhận được văn bản OCR.' };
  if (text.length > 60000) return { ok: false, message: 'Văn bản OCR vượt giới hạn 60.000 ký tự.' };
  try {
    var resultText = callGeminiText(BHYT_TEXT_PROMPT, text);
    var parsed = normalizeBhytReview(parseModelJson(resultText), text);
    if (!parsed) return { ok: false, message: 'AI trả về định dạng không hợp lệ. Vui lòng thử lại.' };
    return { ok: true, result: parsed };
  } catch (err) {
    return buildGeminiErrorResponse(err && err.message ? err.message : String(err));
  }
}

function normalizeBhytReview(parsed, ocrText) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  var classification = parsed.classification && typeof parsed.classification === 'object' ? parsed.classification : {};
  classification.bhytDrugs = Array.isArray(classification.bhytDrugs) ? classification.bhytDrugs : [];
  classification.serviceDrugs = Array.isArray(classification.serviceDrugs) ? classification.serviceDrugs : [];
  classification.unclassifiedDrugs = Array.isArray(classification.unclassifiedDrugs) ? classification.unclassifiedDrugs : [];
  parsed.classification = classification;
  parsed.interactions = (Array.isArray(parsed.interactions) ? parsed.interactions : []).filter(function (item) {
    var scope = String(item && item.scope || '');
    return scope === 'BHYT-BHYT' || scope === 'BHYT-Dịch vụ';
  });
  parsed.icdChecks = Array.isArray(parsed.icdChecks) ? parsed.icdChecks : [];
  parsed.issues = Array.isArray(parsed.issues) ? parsed.issues : [];

  var plain = String(ocrText || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  var hasBhytMarker = /\b(bhyt|bao hiem y te|the bhyt|quay phat thuoc bao hiem)\b/.test(plain) || classification.bhytDrugs.length > 0;
  var hasIcdCode = /\b[A-TV-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?\b/i.test(String(ocrText || ''));
  var alreadyFlagged = parsed.issues.some(function (item) {
    return String(item && item.category || '').toUpperCase() === 'ICD-BHYT' && String(item && item.finding || '').indexOf('NGUY CƠ XUẤT TOÁN') !== -1;
  });
  if (hasBhytMarker && !hasIcdCode && !alreadyFlagged) {
    parsed.issues.unshift({
      category: 'ICD-BHYT', severity: 'cao',
      finding: 'NGUY CƠ XUẤT TOÁN: thuốc BHYT không có mã ICD-10 tương ứng trong dữ liệu OCR.',
      recommendation: 'Kiểm tra đơn gốc và hồ sơ bệnh án; bổ sung đúng mã chỉ khi chẩn đoán thực tế đã được ghi nhận.'
    });
  }
  return parsed;
}

function callGeminiAnalysis(images, note) {
  var parts = [{
    text: 'Đọc trực tiếp và phân tích toàn bộ y lệnh trong (các) ảnh theo đúng hướng dẫn trong MỘT lượt gọi AI; chỉ trả về một object JSON hợp lệ.' +
      '\nVới từng thuốc: chép nguyên văn tên và dòng y lệnh trước; nhận diện tên biệt dược/tên thương mại cùng hoạt chất rồi phân tích đầy đủ liều, cách dùng, tốc độ truyền, thận và tương tác khi đủ rõ.' +
      '\nKhông được từ chối hoặc loại thuốc chỉ vì thuốc chưa có trong danh mục nội bộ. identity.rawName giữ đúng phần chữ nhìn thấy; identity.brand ghi tên thương mại; identity.activeIngredient ghi hoạt chất dùng để phân tích; identity.catalogId luôn để trống.' +
      '\nChỉ khi chữ trong ảnh hoặc hoạt chất thật sự không chắc chắn mới để trống phần không chắc và ghi vào unclear; không đoán phần chữ mờ, không tự hoàn thiện tên thuốc, không thay bằng tên gần giống.' +
      (note ? ('\n\nGhi chú thêm từ dược sĩ: ' + note) : '')
  }];
  images.forEach(function (img) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType || 'image/jpeg',
        data: img.base64
      }
    });
  });
  return requestGemini(SYSTEM_PROMPT, parts, 8192);
}

function sanitizeDrugCatalog(input) {
  if (!Array.isArray(input)) return [];
  var seen = {};
  return input.slice(0, 600).map(function (item) {
    item = item || {};
    return {
      catalogId: String(item.catalogId || '').slice(0, 80),
      brand: String(item.brand || '').slice(0, 200),
      activeIngredient: String(item.activeIngredient || '').slice(0, 300),
      strength: String(item.strength || '').slice(0, 120),
      route: String(item.route || '').slice(0, 80),
      registrationNumber: String(item.registrationNumber || '').slice(0, 80)
    };
  }).filter(function (item) {
    if (!item.catalogId || !item.brand || !item.activeIngredient || seen[item.catalogId]) return false;
    seen[item.catalogId] = true;
    return true;
  });
}

function normalizeCatalogBrand(value) {
  return normalizeIdentityText(String(value || '').split('(')[0])
    .replace(/\b(?:ttkn|syt|dv|bhyt)\s*\d+\b/g, ' ')
    .replace(/\b(\d+)\s+(mg|g|mcg|ug|ml|iu|ui)\b/g, '$1$2')
    .replace(/\s+/g, ' ').trim();
}

function catalogEntriesSameIdentity(entries) {
  if (!entries.length) return false;
  var first = entries[0];
  return entries.every(function (entry) {
    return identityActiveEquivalent(entry.activeIngredient, first.activeIngredient)
      && normalizeIdentityText(entry.strength) === normalizeIdentityText(first.strength);
  });
}

function exactCatalogMatch(rawName, catalog) {
  var raw = normalizeCatalogBrand(rawName);
  if (raw.length < 4) return { status: 'unreadable', entry: null };
  var exact = catalog.filter(function (entry) { return normalizeCatalogBrand(entry.brand) === raw; });
  if (exact.length === 1 || (exact.length > 1 && catalogEntriesSameIdentity(exact))) {
    return { status: 'exact', entry: exact[0] };
  }
  if (exact.length > 1) return { status: 'ambiguous', entry: null };
  return { status: 'not_found', entry: null };
}

function resolveCatalogIdentities(ocrDrugs, catalog) {
  return ocrDrugs.slice(0, 100).map(function (ocr) {
    ocr = ocr || {};
    var rawName = String(ocr.rawName || '').slice(0, 240);
    var match = ocr.readable === false
      ? { status: 'unreadable', entry: null }
      : catalogMatchFromOrderLine(rawName, catalog);
    if (!match.entry) {
      return {
        rawName: rawName, orderedText: String(ocr.orderedText || '').slice(0, 500),
        status: match.status, catalogId: '', brand: rawName,
        activeIngredient: '', strength: '', route: '', registrationNumber: ''
      };
    }
    return {
      rawName: rawName, orderedText: String(ocr.orderedText || '').slice(0, 500),
      status: 'exact', catalogId: match.entry.catalogId, brand: match.entry.brand,
      activeIngredient: match.entry.activeIngredient, strength: match.entry.strength,
      route: match.entry.route, registrationNumber: match.entry.registrationNumber
    };
  });
}

function normalizeIdentityText(value) {
  return String(value || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();
}

function identityActiveTokens(value) {
  var ignored = { duoi:1, dang:1, tuong:1, duong:1, natri:1, sodium:1, kali:1, potassium:1, hydrat:1, hydrate:1, hydrochlorid:1, hydrochloride:1 };
  return normalizeIdentityText(value).split(' ').map(function (token) {
    return token === 'ampicillin' ? 'ampicilin' : token;
  }).filter(function (token) { return token.length >= 4 && !ignored[token] && !/^\d/.test(token); });
}

function identityActiveEquivalent(left, right) {
  var a = identityActiveTokens(left);
  var b = identityActiveTokens(right);
  if (!a.length || !b.length) return false;
  var overlap = a.filter(function (token) { return b.indexOf(token) !== -1; }).length;
  return overlap === Math.min(a.length, b.length) && overlap / Math.max(a.length, b.length) >= 0.5;
}

function catalogBrandVisibleInRawName(rawName, catalogBrand) {
  var raw = ' ' + normalizeIdentityText(rawName)
    .replace(/\b(\d+)\s+(mg|g|mcg|ug|ml|iu|ui)\b/g, '$1$2')
    .replace(/\s+/g, ' ').trim() + ' ';
  var brand = normalizeIdentityText(catalogBrand)
    .replace(/\b(\d+)\s+(mg|g|mcg|ug|ml|iu|ui)\b/g, '$1$2')
    .replace(/\s+/g, ' ').trim();
  return brand.length >= 4 && raw.indexOf(' ' + brand + ' ') !== -1;
}

function enforceCatalogIdentity(result, catalog) {
  result = result && typeof result === 'object' ? result : {};
  result.drugs = Array.isArray(result.drugs) ? result.drugs : [];
  result.unclear = Array.isArray(result.unclear) ? result.unclear : [];
  var byId = {};
  catalog.forEach(function (entry) { byId[entry.catalogId] = entry; });

  result.drugs.forEach(function (drug) {
    drug = drug || {};
    var identity = drug.identity || {};
    var entry = identity.status === 'exact' ? byId[String(identity.catalogId || '')] : null;
    if (!entry) {
      var recovered = catalogMatchFromOrderLine(identity.rawName || drug.tradeName || drug.brand || drug.name || '', catalog);
      if (recovered.entry) entry = recovered.entry;
    }
    var rawName = String(identity.rawName || drug.tradeName || drug.brand || drug.name || '');
    var declaredBrand = String(identity.brand || drug.tradeName || drug.brand || rawName);
    var declaredActive = String(identity.activeIngredient || drug.activeIngredient || drug.genericName || '');
    if (!entry) {
      drug.identity = {
        rawName: rawName,
        status: String(identity.status || (rawName ? 'exact' : 'unreadable')),
        catalogStatus: catalog.length ? 'not_found' : 'unavailable',
        catalogId: '',
        brand: declaredBrand,
        activeIngredient: declaredActive,
        strength: String(identity.strength || drug.strength || ''),
        route: String(identity.route || drug.route || ''),
        registrationNumber: String(identity.registrationNumber || '')
      };
      drug.tradeName = drug.tradeName || declaredBrand;
      drug.activeIngredient = drug.activeIngredient || declaredActive;
      if (catalog.length) {
        result.unclear.push('Thuốc "' + (rawName || 'chưa đọc rõ tên') + '" chưa có trong danh mục nội bộ; kết quả AI vẫn được giữ để dược sĩ đối chiếu.');
      }
      return;
    }

    if (!catalogBrandVisibleInRawName(rawName, declaredBrand)
        && catalogBrandVisibleInRawName(rawName, entry.brand)) {
      declaredBrand = entry.brand;
      drug.name = declaredBrand;
    }
    var mismatch = declaredActive && !identityActiveEquivalent(declaredActive, entry.activeIngredient);
    if (mismatch) {
      drug.identity = {
        rawName: rawName, status: String(identity.status || 'exact'), catalogStatus: 'conflict',
        catalogId: '', brand: declaredBrand, activeIngredient: declaredActive,
        strength: String(identity.strength || drug.strength || ''),
        route: String(identity.route || drug.route || ''),
        registrationNumber: String(identity.registrationNumber || ''),
        catalogReference: {
          catalogId: entry.catalogId, brand: entry.brand, activeIngredient: entry.activeIngredient,
          strength: entry.strength, route: entry.route, registrationNumber: entry.registrationNumber
        }
      };
      result.unclear.push('Cần đối chiếu thuốc "' + (rawName || declaredBrand) + '": AI nhận hoạt chất "' + declaredActive + '" nhưng danh mục nội bộ ghi "' + entry.activeIngredient + '". Kết quả AI không bị khóa.');
      return;
    }

    drug.identity = {
      rawName: rawName, status: String(identity.status || 'exact'), catalogStatus: 'matched',
      catalogId: entry.catalogId, brand: declaredBrand,
      activeIngredient: declaredActive, strength: String(identity.strength || drug.strength || ''),
      route: String(identity.route || drug.route || ''),
      registrationNumber: String(identity.registrationNumber || ''),
      catalogReference: {
        catalogId: entry.catalogId, brand: entry.brand, activeIngredient: entry.activeIngredient,
        strength: entry.strength, route: entry.route, registrationNumber: entry.registrationNumber
      }
    };
    drug.tradeName = drug.tradeName || declaredBrand;
    drug.activeIngredient = drug.activeIngredient || declaredActive;
  });

  result.unclear = result.unclear.filter(function (item, index, array) { return item && array.indexOf(item) === index; });
  return result;
}

function callGeminiText(instructions, inputText) {
  return requestGemini(instructions, [{
    text: 'Phân tích văn bản OCR sau đây theo đúng cấu trúc đã yêu cầu và chỉ trả về một object JSON hợp lệ.\n\n' + inputText
  }], 4096);
}

function requestGemini(instructions, parts, maxOutputTokens, responseSchema) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Chưa cấu hình GEMINI_API_KEY trong Script Properties.');

  var request = {
    systemInstruction: { parts: [{ text: instructions }] },
    contents: [{ role: 'user', parts: parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: maxOutputTokens
    }
  };
  if (responseSchema) request.generationConfig.responseSchema = responseSchema;
  var errors = [];

  for (var modelIndex = 0; modelIndex < GEMINI_MODELS.length; modelIndex++) {
    var model = GEMINI_MODELS[modelIndex];
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify(request)
    });
    var code = res.getResponseCode();
    var body;
    try { body = JSON.parse(res.getContentText()); } catch (e) { body = {}; }

    if (code >= 200 && code < 300) {
      var text = extractGeminiText(body);
      if (text) return text;
      errors.push(model + ': không có nội dung trả về');
      continue;
    }

    var detail = (body.error && body.error.message) || ('HTTP ' + code);
    var retryDelay = extractGeminiRetryDelay(body);
    errors.push(model + ': ' + detail + (retryDelay ? ('; retryDelay=' + retryDelay + 's') : ''));
  }

  throw new Error('Gemini không khả dụng sau khi đã thử model chính và dự phòng. ' + errors.join(' | '));
}

function extractGeminiRetryDelay(body) {
  var details = body && body.error && body.error.details;
  if (!Array.isArray(details)) return 0;
  for (var index = 0; index < details.length; index++) {
    var value = details[index] && details[index].retryDelay;
    var match = String(value || '').match(/^([0-9]+(?:\.[0-9]+)?)s$/i);
    if (match) return Math.ceil(Number(match[1]) || 0);
  }
  return 0;
}

function extractGeminiText(body) {
  var chunks = [];
  (body.candidates || []).forEach(function (candidate) {
    (((candidate || {}).content || {}).parts || []).forEach(function (part) {
      if (part && part.text) chunks.push(part.text);
    });
  });
  return chunks.join('');
}

/** Tìm một fragment JSON cân bằng trong text, có xử lý chuỗi và ký tự escape. */
function extractBalancedJsonFragment(text, startIndex) {
  var source = String(text || '');
  var opener = source.charAt(startIndex);
  var closer = opener === '{' ? '}' : opener === '[' ? ']' : '';
  if (!closer) return '';
  var depth = 0;
  var inString = false;
  var escaped = false;
  for (var i = startIndex; i < source.length; i++) {
    var ch = source.charAt(i);
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === opener) depth++;
    if (ch === closer) {
      depth--;
      if (depth === 0) return source.slice(startIndex, i + 1);
    }
  }
  return '';
}

/** Parse JSON chịu được markdown fence hoặc phần giải thích thừa trước/sau JSON. */
function parseModelJson(text) {
  var raw = String(text || '').trim();
  if (!raw) return null;
  var cleaned = raw
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .replace(/^\s*json\s*[:\-]?\s*/i, '')
    .trim();

  var candidates = [cleaned];
  var starts = [];
  var objectStart = cleaned.indexOf('{');
  var arrayStart = cleaned.indexOf('[');
  if (objectStart >= 0) starts.push(objectStart);
  if (arrayStart >= 0) starts.push(arrayStart);
  starts.sort(function (a, b) { return a - b; });
  starts.forEach(function (index) {
    var fragment = extractBalancedJsonFragment(cleaned, index);
    if (fragment) candidates.push(fragment);
  });

  for (var i = 0; i < candidates.length; i++) {
    try { return JSON.parse(candidates[i]); } catch (e) {}
  }
  return null;
}

function normalizeIdentityDrugRow(item) {
  if (typeof item === 'string') {
    return { rawName: item.trim(), orderedText: item.trim(), readable: true };
  }
  item = item && typeof item === 'object' ? item : {};
  var rawName = String(item.rawName || item.name || item.drug || item.medicine || item.medication || item.tradeName || item.brand || '').trim();
  var orderedText = String(item.orderedText || item.order || item.line || item.text || item.doseLine || rawName).trim();
  if (!rawName) return null;
  return { rawName: rawName, orderedText: orderedText, readable: item.readable !== false };
}

function identityRowsFromParsed(parsed) {
  if (!parsed) return [];
  var rows = [];
  if (Array.isArray(parsed)) rows = parsed;
  else if (Array.isArray(parsed.drugs)) rows = parsed.drugs;
  else if (Array.isArray(parsed.medications)) rows = parsed.medications;
  else if (Array.isArray(parsed.medicines)) rows = parsed.medicines;
  else if (Array.isArray(parsed.items)) rows = parsed.items;
  else if (parsed.drugs && typeof parsed.drugs === 'object') rows = Object.keys(parsed.drugs).map(function (key) { return parsed.drugs[key]; });
  return rows.map(normalizeIdentityDrugRow).filter(function (row) { return row && row.rawName; });
}

function catalogMatchFromOrderLine(rawText, catalog) {
  var direct = exactCatalogMatch(rawText, catalog);
  if (direct.entry || direct.status === 'ambiguous') return direct;

  var normalizedLine = ' ' + normalizeIdentityText(rawText) + ' ';
  var matches = catalog.filter(function (entry) {
    var brand = normalizeCatalogBrand(entry.brand);
    return brand.length >= 4 && normalizedLine.indexOf(' ' + brand + ' ') !== -1;
  });
  if (matches.length === 1 || (matches.length > 1 && catalogEntriesSameIdentity(matches))) {
    matches.sort(function (a, b) { return normalizeCatalogBrand(b.brand).length - normalizeCatalogBrand(a.brand).length; });
    return { status: 'exact', entry: matches[0] };
  }
  return { status: matches.length > 1 ? 'ambiguous' : direct.status, entry: null };
}

function looseRawNameFromLine(line) {
  var value = String(line || '').trim()
    .replace(/^[-*•]+\s*/, '')
    .replace(/^\d+[.)\-:]\s*/, '')
    .replace(/^["']?(?:rawName|name|drug|medicine|medication|thuoc|tên thuốc)["']?\s*[:=]\s*/i, '')
    .replace(/^["']|["'],?$/g, '')
    .trim();
  if (!value || value.length < 3 || value.length > 240) return '';
  var doseIndex = value.search(/\s(?:\d+(?:[.,]\d+)?\s*(?:mg|g|mcg|µg|ml|mL|iu|ui|đv|%|lọ|lo|ống|ong|viên|vien)\b|x\s*\d+\b)/i);
  if (doseIndex > 2) value = value.slice(0, doseIndex).trim();
  if (/^(?:drugs?|medications?|medicines?|result|json|object|danh sach|danh sách)\b/i.test(value)) return '';
  return value;
}

/**
 * Fallback định danh: đọc text thô từng dòng và ưu tiên đối chiếu tên thuốc
 * trực tiếp với danh mục nội trú. Không suy diễn hoạt chất từ kiến thức model.
 */
function fallbackParseIdentityText(text, catalog) {
  var raw = String(text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '');
  var lines = raw.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
  var rows = [];
  var seen = {};

  function pushRow(rawName, orderedText) {
    rawName = String(rawName || '').trim();
    if (!rawName) return;
    var key = normalizeIdentityText(rawName);
    if (seen[key]) return;
    seen[key] = true;
    rows.push({ rawName: rawName, orderedText: String(orderedText || rawName).slice(0, 500), readable: true });
  }

  lines.forEach(function (line) {
    var match = catalogMatchFromOrderLine(line, catalog);
    if (match.entry) {
      pushRow(match.entry.brand, line);
      return;
    }
    var keyed = line.match(/["']?(?:rawName|name|drug|medicine|medication|thuoc|tên thuốc)["']?\s*[:=]\s*["']?([^"',}\]]{3,240})/i);
    if (keyed && keyed[1]) {
      pushRow(looseRawNameFromLine(keyed[1]) || keyed[1], line);
      return;
    }
    if (/\b\d+(?:[.,]\d+)?\s*(?:mg|g|mcg|µg|ml|mL|iu|ui|đv|%|lọ|lo|ống|ong|viên|vien)\b/i.test(line)) {
      var loose = looseRawNameFromLine(line);
      if (loose) pushRow(loose, line);
    }
  });

  if (!rows.length && raw) {
    var normalizedWhole = ' ' + normalizeIdentityText(raw) + ' ';
    catalog.forEach(function (entry) {
      var brand = normalizeCatalogBrand(entry.brand);
      if (brand.length >= 4 && normalizedWhole.indexOf(' ' + brand + ' ') !== -1) pushRow(entry.brand, entry.brand);
    });
  }
  return rows.slice(0, 100);
}

function parseIdentityModelOutput(text, catalog) {
  var parsedRows = identityRowsFromParsed(parseModelJson(text));
  var fallbackRows = fallbackParseIdentityText(text, catalog || []);
  var rows = [];
  var seen = {};
  parsedRows.concat(fallbackRows).forEach(function (row) {
    var key = normalizeIdentityText(row.rawName);
    if (!row.rawName || seen[key]) return;
    seen[key] = true;
    rows.push(row);
  });
  return { drugs: rows.slice(0, 100) };
}

function analysisObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function firstAnalysisText() {
  for (var i = 0; i < arguments.length; i++) {
    var value = arguments[i];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && isFinite(value)) return String(value);
  }
  return '';
}

function parseAnalysisOrderLine(value) {
  var orderedDose = firstAnalysisText(value)
    .replace(/^\s*(?:[-*•▪◦]+|\d+\s*[.)\-:])\s*/, '').trim();
  if (!orderedDose) return { rawName: '', orderedDose: '', strength: '' };
  var strengthMatch = orderedDose.match(/\b\d+(?:[.,]\d+)?\s*(?:mg|g|mcg|µg|ug|ml|mL|l|iu|ui|đv|%)\b(?:\s*\/\s*\d*(?:[.,]\d+)?\s*(?:ml|mL|l))?/i);
  var quantityMatch = orderedDose.match(/\b\d+(?:[.,]\d+)?\s*(?:viên|vien|ống|ong|lọ|lo|gói|goi|chai|túi|tui|bơm)\b/i);
  var routeMatch = orderedDose.match(/\s+(?=(?:uống|tiêm|truyền|ngậm|bôi|đặt|xịt|nhỏ|khí\s*dung)\b)/i);
  var indexes = [];
  if (strengthMatch && strengthMatch.index > 1) indexes.push(strengthMatch.index);
  if (quantityMatch && quantityMatch.index > 1) indexes.push(quantityMatch.index);
  if (routeMatch && routeMatch.index > 1) indexes.push(routeMatch.index);
  indexes.sort(function (left, right) { return left - right; });
  var rawName = indexes.length ? orderedDose.slice(0, indexes[0]) : orderedDose;
  return {
    rawName: rawName.trim(),
    orderedDose: orderedDose,
    strength: strengthMatch ? strengthMatch[0].trim() : ''
  };
}

function normalizeAnalysisDrugRow(item) {
  var source = typeof item === 'string' ? { orderedText: item } : analysisObject(item);
  var identity = analysisObject(source.identity || source.drugIdentity || source.drug_identity);
  var order = analysisObject(source.order);
  var orderedDose = firstAnalysisText(
    source.orderedDose, source.ordered_dose, source.orderedText, source.ordered_text,
    source.orderText, source.order_text, source.order, order.text,
    source.dosage, source.dose, source.instruction, source.instructions
  );
  var parsedLine = parseAnalysisOrderLine(orderedDose);
  var rawName = firstAnalysisText(
    identity.rawName, identity.raw_name, source.rawName, source.raw_name,
    source.drugName, source.drug_name, source.name, source.drug,
    source.medicine, source.medication, source.tradeName, source.trade_name,
    source.brand, parsedLine.rawName
  );
  var brand = firstAnalysisText(
    identity.brand, identity.tradeName, identity.trade_name,
    source.tradeName, source.trade_name, source.brand, rawName
  );
  var activeIngredient = firstAnalysisText(
    identity.activeIngredient, identity.active_ingredient,
    source.activeIngredient, source.active_ingredient,
    source.genericName, source.generic_name, source.active
  );
  var route = firstAnalysisText(
    source.route, source.administrationRoute, source.administration_route,
    identity.route, order.route
  );
  var doseInput = source.doseAssessment || source.dose_assessment || source.doseEvaluation || source.dose_evaluation;
  var dose = analysisObject(doseInput);
  var infusionInput = source.infusionRate || source.infusion_rate;
  var infusion = analysisObject(infusionInput);
  var renalInput = source.renalAdjustment || source.renal_adjustment;
  var renal = analysisObject(renalInput);
  var infusionRate = firstAnalysisText(infusion.rate, source.infusionRateText, source.infusion_rate_text);
  var normalized = {};
  Object.keys(source).forEach(function (key) { normalized[key] = source[key]; });
  normalized.name = firstAnalysisText(source.name, source.drugName, source.drug_name, brand, rawName);
  normalized.identity = {
    rawName: rawName,
    status: firstAnalysisText(identity.status, rawName ? 'not_found' : 'unreadable'),
    catalogId: firstAnalysisText(identity.catalogId, identity.catalog_id),
    brand: brand,
    activeIngredient: activeIngredient,
    strength: firstAnalysisText(identity.strength, source.strength, parsedLine.strength),
    route: firstAnalysisText(identity.route, route),
    registrationNumber: firstAnalysisText(identity.registrationNumber, identity.registration_number)
  };
  normalized.orderedDose = firstAnalysisText(orderedDose, parsedLine.orderedDose);
  normalized.route = route;
  normalized.usageNote = firstAnalysisText(
    source.usageNote, source.usage_note, source.instructions,
    source.instruction, source.directions, order.usageNote, order.usage_note
  );
  normalized.doseAssessment = {
    status: firstAnalysisText(dose.status, dose.result, typeof doseInput === 'string' ? doseInput : '', source.doseStatus, source.dose_status),
    detail: firstAnalysisText(dose.detail, dose.reason, dose.note),
    source: firstAnalysisText(dose.source, dose.reference)
  };
  normalized.infusionRate = {
    applicable: typeof infusion.applicable === 'boolean' ? infusion.applicable : Boolean(infusionRate),
    rate: infusionRate,
    basis: firstAnalysisText(infusion.basis, infusion.detail, infusion.source)
  };
  normalized.renalAdjustment = {
    applicable: typeof renal.applicable === 'boolean' ? renal.applicable : Boolean(firstAnalysisText(renal.warning, renal.method, renal.suggestedRegimen, renal.suggested_regimen)),
    priority: firstAnalysisText(renal.priority),
    warning: firstAnalysisText(renal.warning, renal.note),
    method: firstAnalysisText(renal.method, renal.basis),
    suggestedRegimen: firstAnalysisText(renal.suggestedRegimen, renal.suggested_regimen),
    loadingDoseNote: firstAnalysisText(renal.loadingDoseNote, renal.loading_dose_note),
    monitoring: firstAnalysisText(renal.monitoring, renal.followUp, renal.follow_up),
    source: firstAnalysisText(renal.source, renal.reference)
  };
  return normalized;
}

function normalizeAnalysisResult(parsed) {
  if (!parsed) return null;
  if (Array.isArray(parsed)) parsed = { drugs: parsed };
  if (typeof parsed !== 'object') return null;
  var container = parsed.drugs || parsed.medications || parsed.medicines || parsed.items || [];
  var rows = Array.isArray(container)
    ? container
    : Object.keys(analysisObject(container)).map(function (key) { return container[key]; });
  parsed.drugs = rows.map(normalizeAnalysisDrugRow);
  if (!Array.isArray(parsed.highPriorityIssues)) parsed.highPriorityIssues = [];
  if (!parsed.patientRecord || typeof parsed.patientRecord !== 'object') parsed.patientRecord = {};
  if (!Array.isArray(parsed.indicationReview)) parsed.indicationReview = [];
  if (!Array.isArray(parsed.interactions)) parsed.interactions = [];
  if (!Array.isArray(parsed.recommendations)) parsed.recommendations = [];
  if (!Array.isArray(parsed.monitoringPlan)) parsed.monitoringPlan = [];
  if (!Array.isArray(parsed.unclear)) parsed.unclear = [];
  if (!parsed.patientContext && parsed.patient_context) parsed.patientContext = parsed.patient_context;
  return parsed;
}

/**
 * Dùng nếu triển khai deployment RIÊNG chỉ cho tính năng này (không dùng
 * chung router doPost hiện có của dự án). Nếu đã có doPost khác trong cùng
 * dự án Apps Script, XÓA hàm này và gọi handleAnalyzeInpatientOrder() từ
 * router chung để tránh xung đột "doPost đã được định nghĩa".
 */
function doPost(e) {
  var result;
  try {
    var payload = parseRequestPayload(e);
    var action = String(payload.action || '').trim();
    if (action === 'review_bhyt' || action === 'analyzeBhytPrescriptionText') {
      result = handleAnalyzeBhytPrescriptionText(payload);
    } else if (action === 'review_inpatient' || action === 'analyzeInpatientOrder') {
      result = handleAnalyzeInpatientOrder(payload);
    } else if (action === 'calculate_pediatric_antibiotic') {
      result = handlePediatricDosing(payload);
    } else {
      result = { ok: false, errorCode: 'UNKNOWN_ACTION', message: 'action không hợp lệ. Dùng review_bhyt, review_inpatient hoặc calculate_pediatric_antibiotic.' };
    }
  } catch (err) {
    result = { ok: false, errorCode: 'INVALID_REQUEST', message: 'Yêu cầu JSON không hợp lệ.' };
  }
  return jsonResponse(result);
}

function doGet(e) {
  var action = String(e && e.parameter && e.parameter.action || 'health').trim();
  return jsonResponse(action === 'health'
    ? { ok: true, service: 'clinical-review', actions: ['review_bhyt', 'review_inpatient', 'calculate_pediatric_antibiotic'] }
    : { ok: false, errorCode: 'UNKNOWN_ACTION', message: 'Chỉ hỗ trợ action=health với GET.' });
}

function parseRequestPayload(e) {
  var raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
  var payload = raw ? JSON.parse(raw) : {};
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid payload');
  return payload;
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * GHI CHÚ GIỚI HẠN THỰC TẾ
 * - Apps Script Web App giới hạn kích thước request ~50MB và thời gian
 *   chạy 6 phút/lần gọi (tài khoản cá nhân). Nhiều ảnh độ phân giải cao
 *   cùng lúc có thể vượt ngưỡng này dù không có giới hạn "cứng" về số
 *   lượng ảnh trong code — client nên nén ảnh trước khi gửi (đã áp dụng
 *   trong assets/inpatient-order-review.js).
 * - Đây là proxy tạm thời phù hợp kiến trúc hiện tại (GitHub Pages +
 *   Apps Script). Khi nhánh security/backend-migration (NestJS/Prisma)
 *   hoàn tất, nên chuyển endpoint này sang backend chính thức để quản lý
 *   khóa API, rate-limit và log audit tốt hơn.
 */
