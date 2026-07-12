from __future__ import annotations

import hashlib
import json
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


LIST_URL = "https://canhgiacduoc.org.vn/CanhGiacDuoc/DiemTinCGD.aspx"
BASE_URL = "https://canhgiacduoc.org.vn/"
OUTPUT_PATH = Path("assets/pharmacovigilance_auto.json")
STATIC_PATH = Path("assets/pharmacovigilance_alerts.json")
MAX_ITEMS = 30
DETAIL_LINK_RE = re.compile(r"/CanhGiacDuoc/DiemTin/\d+/", re.IGNORECASE)
DATE_RE = re.compile(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b")


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def normalize_key(value: str) -> str:
    text = unicodedata.normalize("NFD", clean_text(value))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def make_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=3,
        connect=3,
        read=3,
        backoff_factor=1,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (compatible; VPMED-Pharmacovigilance-Updater/1.0; "
                "+https://vpmed-tanhung.github.io/trang-chu-khoa-duoc/)"
            ),
            "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.7",
        }
    )
    return session


def fetch_html(session: requests.Session, url: str) -> str:
    response = session.get(url, timeout=40)
    response.raise_for_status()
    if not response.encoding or response.encoding.lower() == "iso-8859-1":
        response.encoding = response.apparent_encoding or "utf-8"
    return response.text


def extract_listing(html: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    items: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    for anchor in soup.find_all("a", href=True):
        title = clean_text(anchor.get_text(" ", strip=True))
        url = urljoin(BASE_URL, anchor["href"])

        if not DETAIL_LINK_RE.search(url):
            continue
        if not title or title.casefold() in {"xem tiếp", "xem tiếp >>"}:
            continue
        if url in seen_urls:
            continue

        seen_urls.add(url)
        items.append({"title": title, "url": url})
        if len(items) >= MAX_ITEMS:
            break

    return items


def extract_detail(html: str, fallback_title: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    page_text = soup.get_text("\n", strip=True)
    lines = [clean_text(line) for line in page_text.splitlines() if clean_text(line)]

    date_text = ""
    date_match = DATE_RE.search(page_text)
    if date_match:
        day, month, year = map(int, date_match.groups())
        date_text = f"{day:02d}/{month:02d}/{year:04d}"

    start_index = 0
    target_key = normalize_key(fallback_title)
    for index, line in enumerate(lines):
        if target_key and target_key in normalize_key(line):
            start_index = index + 1
            break

    excluded_prefixes = (
        "trang chủ",
        "giới thiệu",
        "cảnh giác dược",
        "tiện ích",
        "lịch công tác",
        "các tin liên quan",
        "bản quyền",
        "địa chỉ:",
        "điện thoại:",
        "điểm tin:",
        "hiệu đính:",
        "phụ trách:",
    )

    body_lines: list[str] = []
    for line in lines[start_index:]:
        lower = line.casefold()

        if lower.startswith("nguồn:") or lower.startswith("các tin liên quan"):
            break
        if DATE_RE.fullmatch(line):
            continue
        if any(lower.startswith(prefix) for prefix in excluded_prefixes):
            continue
        if len(line) < 45:
            continue

        body_lines.append(line)
        if len(body_lines) >= 4:
            break

    summary = clean_text(" ".join(body_lines[:2]))
    if not summary:
        summary = f"Bản tin mới: {fallback_title}."
    if len(summary) > 650:
        summary = summary[:647].rstrip() + "…"

    return {
        "date": date_text,
        "summary": summary,
    }


def load_static_keys() -> tuple[set[str], set[str]]:
    titles: set[str] = set()
    urls: set[str] = set()

    if not STATIC_PATH.exists():
        return titles, urls

    try:
        payload = json.loads(STATIC_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return titles, urls

    records = payload if isinstance(payload, list) else payload.get("alerts", [])
    for item in records:
        if not isinstance(item, dict):
            continue
        title = normalize_key(str(item.get("title", "")))
        url = clean_text(str(item.get("url", ""))).rstrip("/").lower()
        if title:
            titles.add(title)
        if url:
            urls.add(url)

    return titles, urls


def build_alert(title: str, url: str, detail: dict[str, Any]) -> dict[str, Any]:
    date_text = detail.get("date") or ""
    date_match = DATE_RE.search(date_text)
    year = date_match.group(3) if date_match else ""

    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:14]
    interaction = "tương tác" in normalize_key(title)

    return {
        "id": f"auto-{digest}",
        "level": "green",
        "year": year,
        "date": date_text,
        "category": "Bản tin mới từ nguồn chính thức",
        "system": "Chưa phân loại",
        "interaction": interaction,
        "title": title,
        "drugs": "Mở nội dung gốc để xác định thuốc/nhóm thuốc.",
        "summary": detail.get("summary", ""),
        "quick": "Bản tin tự động, chưa biên tập chuyên môn. Dược sĩ cần đọc nguồn gốc trước khi sử dụng.",
        "risk": [],
        "signs": [],
        "action": [],
        "monitor": [],
        "source": "Trung tâm Quốc gia về Thông tin thuốc và Theo dõi phản ứng có hại của thuốc",
        "url": url,
        "auto": True,
        "reviewed": False,
    }


def main() -> int:
    session = make_session()
    listing_html = fetch_html(session, LIST_URL)
    listing = extract_listing(listing_html)

    if not listing:
        raise RuntimeError("Không tìm thấy liên kết bản tin trên trang nguồn.")

    static_titles, static_urls = load_static_keys()
    alerts: list[dict[str, Any]] = []
    errors: list[str] = []

    for item in listing:
        title = item["title"]
        url = item["url"]
        title_key = normalize_key(title)
        url_key = url.rstrip("/").lower()

        if title_key in static_titles or url_key in static_urls:
            continue

        try:
            detail_html = fetch_html(session, url)
            detail = extract_detail(detail_html, title)
            alerts.append(build_alert(title, url, detail))
        except Exception as exc:  # tiếp tục lấy các bản tin còn lại
            errors.append(f"{url}: {exc}")

    def sort_key(alert: dict[str, Any]) -> datetime:
        try:
            return datetime.strptime(alert.get("date", ""), "%d/%m/%Y")
        except ValueError:
            return datetime.min

    alerts.sort(key=sort_key, reverse=True)

    now = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh"))
    payload = {
        "generated_at": now.isoformat(timespec="seconds"),
        "source": LIST_URL,
        "review_status": (
            "Bản tin tự động chưa thay thế nội dung đã được dược sĩ biên tập. "
            "Cần mở nguồn gốc và rà soát trước khi sử dụng."
        ),
        "alerts": alerts,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Đã tạo {len(alerts)} bản tin tự động tại {OUTPUT_PATH}.")
    if errors:
        print(f"Có {len(errors)} liên kết không đọc được:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
