#!/usr/bin/env python3

import hashlib
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

FEED_URL = os.getenv("WERSS_FEED_URL", "").strip()
AUTHORIZATION = os.getenv("WERSS_AUTHORIZATION", "").strip()
ACCOUNT_NAME = os.getenv("WECHAT_ACCOUNT_NAME", "").strip()

TARGET_FILE = Path(
    os.getenv(
        "TARGET_FILE",
        "content/pr-portfolio/wechat-articles.json"
    )
)

STATE_FILE = Path(
    os.getenv(
        "STATE_FILE",
        "content/pr-portfolio/wechat-sync-state.json"
    )
)

INITIAL_SYNC_MODE = os.getenv(
    "INITIAL_SYNC_MODE",
    "baseline"
).strip().lower()

MAX_NEW_ITEMS = int(
    os.getenv("MAX_NEW_ITEMS", "50")
)

REQUEST_TIMEOUT = int(
    os.getenv("REQUEST_TIMEOUT", "30")
)

USER_AGENT = (
    "globalviewnet-wechat-sync/1.0 "
    "(+https://github.com/krishnaxu/globalviewnet)"
)

HTML_TAG_RE = re.compile(r"<[^>]+>")

SCRIPT_STYLE_RE = re.compile(
    r"<(script|style)\b[^>]*>.*?</\1>",
    re.I | re.S
)

IMAGE_RE = re.compile(
    r'<img\b[^"\']+["\']',
    re.I
)


def utc_now():
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def fail(message):
    print("ERROR:", message, file=sys.stderr)
    raise SystemExit(1)


def load_json(path, default):
    if not path.exists():
        return default

    try:
        return json.loads(
            path.read_text(encoding="utf-8-sig")
        )
    except Exception as error:
        fail(f"无法读取 {path}: {error}")


def write_json(path, value):
    path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    temporary = path.with_suffix(
        path.suffix + ".tmp"
    )

    temporary.write_text(
        json.dumps(
            value,
            ensure_ascii=False,
            indent=2
        ) + "\n",
        encoding="utf-8"
    )

    temporary.replace(path)


def clean_text(value, limit=260):
    if value is None:
        return ""

    text = str(value)

    text = SCRIPT_STYLE_RE.sub(
        " ",
        text
    )

    text = HTML_TAG_RE.sub(
        " ",
        text
    )

    text = html.unescape(text)

    text = re.sub(
        r"\s+",
        " ",
        text
    ).strip()

    if len(text) <= limit:
        return text

    return text[:limit - 1].rstrip() + "…"


def extract_image(value):
    if not value:
        return ""

    match = IMAGE_RE.search(
        str(value)
    )

    if not match:
        return ""

    return html.unescape(
        match.group(1).strip()
    )


def normalize_date(value):
    fallback = utc_now()

    if not value:
        return fallback

    text = str(value).strip()

    if text.isdigit():
        number = float(text)

        if number > 10_000_000_000:
            number /= 1000

        try:
            return (
                datetime.fromtimestamp(
                    number,
                    timezone.utc
                )
                .replace(microsecond=0)
                .isoformat()
                .replace("+00:00", "Z")
            )
        except Exception:
            return fallback

    try:
        date = parsedate_to_datetime(text)

        if date.tzinfo is None:
            date = date.replace(
                tzinfo=timezone.utc
            )

        return (
            date.astimezone(timezone.utc)
            .replace(microsecond=0)
            .isoformat()
            .replace("+00:00", "Z")
        )
    except Exception:
        pass

    try:
        date = datetime.fromisoformat(
            text.replace("Z", "+00:00")
        )

        if date.tzinfo is None:
            date = date.replace(
                tzinfo=timezone.utc
            )

        return (
            date.astimezone(timezone.utc)
            .replace(microsecond=0)
            .isoformat()
            .replace("+00:00", "Z")
        )
    except Exception:
        return fallback


def canonical_url(value):
    if not value:
        return ""

    try:
        parsed = urllib.parse.urlsplit(
            value.strip()
        )
    except Exception:
        return value.strip()

    if parsed.scheme not in ("http", "https"):
        return value.strip()

    hostname = parsed.netloc.lower()

    query_pairs = urllib.parse.parse_qsl(
        parsed.query,
        keep_blank_values=True
    )

    if hostname.endswith(
        "mp.weixin.qq.com"
    ):
        if parsed.path.startswith("/s/"):
            query_pairs = []
        else:
            allowed = {
                "__biz",
                "mid",
                "idx",
                "sn"
            }

            query_pairs = [
                pair
                for pair in query_pairs
                if pair[0] in allowed
            ]
    else:
        query_pairs = [
            pair
            for pair in query_pairs
            if not pair[0].lower().startswith(
                "utm_"
            )
        ]

    query_pairs.sort()

    return urllib.parse.urlunsplit(
        (
            parsed.scheme.lower(),
            hostname,
            parsed.path.rstrip("/") or "/",
            urllib.parse.urlencode(
                query_pairs
            ),
            ""
        )
    )


def fetch_feed():
    if not FEED_URL:
        fail(
            "缺少 WERSS_FEED_URL。"
            "请先在 GitHub Actions Secrets 中配置。"
        )

    parsed = urllib.parse.urlsplit(
        FEED_URL
    )

    if (
        parsed.scheme not in ("http", "https")
        or not parsed.netloc
    ):
        fail(
            "WERSS_FEED_URL 必须是完整的 "
            "http:// 或 https:// 地址。"
        )

    headers = {
        "Accept": (
            "application/feed+json,"
            "application/json,"
            "application/rss+xml,"
            "application/atom+xml,"
            "application/xml,"
            "text/xml"
        ),
        "User-Agent": USER_AGENT
    }

    if AUTHORIZATION:
        headers["Authorization"] = (
            AUTHORIZATION
        )

    request = urllib.request.Request(
        FEED_URL,
        headers=headers
    )

    with urllib.request.urlopen(
        request,
        timeout=REQUEST_TIMEOUT
    ) as response:
        body = response.read(
            10 * 1024 * 1024
        )

        content_type = (
            response.headers.get(
                "Content-Type",
                ""
            )
        )

        return body, content_type


def first_value(mapping, names):
    lowered = {
        str(key).lower(): value
        for key, value in mapping.items()
    }

    for name in names:
        value = lowered.get(
            name.lower()
        )

        if value not in (
            None,
            "",
            [],
            {}
        ):
            return value

    return ""


def find_json_items(payload):
    if isinstance(payload, list):
        return [
            item
            for item in payload
            if isinstance(item, dict)
        ]

    if not isinstance(payload, dict):
        return []

    for key in (
        "items",
        "articles",
        "entries",
        "records",
        "list"
    ):
        value = payload.get(key)

        if isinstance(value, list):
            return [
                item
                for item in value
                if isinstance(item, dict)
            ]

    data = payload.get("data")

    if isinstance(data, (dict, list)):
        return find_json_items(data)

    return []


def normalize_json_item(item):
    content = first_value(
        item,
        (
            "content_html",
            "content_text",
            "content",
            "description",
            "summary",
            "digest",
            "excerpt"
        )
    )

    summary = first_value(
        item,
        (
            "summary",
            "description",
            "digest",
            "excerpt"
        )
    ) or content

    image = first_value(
        item,
        (
            "image",
            "banner_image",
            "thumbnail",
            "cover_url",
            "coverUrl",
            "cover",
            "pic_url"
        )
    )

    if isinstance(image, dict):
        image = first_value(
            image,
            (
                "url",
                "src",
                "href"
            )
        )

    if not image:
        image = extract_image(content)

    url = first_value(
        item,
        (
            "external_url",
            "externalUrl",
            "original_url",
            "url",
            "link",
            "article_url",
            "articleUrl",
            "href"
        )
    )

    raw_id = first_value(
        item,
        (
            "id",
            "guid",
            "article_id",
            "articleId",
            "uuid"
        )
    )

    published = first_value(
        item,
        (
            "date_published",
            "date_modified",
            "published",
            "pubDate",
            "publish_time",
            "publishTime",
            "created_at",
            "timestamp"
        )
    )

    author = first_value(
        item,
        (
            "author",
            "creator",
            "account_name",
            "accountName"
        )
    )

    if isinstance(author, dict):
        author = first_value(
            author,
            (
                "name",
                "title",
                "display_name"
            )
        )

    return {
        "raw_id": str(raw_id).strip(),
        "title": clean_text(
            first_value(
                item,
                ("title", "name")
            ),
            300
        ),
        "summary": clean_text(summary),
        "url": canonical_url(
            str(url).strip()
        ),
        "image": str(image or "").strip(),
        "author": clean_text(
            author or ACCOUNT_NAME,
            100
        ),
        "published_at": normalize_date(
            published
        )
    }


def local_name(tag):
    return tag.rsplit(
        "}",
        1
    )[-1].lower()


def xml_child_text(element, names):
    for name in names:
        for child in list(element):
            if local_name(child.tag) == name:
                value = "".join(
                    child.itertext()
                ).strip()

                if value:
                    return value

    return ""


def xml_link(element):
    candidates = []

    for child in list(element):
        if local_name(child.tag) != "link":
            continue

        href = (
            child.attrib.get("href")
            or (child.text or "").strip()
        )

        if href:
            candidates.append(href)

    for value in candidates:
        url = urllib.parse.urljoin(
            FEED_URL,
            html.unescape(value)
        )

        if urllib.parse.urlsplit(
            url
        ).scheme in ("http", "https"):
            return canonical_url(url)

    return ""


def parse_xml_feed(body):
    root = ET.fromstring(body)

    entries = [
        element
        for element in root.iter()
        if local_name(element.tag)
        in ("item", "entry")
    ]

    results = []

    for entry in entries:
        content = xml_child_text(
            entry,
            (
                "content",
                "encoded",
                "description",
                "summary"
            )
        )

        summary = xml_child_text(
            entry,
            (
                "summary",
                "description"
            )
        ) or content

        image = ""

        for child in entry.iter():
            name = local_name(
                child.tag
            )

            if name in (
                "thumbnail",
                "enclosure",
                "image",
                "content"
            ):
                candidate = (
                    child.attrib.get("url")
                    or child.attrib.get("href")
                    or ""
                )

                if candidate:
                    image = candidate
                    break

        if not image:
            image = extract_image(content)

        results.append({
            "raw_id": xml_child_text(
                entry,
                ("guid", "id")
            ),
            "title": clean_text(
                xml_child_text(
                    entry,
                    ("title",)
                ),
                300
            ),
            "summary": clean_text(summary),
            "url": xml_link(entry),
            "image": image,
            "author": clean_text(
                xml_child_text(
                    entry,
                    ("creator", "author")
                ) or ACCOUNT_NAME,
                100
            ),
            "published_at": normalize_date(
                xml_child_text(
                    entry,
                    (
                        "pubdate",
                        "published",
                        "updated",
                        "date"
                    )
                )
            )
        })

    return results


def parse_feed(body, content_type):
    stripped = body.lstrip()

    is_json = (
        "json" in content_type.lower()
        or stripped.startswith(b"{")
        or stripped.startswith(b"[")
    )

    if is_json:
        payload = json.loads(
            body.decode("utf-8-sig")
        )

        return [
            normalize_json_item(item)
            for item in find_json_items(
                payload
            )
        ]

    return parse_xml_feed(body)


def locate_articles(document):
    if isinstance(document, list):
        return document

    if not isinstance(document, dict):
        fail(
            f"{TARGET_FILE} 必须是 "
            "JSON对象或JSON数组。"
        )

    for key in (
        "articles",
        "items",
        "records",
        "list"
    ):
        value = document.get(key)

        if isinstance(value, list):
            return value

    if not document:
        document["articles"] = []
        return document["articles"]

    fail(
        f"{TARGET_FILE} 中未找到 "
        "articles/items/records/list 数组。"
    )


def item_keys(item):
    keys = set()

    for field in (
        "raw_id",
        "article_id",
        "articleId",
        "id",
        "guid"
    ):
        value = item.get(field)

        if value:
            keys.add(
                "id:" +
                str(value).strip()
            )

    for field in (
        "url",
        "link",
        "source_url",
        "external_url",
        "original_url"
    ):
        value = item.get(field)

        if value:
            url = canonical_url(
                str(value)
            )

            if url:
                keys.add(
                    "url:" + url
                )

    return keys


def build_record(item, collected_at):
    stable_value = (
        item["url"]
        or item["raw_id"]
        or (
            item["title"] +
            item["published_at"]
        )
    )

    generated_id = (
        "wechat-" +
        hashlib.sha256(
            stable_value.encode("utf-8")
        ).hexdigest()[:20]
    )

    article_id = (
        item["raw_id"]
        or generated_id
    )

    return {
        "id": generated_id,
        "articleId": article_id,
        "article_id": article_id,
        "title": item["title"],
        "summary": item["summary"],
        "description": item["summary"],
        "excerpt": item["summary"],
        "url": item["url"],
        "link": item["url"],
        "source_url": item["url"],
        "image": item["image"],
        "cover": item["image"],
        "coverUrl": item["image"],
        "cover_url": item["image"],
        "author": item["author"],
        "account": item["author"],
        "source": "Industry News",
        "sourceType": "wechat",
        "category": "industry",
        "publishedAt": item["published_at"],
        "published_at": item["published_at"],
        "publishTime": item["published_at"],
        "date": item["published_at"][:10],
        "status": "published",
        "reviewStatus": "approved",
        "visible": True,
        "approved": True,
        "collectedAt": collected_at
    }


def main():
    if INITIAL_SYNC_MODE not in (
        "baseline",
        "import"
    ):
        fail(
            "INITIAL_SYNC_MODE 只能是 "
            "baseline 或 import。"
        )

    body, content_type = fetch_feed()

    feed_items = parse_feed(
        body,
        content_type
    )

    valid_items = []
    feed_keys = set()

    for item in feed_items:
        if (
            not item["title"]
            or not item["url"]
        ):
            continue

        keys = item_keys(item)

        if (
            not keys
            or keys & feed_keys
        ):
            continue

        feed_keys.update(keys)
        valid_items.append(item)

    if not valid_items:
        fail(
            "Feed 中没有同时包含标题和链接的有效文章。"
        )

    target_document = load_json(
        TARGET_FILE,
        {"articles": []}
    )

    articles = locate_articles(
        target_document
    )

    existing_keys = set()

    for article in articles:
        if isinstance(article, dict):
            existing_keys.update(
                item_keys(article)
            )

    collected_at = utc_now()

    state_exists = STATE_FILE.exists()

    state = load_json(
        STATE_FILE,
        {}
    )

    state_seen = set(
        state.get("seen", [])
    )

    if (
        not state_exists
        and INITIAL_SYNC_MODE == "baseline"
    ):
        write_json(
            STATE_FILE,
            {
                "version": 1,
                "initializedAt": collected_at,
                "lastRunAt": collected_at,
                "lastNewCount": 0,
                "seen": sorted(feed_keys)
            }
        )

        print(
            "Baseline created: "
            f"{len(valid_items)} current "
            "entries marked as seen; "
            "0 imported."
        )

        return

    known = (
        existing_keys |
        state_seen
    )

    new_items = []

    for item in valid_items:
        keys = item_keys(item)

        if keys & known:
            known.update(keys)
            continue

        new_items.append(item)
        known.update(keys)

        if len(new_items) >= MAX_NEW_ITEMS:
            break

    new_records = [
        build_record(
            item,
            collected_at
        )
        for item in new_items
    ]

    if new_records:
        articles[0:0] = new_records

        write_json(
            TARGET_FILE,
            target_document
        )

    state_seen.update(feed_keys)
    state_seen.update(existing_keys)

    write_json(
        STATE_FILE,
        {
            "version": 1,
            "initializedAt": state.get(
                "initializedAt",
                collected_at
            ),
            "lastRunAt": collected_at,
            "lastNewCount": len(
                new_records
            ),
            "seen": sorted(state_seen)[-5000:]
        }
    )

    print(
        f"Feed entries: {len(valid_items)}; "
        f"new articles: {len(new_records)}."
    )

    for record in new_records:
        print(
            "+",
            record["publishedAt"],
            "|",
            record["title"],
            "|",
            record["url"]
        )


if __name__ == "__main__":
    main()
