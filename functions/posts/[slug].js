
export async function onRequestGet({ request, params }) {
  const slug = params.slug;

  if (
    !slug ||
    slug.includes("/") ||
    slug.includes("\\") ||
    slug.includes("..")
  ) {
    return new Response("文章地址无效", { status: 400 });
  }

  const apiUrl = new URL("/api/post", request.url);
  apiUrl.searchParams.set("slug", slug);

  try {
    const response = await fetch(apiUrl.toString());

    if (!response.ok) {
      return new Response(
        response.status === 404
          ? "文章不存在"
          : "暂时无法读取文章，请稍后再试",
        {
          status: response.status === 404 ? 404 : 502,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        }
      );
    }

    const post = await response.json();

    const escapeHtml = (value) =>
      String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);

    const renderInline = (text) => {
      let result = escapeHtml(text);

      result = result.replace(
        /!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)/g,
        (_, alt, src, title) => {
          const safeSrc = src.replace(/&amp;/g, "&");
          if (!/^\/public\/images\/uploads\/[\w./%\-]+$/i.test(safeSrc)) {
            return escapeHtml(alt || "图片");
          }

          return `<img src="${escapeHtml(safeSrc)}" alt="${escapeHtml(alt)}" title="${escapeHtml(title || "")}" loading="lazy">`;
        }
      );

      result = result.replace(
        /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
        (_, label, href) =>
          `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
      );

      result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");

      return result;
    };

    const renderMarkdown = (markdown) => {
      const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
      const output = [];
      let paragraph = [];
      let inList = false;

      const flushParagraph = () => {
        if (paragraph.length) {
          output.push(`<p>${paragraph.map(renderInline).join("<br>")}</p>`);
          paragraph = [];
        }
      };

      const closeList = () => {
        if (inList) {
          output.push("</ul>");
          inList = false;
        }
      };

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
          flushParagraph();
          closeList();
          continue;
        }

        const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
          flushParagraph();
          closeList();
          const level = heading[1].length;
          output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
          continue;
        }

        const listItem = trimmed.match(/^[-*]\s+(.+)$/);
        if (listItem) {
          flushParagraph();
          if (!inList) {
            output.push("<ul>");
            inList = true;
          }
          output.push(`<li>${renderInline(listItem[1])}</li>`);
          continue;
        }

        closeList();
        paragraph.push(trimmed);
      }

      flushParagraph();
      closeList();

      return output.join("\n");
    };

    const title = escapeHtml(post.title || slug);
    const date = escapeHtml(post.date || "");
    const body = renderMarkdown(post.body || "");

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="index,follow">
  <title>${title} - GlobalViewNet</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #222;
      background: #f6f7f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
        "Microsoft YaHei", sans-serif;
      line-height: 1.85;
    }
    header {
      padding: 18px 24px;
      background: #fff;
      border-bottom: 1px solid #e8e8e8;
    }
    header a {
      color: #222;
      font-size: 18px;
      font-weight: 700;
      text-decoration: none;
    }
    main {
      max-width: 850px;
      margin: 36px auto;
      padding: 36px 42px;
      background: #fff;
      border-radius: 10px;
    }
    h1 {
      margin: 0 0 14px;
      font-size: clamp(26px, 4vw, 36px);
      line-height: 1.4;
      overflow-wrap: anywhere;
    }
    .date {
      margin-bottom: 30px;
      color: #888;
      font-size: 14px;
    }
    article { overflow-wrap: anywhere; }
    article h2, article h3 { margin-top: 30px; line-height: 1.5; }
    article p { margin: 0 0 20px; }
    article img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 22px auto;
      border-radius: 4px;
    }
    article a { color: #1769aa; }
    footer {
      padding: 20px;
      color: #888;
      text-align: center;
      font-size: 13px;
    }
    @media (max-width: 600px) {
      main {
        margin: 16px 10px;
        padding: 24px 18px;
      }
      header { padding: 16px; }
    }
  </style>
</head>
<body>
  <header><a href="/">GlobalViewNet</a></header>
  <main>
    <h1>${title}</h1>
    <div class="date">${date}</div>
    <article>${body}</article>
  </main>
  <footer>GlobalViewNet</footer>
</body>
</html>`;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60"
      }
    });
  } catch {
    return new Response("读取文章失败，请稍后再试", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}
