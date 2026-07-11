#!/usr/bin/env python3
from pathlib import Path
p=Path("index.html")
if not p.exists(): raise SystemExit("Không tìm thấy index.html ở thư mục gốc.")
s=p.read_text(encoding="utf-8")
# Xóa các bản nạp cũ để không chạy hai giao diện.
import re
s=re.sub(r'\s*<script[^>]+src=["\']assets/pharmacovigilance_integration\.js[^>]*></script>\s*','\n',s,flags=re.I)
tag='  <script src="assets/pharmacovigilance_integration.js?v=20260711c"></script>\n'
pos=s.lower().rfind('</body>')
if pos<0: raise SystemExit("Không tìm thấy </body> trong index.html")
s=s[:pos]+tag+s[pos:]
p.write_text(s,encoding="utf-8")
print("Đã gắn bản Cảnh báo dược giao diện đẹp 42 cảnh báo vào index.html.")
