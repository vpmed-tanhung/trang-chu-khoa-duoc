#!/usr/bin/env python3
"""Đảm bảo index.html của web chính nạp mô-đun Cảnh báo dược."""
from pathlib import Path
import sys

index_path = Path(sys.argv[1] if len(sys.argv) > 1 else "index.html")
if not index_path.exists():
    raise SystemExit(f"Không tìm thấy {index_path}")

text = index_path.read_text(encoding="utf-8")
src = "assets/pharmacovigilance_integration.js"
tag = '  <script src="assets/pharmacovigilance_integration.js?v=20260711"></script>'

if src in text:
    print("index.html đã nạp mô-đun Cảnh báo dược.")
    raise SystemExit(0)

lower = text.lower()
pos = lower.rfind("</body>")
if pos < 0:
    raise SystemExit("Không tìm thấy thẻ </body> trong index.html")

updated = text[:pos] + tag + "\n" + text[pos:]
index_path.write_text(updated, encoding="utf-8")
print("Đã thêm mô-đun Cảnh báo dược vào index.html.")
