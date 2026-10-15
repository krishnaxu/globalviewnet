
function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseFrontmatter(content) {
  const match = content.match(
    /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/
  );
  if (!match) return { metadata: {}, body: content };

  const lines = match[1].split(/\r?\n/);
  const metadata = {};

  for (let i = 0; i < lines.length; i++) {
    const item = lines[i].match(/^([A-Za-z0-9_-]+):(?:[ \t]*(.*))?$/);
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
      value = folded ? text.join(" ").trim() : text.join("\n");
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

    metadata[key] = String(value);
  }

  return {
    metadata,
    body: content.slice(match[0].length)
  };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const lang = url.searchParams.get("lang") === "en" ? "en" : "zh";

  if (
    !slug ||
    slug.includes("/") ||
    slug.includes("\\") ||
    slug.includes("..") ||
    slug.toLowerCase().endsWith(".md")
  ) {
    return Response.json(
      { error: "缺少有效的文章标识 slug" },
      { status: 400 }
    );
  }

  const token = env.GITHUB_CONTENT_TOKEN;

  if (!token) {
    return Response.json(
      { error: "Cloudflare 未读取到 GITHUB_CONTENT_TOKEN" },
      { status: 500 }
    );
  }

  const apiUrl =
    "https://api.github.com/repos/krishnaxu/globalviewnet/contents/content/posts/" +
    encodeURIComponent(slug) +
    ".md?ref=main";

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + token,
        "X-GitHub-Api-Version": "2022-11-28",
        "user-agent": "globalviewnet-pages/1.0"
      }
    });

    if (!response.ok) {
      const detail = await response.text();

      return Response.json(
        {
          error: "GitHub 拒绝读取文章",
          github_status: response.status,
          detail: detail.slice(0, 1500)
        },
        {
          status: 502,
          headers: { "Cache-Control": "no-store" }
        }
      );
    }

    const file = await response.json();

    if (!file.content) {
      return Response.json(
        { error: "GitHub 未返回文章正文内容" },
        { status: 502 }
      );
    }

    const content = decodeBase64Utf8(file.content);
    const parsed = parseFrontmatter(content);
    const meta = parsed.metadata;

    const legacyBody = parsed.body.trim();
    const bodyZh = meta.body_zh || legacyBody;
    const bodyEn = meta.body_en || "";

    const titleZh = meta.title_zh || meta.title || "";
    const titleEn = meta.title_en || "";

    const title = lang === "en"
      ? (titleEn || titleZh || slug)
      : (titleZh || titleEn || slug);

    const body = lang === "en"
      ? (bodyEn || bodyZh)
      : bodyZh;

    return Response.json(
      {
        slug,
        lang,
        title,
        date: meta.date || "",
        category: meta.category || "tech",
        excerpt: lang === "en"
          ? (meta.excerpt_en || meta.excerpt_zh || "")
          : (meta.excerpt_zh || meta.excerpt_en || ""),
        cover_image: meta.cover_image || "",
        source_name: meta.source_name || "",
        source_url: meta.source_url || "",
        title_zh: titleZh,
        title_en: titleEn,
        excerpt_zh: meta.excerpt_zh || "",
        excerpt_en: meta.excerpt_en || "",
        body_zh: bodyZh,
        body_en: bodyEn,
        body
      },
      {
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (error) {
    return Response.json(
      {
        error: "读取文章时发生网络错误",
        detail: error instanceof Error ? error.message : "未知错误"
      },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }
}
