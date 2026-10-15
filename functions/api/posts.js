
function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseFrontmatter(content) {
  const match = content.match(
    /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/
  );
  if (!match) return {};

  const lines = match[1].split(/\r?\n/);
  const data = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const item = line.match(/^([A-Za-z0-9_-]+):(?:[ \t]*(.*))?$/);
    if (!item) continue;

    const key = item[1];
    let value = item[2] || "";

    if (/^[|>][+-]?\d?$/.test(value.trim())) {
      const folded = value.trim().startsWith(">");
      const block = [];

      while (i + 1 < lines.length) {
        const next = lines[i + 1];

        if (next.trim() && !/^\s/.test(next)) break;

        i++;
        block.push(next);
      }

      const nonEmpty = block.filter((s) => s.trim());
      const indent = nonEmpty.length
        ? Math.min(...nonEmpty.map((s) => s.match(/^\s*/)[0].length))
        : 0;

      const text = block.map((s) => s.slice(indent));
      value = folded
        ? text.join(" ").trim()
        : text.join("\n");

      if (value && !value.endsWith("\n") && !value.endsWith("\n\n")) {
        // 保留 Markdown 正文内容，不额外添加换行
      }
    } else {
      value = value.trim();

      if (value.startsWith('"') && value.endsWith('"')) {
        try {
          value = JSON.parse(value);
        } catch {
          value = value.slice(1, -1);
        }
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1).replace(/''/g, "'");
      }
    }

    data[key] = String(value);
  }

  return data;
}

export async function onRequestGet({ env }) {
  const token = env.GITHUB_CONTENT_TOKEN;

  if (!token) {
    return Response.json(
      { error: "缺少 GITHUB_CONTENT_TOKEN 环境变量" },
      { status: 500 }
    );
  }

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: "Bearer " + token,
    "X-GitHub-Api-Version": "2022-11-28",
    "user-agent": "globalviewnet-pages/1.0"
  };

  const apiUrl =
    "https://api.github.com/repos/krishnaxu/globalviewnet/contents/content/posts?ref=main";

  try {
    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
      const detail = await response.text();
      return Response.json(
        {
          error: "读取文章列表失败",
          status: response.status,
          detail: detail.slice(0, 1500)
        },
        { status: 502 }
      );
    }

    const files = await response.json();

    if (!Array.isArray(files)) {
      return Response.json(
        {
          error: "文章目录返回格式异常",
          detail: JSON.stringify(files).slice(0, 1500)
        },
        { status: 502 }
      );
    }

    const markdownFiles = files.filter(
      (file) =>
        file.type === "file" &&
        file.name.toLowerCase().endsWith(".md")
    );

    const posts = await Promise.all(
      markdownFiles.map(async (file) => {
        const contentUrl =
          "https://api.github.com/repos/krishnaxu/globalviewnet/contents/" +
          file.path.split("/").map(encodeURIComponent).join("/") +
          "?ref=main";

        const contentResponse = await fetch(contentUrl, { headers });

        if (!contentResponse.ok) {
          throw new Error(
            "读取文章文件失败：" + file.name +
            "；状态码：" + contentResponse.status
          );
        }

        const data = await contentResponse.json();

        if (!data.content) {
          throw new Error("文章内容为空：" + file.name);
        }

        const content = decodeBase64Utf8(data.content);
        const meta = parseFrontmatter(content);
        const slug = file.name.replace(/\.md$/i, "");

        return {
          slug,
          category: meta.category || "tech",
          date: meta.date || "",
          title: meta.title_zh || meta.title_en || meta.title || slug,
          title_zh: meta.title_zh || meta.title || "",
          title_en: meta.title_en || "",
          excerpt_zh: meta.excerpt_zh || "",
          excerpt_en: meta.excerpt_en || "",
          cover_image: meta.cover_image || "",
          source_name: meta.source_name || "",
          source_url: meta.source_url || "",
          url: "/posts/" + encodeURIComponent(slug),
          url_zh: "/zh/posts/" + encodeURIComponent(slug),
          url_en: "/en/posts/" + encodeURIComponent(slug)
        };
      })
    );

    posts.sort((a, b) => {
      const dateA = Date.parse(a.date) || 0;
      const dateB = Date.parse(b.date) || 0;
      return dateB - dateA;
    });

    return Response.json(posts, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json(
      {
        error: "读取文章列表时发生错误",
        detail: error instanceof Error ? error.message : "未知错误"
      },
      { status: 502 }
    );
  }
}
