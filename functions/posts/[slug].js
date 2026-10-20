
export async function onRequestGet({ request, params }) {
  let slug = params?.slug || "";

  try {
    slug = decodeURIComponent(slug);
  } catch {
    return new Response("文章地址无效", { status: 400 });
  }

  if (
    !slug ||
    slug.includes("/") ||
    slug.includes("\\") ||
    slug.includes("..") ||
    slug.toLowerCase().endsWith(".md")
  ) {
    return new Response("文章地址无效", { status: 400 });
  }

  const safeSlug = JSON.stringify(slug).replace(/</g, "\\u003c");

  // 在服务器端读取文章信息，供 SEO 标签使用
  const requestUrl = new URL(request.url);
  const lang = requestUrl.searchParams.get("lang") === "en" ? "en" : "zh";
  let seoArticle = null;

  try {
    const apiUrl = new URL("/api/post", request.url);
    apiUrl.searchParams.set("slug", slug);
    apiUrl.searchParams.set("lang", lang);

    const apiResponse = await fetch(apiUrl.toString(), {
      headers: { Accept: "application/json" }
    });

    if (apiResponse.ok) {
      seoArticle = await apiResponse.json();
    }
  } catch (error) {
    seoArticle = null;
  }

  const seoTitle = lang === "en"
    ? (
        seoArticle?.title_en ||
        seoArticle?.title ||
        seoArticle?.title_zh ||
        slug
      )
    : (
        seoArticle?.title_zh ||
        seoArticle?.title ||
        seoArticle?.title_en ||
        slug
      );

  const seoDescription = lang === "en"
    ? (
        seoArticle?.excerpt_en ||
        seoArticle?.excerpt ||
        seoArticle?.excerpt_zh ||
        seoTitle
      )
    : (
        seoArticle?.excerpt_zh ||
        seoArticle?.excerpt ||
        seoArticle?.excerpt_en ||
        seoTitle
      );

  const seoImage = seoArticle?.cover_image || "";
  const seoCanonical = new URL(
    "/posts/" + encodeURIComponent(slug),
    request.url
  ).toString();

  function escapeSeoHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  const absoluteSeoImage = seoImage
    ? new URL(seoImage, request.url).toString()
    : "";

    const seoBody = lang === "en"
    ? (
        seoArticle?.body_en ||
        seoArticle?.body ||
        seoArticle?.body_zh ||
        ""
      )
    : (
        seoArticle?.body_zh ||
        seoArticle?.body ||
        ""
      );

  const seoDate = seoArticle?.date || "";

  function escapeSeoBody(value) {
    return escapeSeoHtml(value)
      .replace(/\r\n?/g, "\n")
      .replace(/\n/g, "<br>\n");
  }
  const seoTags = [
    "<title>" + escapeSeoHtml(seoTitle) + " - GlobalViewNet</title>",
    '<meta name="description" content="' + escapeSeoHtml(seoDescription) + '">',
    '<link rel="canonical" href="' + escapeSeoHtml(seoCanonical) + '">',
    '<meta property="og:type" content="article">',
    '<meta property="og:title" content="' + escapeSeoHtml(seoTitle) + '">',
    '<meta property="og:description" content="' + escapeSeoHtml(seoDescription) + '">',
    '<meta property="og:url" content="' + escapeSeoHtml(seoCanonical) + '">',
    absoluteSeoImage
      ? '<meta property="og:image" content="' + escapeSeoHtml(absoluteSeoImage) + '">'
      : "",
    '<meta name="twitter:card" content="' + (absoluteSeoImage ? "summary_large_image" : "summary") + '">',
    '<meta name="twitter:title" content="' + escapeSeoHtml(seoTitle) + '">',
    '<meta name="twitter:description" content="' + escapeSeoHtml(seoDescription) + '">',
    absoluteSeoImage
      ? '<meta name="twitter:image" content="' + escapeSeoHtml(absoluteSeoImage) + '">'
      : ""
  ].filter(Boolean).join("\n  ");

  const html = String.raw`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
    __SEO_TAGS__
  <style>
    * { box-sizing: border-box; }

    body {
      margin: 0;
      color: #252525;
      background: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
        "PingFang SC", "Microsoft YaHei", sans-serif;
      line-height: 1.8;
    }

    .page {
      width: min(800px, calc(100% - 36px));
      margin: 0 auto;
      padding: 32px 0 64px;
    }

    .back {
      display: inline-block;
      margin-bottom: 28px;
      color: #555;
      text-decoration: none;
    }

    .back:hover { color: #111; }

    h1 {
      margin: 0 0 12px;
      font-size: clamp(28px, 5vw, 40px);
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .date {
      margin-bottom: 32px;
      color: #888;
      font-size: 14px;
    }

    #content {
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    #content h2,
    #content h3,
    #content h4 {
      margin-top: 1.8em;
      line-height: 1.45;
    }

    #content p {
      margin: 1em 0;
    }

    #content img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 22px auto;
      border-radius: 4px;
    }

    #content a {
      color: #1769aa;
      overflow-wrap: anywhere;
    }

    #content blockquote {
      margin: 20px 0;
      padding: 4px 18px;
      border-left: 4px solid #ddd;
      color: #666;
    }

    #content pre {
      padding: 16px;
      overflow-x: auto;
      background: #f5f5f5;
      border-radius: 6px;
    }

    #content code {
      padding: 2px 4px;
      background: #f5f5f5;
      border-radius: 3px;
      font-family: Consolas, monospace;
    }

    #content pre code {
      padding: 0;
      background: transparent;
    }

    #content table {
      display: block;
      max-width: 100%;
      overflow-x: auto;
      border-collapse: collapse;
    }

    #content th,
    #content td {
      padding: 8px 12px;
      border: 1px solid #ddd;
    }

    /* 文末来源信息 */
    .source-info {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
      color: #666;
      font-size: 14px;
      line-height: 1.8;
      overflow-wrap: anywhere;
    }

    .source-info h2 {
      margin: 0 0 8px;
      color: #333;
      font-size: 16px;
      line-height: 1.5;
    }

    .source-info a {
      color: #1769aa;
      text-decoration: none;
      overflow-wrap: anywhere;
    }

    .source-info a:hover {
      text-decoration: underline;
    }

    .error {
      padding: 16px;
      color: #b42318;
      background: #fff3f2;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  </style>
</head>
<body>
  <main class="page">
    <a class="back" href="/">← 返回首页</a>
    <article>
      <h1 id="title">__SSR_TITLE__</h1>
      <div id="date" class="date">__SSR_DATE__</div>
      <div id="content">__SSR_BODY__</div>
    </article>
  </main>

  <script>
    const slug = __SLUG_JSON__;

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, function (char) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[char];
      });
    }

    function safeUrl(value) {
      const url = String(value || "").trim();

      if (/^https?:\/\//i.test(url)) {
        return url;
      }

      if (url.startsWith("/") && !url.startsWith("//")) {
        return url;
      }

      return "#";
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
          let url = safeUrl(src);

          if (url.startsWith("/images/uploads/")) {
            url = "/public" + url;
          }

          if (url === "#") {
            return escapeHtml(alt);
          }

          return '<img src="' + escapeHtml(url) +
            '" alt="' + escapeHtml(alt) + '"' +
            (title ? ' title="' + escapeHtml(title) + '"' : "") +
            ' loading="lazy">';
        }
      );

      value = value.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/(?!\/)[^\s)]*)\)/g,
        function (_, label, url) {
          return '<a href="' + escapeHtml(safeUrl(url)) +
            '" target="_blank" rel="noopener noreferrer">' +
            label + '</a>';
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
      let text = String(markdown || "");

      // 兼容正文中以字面形式保存的反斜杠+n
      text = text.replace(/\\n/g, "\n");

      // 统一不同系统的换行符
      text = text.replace(/\r\n?/g, "\n");

      // 兼容现有测试文章：多个连续空格作为段落分隔
      text = text.replace(/[ \t]{2,}/g, "\n");

      const lines = text.split("\n");
      const output = [];

      let paragraph = [];
      let listType = "";
      let inCode = false;
      let codeLines = [];

      function flushParagraph() {
        if (paragraph.length) {
          output.push(
            "<p>" +
            paragraph.map(inlineMarkdown).join("<br>\n") +
            "</p>"
          );
          paragraph = [];
        }
      }

      function closeList() {
        if (listType) {
          output.push("</" + listType + ">");
          listType = "";
        }
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
        paragraph.push(trimmed);
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

    function renderSource(article, lang, contentElement) {
      const sourceName = String(article.source_name || "").trim();
      const sourceUrl = String(article.source_url || "").trim();

      // 两项都为空时，不显示来源区块
      if (!sourceName && !sourceUrl) {
        return;
      }

      const sourceSection = document.createElement("section");
      sourceSection.className = "source-info";

      const heading = document.createElement("h2");
      heading.textContent = lang === "en" ? "Source" : "信息来源";
      sourceSection.appendChild(heading);

      const sourceText = document.createElement("div");

      if (sourceName) {
        sourceText.appendChild(document.createTextNode(sourceName));
      }

      // 只允许 HTTP / HTTPS 来源链接
      if (/^https?:\/\/\S+$/i.test(sourceUrl)) {
        if (sourceName) {
          sourceText.appendChild(document.createTextNode(" · "));
        }

        const link = document.createElement("a");
        link.href = sourceUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = lang === "en" ? "Read original" : "查看原文";

        sourceText.appendChild(link);
      }

      sourceSection.appendChild(sourceText);
      contentElement.appendChild(sourceSection);
    }

    async function loadArticle() {
      const titleElement = document.getElementById("title");
      const contentElement = document.getElementById("content");
      const dateElement = document.getElementById("date");

      const params = new URLSearchParams(window.location.search);
      const lang = params.get("lang") === "en" ? "en" : "zh";

      try {
        const response = await fetch(
          "/api/post?slug=" + encodeURIComponent(slug) +
          "&lang=" + lang,
          { cache: "no-store" }
        );

        const article = await response.json();

        if (!response.ok) {
          throw new Error(
            article.detail || article.error || "文章读取失败"
          );
        }

        const title = lang === "en"
          ? (article.title_en || article.title || article.title_zh || slug)
          : (article.title_zh || article.title || article.title_en || slug);

        const body = lang === "en"
          ? (article.body_en || article.body || article.body_zh || "")
          : (article.body_zh || article.body || "");

        document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
        document.title = title + " - GlobalViewNet";
        titleElement.textContent = title;

        if (dateElement && article.date) {
          const date = new Date(article.date);

          dateElement.textContent = Number.isNaN(date.getTime())
            ? article.date
            : date.toLocaleDateString(
                lang === "en" ? "en-US" : "zh-CN",
                {
                  year: "numeric",
                  month: "long",
                  day: "numeric"
                }
              );
        }

        // 渲染正文
        contentElement.innerHTML = renderMarkdown(body);

        // 在正文末尾显示来源名称和来源链接
        renderSource(article, lang, contentElement);

        // 中英文首页返回链接
        const backLink = document.querySelector(".back");

        if (backLink) {
          backLink.textContent =
            lang === "en" ? "← Back to Home" : "← 返回首页";

          backLink.href = lang === "en" ? "/?lang=en" : "/";
        }
      } catch (error) {
        titleElement.textContent =
          lang === "en" ? "Failed to load article" : "文章加载失败";

        contentElement.className = "error";
        contentElement.textContent =
          error instanceof Error ? error.message : "文章读取失败";
      }
    }

    loadArticle();
  </script>
</body>
</html>`
    .replace("__SLUG_JSON__", () => safeSlug)
    .replace("__SEO_TAGS__", () => seoTags)
    .replace("__SSR_TITLE__", () => escapeSeoHtml(seoTitle))
    .replace("__SSR_DATE__", () => escapeSeoHtml(seoDate))
    .replace("__SSR_BODY__", () => escapeSeoBody(seoBody));
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
