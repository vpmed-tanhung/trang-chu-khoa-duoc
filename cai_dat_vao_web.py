#!/usr/bin/env python3
"""Tích hợp mô-đun Cảnh báo dược vào trang chủ VPMED, không sửa các ứng dụng khác."""
from __future__ import annotations

import shutil
import sys
from datetime import datetime
from pathlib import Path

TITLE = "Cảnh báo dược về sử dụng thuốc"
MODULE_REL = "canh-bao-duoc/index.html"
CARD = (
    '<a class="feature-card pharmacovigilance-feature" href="canh-bao-duoc/index.html">'
    '<span class="feature-icon">🛡️</span><b>Cảnh báo dược về sử dụng thuốc</b>'
    '<small>Tra cứu cảnh báo ADR, tương tác, thuốc nguy cơ cao, sai sót sử dụng, '
    'theo dõi xét nghiệm và biện pháp giảm thiểu nguy cơ.</small>'
    '<em>Cập nhật 11/07/2026</em></a>'
)
HERO_ITEM = (
    '<li><strong>Cảnh báo dược về sử dụng thuốc:</strong> Tra cứu cảnh báo ADR, '
    'tương tác, thuốc nguy cơ cao và biện pháp giảm thiểu nguy cơ.</li>'
)
SOURCE_MARKER = '<button class="feature-card" data-open="sources" data-intro-exclude="true">'


def find_repo(arg: str | None) -> Path:
    script_dir = Path(__file__).resolve().parent
    candidates = []
    if arg:
        candidates.append(Path(arg).expanduser())
    candidates.extend([Path.cwd(), script_dir, script_dir.parent])
    for candidate in candidates:
        candidate = candidate.resolve()
        if candidate.is_file() and candidate.name.lower() == "index.html":
            return candidate.parent
        if (candidate / "index.html").is_file():
            return candidate
    raise FileNotFoundError(
        "Không tìm thấy index.html. Hãy đặt bộ cài vào thư mục gốc của repo "
        "trang-chu-khoa-duoc hoặc truyền đường dẫn thư mục repo khi chạy."
    )


def insert_before_line(text: str, marker: str, new_line: str) -> tuple[str, bool]:
    pos = text.find(marker)
    if pos < 0:
        return text, False
    line_start = text.rfind("\n", 0, pos) + 1
    indent = text[line_start:pos]
    eol = "\r\n" if "\r\n" in text else "\n"
    return text[:line_start] + indent + new_line + eol + text[line_start:], True


def add_hero_item(text: str) -> tuple[str, bool]:
    if HERO_ITEM in text or f"<strong>{TITLE}:" in text:
        return text, False
    start = text.find('id="heroFeatureList"')
    if start < 0:
        return text, False
    close = text.find("</ul>", start)
    if close < 0:
        return text, False
    line_start = text.rfind("\n", 0, close) + 1
    indent = text[line_start:close]
    eol = "\r\n" if "\r\n" in text else "\n"
    return text[:line_start] + indent + HERO_ITEM + eol + text[line_start:], True


def main() -> int:
    try:
        repo = find_repo(sys.argv[1] if len(sys.argv) > 1 else None)
    except Exception as exc:
        print(f"LỖI: {exc}")
        return 1

    script_dir = Path(__file__).resolve().parent
    source_module = script_dir / "canh-bao-duoc"
    target_module = repo / "canh-bao-duoc"
    index_path = repo / "index.html"

    if not source_module.is_dir():
        print(f"LỖI: Thiếu thư mục mô-đun: {source_module}")
        return 1

    if source_module.resolve() != target_module.resolve():
        if target_module.exists():
            shutil.rmtree(target_module)
        shutil.copytree(source_module, target_module)

    text = index_path.read_text(encoding="utf-8-sig")
    original = text

    card_added = False
    if MODULE_REL not in text:
        text, card_added = insert_before_line(text, SOURCE_MARKER, CARD)
        if not card_added:
            print("LỖI: Không tìm thấy thẻ 'Nguồn dữ liệu hệ thống' để đặt thẻ mới trước nó.")
            return 1

    text, hero_added = add_hero_item(text)

    if text != original:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup = repo / f"index.backup_truoc_canh_bao_duoc_{stamp}.html"
        shutil.copy2(index_path, backup)
        index_path.write_text(text, encoding="utf-8", newline="")
        print(f"ĐÃ SAO LƯU: {backup.name}")
    else:
        print("index.html đã có thẻ Cảnh báo dược; không tạo bản trùng lặp.")

    checks = {
        "module": (target_module / "index.html").is_file(),
        "card": MODULE_REL in index_path.read_text(encoding="utf-8-sig"),
    }
    if all(checks.values()):
        print("HOÀN TẤT: Đã tích hợp Cảnh báo dược vào mục Ứng dụng chính.")
        print(f"THƯ MỤC REPO: {repo}")
        print("ĐƯỜNG DẪN SAU KHI GITHUB PAGES CẬP NHẬT:")
        print("https://vpmed-tanhung.github.io/trang-chu-khoa-duoc/canh-bao-duoc/")
        return 0

    print("LỖI: Kiểm tra sau cài đặt không đạt.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
