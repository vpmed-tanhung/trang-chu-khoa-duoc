from pathlib import Path


INDEX_PATH = Path("index.html")
SCRIPT_SRC = "assets/pharmacovigilance_refresh_button.js"
SCRIPT_TAG = f'<script src="{SCRIPT_SRC}?v=20260712"></script>'


def main() -> int:
    if not INDEX_PATH.exists():
        raise FileNotFoundError("Không tìm thấy index.html")

    html = INDEX_PATH.read_text(encoding="utf-8")

    if SCRIPT_SRC in html:
        print("index.html đã có mô-đun nút cập nhật.")
        return 0

    marker = "</body>"
    if marker not in html:
        raise RuntimeError("Không tìm thấy thẻ </body> trong index.html")

    html = html.replace(marker, f"  {SCRIPT_TAG}\n{marker}", 1)
    INDEX_PATH.write_text(html, encoding="utf-8")
    print("Đã gắn mô-đun nút cập nhật vào index.html.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
