
const REPO = "krishnaxu/globalviewnet";
const BRANCH = "main";
const POSTS_PATH = "content/posts";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  });
}

// 解析文章 Markdown 文件开头的 YAML 信息
function parseFrontmatter(markdown) {
  const result = {};
  const match = markdown.match(
    /^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)/
  );

  if (!match) {
    return { meta: result, body: markdown };
  }

  const lines = match[1].split(/\r?\n/);
  let currentKey = null;
  let blockLines = [];

  function saveBlock() {
    if (currentKey !== null) {
      result[currentKey] = blockLines.join("\n").replace(/\n+$/, "");
    }
    currentKey = null;
    blockLines = [];
  }

  for (const line of lines) {
    const field = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);

    if (field) {
      saveBlock();

      const key = field[1];
      const value = field[2].trim();

      if (value === "|" || value === "|-" || value === ">" || value === ">-") {
        currentKey = key;
        continue;
      }

      result[key] = value
        .replace(/^(['"])([\s\S]*)\1$/, "$2")
        .trim();

      continue;
    }

    if (currentKey !== null) {
      blockLines.push(line.replace(/^(  |\t)/, ""));
    }
  }

  saveBlock();

  return {
    meta: result,
    body: markdown.slice(match[0].length)
  };
}

// 读取 GitHub 返回的 Base64 内容，并正确处理中文
function decodeBase64(content) {
  const binary = atob(content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

async function githubRequest(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API 请求失败：${response.status}`);
  }

  return response.json();
}

function getString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getSlug(filename) {
  return filename.replace(/\.md$/i, "");
}

export async function onRequestGet({ request, env }) {
  try {
    const token = env.GITHUB_CONTENT_TOKEN;

    if (!token) {
      return json({
        error: "服务器尚未配置 GITHUB_CONTENT_TOKEN"
      }, 500);
    }

    const url = new URL(request.url);
    const category = url.searchParams.get("category") || "";
    const lang = url.searchParams.get("lang") === "en" ? "en" : "zh";

    // 读取文章目录
    const filesUrl =
      `https://api.github.com/repos/${REPO}/contents/${POSTS_PATH}` +
      `?ref=${encodeURIComponent(BRANCH)}`;

    const files = await githubRequest(filesUrl, token);

    if (!Array.isArray(files)) {
      return json({
        error: "文章目录返回格式异常，请检查 GitHub 仓库目录"
      }, 502);
    }

    const markdownFiles = files.filter(file =>
      file.type === "file" &&
      file.name.toLowerCase().endsWith(".md")
    );

    // 读取并筛选文章。没有 published: true 的文章默认不公开。
    const results = await Promise.all(
      markdownFiles.map(async file => {
        const fileData = await githubRequest(file.url, token);
        const markdown = decodeBase64(fileData.content || "");
        const { meta } = parseFrontmatter(markdown);

        // CMS 中勾选“是否发布到网站”后，YAML 应保存为 published: true
        if (String(meta.published || "").toLowerCase() !== "true") {
          return null;
        }

        const slug = getSlug(file.name);
        const titleZh = getString(meta.title_zh || meta.title);
        const titleEn = getString(meta.title_en || meta.title);
        const excerptZh = getString(meta.excerpt_zh || meta.excerpt);
        const excerptEn = getString(meta.excerpt_en || meta.excerpt);
        const articleCategory = getString(meta.category) || "tech";
        const date = getString(meta.date);
        const coverImage = getString(meta.cover_image);
        const sourceName = getString(meta.source_name);
        const sourceUrl = getString(meta.source_url);

        return {
          slug,
          title: lang === "en"
            ? (titleEn || titleZh)
            : (titleZh || titleEn),
          title_zh: titleZh,
          title_en: titleEn,
          excerpt: lang === "en"
            ? (excerptEn || excerptZh)
            : (excerptZh || excerptEn),
          excerpt_zh: excerptZh,
          excerpt_en: excerptEn,
          category: articleCategory,
          date,
          cover_image: coverImage,
          source_name: sourceName,
          source_url: sourceUrl,
          url: `/posts/${encodeURIComponent(slug)}`,
          url_zh: `/posts/${encodeURIComponent(slug)}`,
          url_en: `/posts/${encodeURIComponent(slug)}?lang=en`
        };
      })
    );

    let posts = results.filter(Boolean);

    if (category) {
      posts = posts.filter(post => post.category === category);
    }

    posts.sort((a, b) => {
      const dateA = Date.parse(a.date) || 0;
      const dateB = Date.parse(b.date) || 0;
      return dateB - dateA;
    });

    return json({
      success: true,
      total: posts.length,
      lang,
      posts
    });
  } catch (error) {
    return json({
      error: "获取文章列表失败",
      detail: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}
