
import hashlib
import html
import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from html.parser import HTMLParser

PAGES = [
    f"https://www.people.com.cn/GB/8722/11139/385815/index{i}.html"
    for i in range(1, 6)
]

OUT = Path("content/works")
OUT.mkdir(parents=True, exist_ok=True)


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items = []
        self.href = None
        self.text = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.href = dict(attrs).get("href")
            self.text = []

    def handle_data(self, data):
        if self.href is not None:
            self.text.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.href is not None:
            title = re.sub(r"\s+", " ", "".join(self.text)).strip()
            self.items.append((self.href, title))
            self.href = None
            self.text = []


class ArticleParser(HTMLParser):
    """优先提取常见新闻正文容器中的文本。"""

    def __init__(self):
        super().__init__()
        self.depth = 0
        self.active = False
        self.parts = []
        self.candidates = []
        self.current = []
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get("class", "")
        element_id = attrs.get("id", "")
        marker = f"{element_id} {classes}".lower()

        if not self.active and (
            "rm_txt" in marker
            or "article-content" in marker
            or "articlecontent" in marker
            or "text_con" in marker
            or "content" == element_id.lower()
        ):
            self.active = True
            self.depth = 1
            self.current = []
            return

        if self.active:
            if tag in ("script", "style", "nav", "footer"):
                self.skip_depth += 1
            if tag in ("p", "h1", "h2", "h3", "br"):
                self.current.append("\n")
            self.depth += 1

    def handle_data(self, data):
        if self.active and self.skip_depth == 0:
            text = re.sub(r"\s+", " ", data).strip()
            if text:
                self.current.append(text)

    def handle_endtag(self, tag):
        if self.active:
            if tag in ("script", "style", "nav", "footer") and self.skip_depth:
                self.skip_depth -= 1

            self.depth -= 1
            if self.depth <= 0:
                text = re.sub(r"[ \t]+", " ", "".join(self.current))
                text = re.sub(r"\n\s*\n+", "\n\n", text).strip()
                if len(text) > 100:
                    self.candidates.append(text)
                self.active = False


def yaml_string(value):
    return json.dumps(value, ensure_ascii=False)


def read_page(url):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=30) as response:
        raw = response.read()
        charset_match = re.search(
            br'<meta[^>]+charset=["\']?\s*([a-zA-Z0-9_-]+)',
            raw,
            re.IGNORECASE
        )
        charset = (
            charset_match.group(1).decode("ascii")
            if charset_match
            else response.headers.get_content_charset()
        )

    candidates = ([charset] if charset else []) + ["gb18030", "utf-8"]
    for encoding in dict.fromkeys(candidates):
        try:
            return raw.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            pass

    raise ValueError(f"无法识别网页编码：{url}")


def extract_article(url):
    source = read_page(url)
    parser = ArticleParser()
    parser.feed(source)

    if not parser.candidates:
        return ""

    # 选取最长的候选正文，避免误取短导航内容。
    body = max(parser.candidates, key=len)
    body = html.unescape(body)
    body = re.sub(r"\n{3,}", "\n\n", body).strip()
    return body


def parse_frontmatter(text):
    match = re.match(
        r"^\ufeff?---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)",
        text
    )
    if not match:
        return {}, ""

    meta = {}
    for line in match.group(1).splitlines():
        field = re.match(r"^([A-Za-z0-9_-]+)\s*:\s*(.*)$", line)
        if field:
            value = field.group(2).strip()
            try:
                value = json.loads(value)
            except Exception:
                value = value.strip("\"'")
            meta[field.group(1)] = value

    return meta, text[match.end():]


def main():
    existing_by_url = {}

    for file in OUT.glob("*.md"):
        text = file.read_text(encoding="utf-8")
        meta, _ = parse_frontmatter(text)
        url = str(meta.get("original_url", "")).strip()
        if url:
            existing_by_url[url] = file

    found = {}

    for page in PAGES:
        print("读取列表：", page)
        source = read_page(page)
        parser = Links()
        parser.feed(source)

        for href, title in parser.items:
            if not title or len(title) < 4:
                continue

            url = urljoin(page, html.unescape(href)).split("#")[0]
            host = urlparse(url).hostname or ""

            if host != "world.people.com.cn":
                continue
            if "/GB/8722/11139/385815/" in url:
                continue

            url = url.replace("http://", "https://", 1)
            found[url] = title

        time.sleep(1)

    added = 0
    updated = 0
    failed = 0

    for url, title in found.items():
        file = existing_by_url.get(url)

        if file:
            old_text = file.read_text(encoding="utf-8")
            meta, old_body = parse_frontmatter(old_text)

            # 已有正文不覆盖，避免覆盖手工编辑内容。
            if str(meta.get("body", "")).strip() or old_body.strip():
                print("已有正文，跳过：", title)
                continue

            slug = str(meta.get("slug") or file.stem)
            platform = str(meta.get("platform") or "人民网")
            date = str(meta.get("date") or "")
            excerpt = str(meta.get("excerpt") or "")
            cover_image = str(meta.get("cover_image") or "")
            published = str(meta.get("published", "true")).lower()
        else:
            slug = "people-" + hashlib.sha1(url.encode()).hexdigest()[:14]
            file = OUT / f"{slug}.md"
            if file.exists():
                print("文件已存在，跳过：", file.name)
                continue

            platform = "人民网"
            date = ""
            excerpt = ""
            cover_image = ""
            published = "true"

        print("抓取正文：", title)
        try:
            body = extract_article(url)
        except Exception as error:
            print("抓取失败：", url, error)
            failed += 1
            continue

        if len(body) < 100:
            print("未识别到可靠正文，跳过：", title)
            failed += 1
            continue

        # 正文使用 JSON 字符串保存，避免 YAML 多行文本转义问题。
        content = (
            "---\n"
            f"slug: {yaml_string(slug)}\n"
            f"title: {yaml_string(title)}\n"
            f"original_url: {yaml_string(url)}\n"
            f"platform: {yaml_string(platform)}\n"
            f"date: {yaml_string(date)}\n"
            f"excerpt: {yaml_string(excerpt)}\n"
            f"cover_image: {yaml_string(cover_image)}\n"
            f"published: {published}\n"
            f"body: {yaml_string(body)}\n"
            "---\n"
        )

        file.write_text(content, encoding="utf-8")
        if url in existing_by_url:
            updated += 1
            print("补充正文：", title)
        else:
            added += 1
            print("新增作品：", title)

        time.sleep(1)

    print(
        f"完成：解析 {len(found)} 篇，补充正文 {updated} 篇，"
        f"新增作品 {added} 篇，失败或跳过 {failed} 篇。"
    )


if __name__ == "__main__":
    main()
