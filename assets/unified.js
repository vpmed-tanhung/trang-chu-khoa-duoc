const D=window.VPMED_DRUGS||[],I=window.VPMED_INTERACTIONS||[];
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
function showView(name){$$('.view').forEach(v=>v.classList.remove('active'));$('#view-'+name)?.classList.add('active');$$('.main-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===name));history.replaceState(null,'','#'+name);$('#mainNav').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'})}
$$('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));$$('[data-open]').forEach(b=>b.onclick=()=>showView(b.dataset.open));$$('[data-go]').forEach(b=>b.onclick=e=>{e.preventDefault();showView(b.dataset.go)});$('#menuBtn').onclick=()=>$('#mainNav').classList.toggle('open');
const initial=location.hash.replace('#','');if(['home','dose','antibiotics','interactions','sources'].includes(initial))showView(initial);
$('#statDrugs').textContent=D.length;$('#statInteractions').textContent=I.length;

// Antibiotics
let selected=D[0]?.id;
function groups(){const g=[...new Set(D.map(x=>x.group).filter(Boolean))].sort();$('#group').innerHTML='<option value="">Tất cả nhóm</option>'+g.map(x=>`<option>${esc(x)}</option>`).join('')}
function filtered(){const q=norm($('#q').value),g=$('#group').value;return D.filter(x=>(!g||x.group===g)&&(!q||norm([x.brand,x.active,x.group,x.strength,x.route].join(' ')).includes(q)))}
function renderDrugList(){const f=filtered();$('#drugList').innerHTML=f.map(x=>`<div class="drug-item ${x.id===selected?'active':''}" data-id="${x.id}"><b>${esc(x.brand)}</b><small>${esc(x.active)}</small><small>${esc(x.strength)} · ${esc(x.route)}</small></div>`).join('')||'<div class="alert">Không tìm thấy thuốc phù hợp.</div>';$$('.drug-item').forEach(e=>e.onclick=()=>{selected=+e.dataset.id;renderDrugList();renderProfile()})}
const ul=a=>`<ul>${(a||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
const sourceHtml=a=>`<div class="source-list">${(a||[]).map(x=>`<div class="source-line"><b>${esc(x.title)}</b><br><small>${esc(x.note)}</small>${x.url?`<br><a href="${esc(x.url)}" target="_blank" rel="noopener">Mở nguồn ↗</a>`:''}</div>`).join('')}</div>`;

function drugInteractionMatches(d){
  const raw=norm(String(d.active||'').replace(/\*/g,'').replace(/hydrochloride/g,'').replace(/acid clavulanic|acid clavulanic/g,'clavulanat'));
  const keys=raw.split(/\s+\+\s+/).map(x=>x.trim()).filter(x=>x.length>3);
  const brand=norm(d.brand||'');
  return I.filter(i=>{const z=norm(i.name||'');return keys.some(k=>z.includes(k)||k.includes(z))||z.includes(brand)});
}
function conciseDDI(d,limit=4){
  const found=drugInteractionMatches(d);
  const fromList=found.slice(0,limit).map(i=>`${i.name}: ${i.management||i.consequence||'Cần kiểm tra và xử trí theo nguồn.'}`);
  return fromList.length?fromList:(d.clinicalDDI||[]).slice(0,limit);
}
function detailList(items){return `<ul class="clinical-list">${(items||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`}

function infusionSections(d){
  const f=d.infusionStructured;
  if(!f)return `<div class="infusion-grid"><section><h4>Hoàn nguyên</h4><p>${esc((d.infusionDetails||[d.infusion])[0]||'Chưa có dữ liệu hoàn nguyên đã xác minh.')}</p></section><section><h4>Pha loãng</h4><p>Chưa có dữ liệu pha loãng đã xác minh.</p></section><section><h4>Cách dùng / tốc độ</h4><p>${esc((d.infusionDetails||[])[1]||'Chưa có tốc độ truyền đã xác minh.')}</p></section><section><h4>Đường truyền / tương hợp</h4><p>Dùng đường riêng và súc rửa dây truyền trước, sau khi dùng.</p></section><section><h4>Ổn định sau pha</h4><p>Không lưu dung dịch sau pha khi chưa có dữ liệu ổn định cụ thể.</p></section></div>`;
  const rows=[['Hoàn nguyên',f.reconstitution],['Pha loãng',f.dilution],['Cách dùng / tốc độ',f.administration],['Đường truyền / tương hợp',f.line],['Ổn định sau pha',f.stability]];
  return `<div class="infusion-grid">${rows.map(([h,v])=>`<section><h4>${esc(h)}</h4><p>${esc(v)}</p></section>`).join('')}</div>`;
}



function calcEgfr2021(age,scrMgDl,sex){
  const female=sex==='f';
  const k=female?0.7:0.9;
  const alpha=female?-0.241:-0.302;
  const ratio=scrMgDl/k;
  return 142*Math.pow(Math.min(ratio,1),alpha)*Math.pow(Math.max(ratio,1),-1.2)*Math.pow(0.9938,age)*(female?1.012:1);
}
function calcBsaMosteller(heightCm,weightKg){
  if(!heightCm||!weightKg)return null;
  return Math.sqrt((heightCm*weightKg)/3600);
}
function egfrCategory(egfr){
  if(egfr>=90)return {key:'g1',stage:'G1',label:'Bình thường hoặc cao',tone:'preserved'};
  if(egfr>=60)return {key:'g2',stage:'G2',label:'Giảm nhẹ',tone:'mild'};
  if(egfr>=45)return {key:'g3a',stage:'G3a',label:'Giảm nhẹ đến trung bình',tone:'moderate'};
  if(egfr>=30)return {key:'g3b',stage:'G3b',label:'Giảm trung bình đến nặng',tone:'severe'};
  if(egfr>=15)return {key:'g4',stage:'G4',label:'Giảm nặng',tone:'severe'};
  return {key:'g5',stage:'G5',label:'Suy thận',tone:'critical'};
}
function egfrAlertHtml(egfr,egfrAbsolute){
  const g=egfrCategory(egfr);
  const absolute=egfrAbsolute?`<div class="egfr-absolute"><b>eGFR quy đổi theo diện tích cơ thể:</b> ${egfrAbsolute.toFixed(1)} mL/phút</div>`:'';
  return `<div class="renal-alert renal-${g.tone}"><div class="renal-alert-icon" aria-hidden="true">${g.stage}</div><div><span>Phân loại theo eGFR CKD-EPI 2021</span><strong>${g.stage} — ${esc(g.label)}</strong><p>eGFR: ${egfr.toFixed(1)} mL/phút/1,73 m².</p>${absolute}<small>Phân loại G1–G5 mô tả mức lọc cầu thận ước tính tại thời điểm xét nghiệm. Một giá trị eGFR đơn lẻ chưa đủ để chẩn đoán bệnh thận mạn. Với G1–G2, chỉ xác định bệnh thận mạn khi có dấu hiệu tổn thương thận và tình trạng kéo dài ít nhất 3 tháng; nên đánh giá thêm tỷ số albumin/creatinin niệu (ACR).</small></div></div>`;
}

function renalRiskByCrCl(crcl){
  if(crcl>=90)return {key:'preserved',label:'Chức năng thận theo CrCl còn bảo tồn',short:'Bảo tồn',warning:'Tiếp tục đối chiếu liều theo đúng thuốc và chỉ định; vẫn theo dõi creatinin khi có nguy cơ độc thận.'};
  if(crcl>=60)return {key:'mild',label:'Giảm chức năng thận mức độ nhẹ',short:'Giảm nhẹ',warning:'Rà soát thuốc cần hiệu chỉnh khi CrCl giảm; theo dõi diễn biến creatinin và lượng nước tiểu.'};
  if(crcl>=30)return {key:'moderate',label:'Giảm chức năng thận mức độ trung bình',short:'Giảm trung bình',warning:'Nhiều kháng sinh cần giảm liều hoặc kéo dài khoảng cách dùng. Hạn chế phối hợp thuốc độc thận và theo dõi sát.'};
  if(crcl>=15)return {key:'severe',label:'Giảm chức năng thận mức độ nặng',short:'Giảm nặng',warning:'Nguy cơ tích lũy và độc tính cao. Bắt buộc kiểm tra liều từng thuốc; cân nhắc hội chẩn Dược lâm sàng/Thận học.'};
  return {key:'critical',label:'Giảm chức năng thận rất nặng',short:'Rất nặng',warning:'Nguy cơ tích lũy thuốc rất cao. Đánh giá chỉ định lọc máu, tình trạng cấp hay mạn và hội chẩn chuyên khoa trước khi chốt liều.'};
}
function renalAlertHtml(crcl){
  const r=renalRiskByCrCl(crcl);
  return `<div class="renal-alert renal-${r.key}"><div class="renal-alert-icon" aria-hidden="true">${r.key==='preserved'?'✓':r.key==='mild'?'!':r.key==='moderate'?'!!':'⚠'}</div><div><span>Đánh giá chức năng thận theo CrCl</span><strong>${esc(r.label)}</strong><p>${esc(r.warning)}</p><small>Mức cảnh báo màu phản ánh mức giảm độ thanh thải creatinin ước tính và được dùng để hỗ trợ lựa chọn, hiệu chỉnh liều thuốc. CrCl không dùng để chẩn đoán hoặc phân giai đoạn bệnh thận mạn. Chẩn đoán bệnh thận mạn cần có bất thường chức năng hoặc cấu trúc thận kéo dài ít nhất 3 tháng, kết hợp eGFR và đánh giá tổn thương thận, đặc biệt albumin niệu.</small></div></div>`;
}

function ddiCards(d){
  const found=drugInteractionMatches(d);
  if(found.length)return found.map(x=>`<div class="clinical-item"><b>${esc(x.name)}</b><p><strong>Mức độ:</strong> ${esc(x.level)}</p><p><strong>Hậu quả:</strong> ${esc(x.consequence)}</p><p><strong>Cơ chế:</strong> ${esc(x.mechanism)}</p><p><strong>Xử trí:</strong> ${esc(x.management)}</p><small>Nguồn: ${esc(x.source)}</small></div>`).join('');
  return `<div class="clinical-item"><b>Các tương tác cần rà soát</b>${detailList(d.clinicalDDI||[])}<small>Chưa có cặp chống chỉ định tương ứng trong danh mục 5948 được nhập; không đồng nghĩa phối hợp an toàn.</small></div>`;
}
function renderProfile(){const x=D.find(v=>v.id===selected)||filtered()[0];if(!x){$('#profile').innerHTML='<div class="alert">Chưa có dữ liệu.</div>';return}selected=x.id;const indications=x.indicationsDetailed||x.indications||[];$('#profile').innerHTML=`<span class="kicker">STT nội trú ${x.id}</span><h2>${esc(x.brand)}</h2><p><b>Hoạt chất:</b> ${esc(x.active)}</p><div class="meta"><div class="pill"><b>Nhóm:</b> ${esc(x.group)}</div><div class="pill"><b>Hàm lượng:</b> ${esc(x.strength)}</div><div class="pill"><b>Đường dùng:</b> ${esc(x.route)}</div></div><div class="tabs">${['Tổng quan','Liều & CrCl','Pha truyền','Chống chỉ định & ADR','Tương tác','Theo dõi & TDM','Nguồn'].map((t,i)=>`<button class="tab ${i===0?'active':''}" data-tab="t${i}">${t}</button>`).join('')}</div>
<div class="tabpane active" id="t0"><div class="profile-grid"><div class="info-box"><h3>Cơ chế tác dụng</h3><p>${esc(x.mechanism)}</p><h3>Chỉ định</h3>${detailList(indications)}<div class="source-note"><b>Nguồn chỉ định:</b> ${esc(x.indicationSource||x.clinicalSourceNote||'Tờ HDSD của đúng chế phẩm.')}</div></div><div class="info-box"><h3>PK/PD</h3><p>${esc(x.pkpd)}</p><h3>Lưu ý sử dụng</h3><p>${esc(x.notes)}</p></div></div></div>
<div class="tabpane" id="t1"><div class="profile-grid"><div class="info-box"><h3>Liều người lớn tham khảo</h3><p>${esc(x.standard)}</p><h3>Hiệu chỉnh theo CrCl</h3>${ul(x.renal)}<div class="dose-source-badge"><b>Mức xác minh:</b> ${esc(x.renalVerified||'Chưa xác minh đầy đủ')}</div></div><div class="info-box"><h3>HD</h3><p>${esc(x.hd)}</p><h3>CRRT</h3><p>${esc(x.crrt)}</p></div></div></div>
<div class="tabpane" id="t2"><div class="info-box"><h3>Pha truyền</h3>${infusionSections(x)}<div class="source-note"><b>Nguồn áp dụng:</b> ${esc(x.clinicalSourceNote||'Tờ HDSD của đúng chế phẩm.')}</div></div></div>
<div class="tabpane" id="t3"><div class="profile-grid"><div class="info-box"><h3>Chống chỉ định/cảnh báo chính</h3><p>${esc(x.contra)}</p><h3>Tương tác thuốc – bệnh lý</h3>${detailList(x.diseaseInteractions||[])}</div><div class="info-box"><h3>ADR quan trọng</h3><p>${esc(x.adr)}</p><div class="source-note"><b>Lưu ý:</b> phải đối chiếu chống chỉ định đầy đủ trên tờ HDSD đúng số đăng ký của chế phẩm.</div></div></div></div>
<div class="tabpane" id="t4"><div class="profile-grid"><div class="info-box"><h3>Tương tác thuốc – thuốc</h3><div class="clinical-stack">${ddiCards(x)}</div></div><div class="info-box"><h3>Tương tác thuốc – bệnh lý</h3>${detailList(x.diseaseInteractions||[])}<button class="btn btn-primary" id="openInteractionFromDrug">Mở công cụ kiểm tra hai thuốc</button></div></div></div>
<div class="tabpane" id="t5"><div class="info-box"><h3>TDM/theo dõi</h3><p>${esc(x.tdm)}</p><p>Theo dõi chức năng thận, gan, huyết học, điện giải, ECG và độc tính đặc hiệu tùy thuốc.</p></div></div>
<div class="tabpane" id="t6"><div class="alert"><b>Ngày rà soát dữ liệu:</b> ${esc(x.reviewed||'Chưa ghi nhận')}. Liều, chỉ định, chống chỉ định và cách pha cuối cùng phải đối chiếu đúng tờ HDSD của chế phẩm và quy trình bệnh viện.</div>${sourceHtml(x.sources)}</div>`;$$('.tab').forEach(b=>b.onclick=()=>{$$('.tab,.tabpane').forEach(z=>z.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.tab).classList.add('active')});$('#openInteractionFromDrug')?.addEventListener('click',()=>{$('#a').value=x.brand;showView('interactions')})}
$('#q').oninput=()=>{renderDrugList();const f=filtered();if(f.length&&!f.some(x=>x.id===selected)){selected=f[0].id;renderProfile()}};$('#group').onchange=$('#q').oninput;groups();renderDrugList();renderProfile();

// Dose
$('#drug').innerHTML=D.map(x=>`<option value="${x.id}">${esc(x.brand)} — ${esc(x.active)}</option>`).join('');const KEY='vpmed_dose_history_v4';
function loadHist(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
function saveHist(a){localStorage.setItem(KEY,JSON.stringify(a.slice(0,100)))}
function renderHist(){const h=loadHist();$('#hist').innerHTML=h.map(x=>`<tr><td>${esc(x.time)}</td><td>${esc(x.patient)}</td><td>${esc(x.crcl)} mL/ph</td><td>${esc(x.egfr||'—')}</td><td>${esc(x.drug)}</td><td>${esc(x.advice)}</td></tr>`).join('')||'<tr><td colspan="6" style="text-align:center">Chưa có lịch sử</td></tr>'}
renderHist();$('#clear').onclick=()=>{if(confirm('Xóa toàn bộ lịch sử trên thiết bị này?')){saveHist([]);renderHist()}};
$('#exportHist').onclick=()=>{const h=loadHist();if(!h.length){alert('Chưa có lịch sử để xuất.');return}const rows=[['Thời gian','Bệnh nhân','CrCl','eGFR','Thuốc','Gợi ý'],...h.map(x=>[x.time,x.patient,x.crcl,x.egfr||'',x.drug,x.advice])];const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='lich-su-tra-cuu-khang-sinh.csv';a.click();URL.revokeObjectURL(a.href)};
$('#drug').addEventListener('change',()=>{const d=D.find(x=>String(x.id)===String($('#drug').value));$('#output').className='empty-state';$('#output').innerHTML=`<div>💊</div><b>Đã chọn ${esc(d?.brand||'kháng sinh')}</b><span>Bấm “Tính CrCl và gợi ý liều” để cập nhật đúng thuốc đang chọn.</span>`});
$('#calc').onclick=()=>{const age=+$('#age').value,wt=+$('#wt').value,ht=+$('#ht').value,scru=+$('#scr').value;if(!age||!wt||!scru){alert('Vui lòng nhập tuổi, cân nặng và creatinine.');return}const selectedId=String($('#drug').value);const d=D.find(x=>String(x.id)===selectedId);if(!d){alert('Không tìm thấy dữ liệu của kháng sinh đang chọn. Vui lòng chọn lại.');return}const scr=scru/88.4;let crcl=((140-age)*wt)/(72*scr);if($('#sex').value==='f')crcl*=.85;crcl=Math.max(0,crcl);const egfr=Math.max(0,calcEgfr2021(age,scr,$('#sex').value));const bsa=calcBsaMosteller(ht,wt);const egfrAbsolute=bsa?egfr*bsa/1.73:null;const rr=window.VPMED_GET_RENAL_DOSE?window.VPMED_GET_RENAL_DOSE(d.active,crcl):null;const chosen=rr?.hit?`${rr.hit.label}: ${rr.hit.text}`:(d.renal||[]).join(' ');const advice=$('#dialysis').checked?`HD: ${d.hd} | CRRT: ${d.crrt}`:chosen;const ddi=conciseDDI(d,3);const disease=(d.diseaseInteractions||[]).slice(0,4);$('#output').className='result-card';$('#output').innerHTML=`<span class="kicker">Kết quả đánh giá chức năng thận</span><div class="kidney-metrics"><div class="kidney-metric primary"><span>CrCl Cockcroft–Gault</span><strong>${crcl.toFixed(1)}</strong><small>mL/phút</small></div><div class="kidney-metric"><span>eGFR CKD-EPI 2021</span><strong>${egfr.toFixed(1)}</strong><small>mL/phút/1,73 m²</small></div>${egfrAbsolute?`<div class="kidney-metric"><span>eGFR không chuẩn hóa BSA</span><strong>${egfrAbsolute.toFixed(1)}</strong><small>mL/phút</small></div>`:''}</div><div class="selected-drug-banner"><span>Kháng sinh đang phân tích</span><strong>${esc(d.brand)} — ${esc(d.active)} (${esc(d.strength)})</strong></div>${renalAlertHtml(crcl)}${egfrAlertHtml(egfr,egfrAbsolute)}<div class="dose-decision"><span>Gợi ý theo CrCl của bệnh nhân</span><strong>${esc(chosen)}</strong><small>Nguồn/mức xác minh: ${esc(rr?.verified||d.renalVerified||'Chưa xác minh đầy đủ')}</small></div><div class="result-grid"><div class="info-box"><h3>Liều người lớn tham khảo</h3><p>${esc(d.standard)}</p><h3>Toàn bộ ngưỡng CrCl</h3>${ul(d.renal)}</div><div class="info-box"><h3>Pha truyền</h3>${infusionSections(d)}<h3>Tương tác thuốc – thuốc</h3>${detailList(ddi)}<h3>Tương tác thuốc – bệnh lý</h3>${detailList(disease)}<div class="source-note"><b>Nguồn:</b> ${esc(d.clinicalSourceNote||'Tờ HDSD và Quyết định 5948/QĐ-BYT.')}</div></div></div><div class="alert" style="margin-top:14px"><b>Kiểm tra an toàn:</b> CrCl Cockcroft–Gault được dùng để chọn ngưỡng liều khi nguồn của thuốc quy định theo CrCl; eGFR CKD-EPI 2021 dùng để phân loại G1–G5 và hỗ trợ đánh giá chức năng thận. Chỉ áp dụng các công thức khi creatinin tương đối ổn định. Liều cuối cùng còn phụ thuộc chỉ định, mức độ nhiễm, vi sinh/MIC, cân nặng dùng để tính liều, dạng bào chế và tờ HDSD đúng chế phẩm.</div>`;const h=loadHist();h.unshift({time:new Date().toLocaleString('vi-VN'),patient:$('#pn').value||'Không ghi tên',crcl:crcl.toFixed(1),egfr:`${egfr.toFixed(1)} (${egfrCategory(egfr).stage})`,drug:`${d.brand} — ${d.active}`,advice});saveHist(h);renderHist()};

// Interactions
const aliases={};D.forEach(x=>{aliases[norm(x.brand)]=x.active;aliases[norm(x.active)]=x.active});const parts=name=>String(name||'').split(/\s*[+\-]\s*/).map(x=>x.trim()).filter(Boolean);const canonical=v=>aliases[norm(v)]||String(v||'').trim();function matchPair(a,b,i){const p=parts(i.name).map(canonical).map(norm),x=norm(canonical(a)),y=norm(canonical(b));return p.length>=2&&(((p[0].includes(x)||x.includes(p[0]))&&(p[1].includes(y)||y.includes(p[1])))||((p[0].includes(y)||y.includes(p[0]))&&(p[1].includes(x)||x.includes(p[1]))))}
const meds=[...new Set([...D.flatMap(x=>[x.brand,x.active]),...I.flatMap(x=>parts(x.name))])].sort();$('#meds').innerHTML=meds.map(x=>`<option value="${esc(x)}">`).join('');$('#icount').textContent=I.length;$('#mcount').textContent=new Set(I.flatMap(x=>parts(x.name).map(norm))).size;
function intCard(x){return `<div class="int"><b>${esc(x.name)}</b><span class="hint">Xem chi tiết →</span><div class="detail"><p><b>Mức độ:</b> ${esc(x.level)}</p><p><b>Hậu quả:</b> ${esc(x.consequence)}</p><p><b>Cơ chế:</b> ${esc(x.mechanism)}</p><p><b>Cách xử trí:</b> ${esc(x.management)}</p><p><b>Nguồn:</b> ${esc(x.source)}</p></div></div>`}
function attachInt(){$$('.int').forEach(e=>e.onclick=()=>e.classList.toggle('open'))}
function renderInteractions(){const q=norm($('#iq').value),f=I.filter(x=>!q||norm(Object.values(x).join(' ')).includes(q));$('#ilist').innerHTML=f.map(intCard).join('')||'<div class="alert">Không có kết quả.</div>';attachInt()}
$('#iq').oninput=renderInteractions;renderInteractions();$('#swap').onclick=()=>{const t=$('#a').value;$('#a').value=$('#b').value;$('#b').value=t};$('#check').onclick=()=>{const a=$('#a').value,b=$('#b').value;if(!a||!b){$('#result').innerHTML='Vui lòng nhập đủ hai thuốc.';return}const m=I.filter(x=>matchPair(a,b,x));$('#result').innerHTML=m.length?m.map(intCard).join(''):'<b>Chưa tìm thấy cặp tương tác trong danh mục hiện có.</b><br>Không đồng nghĩa phối hợp an toàn; cần kiểm tra thêm tờ HDSD và nguồn chuyên môn.';attachInt()};
