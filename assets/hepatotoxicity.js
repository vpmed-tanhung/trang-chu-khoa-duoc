(() => {
  "use strict";

  const drugs = [
    ["Hapacol 250","Paracetamol","Cao","Độc gan phụ thuộc liều; nguy cơ tăng khi quá liều, suy dinh dưỡng, uống rượu hoặc dùng nhiều chế phẩm cùng hoạt chất.","Kiểm tra tổng liều paracetamol/ngày; theo dõi AST, ALT, bilirubin, INR khi nghi ngờ độc tính."],
    ["Paracetamol 10 mg/ml","Paracetamol","Cao","Độc gan phụ thuộc liều; có thể gây hoại tử gan và suy gan cấp khi quá liều.","Kiểm tra tổng liều từ mọi đường dùng; đánh giá sớm khi có buồn nôn, đau hạ sườn phải hoặc tăng men gan."],
    ["Para-OPC 150 mg","Paracetamol","Cao","Nguy cơ độc gan chủ yếu liên quan tổng liều và yếu tố nguy cơ của người bệnh.","Tránh dùng trùng hoạt chất; theo dõi chức năng gan khi dùng kéo dài hoặc có bệnh gan nền."],
    ["Partamol 500 Cap","Paracetamol","Cao","Nguy cơ tăng khi sử dụng nhiều chế phẩm chứa paracetamol hoặc quá liều.","Rà soát thuốc phối hợp và tổng liều 24 giờ."],
    ["Axuka","Amoxicillin + acid clavulanic","Cao","Có thể gây viêm gan ứ mật hoặc tổn thương gan hỗn hợp, đôi khi xuất hiện sau khi ngừng thuốc.","Không dùng lại nếu từng vàng da/rối loạn chức năng gan do thuốc này; theo dõi vàng da, ngứa, bilirubin và ALP."],
    ["Curam 625 mg","Amoxicillin + acid clavulanic","Cao","Nguy cơ tổn thương gan kiểu ứ mật hoặc hỗn hợp.","Hỏi tiền sử DILI do amoxicillin–clavulanate; theo dõi khi điều trị kéo dài."],
    ["Koact 625","Amoxicillin + acid clavulanic","Cao","Có thể gây tổn thương gan xuất hiện muộn.","Ngừng và đánh giá khi xuất hiện vàng da, nước tiểu sẫm hoặc ngứa lan tỏa."],
    ["Dalekine","Valproat natri","Cao","Có thể gây tăng men gan, tăng amoniac, viêm gan nặng hoặc suy gan.","Theo dõi chức năng gan trước và trong điều trị; đánh giá amoniac khi rối loạn ý thức."],
    ["Methotrexat","Methotrexat","Cao","Có thể gây tăng men gan, gan nhiễm mỡ, xơ hóa hoặc xơ gan khi dùng kéo dài.","Theo dõi AST/ALT, albumin; rà soát rượu, béo phì, đái tháo đường và thuốc độc gan phối hợp."],
    ["Spulit","Itraconazol","Cao","Có thể gây viêm gan, ứ mật và hiếm gặp suy gan nặng.","Đánh giá chức năng gan trước điều trị và khi có triệu chứng; ngừng khi nghi ngờ tổn thương gan đáng kể."],
    ["Hadugut 300","Allopurinol","Cao","Tổn thương gan thường liên quan hội chứng quá mẫn/DRESS.","Ngừng thuốc và đánh giá khẩn khi sốt, phát ban, phù mặt, tăng bạch cầu ái toan hoặc vàng da."],
    ["Diclofenac","Diclofenac","Cao","Có nguy cơ gây viêm gan tế bào gan; nguy cơ đáng chú ý hơn nhiều NSAID khác.","Theo dõi men gan khi dùng kéo dài; ngừng khi tăng men gan tiến triển hoặc có triệu chứng."],
    ["Veltaron TTKN-25","Diclofenac natri","Cao","Có thể gây tổn thương tế bào gan dù dùng đường đặt.","Không bỏ qua nguy cơ toàn thân; theo dõi tương tự diclofenac đường uống/tiêm."],
    ["Biseptol 480","Sulfamethoxazol + trimethoprim","Cao","Có thể gây viêm gan quá mẫn, tổn thương tế bào gan hoặc ứ mật.","Ngừng và đánh giá khi sốt, ban, vàng da hoặc tăng bạch cầu ái toan."],
    ["Ocebiso SYT-25","Sulfamethoxazol + trimethoprim","Cao","Nguy cơ DILI có thể đi kèm phản ứng quá mẫn.","Theo dõi lâm sàng và xét nghiệm gan khi có triệu chứng."],
    ["BFS-Amiron","Amiodaron","Cao","Có thể gây tăng men gan, viêm gan mạn hoặc tổn thương gan cấp sau truyền tĩnh mạch.","Theo dõi AST/ALT định kỳ; đánh giá sát sau truyền nếu tụt huyết áp hoặc tăng men gan cấp."],
    ["Tazopelin 4,5 g","Piperacillin + tazobactam","Trung bình–cao","Có thể gây tăng men gan, ứ mật hoặc DRESS.","Theo dõi chức năng gan khi điều trị kéo dài; đánh giá ban, sốt và bạch cầu ái toan."],
    ["Bredomax 300","Fenofibrat","Trung bình–cao","Có thể gây tăng transaminase và hiếm gặp viêm gan kéo dài.","Theo dõi men gan định kỳ; ngừng khi tăng kéo dài hoặc có triệu chứng."],
    ["Atoris 10 mg","Atorvastatin","Theo dõi","Thường gây tăng men gan nhẹ; tổn thương gan có triệu chứng hiếm.","Đánh giá men gan khi có triệu chứng hoặc yếu tố nguy cơ; không ngừng chỉ vì tăng nhẹ đơn độc."],
    ["Lovastatin DWP 10 mg","Lovastatin","Theo dõi","Có thể gây tăng men gan, DILI nặng hiếm gặp.","Theo dõi theo lâm sàng và thuốc phối hợp."],
    ["Pms-Rosuvastatin QG-25","Rosuvastatin","Theo dõi","Tăng men gan nhẹ có thể gặp; tổn thương gan nặng hiếm.","Đánh giá khi mệt nhiều, vàng da, nước tiểu sẫm."],
    ["Garnotal","Phenobarbital","Theo dõi","Có thể gây viêm gan trong phản ứng quá mẫn.","Ngừng và đánh giá khi phát ban, sốt, hạch to hoặc vàng da."],
    ["Garnotal 10","Phenobarbital","Theo dõi","Nguy cơ viêm gan quá mẫn, thường kèm biểu hiện toàn thân.","Theo dõi triệu chứng quá mẫn trong những tuần đầu."],
    ["Ciproven 10 mg/ml","Ciprofloxacin","Theo dõi","DILI hiếm nhưng có thể khởi phát nhanh và nặng.","Ngừng khi xuất hiện vàng da hoặc men gan tăng nhanh không giải thích được."],
    ["Tamisynt 500 mg","Ciprofloxacin","Theo dõi","Có thể gây tổn thương gan cấp hiếm gặp.","Theo dõi triệu chứng trong và sau đợt điều trị."],
    ["Bivelox I.V","Levofloxacin","Theo dõi","DILI hiếm nhưng có thể nặng.","Cân nhắc thuốc khác nếu từng DILI do fluoroquinolon."],
    ["Levofloxacin Kabi","Levofloxacin","Theo dõi","Có thể gây viêm gan tế bào gan hoặc hỗn hợp.","Ngừng và đánh giá khi men gan tăng kèm triệu chứng."],
    ["Ozanier 500 mg","Levofloxacin","Theo dõi","Nguy cơ hiếm, có thể xuất hiện sớm.","Theo dõi lâm sàng ở người bệnh có bệnh gan nền."],
    ["Moxifloxacin IMP 400 mg/250 ml","Moxifloxacin","Theo dõi","Có thể gây tổn thương gan cấp hiếm gặp.","Đặc biệt thận trọng ở suy gan nặng và khi có triệu chứng vàng da."],
    ["Metronidazol 0,5 g/100 ml","Metronidazol","Hiếm","Tổn thương gan do thuốc rất hiếm nhưng đã được báo cáo.","Theo dõi khi dùng kéo dài hoặc người bệnh có bệnh gan nặng."],
    ["Metronidazol 250","Metronidazol","Hiếm","Nguy cơ DILI thấp nhưng không bằng không.","Ngừng và đánh giá khi có vàng da hoặc tăng men gan rõ."],
    ["Daphazyl","Spiramycin + metronidazol","Theo dõi","Có thể ảnh hưởng chức năng gan; dữ liệu chủ yếu từ các thành phần.","Theo dõi khi dùng kéo dài hoặc có bệnh gan nền."],
    ["Nerusyn 1,5 g","Ampicillin + sulbactam","Theo dõi","Có thể gây tăng men gan hoặc ứ mật hiếm gặp.","Theo dõi chức năng gan khi điều trị kéo dài."],
    ["Unasyn","Ampicillin + sulbactam","Theo dõi","Nguy cơ tổn thương gan thấp nhưng có báo cáo.","Đánh giá khi có vàng da hoặc ngứa."],
    ["Medivernol 1 g","Ceftriaxon","Theo dõi","Có thể gây bùn mật, ứ mật hoặc tăng men gan.","Theo dõi đau hạ sườn phải, bilirubin và siêu âm khi nghi ngờ."],
    ["Cefoperazone 1000","Cefoperazon","Theo dõi","Có thể tăng men gan; nguy cơ tích lũy tăng ở bệnh gan/tắc mật.","Theo dõi chức năng gan và INR ở người bệnh nguy cơ."],
    ["Agilecox 200","Celecoxib","Hiếm","DILI hiếm gặp.","Ngừng khi có triệu chứng gan hoặc tăng men gan đáng kể."],
    ["Ibupain","Ibuprofen","Hiếm","Tổn thương gan hiếm.","Theo dõi ở người bệnh dùng kéo dài hoặc phối hợp nhiều thuốc độc gan."],
    ["Ibuprofen S DWP 150 mg","Ibuprofen","Hiếm","Nguy cơ DILI thấp.","Theo dõi theo triệu chứng."],
    ["Ketoprofen EC DWP 100 mg","Ketoprofen","Hiếm","Có thể tăng men gan hoặc DILI hiếm.","Hạn chế phối hợp nhiều NSAID."],
    ["Ketorolac-BFS","Ketorolac","Hiếm","Tổn thương gan hiếm, thường nhẹ.","Theo dõi nếu dùng ở người bệnh có bệnh gan nền."],
    ["Aspirin tab DWP 100 mg","Acetylsalicylic acid","Hiếm","Độc tính gan chủ yếu liên quan liều cao hơn liều chống kết tập tiểu cầu.","Rà soát liều và bệnh gan nền."],
    ["Endoxan 200 mg","Cyclophosphamid","Hóa trị","Có thể gây tăng men gan; hiếm gặp tổn thương gan nặng hoặc tắc nghẽn xoang.","Theo dõi chức năng gan theo phác đồ hóa trị."],
    ["Doxorubicin Bidiphar 50","Doxorubicin","Hóa trị","Có thể gây tăng men gan; cần hiệu chỉnh trong suy gan.","Đánh giá bilirubin và men gan trước chu kỳ."],
    ["Doxorubicin DV-26","Doxorubicin","Hóa trị","Nguy cơ tăng phơi nhiễm khi suy gan.","Hiệu chỉnh liều theo phác đồ và chức năng gan."],
    ["Epirubicin Bidiphar 50","Epirubicin","Hóa trị","Thải trừ qua gan; độc tính tăng khi suy gan.","Kiểm tra bilirubin, AST/ALT trước điều trị."],
    ["Bestdocel 80 mg/4 ml","Docetaxel","Hóa trị","Độc tính tăng rõ khi chức năng gan bất thường.","Không dùng hoặc hiệu chỉnh theo tiêu chuẩn phác đồ khi men gan/bilirubin tăng."],
    ["Canpaxel 250","Paclitaxel","Hóa trị","Có thể tăng men gan; cần hiệu chỉnh khi suy gan.","Theo dõi trước mỗi chu kỳ."],
    ["Paclitaxel Ebewe","Paclitaxel","Hóa trị","Phơi nhiễm và độc tính tăng khi suy gan.","Hiệu chỉnh theo bilirubin và transaminase."],
    ["Kpec 500","Capecitabin","Hóa trị","Có thể tăng bilirubin và men gan.","Theo dõi chức năng gan định kỳ."],
    ["Lyoxatin 50/100 mg","Oxaliplatin","Hóa trị","Có liên quan tổn thương xoang gan và tăng áp cửa không do xơ gan.","Theo dõi tiểu cầu, lách to, men gan và dấu hiệu tăng áp cửa."],
    ["Oxaliplatin Ebewe","Oxaliplatin","Hóa trị","Nguy cơ tổn thương xoang gan khi điều trị tích lũy.","Theo dõi theo phác đồ và dấu hiệu tăng áp cửa."],
    ["Bocartin 150","Carboplatin","Hóa trị","Có thể gây tăng men gan, thường nhẹ.","Theo dõi chức năng gan trong phác đồ phối hợp."],
    ["Sevoflurane 250 ml","Sevofluran","Hiếm","Viêm gan do thuốc mê hô hấp rất hiếm.","Đánh giá nếu vàng da hoặc tăng men gan sau gây mê."],
    ["Suprane DV-26","Desfluran","Hiếm","Tổn thương gan miễn dịch rất hiếm.","Lưu ý tiền sử viêm gan do thuốc mê halogen."],
    ["Fresofol 1%","Propofol","Hiếm","Tổn thương gan hiếm; truyền liều cao kéo dài có nguy cơ hội chứng truyền propofol.","Theo dõi men gan, lactat, CK và huyết động khi truyền kéo dài."],
    ["MG-TAN INJ","Acid amin + glucose + lipid","Theo dõi","Dinh dưỡng tĩnh mạch kéo dài có thể gây gan nhiễm mỡ hoặc ứ mật.","Theo dõi AST, ALT, ALP, bilirubin và triglycerid."],
    ["Vaminolact","Acid amin + glucose + lipid","Theo dõi","Nguy cơ rối loạn chức năng gan khi nuôi dưỡng tĩnh mạch kéo dài.","Đánh giá tổng năng lượng, nhiễm trùng và thời gian nuôi dưỡng."],
    ["Smoflipid","Nhũ dịch lipid","Theo dõi","Có thể góp phần gây ứ mật hoặc tăng men gan khi dùng kéo dài.","Theo dõi triglycerid và chức năng gan."]
  ].map(([name, active, level, risk, monitor], id) => ({id:id+1,name,active,level,risk,monitor}));

  const $ = (id) => document.getElementById(id);
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

  function levelClass(level){
    if(level === "Cao") return "high";
    if(level === "Trung bình–cao") return "medium-high";
    if(level === "Hóa trị") return "chemo";
    if(level === "Theo dõi") return "monitor";
    return "rare";
  }

  function matchesLevel(item, selected){
    if(!selected) return true;
    return item.level === selected;
  }

  function render(){
    const box = $("liverList");
    if(!box) return;
    const query = norm($("liverQ")?.value);
    const selected = $("liverLevel")?.value || "";
    const filtered = drugs.filter(d => {
      const hay = norm([d.name,d.active,d.level,d.risk,d.monitor].join(" "));
      return (!query || hay.includes(query)) && matchesLevel(d, selected);
    });

    box.innerHTML = filtered.length ? filtered.map(d => `
      <details class="liver-item">
        <summary>
          <span class="liver-name"><b>${d.name}</b><small>${d.active}</small></span>
          <span class="liver-badge ${levelClass(d.level)}">${d.level === "Hóa trị" ? "Hóa trị – theo dõi" : d.level}</span>
        </summary>
        <div class="liver-detail">
          <div><b>Nguy cơ chính</b><p>${d.risk}</p></div>
          <div><b>Khuyến nghị theo dõi</b><p>${d.monitor}</p></div>
        </div>
      </details>`).join("") : `<div class="empty-state"><div>🔎</div><b>Không tìm thấy thuốc phù hợp</b><span>Thử tên biệt dược, hoạt chất hoặc chọn mức cảnh báo khác.</span></div>`;

    $("liverTotal").textContent = drugs.length;
    $("liverHigh").textContent = drugs.filter(d => d.level === "Cao" || d.level === "Trung bình–cao").length;
    $("liverFollow").textContent = drugs.filter(d => d.level === "Theo dõi" || d.level === "Hiếm" || d.level === "Hóa trị").length;
    if ($("liverResultCount")) $("liverResultCount").textContent = `${filtered.length} kết quả`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("liverQ")?.addEventListener("input", render);
    $("liverLevel")?.addEventListener("change", render);
    $("liverExpandAll")?.addEventListener("click", () => {
      const items = [...document.querySelectorAll("#liverList details")];
      const shouldOpen = items.some(item => !item.open);
      items.forEach(item => item.open = shouldOpen);
      $("liverExpandAll").textContent = shouldOpen ? "Thu gọn tất cả" : "Mở tất cả";
    });
    render();
  });
})();