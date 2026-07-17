from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlsplit, urlunsplit
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


LIST_URL = "https://canhgiacduoc.org.vn/CanhGiacDuoc/DiemTinCGD.aspx"
BASE_URL = "https://canhgiacduoc.org.vn/"
OUTPUT_PATH = Path("assets/pharmacovigilance_auto.json")
OUTPUT_JS_PATH = Path("assets/pharmacovigilance_auto_data.js")
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


def normalize_source_url(value: str) -> str:
    """Chuẩn hóa đường dẫn nguồn về HTTPS để tránh liên kết HTTP và trùng bản tin."""
    url = clean_text(value)
    if not url:
        return ""

    parts = urlsplit(url)
    host = (parts.hostname or "").lower()

    if host in {"canhgiacduoc.org.vn", "www.canhgiacduoc.org.vn"}:
        netloc = parts.netloc
        if parts.port in {80, 443}:
            netloc = host
        return urlunsplit(("https", netloc, parts.path, parts.query, parts.fragment))

    return url


def smart_truncate(value: str, limit: int = 650) -> str:
    """Cắt tóm tắt tại cuối câu hoặc cuối từ, tránh đứt giữa nội dung."""
    text = clean_text(value)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)

    if not text:
        return ""
    if len(text) <= limit:
        return text if text.endswith((".", "!", "?", "…")) else text + "."

    sentences = re.split(r"(?<=[.!?…])\s+", text)
    selected: list[str] = []
    current_length = 0

    for sentence in sentences:
        sentence = clean_text(sentence)
        if not sentence:
            continue

        added = len(sentence) + (1 if selected else 0)
        if current_length + added > limit:
            break

        selected.append(sentence)
        current_length += added

    # Chỉ dùng phần cuối câu khi đủ thông tin; nếu câu đầu quá dài thì cắt theo từ.
    if selected and current_length >= min(220, limit // 2):
        result = " ".join(selected).strip()
        return result if result.endswith((".", "!", "?", "…")) else result + "."

    clipped = text[: max(1, limit - 1)].rstrip()
    last_space = clipped.rfind(" ")
    if last_space >= max(80, limit // 2):
        clipped = clipped[:last_space].rstrip()

    return clipped.rstrip(",;:") + "…"


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
        url = normalize_source_url(urljoin(BASE_URL, anchor["href"]))

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

    body_text = clean_text(" ".join(body_lines))
    summary = smart_truncate(" ".join(body_lines[:4]))
    if not summary:
        summary = f"Bản tin mới: {fallback_title}."

    return {
        "date": date_text,
        "summary": summary,
        "body": body_text,
    }


DRUG_RULES = (
    (re.compile(r"pivoxil"), "Kháng sinh chứa ester pivoxil"),
    (re.compile(r"valproat|valproic"), "Valproat (natri valproat/acid valproic)"),
    (re.compile(r"methadon"), "Methadon"),
    (re.compile(r"atorvastatin|simvastatin|clarithromycin"), "Atorvastatin; simvastatin; clarithromycin"),
    (re.compile(r"orlistat"), "Orlistat"),
    (re.compile(r"amiodaron"), "Amiodaron"),
    (re.compile(r"opioid|morphin|tramadol|oxycodon|fentanyl"), "Opioid"),
    (re.compile(r"corticosteroid|corticoid"), "Corticosteroid"),
    (re.compile(r"ssri|snri|chong tram cam"), "Thuốc chống trầm cảm SSRI/SNRI"),
    (re.compile(r"uc che men chuyen|\bace\b"), "Thuốc ức chế men chuyển ACE"),
)


def _sentences(value: str) -> list[str]:
    result: list[str] = []
    for sentence in re.split(r"(?<=[.!?…])\s+", clean_text(value)):
        sentence = smart_truncate(sentence, 230)
        if sentence and sentence not in result:
            result.append(sentence)
    return result[:12]


def _pick(sentences: list[str], pattern: str) -> list[str]:
    regex = re.compile(pattern)
    return [sentence for sentence in sentences if regex.search(normalize_key(sentence))][:4]


def auto_edit_alert(title: str, summary: str, body: str) -> dict[str, Any]:
    full_text = clean_text(f"{title}. {summary}. {body}")
    normalized = normalize_key(full_text)
    source_sentences = _sentences(body or summary or title)
    drugs = [label for pattern, label in DRUG_RULES if pattern.search(normalized)]
    drug_text = "; ".join(dict.fromkeys(drugs)) or "Thuốc/nhóm thuốc nêu trong tiêu đề và nguồn gốc"

    risk = _pick(source_sentences, r"nguy co|dac biet|tre em|tre so sinh|nguoi cao tuoi|suy than|suy gan|mang thai|tuoi sinh san|lieu cao|keo dai|phoi hop|benh nhan")
    signs = _pick(source_sentences, r"dau hieu|trieu chung|ha duong|co giat|giam y thuc|chay mau|phat ban|kho tho|phu |dau |yeu co|roi loan|ton thuong|bien co|tu vong")
    action = _pick(source_sentences, r"khuyen cao|\bcan\b|\bnen\b|tranh |ngung |dua |danh gia|ra soat|can nhac|thay the|giam lieu|huong dan|han che")
    monitor = _pick(source_sentences, r"theo doi|kiem tra|xet nghiem|giam sat|dinh luong|ecg|men gan|creatinin|duong huyet|nong do|nhan biet")

    risk = risk or [f"Ưu tiên rà soát người bệnh có yếu tố nguy cơ liên quan đến {drug_text}; đối chiếu chi tiết trong nguồn gốc."]
    signs = signs or [f"Theo dõi biểu hiện bất thường mới xuất hiện trong thời gian sử dụng {drug_text}."]
    action = action or [f"Rà soát chỉ định, liều, thời gian điều trị và thuốc dùng đồng thời trước khi tiếp tục {drug_text}."]
    monitor = monitor or ["Theo dõi đáp ứng, phản ứng có hại và các xét nghiệm liên quan theo nội dung cảnh báo gốc."]

    if re.search(r"tu vong|chong chi dinh|nghiem trong|khong hoi phuc|co giat|ngung tim|ngung ho hap", normalized):
        level = "red"
    elif re.search(r"nguy co|canh bao|ton thuong|chay mau|di tat", normalized):
        level = "orange"
    else:
        level = "green"

    if re.search(r"tuong tac|interaction", normalized):
        category = "Tương tác thuốc"
    elif re.search(r"mang thai|thai nhi|sinh san|cho con bu", normalized):
        category = "Thai kỳ & sức khỏe sinh sản"
    elif re.search(r"tre em|tre so sinh|nhi khoa", normalized):
        category = "Đối tượng đặc biệt"
    elif re.search(r"qua lieu|ngo doc", normalized):
        category = "Quá liều & thuốc nguy cơ cao"
    else:
        category = "Cảnh báo an toàn thuốc"

    systems: list[str] = []
    for pattern, label in (
        (r"tim|qt|nhip|huyet ap|mach", "Tim mạch"),
        (r"than kinh|co giat|y thuc|tam than|dong kinh", "Thần kinh"),
        (r"\bgan\b|men gan|\bmat\b|duong mat", "Gan mật"),
        (r"suy than|creatinin|tieu co van", "Thận"),
        (r"ha duong huyet|carnitin|noi tiet|chuyen hoa", "Chuyển hóa"),
        (r"tre em|tre so sinh|nhi khoa", "Nhi khoa"),
        (r"mang thai|thai nhi|sinh san", "Sản khoa"),
    ):
        if re.search(pattern, normalized):
            systems.append(label)

    return {
        "level": level,
        "category": category,
        "system": " · ".join(dict.fromkeys(systems)) or "Toàn thân",
        "interaction": bool(re.search(r"tuong tac|interaction", normalized)),
        "drugs": drug_text,
        "quick": smart_truncate(action[0], 260),
        "risk": risk,
        "signs": signs,
        "action": action,
        "monitor": monitor,
        "autoEdited": True,
        "editorialStatus": "auto-edited",
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
        url = normalize_source_url(str(item.get("url", ""))).rstrip("/").lower()
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
    title_key = normalize_key(title)
    interaction = "tuong tac" in title_key or "interaction" in title_key

    editorial = auto_edit_alert(title, detail.get("summary", ""), detail.get("body", ""))
    return {
        "id": f"auto-{digest}",
        "level": editorial["level"],
        "year": year,
        "date": date_text,
        "category": editorial["category"],
        "system": editorial["system"],
        "interaction": editorial["interaction"] or interaction,
        "title": title,
        "drugs": editorial["drugs"],
        "summary": detail.get("summary", ""),
        "quick": editorial["quick"],
        "risk": editorial["risk"],
        "signs": editorial["signs"],
        "action": editorial["action"],
        "monitor": editorial["monitor"],
        "source": "Trung tâm Quốc gia về Thông tin thuốc và Theo dõi phản ứng có hại của thuốc",
        "url": normalize_source_url(url),
        "auto": True,
        "reviewed": False,
        "autoEdited": True,
        "editorialStatus": "auto-edited",
    }


def existing_check_is_fresh(now: datetime) -> bool:
    if not OUTPUT_PATH.exists():
        return False
    try:
        payload = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
        generated_at = str(payload.get("generated_at", "")).strip()
        if not generated_at:
            return False
        checked = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
        if checked.tzinfo is None:
            checked = checked.replace(tzinfo=ZoneInfo("Asia/Ho_Chi_Minh"))
        return checked.astimezone(ZoneInfo("Asia/Ho_Chi_Minh")).date() == now.date()
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return False


def write_payload(payload: dict[str, Any]) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    OUTPUT_JS_PATH.write_text(
        "window.VPMED_PHARMACOVIGILANCE_AUTO_DATA = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )


def main(skip_if_fresh: bool = False) -> int:
    now = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh"))
    if skip_if_fresh and existing_check_is_fresh(now):
        print("Dữ liệu đã được kiểm tra trong ngày hôm nay; bỏ qua lượt chạy dự phòng.")
        return 0
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
        url = normalize_source_url(item["url"])
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

    payload = {
        "generated_at": now.isoformat(timespec="seconds"),
        "source": LIST_URL,
        "review_status": (
            "Bản tin mới được tự động trích xuất và biên tập theo cấu trúc cảnh báo. "
            "Cần mở nguồn gốc để kiểm chứng trước khi áp dụng lâm sàng."
        ),
        "alerts": alerts,
    }

    write_payload(payload)

    print(f"Đã tạo {len(alerts)} bản tin tự động tại {OUTPUT_PATH} và {OUTPUT_JS_PATH}.")
    if errors:
        print(f"Có {len(errors)} liên kết không đọc được:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cập nhật dữ liệu cảnh báo dược tự động.")
    parser.add_argument(
        "--skip-if-fresh",
        action="store_true",
        help="Bỏ qua nếu dữ liệu đã được kiểm tra trong ngày hiện tại.",
    )
    args = parser.parse_args()
    raise SystemExit(main(skip_if_fresh=args.skip_if_fresh))
