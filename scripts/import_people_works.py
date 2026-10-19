
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

USER_AGENT = "Mozilla/5.0 (compatible; GlobalViewWorksImporter/1.0)"
DELAY_SECONDS = 1


def read_page(url):
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        raw = response.read()
        declared = response.headers.get_content_charset()

    match = re.search(
        br'<meta[^>]+charset=["\']?\s*([a-zA-Z0-9_-]+)',
        raw,
        re.IGNORECASE
    )
    if match:
        declared = match.group(1).decode("ascii")

    for encoding in dict.fromkeys(
        ([declared] if declared else []) + ["gb18030", "utf-8"]
    ):
        try:
            return raw.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            continue

    raise ValueError(f"无法识别网页编码：{url}")


def yaml_string(value):
    return json.dumps(value, ensure_ascii=False)


def split_frontmatter(markdown):
    match = re.match(
        r"^\ufeff?---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)",
        markdown
    )
    if not match:
        return None, markdown

    return match.group(1), markdown[match.end():]


def parse_metadata(frontmatter):
    result = {}
    if not frontmatter:
        return result

    for line in frontmatter.splitlines():
        match = re.match(r"^([A-Za-z0-9_-]+)\s*:\s*(.*)$", line)
        if not match:
            continue

        key, value = match.groups()
        value = value.strip()

        try:
            result[key] = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            result[key] = value.strip("\"'")

    return result


def set_metadata(frontmatter, key, value):
    replacement = f"{key}: {yaml_string(value)}"
    pattern = rf"(?m)^{re.escape(key)}\s*:.*$"

    if re.search(pattern, frontmatter):
        return re.sub(pattern, lambda _: replacement, frontmatter, count=1)

    return frontmatter.rstrip() + "\n" + replacement


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items = []
        self.href = None
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.href = dict(attrs).get("href")
            self.parts = []

    def handle_data(self, data):
        if self.href is not None:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.href is not None:
            title = re.sub(r"\s+", " ", "".join(self.parts)).strip()
            self.items.append((self.href, title))
            self.href = None
            self.parts = []


class ArticleParser(HTMLParser):
    TARGETS = (
        "rm_txt_con",
        "rm_txt",
        "article-content",
        "articlecontent",
        "article_body",
        "article-body",
        "text_con",
        "rwb_zw"
    )

    SKIP_TAGS = {"script", "style", "nav", "footer", "noscript"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.active = False
        self.depth = 0
        self.skip_depth = 0
        self.parts = []
        self.candidates = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        marker = (
            str(attrs.get("id", "")) + " " +
            str(attrs.get("class", ""))
        ).lower()

        if not self.active and any(target in marker for target in self.TARGETS):
            self.active = True
            self.depth = 1
            self.skip_depth = 0
            self.parts = []
            return

        if not self.active:
            return

        self.depth += 1

        if tag in self.SKIP_TAGS:
            self.skip_depth += 1
            return

        if self.skip_depth == 0 and tag in (
            "p", "h1", "h2", "h3", "h4", "br", "li"
        ):
            self.parts.append("\n")

    def handle_data(self, data):
        if self.active and self.skip_depth == 0:
            text = re.sub(r"\s+", " ", data).strip()
            if text:
                self.parts.append(text)

    def handle_endtag(self, tag):
        if not self.active:
            return

        if tag in self.SKIP_TAGS and self.skip_depth:
            self.skip_depth -= 1

        if self.skip_depth == 0 and tag in ("p", "h1", "h2", "h3", "h4", "li"):
            self.parts.append("\n")

        self.depth -= 1

        if self.depth <= 0:
            text = "".join(self.parts)
            text = re.sub(r"[ \t]+", " ", text)
            text = re.sub(r" *\n *", "\n", text)
            text = re.sub(r"\n{3,}", "\n\n", text).strip()

            if len(text) >= 100:
                self.candidates.append(text)

            self.active = False
            self.depth = 0
            self.skip_depth = 0
            self.parts = []


def extract_article(url):
    source = read_page(url)
    parser = ArticleParser()
    parser.feed(source)

    if not parser.candidates:
        return ""

    return max(parser.candidates, key=len)


def normalize_url(url):
    return str(url or "").strip().rstrip("/")


def main():
    existing_by_url = {}

    for file in OUT.glob("*.md"):
        text = file.read_text(encoding="utf-8")
        frontmatter, _ = split_frontmatter(text)

        if frontmatter is None:
            continue

        meta = parse_metadata(frontmatter)
        url = normalize_url(meta.get("original_url"))

        if url:
            existing_by_url[url] = file

    found = {}

    for page in PAGES:
        print("读取列表：", page)

        try:
            source = read_page(page)
        except Exception as error:
            print("列表读取失败：", page, error)
            continue

        parser = LinkParser()
        parser.feed(source)

        for href, title in parser.items:
            if not title or len(title) < 4:
                continue

            url = urljoin(page, html.unescape(href)).split("#")[0]
            parsed = urlparse(url)

            if parsed.hostname != "world.people.com.cn":
                continue

            if "/GB/8722/11139/385815/" in url:
                continue

            url = url.replace("http://", "https://", 1)
            found[normalize_url(url)] = title

        time.sleep(DELAY_SECONDS)

    added = 0
    updated = 0
    skipped = 0
    failed = 0

    for url, title in found.items():
        file = existing_by_url.get(url)

        if file is not None:
            # 只自动更新批量导入的作品，不修改手工作品。
            if not file.name.startswith("people-"):
                print("手工作品，跳过：", title)
                skipped += 1
                continue

            old_text = file.read_text(encoding="utf-8")
            frontmatter, old_body = split_frontmatter(old_text)

            if frontmatter is None:
                print("文件格式异常，跳过：", file.name)
                failed += 1
                continue

            meta = parse_metadata(frontmatter)

            # 已有正文不覆盖，避免覆盖手工维护的内容。
            if old_body.strip():
                print("已有正文，保留：", title)
                skipped += 1
                continue

            frontmatter = set_metadata(frontmatter, "title", title)
            original_url = str(meta.get("original_url") or url)

        else:
            slug = "people-" + hashlib.sha1(
                url.encode("utf-8")
            ).hexdigest()[:14]

            file = OUT / f"{slug}.md"

            if file.exists():
                print("文件已存在但链接未匹配，跳过：", file.name)
                skipped += 1
                continue

            frontmatter = "\n".join([
                f"slug: {yaml_string(slug)}",
                f"title: {yaml_string(title)}",
                f"original_url: {yaml_string(url)}",
                f"platform: {yaml_string('人民网')}",
                'date: ""',
                'excerpt: ""',
                'cover_image: ""',
                "published: true"
            ])
            original_url = url

        print("抓取正文：", title)

        try:
            body = extract_article(original_url)
        except Exception as error:
            print("正文抓取失败：", original_url, error)
            failed += 1
            continue

        if len(body) < 100:
            print("未识别到正文，保留原文件：", title)
            failed += 1
            continue

        # CMS 的 Markdown 正文字段放在 Front Matter 之后。
        output = f"---\n{frontmatter.strip()}\n---\n\n{body}\n"
        file.write_text(output, encoding="utf-8")

        if url in existing_by_url:
            updated += 1
            print("已补充正文：", title)
        else:
            added += 1
            print("已新增作品：", title)

        time.sleep(DELAY_SECONDS)

    print("\n批量处理结束")
    print("列表解析链接：", len(found))
    print("补充已有作品正文：", updated)
    print("新增作品：", added)
    print("跳过：", skipped)
    print("失败：", failed)


if __name__ == "__main__":
    main()
