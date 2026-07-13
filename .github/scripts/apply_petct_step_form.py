from __future__ import annotations

import re
from pathlib import Path

INDEX_PATH = Path("index.html")
SCRIPT_TAG = '<script src="assets/petct_step_form.js?v=20260713"></script>'


def main() -> None:
    if not INDEX_PATH.exists():
        raise SystemExit("Không tìm thấy index.html ở thư mục gốc repository.")

    original = INDEX_PATH.read_text(encoding="utf-8")
    newline = "\r\n" if "\r\n" in original else "\n"

    # Chỉ quản lý đúng thẻ nạp giao diện PET/CT; không sửa nội dung hay dữ liệu khác.
    cleaned = re.sub(
        r"[ \t]*<script\s+src=[\"']assets/petct_step_form\.js(?:\?[^\"']*)?[\"']\s*></script>[ \t]*(?:\r?\n)?",
        "",
        original,
        flags=re.IGNORECASE,
    )

    if "</body>" not in cleaned.lower():
        raise SystemExit("index.html không có thẻ </body>; dừng để tránh sửa sai cấu trúc.")

    match = re.search(r"</body>", cleaned, flags=re.IGNORECASE)
    assert match is not None
    updated = cleaned[: match.start()] + f"  {SCRIPT_TAG}{newline}" + cleaned[match.start() :]

    if updated == original:
        print("Form PET/CT theo bước đã được nạp; không cần thay đổi.")
        return

    INDEX_PATH.write_text(updated, encoding="utf-8", newline="")
    print("Đã thêm đúng 1 thẻ script vào index.html. Không thay đổi dữ liệu hoặc công thức tính.")


if __name__ == "__main__":
    main()
