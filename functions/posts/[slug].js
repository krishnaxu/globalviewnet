export async function onRequestGet({ params }) {
  const slug = params?.slug || "";

  if (
    !slug ||
    slug.includes("/") ||
    slug.includes("\\") ||
    slug.includes("..")
  ) {
    return new Response("文章地址无效", { status: 400 });
  }

  const safeSlug = JSON.stringify(slug).replace(/</g, "\\u003c");

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>文章详情 - GlobalViewNet</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #222;
      background: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
        "Microsoft YaHei", sans-serif;
      line-height: 1.85;
    }
    .container {
      width: min(820px, 92%);
      margin: 40px auto;
    }
    .back {
      color: #555;
      text-decoration: none;
      font-size: 14px;
    }
    h1 {
      margin: 28px 0 12px;
      font-size: clamp(26px, 5vw, 36px);
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .date {
      color: #888;
      font-size: 14px;
      margin-bottom: 30px;
    }
    #content {
      overflow-wrap: anywhere;
      font-size: 17px;
    }
    #content h2, #content h3 {
      margin-top: 30px;
      line-height: 1.5;
    }
    #content img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 22px auto;
    }
    #content a { color: #1769aa; }
    #content blockquote {
      margin: 20px 0;
      padding: 8px 16px;
      border-left: 3px solid #ccc;
      color: #666;
    }
    #content pre {
      overflow-x: auto;
      padding: 12px;
      background: #f5f5f5;
    }
    .error { color: #a22; }
    @media (max-width: 600px) {
      .container { margin: 24px auto; }
      #content { font-size: 16px; }
    }
  </style>
</head>
<body>
  <main class="container">
    <a class="back" href="/">← 返回首页</a>
    <h1 id="title">正在加载文章……</h1>
    <div class="date" id="date"></div>
    <article id="content"></article>
  </main>

  <script>
    const slug = ${safeSlug};

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
      if (/^https?:\\/\\//i.test(value) || value.startsWith("/")) {
        return value;
      }
      return "#";
    }

    function inlineMarkdown(text) {
      let value = escapeHtml(text);

      value = value.replace(
        /!\\[([^\\]]*)\\]\\(([^\\s)]+)(?:\\s+"([^"]*)")?\\)/g,
        function (_, alt, source, title) {
          let src = source;
          if (src.startsWith("/images/uploads/")) {
            src = "/public" + src;
          }
          src = safeUrl(src);
          return '<img src="' + src + '" alt="' + alt + '"' +
            (title ? ' title="' + title + '"' : "") + '>';
        }
      );

      value = value.replace(
        /\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+|\\/[^\\s)]*)\\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );

      value = value.replace(/\\*\\*(.+?)\\*\\*/g, "<strong>$1</strong>");
      value = value.replace(/\\*(.+?)\\*/g, "<em>$1</em>");
      value = value.replace(/\`([^\`]+)\`/g, "<code>$1</code>");

      return value;
    }

    function renderMarkdown(markdown) {
      const lines = markdown.replace(/\\r/g, "").split("\\n");
      const output = [];
      let paragraph = [];
      let inList = false;
      let inCode = false;
      let codeLines = [];

      function flushParagraph() {
        if (paragraph.length) {
          output.push("<p>" +
            paragraph.map(inlineMarkdown).join("<br>") +
            "</p>");
          paragraph = [];
        }
      }

      function closeList() {
        if (inList) {
          output.push("</ul>");
          inList = false;
        }
      }

      for (const line of lines) {
        if (line.trim().startsWith("\`\`\`")) {
          flushParagraph();
          closeList();

          if (inCode) {
            output.push("<pre><code>" +
              escapeHtml(codeLines.join("\\n")) +
              "</code></pre>");
            codeLines = [];
            inCode = false;
          } else {
            inCode = true;
          }
          continue;
        }

        if (inCode) {
          codeLines.push(line);
          continue;
        }

        if (!line.trim()) {
          flushParagraph();
          closeList();
          continue;
        }

        const heading = line.match(/^(#{1,6})\\s+(.+)$/);
        if (heading) {
          flushParagraph();
          closeList();
          const level = heading[1].length;
          output.push("<h" + level + ">" +
            inlineMarkdown(heading[2]) +
            "</h" + level + ">");
          continue;
        }

        const image = line.match(/^\\s*!\\[([^\\]]*)\\]\\(([^\\s)]+)(?:\\s+"([^"]*)")?\\)\\s*$/);
        if (image) {
          flushParagraph();
          closeList();
          output.push(inlineMarkdown(line));
          continue;
        }

        if (/^\\s*[-*+]\\s+/.test(line)) {
          flushParagraph();
          if (!inList) {
            output.push("<ul>");
            inList = true;
          }
          output.push("<li>" +
            inlineMarkdown(line.replace(/^\\s*[-*+]\\s+/, "")) +
            "</li>");
          continue;
        }

        const quote = line.match(/^\\s*>\\s?(.*)$/);
        if (quote) {
          flushParagraph();
          closeList();
          output.push("<blockquote>" +
            inlineMarkdown(quote[1]) +
            "</blockquote>");
          continue;
        }

        paragraph.push(line);
      }

      flushParagraph();
      closeList();

      if (inCode) {
        output.push("<pre><code>" +
          escapeHtml(codeLines.join("\\n")) +
          "</code></pre>");
      }

      return output.join("\\n");
    }

    async function loadArticle() {
      try {
        const response = await fetch(
          "/api/post?slug=" + encodeURIComponent(slug)
        );

        const article = await response.json();

        if (!response.ok) {
          throw new Error(article.error || "文章读取失败");
        }

        document.title = article.title + " - GlobalViewNet";
        document.getElementById("title").textContent = article.title;

        const dateElement = document.getElementById("date");
        if (article.date) {
          const date = new Date(article.date);
          dateElement.textContent = Number.isNaN(date.getTime())
            ? article.date
            : date.toLocaleDateString("zh-CN");
        }

        document.getElementById("content").innerHTML =
          renderMarkdown(article.body || "");
      } catch (error) {
        document.getElementById("title").textContent = "文章加载失败";
        const content = document.getElementById("content");
        content.className = "error";
        content.textContent =
          (error && error.message) || "请稍后重试";
      }
    }

    loadArticle();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "public, max-age=60"
    }
  });
}
