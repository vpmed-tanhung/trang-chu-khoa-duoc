#!/usr/bin/env python3
from pathlib import Path
import re
p=Path('index.html')
if not p.exists(): raise SystemExit('Không tìm thấy index.html')
s=p.read_text(encoding='utf-8')
# Xóa mọi dòng nạp bản tích hợp cảnh báo dược cũ, sau đó thêm đúng một dòng bản mới.
s=re.sub(r'\s*<script[^>]+src=["\']assets/pharmacovigilance_integration\.js[^"\']*["\'][^>]*></script>\s*','\n',s,flags=re.I)
tag='  <script src="assets/pharmacovigilance_integration.js?v=20260711-exact-file"></script>\n'
pos=s.lower().rfind('</body>')
if pos<0: raise SystemExit('Không tìm thấy </body>')
s=s[:pos]+tag+s[pos:]
p.write_text(s,encoding='utf-8')
print('Đã gắn đúng giao diện nguyên bản vào web chính.')
