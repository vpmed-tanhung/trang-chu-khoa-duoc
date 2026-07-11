#!/usr/bin/env python3
from pathlib import Path

index = Path('index.html')
if not index.exists():
    raise SystemExit('Không tìm thấy index.html ở thư mục gốc repository.')

text = index.read_text(encoding='utf-8')
marker = 'assets/pharmacovigilance_integration.js'
tag = '  <script src="assets/pharmacovigilance_integration.js?v=20260711"></script>\n'

if marker in text:
    print('index.html đã có mô-đun Cảnh báo dược.')
    raise SystemExit(0)

if '</body>' not in text:
    raise SystemExit('Không tìm thấy thẻ </body> trong index.html.')

index.write_text(text.replace('</body>', tag + '</body>', 1), encoding='utf-8')
print('Đã gắn mô-đun Cảnh báo dược vào index.html.')
