from pathlib import Path


INDEX_PATH = Path("index.html")
CONFIG_SRC = "assets/pharmacovigilance_refresh_config.js"
BUTTON_SRC = "assets/pharmacovigilance_refresh_button.js"
CONFIG_TAG = f'<script src="{CONFIG_SRC}?v=20260713"></script>'
BUTTON_TAG = f'<script src="{BUTTON_SRC}?v=20260713"></script>'


def main() -> int:
    if not INDEX_PATH.exists():
        raise FileNotFoundError("Không tìm thấy index.html")

    html = INDEX_PATH.read_text(encoding="utf-8")
    changed = False

    # Xóa thẻ phiên bản cũ để tránh trình duyệt giữ cache.
    lines = []
    for line in html.splitlines():
        if CONFIG_SRC in line or BUTTON_SRC in line:
            changed = True
            continue
        lines.append(line)
    html = "\n".join(lines)

    marker = "</body>"
    if marker not in html:
        raise RuntimeError("Không tìm thấy thẻ </body> trong index.html")

    block = f"  {CONFIG_TAG}\n  {BUTTON_TAG}\n"
    html = html.replace(marker, block + marker, 1)
    changed = True

    if changed:
        INDEX_PATH.write_text(html + ("\n" if not html.endswith("\n") else ""), encoding="utf-8")
        print("Đã gắn cấu hình và mô-đun nút cập nhật vào index.html.")
    else:
        print("index.html đã có mô-đun cập nhật.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
