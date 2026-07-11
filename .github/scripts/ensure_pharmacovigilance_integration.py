#!/usr/bin/env python3
from pathlib import Path
import re, sys
p=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
if not p.exists(): raise SystemExit(f'Không tìm thấy {p}')
text=p.read_text(encoding='utf-8')
# Remove any old pharmacovigilance stylesheet link; the exact UI is isolated inside Shadow DOM.
text=re.sub(r'\s*<link[^>]+pharmacovigilance\.css[^>]*>\s*', '\n', text, flags=re.I)
new_tag='  <script src="assets/pharmacovigilance_integration.js?v=20260711-exact42"></script>'
pat=r'<script\s+src=["\']assets/pharmacovigilance_integration\.js(?:\?[^"\']*)?["\']\s*></script>'
if re.search(pat,text,flags=re.I):
    text=re.sub(pat,new_tag,text,count=1,flags=re.I)
else:
    pos=text.lower().rfind('</body>')
    if pos<0: raise SystemExit('Không tìm thấy </body>')
    text=text[:pos]+new_tag+'\n'+text[pos:]
p.write_text(text,encoding='utf-8')
print('Đã gắn giao diện Cảnh báo dược bản đẹp, đủ 42 cảnh báo.')
