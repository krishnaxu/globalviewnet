
import hashlib
import html
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

def yaml_string(value):
    import json
    return json.dumps(value, ensure_ascii=False)

def main():
       existing_by_url = {}
    for file in OUT.glob("*.md"):
        text = file.read_text(encoding="utf-8")
        m = re.search(r"(?m)^original_url:\s*[\"']?(https?://\S+)", text)
        if m:
            existing_by_url[m.group(1).rstrip("\"'")] = file

    found = {}
    for page in PAGES:
        print("读取：", page)
        req = Request(page, headers={"User-Agent": "Mozilla/5.0"})
                with urlopen(req, timeout=30) as response:
            raw = response.read()

            # 优先读取网页自身声明的编码
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

            # 人民网旧版页面常使用 GBK 系列编码
            candidates = []
            if charset:
                candidates.append(charset)
            candidates.extend(["gb18030", "utf-8"])

            source = None
            for encoding in dict.fromkeys(candidates):
                try:
                    source = raw.decode(encoding)
                    break
                except (UnicodeDecodeError, LookupError):
                    continue

            if source is None:
                raise ValueError(f"无法识别网页编码：{page}")
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

            # 兼容旧版 http 链接，统一保存为 https
            url = url.replace("http://", "https://", 1)
            found[url] = title

        time.sleep(1)
    added = 0
       for url, title in found.items():
        if url in existing_by_url:
            existing_file = existing_by_url[url]

            # 只修复本次批量导入的作品，不覆盖原有手工作品
            if existing_file.name.startswith("people-"):
                content = existing_file.read_text(encoding="utf-8")
                replacement = "title: " + yaml_string(title)

                content, count = re.subn(
                    r"(?m)^title:.*$",
                    lambda _: replacement,
                    content,
                    count=1
                )

                if count:
                    existing_file.write_text(content, encoding="utf-8")
                    print("修复标题：", title)

            continue

        slug = "people-" + hashlib.sha1(url.encode()).hexdigest()[:14]
        path = OUT / f"{slug}.md"
        if path.exists():
            continue

        content = (
            "---\n"
            f"slug: {yaml_string(slug)}\n"
            f"title: {yaml_string(title)}\n"
            f"original_url: {yaml_string(url)}\n"
            f"platform: {yaml_string('人民网')}\n"
            'date: ""\n'
            'excerpt: ""\n'
            'cover_image: ""\n'
            "published: true\n"
            "---\n"
        )
        path.write_text(content, encoding="utf-8")
        added += 1

    print(f"列表解析到 {len(found)} 个链接；新增作品 {added} 篇。")

if __name__ == "__main__":
    main()
