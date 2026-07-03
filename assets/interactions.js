const D=window.VPMED_DRUGS||[],I=window.VPMED_INTERACTIONS||[];
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

const aliases={};
D.forEach(x=>{
  aliases[norm(x.brand)]=x.active;
  aliases[norm(x.active)]=x.active;
});
const canonical=v=>aliases[norm(v)]||String(v||'').trim();
const interactionDrugNames=x=>[x.drug1||'',x.drug2||''];
function flexibleMatch(input,target){
  const a=norm(canonical(input)),b=norm(canonical(target));
  if(!a||!b)return false;
  return a===b||a.includes(b)||b.includes(a);
}
function matchPair(a,b,i){
  const d1=i.drug1||'',d2=i.drug2||'';
  return (flexibleMatch(a,d1)&&flexibleMatch(b,d2))||(flexibleMatch(a,d2)&&flexibleMatch(b,d1));
}
const meds=[...new Set([
  ...D.flatMap(x=>[x.brand,x.active]),
  ...I.flatMap(x=>interactionDrugNames(x))
].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
$('#meds').innerHTML=meds.map(x=>`<option value="${esc(x)}">`).join('');
$('#icount').textContent=I.length;
$('#mcount').textContent=new Set(I.flatMap(x=>interactionDrugNames(x).map(norm))).size;

function intCard(x){
  const levelClass=x.conditional?'conditional':'contra';
  return `<div class="int">
    <div class="int-title">
      <b><span class="int-stt">#${esc(x.stt||'')}</span> ${esc(x.drug1||'')} + ${esc(x.drug2||'')}</b>
      <span class="interaction-level ${levelClass}">${esc(x.level)}</span>
      <span class="hint">Xem chi tiết →</span>
    </div>
    <div class="detail">
      <p><b>Cơ chế:</b> ${esc(x.mechanism)}</p>
      <p><b>Hậu quả:</b> ${esc(x.consequence)}</p>
      <p><b>Xử trí:</b> ${esc(x.management)}</p>
      <p><b>Nguồn:</b> ${esc(x.source)}</p>
    </div>
  </div>`;
}
function attachInt(){$$('.int').forEach(e=>e.onclick=()=>e.classList.toggle('open'))}
function renderInteractions(){
  const q=norm($('#iq').value);
  const f=I.filter(x=>!q||norm([
    x.stt,x.drug1,x.drug2,x.level,x.mechanism,x.consequence,x.management,x.source
  ].join(' ')).includes(q));
  $('#ilist').innerHTML=f.map(intCard).join('')||'<div class="alert">Không có kết quả.</div>';
  attachInt();
}
$('#iq').oninput=renderInteractions;
renderInteractions();
$('#swap').onclick=()=>{const t=$('#a').value;$('#a').value=$('#b').value;$('#b').value=t};
$('#check').onclick=()=>{
  const a=$('#a').value,b=$('#b').value;
  if(!a||!b){$('#result').innerHTML='Vui lòng nhập đủ hai thuốc.';return}
  const m=I.filter(x=>matchPair(a,b,x));
  $('#result').innerHTML=m.length
    ?m.map(intCard).join('')
    :'<b>Không tìm thấy cặp này trong Bảng 3.1 của Quyết định 5948/QĐ-BYT.</b><br>Điều này không khẳng định phối hợp an toàn; cần tiếp tục kiểm tra tờ hướng dẫn sử dụng và nguồn chuyên môn hiện hành.';
  attachInt();
};
