#!/usr/bin/env python3
"""Đồng bộ điểm tin Cảnh giác Dược mới vào JSON dùng cho GitHub Pages."""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

SOURCE_URL = "https://canhgiacduoc.org.vn/CanhGiacDuoc/DiemTinCGD.aspx"
BASE_URL = "https://canhgiacduoc.org.vn"
ARTICLE_RE = re.compile(r"/CanhGiacDuoc/DiemTin/(\d+)/[^?#]+\.htm", re.I)
DATE_RE = re.compile(r"\b(\d{1,2})/(\d{1,2})/(20\d{2})\b")
UA = "VPMED-Tan-Hung-Pharmacovigilance-Monitor/1.0 (+GitHub Actions)"

RED_WORDS = ("tử vong", "phản vệ", "sốc", "hoại tử", "mất thị lực", "co giật", "quá liều", "tiêu cơ vân", "đe dọa tính mạng", "nghiêm trọng")
INTERACTION_WORDS = ("tương tác", "phối hợp", "cyp", "p-gp")
BOILERPLATE = (
    "bản quyền thuộc", "các tin liên quan", "điểm tin:", "hiệu đính:", "nguồn:",
    "trung tâm quốc gia về thông tin thuốc", "lịch công tác", "xem tiếp", "tiện ích",
)


def norm(value: str) -> str:
    value = unicodedata.normalize("NFD", value or "")
    return "".join(ch for ch in value if unicodedata.category(ch) != "Mn").lower()


def clean_text(value: str) -> str:
    value = re.sub(r"\s+", " ", value or "").strip()
    return value.replace("\x00", "")


def request(session: requests.Session, url: str, attempts: int = 3) -> requests.Response:
    last_error = None
    for attempt in range(attempts):
        try:
            response = session.get(url, timeout=35)
            response.raise_for_status()
            response.encoding = response.apparent_encoding or response.encoding or "utf-8"
            return response
        except requests.RequestException as exc:
            last_error = exc
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Không tải được {url}: {last_error}")


def article_links(session: requests.Session, pages: int) -> list[dict]:
    found: dict[str, dict] = {}
    for page in range(1, pages + 1):
        url = SOURCE_URL if page == 1 else f"{SOURCE_URL}?page={page}"
        soup = BeautifulSoup(request(session, url).text, "html.parser")
        for anchor in soup.find_all("a", href=True):
            absolute = urljoin(BASE_URL, anchor.get("href", ""))
            match = ARTICLE_RE.search(urlparse(absolute).path)
            if not match:
                continue
            title = clean_text(anchor.get_text(" ", strip=True))
            if len(title) < 12 or title.lower().startswith("xem tiếp"):
                continue
            container_text = clean_text(anchor.parent.get_text(" ", strip=True) if anchor.parent else "")
            date_match = DATE_RE.search(container_text)
            found[absolute] = {
                "article_id": match.group(1),
                "url": absolute,
                "title": title,
                "date": date_match.group(0) if date_match else "",
            }
    return sorted(found.values(), key=lambda x: int(x["article_id"]), reverse=True)


def best_content_node(soup: BeautifulSoup):
    candidates = []
    for node in soup.find_all(["article", "main", "section", "div"]):
        text = clean_text(node.get_text(" ", strip=True))
        p_count = len(node.find_all("p"))
        li_count = len(node.find_all("li"))
        if len(text) < 400:
            continue
        attrs = " ".join([str(node.get("id", "")), " ".join(node.get("class", []))]).lower()
        bonus = 1000 if any(k in attrs for k in ("detail", "content", "news", "article", "noidung")) else 0
        score = min(len(text), 12000) + p_count * 120 + li_count * 25 + bonus
        candidates.append((score, node))
    return max(candidates, key=lambda x: x[0])[1] if candidates else soup.body or soup


def extract_article(session: requests.Session, item: dict) -> dict:
    soup = BeautifulSoup(request(session, item["url"]).text, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "form", "nav", "footer", "header"]):
        tag.decompose()

    title = clean_text(item["title"])

    full_text = clean_text(soup.get_text(" ", strip=True))
    date_match = DATE_RE.search(full_text)
    date = item.get("date") or (date_match.group(0) if date_match else datetime.now().strftime("%d/%m/%Y"))

    node = best_content_node(soup)
    chunks = []
    for element in node.find_all(["p", "li"]):
        text = clean_text(element.get_text(" ", strip=True))
        low = text.lower()
        if len(text) < 45 or any(term in low for term in BOILERPLATE):
            continue
        if text == title or DATE_RE.fullmatch(text):
            continue
        if text not in chunks:
            chunks.append(text)
        if sum(len(x) for x in chunks) > 1800:
            break
    excerpt = "\n\n".join(chunks[:6])
    if not excerpt:
        excerpt = clean_text(full_text[:1200])
    summary = clean_text(" ".join(chunks[:2]))[:700] or "Điểm tin mới từ Trung tâm DI & ADR Quốc gia."

    title_n = norm(title)
    level = "red" if any(norm(w) in title_n for w in RED_WORDS) else "orange" if "nguy co" in title_n or "canh bao" in title_n else "yellow"
    interaction = any(norm(w) in title_n for w in INTERACTION_WORDS)
    if interaction:
        category = "Tương tác thuốc"
    elif "sai sot" in title_n:
        category = "Sai sót sử dụng thuốc"
    elif "thai" in title_n or "cho con bu" in title_n:
        category = "Thai kỳ & cho con bú"
    elif "chat luong" in title_n or "thu hoi" in title_n:
        category = "Cảnh báo chất lượng thuốc"
    elif "qua lieu" in title_n:
        category = "Quá liều & độc tính"
    else:
        category = "Tin cảnh giác dược mới"

    systems = []
    for keys, label in [
        (("than", "creatinin", "suy than"), "Thận"),
        (("gan", "bilirubin"), "Gan"),
        (("tim", "qt", "nhip"), "Tim mạch"),
        (("than kinh", "co giat", "tam than"), "Thần kinh"),
        (("da", "phat ban", "dress"), "Da"),
        (("thai", "so sinh"), "Sản khoa"),
        (("mau", "bach cau", "tieu cau"), "Huyết học"),
    ]:
        if any(norm(k) in norm(title + " " + summary) for k in keys):
            systems.append(label)
    system = " · ".join(systems[:3]) or "Chưa phân loại"

    subject = re.sub(r"^(ANSM|Medsafe|MHRA|FDA|WHO|EMA|PRAC|CBIP|HSA|Health Canada)\s*:\s*", "", title, flags=re.I)
    subject = clean_text(subject)[:180]
    year_match = DATE_RE.match(date)
    year = year_match.group(3) if year_match else str(datetime.now().year)

    return {
        "id": f"auto-{item['article_id']}",
        "level": level,
        "year": year,
        "date": date,
        "category": category,
        "system": system,
        "interaction": interaction,
        "title": title,
        "drugs": subject,
        "summary": summary,
        "quick": "Tin mới được đồng bộ tự động từ nguồn chính thức. Mở bài gốc và rà soát chuyên môn trước khi áp dụng cho người bệnh.",
        "risk": [],
        "signs": [],
        "action": [
            "Mở bài gốc của Trung tâm DI & ADR Quốc gia để đọc đầy đủ.",
            "Dược sĩ lâm sàng rà soát trước khi chuyển thành cảnh báo áp dụng tại bệnh viện.",
        ],
        "monitor": [],
        "source": "Trung tâm DI & ADR Quốc gia · tự động đồng bộ",
        "url": item["url"],
        "auto": True,
        "excerpt": excerpt,
        "source_article_id": item["article_id"],
        "imported_at": datetime.now(timezone.utc).isoformat(),
    }


def manual_urls(index_path: Path) -> set[str]:
    if not index_path.exists():
        return set()
    html = index_path.read_text(encoding="utf-8", errors="ignore")
    return set(re.findall(r"(?:[\"\']?url[\"\']?)\s*:\s*[\"\']([^\"\']+)[\"\']", html))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-path", default="assets/pharmacovigilance_auto.json")
    parser.add_argument("--curated-path", default="assets/pharmacovigilance_alerts.json")
    parser.add_argument("--pages", type=int, default=3)
    parser.add_argument("--max-new", type=int, default=20)
    args = parser.parse_args()

    root = Path.cwd()
    data_path = root / args.data_path
    curated_path = root / args.curated_path
    data_path.parent.mkdir(parents=True, exist_ok=True)

    if data_path.exists():
        payload = json.loads(data_path.read_text(encoding="utf-8"))
    else:
        payload = {"schema_version": 1, "source_name": "Trung tâm DI & ADR Quốc gia", "source_url": SOURCE_URL, "items": []}

    existing_items = payload.get("items") if isinstance(payload.get("items"), list) else []
    curated_urls = set()
    if curated_path.exists():
        try:
            curated_payload = json.loads(curated_path.read_text(encoding="utf-8"))
            curated_urls = {str(x.get("url")) for x in curated_payload.get("items", []) if x.get("url")}
        except (OSError, ValueError, TypeError):
            curated_urls = set()
    before_cleanup = len(existing_items)
    existing_items = [x for x in existing_items if str(x.get("url", "")) not in curated_urls]
    removed_curated = before_cleanup - len(existing_items)
    known_urls = curated_urls | {str(x.get("url")) for x in existing_items if x.get("url")}

    session = requests.Session()
    session.headers.update({"User-Agent": UA, "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.7"})

    links = article_links(session, max(1, args.pages))
    new_links = [x for x in links if x["url"] not in known_urls][: max(0, args.max_new)]
    imported = []
    failures = []
    for item in reversed(new_links):
        try:
            imported.append(extract_article(session, item))
        except Exception as exc:  # vẫn tiếp tục với các bài còn lại
            failures.append({"url": item["url"], "error": str(exc)})

    merged = existing_items + imported
    # Khử trùng theo URL, giữ bản mới nhất trong dữ liệu
    unique = {str(item.get("url")): item for item in merged if item.get("url")}

    def sort_key(entry: dict):
        match = DATE_RE.match(str(entry.get("date", "")))
        date_value = datetime(int(match.group(3)), int(match.group(2)), int(match.group(1))) if match else datetime.min
        return date_value, int(str(entry.get("source_article_id", "0") or "0"))

    items = sorted(unique.values(), key=sort_key, reverse=True)
    now = datetime.now(timezone.utc).isoformat()

    # Chỉ ghi tệp khi có bài mới, hoặc lần chạy đầu tiên để tránh tạo commit rỗng mỗi giờ.
    should_write = bool(imported) or removed_curated > 0 or not payload.get("checked_at")
    if should_write:
        payload.update({
            "schema_version": 1,
            "source_name": "Trung tâm DI & ADR Quốc gia",
            "source_url": SOURCE_URL,
            "checked_at": now,
            "last_new_at": now if imported else payload.get("last_new_at"),
            "item_count": len(items),
            "new_items_in_run": len(imported),
            "failures_in_run": failures,
            "items": items,
        })
        data_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Đã kiểm tra {len(links)} bài; thêm {len(imported)} bài mới; loại {removed_curated} bài đã được biên tập; tổng {len(items)} tin tự động.")
    if failures:
        print(f"Có {len(failures)} bài không trích xuất được.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
