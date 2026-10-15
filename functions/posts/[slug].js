
function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeMarkdown(markdown) {
  let text = String(markdown || "")
    .replace(/\r\n?/g, "\n");

  // 将正文中被保存为字面字符的 \n 还原为换行
  text = text.replace(/\\n/g, "\n");

  // 兼容测试文章中被折叠的段落标记
  text = text.replace(
    /[ \t]+(?=(?:Paragraph \d+:|Final verification paragraph:))/g,
    "\n\n"
  );

  text = text.replace(
    /[ \t]+(?=(?:第一段：|第二段：|第三段：|第四段：|最后一段：))/g,
    "\n\n"
  );

  return text.trim();
}

function inlineMarkdown(text) {
  let value = escapeHtml(text);
  const codeItems = [];

  value = value.replace(
    /\x60([^\x60]+)\x60/g,
    function (_, code) {
      const index = codeItems.length;
      codeItems.push("<code>" + code + "</code>");
      return "@@INLINECODE" + index + "@@";
    }
  );

  value = value.replace(
    /!\[([^\]]*)\]\((\S+?)(?:\s+["']([^"']*)["'])?\)/g,
    function (_, alt, src, title) {
      if (!/^(https?:\/\/|\/)/i.test(src) || src.startsWith("//")) {
        return alt;
      }

      return '<img src="' + src + '" alt="' + alt + '"' +
        (title ? ' title="' + title + '"' : "") +
        ' loading="lazy">';
    }
  );

  value = value.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/(?!\/)[^\s)]*)\)/g,
    function (_, label, url) {
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' +
        label + "</a>";
    }
  );

  value = value.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/__(.+?)__/g, "<strong>$1</strong>");
  value = value.replace(/\*(.+?)\*/g, "<em>$1</em>");
  value = value.replace(/~~(.+?)~~/g, "<del>$1</del>");

  value = value.replace(
    /@@INLINECODE(\d+)@@/g,
    function (_, index) {
      return codeItems[Number(index)] || "";
    }
  );

  return value;
}

function renderMarkdown(markdown) {
  const normalized = normalizeMarkdown(markdown);
  const lines = normalized.split("\n");
  const output = [];

  let paragraph = [];
  let listType = "";
  let inCode = false;
  let codeLines = [];

  function flushParagraph() {
    if (!paragraph.length) return;

    output.push(
      "<p>" +
      paragraph.map(inlineMarkdown).join("<br>\n") +
      "</p>"
    );

    paragraph = [];
  }

  function closeList() {
    if (!listType) return;

    output.push("</" + listType + ">");
    listType = "";
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const fence = String.fromCharCode(96, 96, 96);

    if (trimmed.startsWith(fence)) {
      if (inCode) {
        output.push(
          "<pre><code>" +
          escapeHtml(codeLines.join("\n")) +
          "</code></pre>"
        );

        codeLines = [];
        inCode = false;
      } else {
        flushParagraph();
        closeList();
        inCode = true;
        codeLines = [];
      }

      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);

    if (heading) {
      flushParagraph();
      closeList();

      const level = heading[1].length;

      output.push(
        "<h" + level + ">" +
        inlineMarkdown(heading[2]) +
        "</h" + level + ">"
      );

      continue;
    }

    if (/^\s*([-*_])\s*\1\s*\1\s*$/.test(line)) {
      flushParagraph();
      closeList();
      output.push("<hr>");
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);

    if (unordered || ordered) {
      flushParagraph();

      const nextType = unordered ? "ul" : "ol";

      if (listType !== nextType) {
        closeList();
        listType = nextType;
        output.push("<" + listType + ">");
      }

      output.push(
        "<li>" +
        inlineMarkdown((unordered || ordered)[1]) +
        "</li>"
      );

      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);

    if (quote) {
      flushParagraph();
      closeList();

      output.push(
        "<blockquote>" +
        inlineMarkdown(quote[1]) +
        "</blockquote>"
      );

      continue;
    }

    closeList();
    paragraph.push(line);
  }

  flushParagraph();
  closeList();

  if (inCode) {
    output.push(
      "<pre><code>" +
      escapeHtml(codeLines.join("\n")) +
      "</code></pre>"
    );
  }

  return output.join("\n");
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const rawSlug = pathname.split("/").filter(Boolean).pop() || "";

  let slug;

  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    slug = rawSlug;
  }

  if (
    !slug ||
    slug.includes("/") ||
    slug.includes("\\") ||
    slug.includes("..")
  ) {
    return new Response("无效的文章地址", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }

  const lang = url.searchParams.get("lang") === "en" ? "en" : "zh";

  const html = String.raw`<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="index,follow">
  <title>Article - Global View</title>
  <style>
    * { box-sizing: border-box; }

    body {
      margin: 0;
      color: #202124;
      background: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
        "PingFang SC", "Microsoft YaHei", sans-serif;
      line-height: 1.8;
    }

    header {
      border-bottom: 1px solid #e8e8e8;
      padding: 16px 24px;
    }

    .nav {
      max-width: 900px;
      margin: auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .brand {
      color: #171717;
      text-decoration: none;
      font-size: 21px;
      font-weight: 700;
    }

    .lang a {
      margin-left: 12px;
      color: #555;
      text-decoration: none;
      font-size: 14px;
    }

    main {
      max-width: 800px;
      margin: 48px auto;
      padding: 0 24px 64px;
      min-height: 60vh;
    }

    .back {
      display: inline-block;
      margin-bottom: 24px;
      color: #555;
      text-decoration: none;
      font-size: 14px;
    }

    h1 {
      margin: 0 0 18px;
      font-size: clamp(28px, 5vw, 40px);
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .meta {
      color: #777;
      font-size: 14px;
      margin-bottom: 32px;
    }

    .article-body {
      overflow-wrap: anywhere;
      word-break: normal;
      font-size: 17px;
    }

    .article-body p {
      margin: 0 0 1.4em;
    }

    .article-body h1,
    .article-body h2,
    .article-body h3,
    .article-body h4 {
      margin: 1.7em 0 .7em;
      line-height: 1.4;
    }

    .article-body ul,
    .article-body ol {
      padding-left: 1.8em;
      margin: 0 0 1.4em;
    }

    .article-body li {
      margin: .35em 0;
    }

    .article-body blockquote {
      margin: 1.4em 0;
      padding: 8px 18px;
      border-left: 3px solid #ccc;
      color: #666;
      background: #f8f8f8;
    }

    .article-body img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 24px auto;
      border-radius: 6px;
    }

    .article-body a {
      color: #1769aa;
      overflow-wrap: anywhere;
    }

    .article-body pre {
      overflow-x: auto;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 6px;
    }

    .article-body code {
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: .9em;
    }

    .article-body hr {
      border: 0;
      border-top: 1px solid #ddd;
      margin: 28px 0;
    }

    .error {
      color: #a12622;
      padding: 16px;
      background: #fff4f2;
      border-radius: 6px;
    }

    footer {
      border-top: 1px solid #eee;
      padding: 24px;
      text-align: center;
      color: #888;
      font-size: 13px;
    }

    @media (max-width: 600px) {
      header { padding: 14px 16px; }
      main { margin-top: 30px; padding: 0 18px 48px; }
      .article-body { font-size: 16px; }
    }
  </style>
</head>
<body>
  <header>
    <nav class="nav">
      <a class="brand" href="/">Global View</a>
      <div class="lang">
        <a id="zhLink" href="#">中文</a>
        <a id="enLink" href="#">English</a>
      </div>
    </nav>
  </header>

  <main>
    <a class="back" id="backLink" href="/">← <span id="backText"></span></a>
    <h1 id="articleTitle">Loading...</h1>
    <div class="meta" id="articleMeta"></div>
    <article class="article-body" id="articleContent"></article>
  </main>

  <footer>Global View</footer>

  <script>
    const slug = ${JSON.stringify(slug)};
    const lang = ${JSON.stringify(lang)};

    const titleElement = document.getElementById("articleTitle");
    const metaElement = document.getElementById("articleMeta");
    const contentElement = document.getElementById("articleContent");

    document.documentElement.lang = lang;

    document.getElementById("zhLink").href =
      "/posts/" + encodeURIComponent(slug) + "?lang=zh";
    document.getElementById("enLink").href =
      "/posts/" + encodeURIComponent(slug) + "?lang=en";

    document.getElementById("backText").textContent =
      lang === "en" ? "Back to home" : "返回首页";

    function escapeHtml(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function normalizeMarkdown(markdown) {
      let text = String(markdown || "")
        .replace(/\\r\\n?/g, "\\n")
        .replace(/\\\\n/g, "\\n");

      text = text.replace(
        /[ \\t]+(?=(?:Paragraph \\d+:|Final verification paragraph:))/g,
        "\\n\\n"
      );

      text = text.replace(
        /[ \\t]+(?=(?:第一段：|第二段：|第三段：|第四段：|最后一段：))/g,
        "\\n\\n"
      );

      return text.trim();
    }

    function inlineMarkdown(text) {
      let value = escapeHtml(text);
      const codeItems = [];

      value = value.replace(
        /\\x60([^\\x60]+)\\x60/g,
        function (_, code) {
          const index = codeItems.length;
          codeItems.push("<code>" + code + "</code>");
          return "@@INLINECODE" + index + "@@";
        }
      );

      value = value.replace(
        /!\\[([^\\]]*)\\]\\((\\S+?)(?:\\s+["']([^"']*)["'])?\\)/g,
        function (_, alt, src, title) {
          if (!/^(https?:\\/\\/|\\/)/i.test(src) || src.startsWith("//")) {
            return alt;
          }

          return '<img src="' + src + '" alt="' + alt + '"' +
            (title ? ' title="' + title + '"' : "") +
            ' loading="lazy">';
        }
      );

      value = value.replace(
        /\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+|\\/(?!\\/)[^\\s)]*)\\)/g,
        function (_, label, url) {
          return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' +
            label + "</a>";
        }
      );

      value = value.replace(/\\*\\*(.+?)\\*\\*/g, "<strong>$1</strong>");
      value = value.replace(/__(.+?)__/g, "<strong>$1</strong>");
      value = value.replace(/\\*(.+?)\\*/g, "<em>$1</em>");
      value = value.replace(/~~(.+?)~~/g, "<del>$1</del>");

      value = value.replace(
        /@@INLINECODE(\\d+)@@/g,
        function (_, index) {
          return codeItems[Number(index)] || "";
        }
      );

      return value;
    }

    function renderMarkdown(markdown) {
      const lines = normalizeMarkdown(markdown).split("\\n");
      const output = [];

      let paragraph = [];
      let listType = "";
      let inCode = false;
      let codeLines = [];

      function flushParagraph() {
        if (!paragraph.length) return;

        output.push(
          "<p>" +
          paragraph.map(inlineMarkdown).join("<br>\\n") +
          "</p>"
        );

        paragraph = [];
      }

      function closeList() {
        if (!listType) return;
        output.push("</" + listType + ">");
        listType = "";
      }

      for (const line of lines) {
        const trimmed = line.trim();
        const fence = String.fromCharCode(96, 96, 96);

        if (trimmed.startsWith(fence)) {
          if (inCode) {
            output.push(
              "<pre><code>" +
              escapeHtml(codeLines.join("\\n")) +
              "</code></pre>"
            );
            codeLines = [];
            inCode = false;
          } else {
            flushParagraph();
            closeList();
            inCode = true;
            codeLines = [];
          }
          continue;
        }

        if (inCode) {
          codeLines.push(line);
          continue;
        }

        if (!trimmed) {
          flushParagraph();
          closeList();
          continue;
        }

        const heading = line.match(/^(#{1,6})\\s+(.+)$/);

        if (heading) {
          flushParagraph();
          closeList();
          const level = heading[1].length;
          output.push(
            "<h" + level + ">" +
            inlineMarkdown(heading[2]) +
            "</h" + level + ">"
          );
          continue;
        }

        if (/^\\s*([-*_])\\s*\\1\\s*\\1\\s*$/.test(line)) {
          flushParagraph();
          closeList();
          output.push("<hr>");
          continue;
        }

        const unordered = line.match(/^\\s*[-*+]\\s+(.+)$/);
        const ordered = line.match(/^\\s*\\d+\\.\\s+(.+)$/);

        if (unordered || ordered) {
          flushParagraph();
          const nextType = unordered ? "ul" : "ol";

          if (listType !== nextType) {
            closeList();
            listType = nextType;
            output.push("<" + listType + ">");
          }

          output.push(
            "<li>" +
            inlineMarkdown((unordered || ordered)[1]) +
            "</li>"
          );
          continue;
        }

        const quote = line.match(/^\\s*>\\s?(.*)$/);

        if (quote) {
          flushParagraph();
          closeList();
          output.push(
            "<blockquote>" +
            inlineMarkdown(quote[1]) +
            "</blockquote>"
          );
          continue;
        }

        closeList();
        paragraph.push(line);
      }

      flushParagraph();
      closeList();

      if (inCode) {
        output.push(
          "<pre><code>" +
          escapeHtml(codeLines.join("\\n")) +
          "</code></pre>"
        );
      }

      return output.join("\\n");
    }

    async function loadArticle() {
      try {
        const response = await fetch(
          "/api/post?slug=" + encodeURIComponent(slug) +
          "&lang=" + lang,
          { cache: "no-store" }
        );

        const article = await response.json();

        if (!response.ok) {
          throw new Error(article.error || "Failed to load article");
        }

        const title = lang === "en"
          ? (article.title_en || article.title || article.title_zh || slug)
          : (article.title_zh || article.title || article.title_en || slug);

        const body = lang === "en"
          ? (article.body_en || article.body || article.body_zh || "")
          : (article.body_zh || article.body || "");

        document.title = title + " | Global View";
        titleElement.textContent = title;
        metaElement.textContent = [
          article.date ? article.date.slice(0, 10) : "",
          article.category || ""
        ].filter(Boolean).join(" · ");

        contentElement.innerHTML = renderMarkdown(body);

      } catch (error) {
        titleElement.textContent =
          lang === "en" ? "Unable to load article" : "文章加载失败";

        contentElement.innerHTML =
          '<p class="error">' + escapeHtml(
            error instanceof Error ? error.message : "Unknown error"
          ) + "</p>";
      }
    }

    loadArticle();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
