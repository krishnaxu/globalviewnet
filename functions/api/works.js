
const REPO = "krishnaxu/globalviewnet";
const BRANCH = "main";
const WORKS_PATH = "content/works";
const PAGE_SIZE = 25;

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

function parseFrontmatter(markdown) {
  const match = markdown.match(
    /^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)/
  );

  const meta = {};
  if (!match) return meta;

  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);

    if (field) {
      meta[field[1]] = field[2]
        .trim()
        .replace(/^(['"])([\s\S]*)\1$/, "$2")
        .trim();
    }
  }

  return meta;
}

function decodeBase64(content) {
  const binary = atob(content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(
    binary,
    char => char.charCodeAt(0)
  );

  return new TextDecoder("utf-8").decode(bytes);
}

async function githubRequest(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "globalviewnet-cms/1.0"
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

function isTrue(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

export async function onRequestGet({ request, env }) {
  try {
    const token = env.GITHUB_CONTENT_TOKEN;

    if (!token) {
      return json({
        success: false,
        error: "服务器未配置 GitHub Token"
      }, 500);
    }

    const requestUrl = new URL(request.url);
    const requestedPage = Number.parseInt(
      requestUrl.searchParams.get("page") || "1",
      10
    );

    const page = Number.isFinite(requestedPage)
      ? Math.max(1, requestedPage)
      : 1;

    const filesUrl =
      `https://api.github.com/repos/${REPO}/contents/${WORKS_PATH}` +
      `?ref=${encodeURIComponent(BRANCH)}`;

    const files = await githubRequest(filesUrl, token);

    if (!Array.isArray(files)) {
      return json({
        success: false,
        error: "作品目录格式异常"
      }, 502);
    }

    const markdownFiles = files
      .filter(file =>
        file.type === "file" &&
        typeof file.name === "string" &&
        file.name.toLowerCase().endsWith(".md")
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    const totalFiles = markdownFiles.length;
    const totalPages = Math.ceil(totalFiles / PAGE_SIZE);
    const start = (page - 1) * PAGE_SIZE;
    const pageFiles = markdownFiles.slice(start, start + PAGE_SIZE);

    // 每次只读取当前页的 Markdown 文件，控制子请求数量。
    const results = await Promise.all(
      pageFiles.map(async file => {
        const fileData = await githubRequest(file.url, token);
        const markdown = decodeBase64(fileData.content || "");
        const meta = parseFrontmatter(markdown);

        if (!isTrue(meta.published)) return null;

        return {
          slug: getString(meta.slug) ||
            file.name.replace(/\.md$/i, ""),
          title: getString(meta.title),
          original_url: getString(meta.original_url),
          platform: getString(meta.platform) || "人民网",
          date: getString(meta.date),
          excerpt: getString(meta.excerpt),
          cover_image: getString(meta.cover_image)
        };
      })
    );

    const works = results.filter(work =>
      work && work.title && work.original_url
    );

    works.sort((a, b) =>
      (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)
    );

    return json({
      success: true,
      total: totalFiles,
      page,
      page_size: PAGE_SIZE,
      total_pages: totalPages,
      has_more: page < totalPages,
      works
    });
  } catch (error) {
    return json({
      success: false,
      error: "获取作品列表失败",
      detail: error instanceof Error
        ? error.message
        : String(error)
    }, 500);
  }
}
