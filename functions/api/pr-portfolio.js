
const REPO = "krishnaxu/globalviewnet";
const BRANCH = "main";
const PORTFOLIO_PATH = "content/pr-portfolio";
const REVIEW_FILE = "review.json";

const ARCHIVE_FILES = [
  {
    name: "company-news.json",
    source: "GenScript Official Website",
    prefix: "company"
  },
  {
    name: "wechat-articles.json",
    source: "Industry News",
    prefix: "wechat"
  }
];

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: HEADERS
  });
}

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
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "globalviewnet-pr-portfolio/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API 请求失败：${response.status}`);
  }

  return response.json();
}

function parseMarkdown(markdown) {
  const lines = markdown.replace(/^\uFEFF/, "").split(/\r?\n/);

  if (lines[0]?.trim() !== "---") {
    return { meta: {}, body: markdown.trim() };
  }

  const endIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---"
  );

  if (endIndex === -1) {
    return { meta: {}, body: markdown.trim() };
  }

  const meta = {};

  for (const line of lines.slice(1, endIndex)) {
    const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);

    if (match) {
      meta[match[1]] = match[2]
        .trim()
        .replace(/^(['"])(.*)\1$/, "$2");
    }
  }

  return {
    meta,
    body: lines.slice(endIndex + 1).join("\n").trim()
  };
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isTrue(value) {
  return value === true ||
    String(value ?? "").trim().toLowerCase() === "true";
}

function makeSlug(value, prefix) {
  const normalized = text(value)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

  return `${prefix}-${normalized || "article"}`;
}

function stripMarkup(value) {
  return text(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function excerptFrom(body) {
  return stripMarkup(body)
    .replace(/^#+\s*/gm, "")
    .slice(0, 240);
}

// 统一文章链接格式，避免末尾斜杠不同导致审核记录失效。
function normalizeUrl(value) {
  const raw = text(value);

  if (!raw) return "";

  try {
    const url = new URL(raw);
    url.hash = "";

    // 去除常见跟踪参数，但保留其他可能影响文章识别的参数。
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid)$/i.test(key)) {
        url.searchParams.delete(key);
      }
    }

    url.hostname = url.hostname.toLowerCase();

    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

async function readEntry(file, token) {
  const fileData = await githubRequest(file.url, token);
  const markdown = decodeBase64(fileData.content || "");
  const { meta, body } = parseMarkdown(markdown);

  if (!isTrue(meta.published)) {
    throw new Error(
      `文章未发布或 published 字段不是 true：title=${JSON.stringify(meta.title)}, source_url=${JSON.stringify(meta.source_url)}`
    );
  }

  const entry = {
    slug: file.name.replace(/\.md$/i, ""),
    title: text(meta.title),
    source: text(meta.source),
    source_url: text(meta.source_url),
    date: text(meta.date),
    excerpt: text(meta.excerpt),
    cover_image: text(meta.cover_image),
    body
  };

  if (!entry.title || !entry.source_url) {
    return null;
  }

  return entry;
}

function getArchiveItems(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object") {
    for (const key of ["entries", "articles", "items", "news", "results"]) {
      if (Array.isArray(data[key])) {
        return data[key];
      }
    }
  }

  throw new Error("JSON 归档格式异常：未找到文章数组");
}

async function readJsonFile(file, token) {
  if (file.download_url) {
    const response = await fetch(file.download_url, {
      headers: { "Cache-Control": "no-cache" }
    });

    if (!response.ok) {
      throw new Error(`读取 ${file.name} 失败：HTTP ${response.status}`);
    }

    return response.json();
  }

  const fileData = await githubRequest(file.url, token);
  return JSON.parse(decodeBase64(fileData.content || ""));
}

// 读取独立审核记录。只有明确设置为 false 的文章才会被隐藏。
async function readReviewMap(files, token) {
  const reviewFile = files.find(file =>
    file.type === "file" && file.name === REVIEW_FILE
  );

  if (!reviewFile) {
    return new Map();
  }

  const data = await readJsonFile(reviewFile, token);
  const reviews = Array.isArray(data)
    ? data
    : Array.isArray(data?.reviews)
      ? data.reviews
      : null;

  if (!reviews) {
    throw new Error(
      `${REVIEW_FILE} 格式异常：需要包含 reviews 数组`
    );
  }

  const reviewMap = new Map();

  for (const review of reviews) {
    if (!review || typeof review !== "object") continue;

    const url = normalizeUrl(
      review.url || review.source_url || review.sourceUrl
    );

    if (!url) continue;

    reviewMap.set(url, {
      title: text(review.title),
      include: review.include_in_portfolio !== false &&
        String(review.include_in_portfolio).toLowerCase() !== "false"
    });
  }

  return reviewMap;
}

async function readArchive(file, token, archive) {
  const data = await readJsonFile(file, token);
  const items = getArchiveItems(data);
  const entries = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;

    const title = text(item.title || item.name);
    const sourceUrl = text(
      item.source_url ||
      item.url ||
      item.link ||
      item.article_url ||
      item.articleUrl
    );

    if (!title || !sourceUrl) continue;

    const body = text(
      item.body ||
      item.content ||
      item.article_body ||
      item.articleBody ||
      item.text
    );

    const date = text(
      item.date ||
      item.published_at ||
      item.publishedAt ||
      item.publish_date ||
      item.publishDate ||
      item.created_at ||
      item.createdAt
    );

    const slug = text(item.slug) ||
      makeSlug(sourceUrl, archive.prefix);

    entries.push({
      slug: slug.startsWith(`${archive.prefix}-`)
        ? slug
        : `${archive.prefix}-${slug}`,
      title,
      source: text(item.source) || archive.source,
      source_url: sourceUrl,
      date,
      excerpt: text(
        item.excerpt ||
        item.description ||
        item.summary ||
        item.digest
      ) || excerptFrom(body),
      cover_image: text(
        item.cover_image ||
        item.coverImage ||
        item.cover ||
        item.image ||
        item.thumb_url ||
        item.thumbUrl
      ),
      body
    });
  }

  return {
    entries,
    itemCount: items.length
  };
}

export async function onRequestGet({ env }) {
  try {
    const token = env.GITHUB_CONTENT_TOKEN;

    if (!token) {
      return json({
        success: false,
        error: "服务器未配置 GitHub Token"
      }, 500);
    }

    const url =
      `https://api.github.com/repos/${REPO}/contents/${PORTFOLIO_PATH}` +
      `?ref=${encodeURIComponent(BRANCH)}`;

    const files = await githubRequest(url, token);

    if (!Array.isArray(files)) {
      return json({
        success: false,
        error: "作品集目录格式异常",
        result: files
      }, 502);
    }

    const markdownFiles = files.filter(file =>
      file.type === "file" &&
      typeof file.name === "string" &&
      file.name.toLowerCase().endsWith(".md")
    );

    const diagnostics = [];
    const entries = [];

    // 第一部分：读取现有 CMS Markdown 文章。
    for (const file of markdownFiles) {
      try {
        const entry = await readEntry(file, token);

        if (entry) {
          entries.push(entry);
          diagnostics.push({
            file: file.name,
            status: "included",
            title: entry.title,
            type: "cms"
          });
        } else {
          diagnostics.push({
            file: file.name,
            status: "excluded",
            reason: "缺少 title 或 source_url 字段",
            type: "cms"
          });
        }
      } catch (error) {
        diagnostics.push({
          file: file.name,
          status: "error",
          reason: error instanceof Error ? error.message : String(error),
          type: "cms"
        });
      }
    }

    // 第二部分：读取公司新闻和行业新闻 JSON 归档。
    const archiveCounts = {};

    for (const archive of ARCHIVE_FILES) {
      const file = files.find(item =>
        item.type === "file" && item.name === archive.name
      );

      if (!file) {
        archiveCounts[archive.name] = 0;
        diagnostics.push({
          file: archive.name,
          status: "missing",
          reason: "未在作品集目录中找到该归档文件",
          type: "archive"
        });
        continue;
      }

      try {
        const result = await readArchive(file, token, archive);
        archiveCounts[archive.name] = result.entries.length;

        entries.push(...result.entries);

        diagnostics.push({
          file: archive.name,
          status: "included",
          count: result.entries.length,
          sourceItems: result.itemCount,
          type: "archive"
        });
      } catch (error) {
        archiveCounts[archive.name] = 0;
        diagnostics.push({
          file: archive.name,
          status: "error",
          reason: error instanceof Error ? error.message : String(error),
          type: "archive"
        });
      }
    }

    // 第三部分：读取人工审核记录。
    let reviewMap = new Map();

    try {
      reviewMap = await readReviewMap(files, token);
      diagnostics.push({
        file: REVIEW_FILE,
        status: "included",
        reviewCount: reviewMap.size,
        type: "review"
      });
    } catch (error) {
      // 审核文件存在但读取失败时，不静默忽略，以免被剔除文章重新显示。
      diagnostics.push({
        file: REVIEW_FILE,
        status: "error",
        reason: error instanceof Error ? error.message : String(error),
        type: "review"
      });

      return json({
        success: false,
        error: "读取 PR Portfolio 人工审核记录失败；为避免错误展示，已停止返回文章",
        detail: error instanceof Error ? error.message : String(error),
        diagnostics
      }, 500);
    }

    // 第四部分：按原文 URL 去重，CMS Markdown 优先。
    const uniqueEntries = [];
    const seenUrls = new Set();

    for (const entry of entries) {
      const key = normalizeUrl(entry.source_url);

      if (!key || seenUrls.has(key)) continue;

      seenUrls.add(key);
      uniqueEntries.push(entry);
    }

    // 第五部分：过滤人工取消展示的文章。
    const hiddenEntries = [];
    const visibleEntries = [];

    for (const entry of uniqueEntries) {
      const key = normalizeUrl(entry.source_url);
      const review = reviewMap.get(key);

      if (review && review.include === false) {
        hiddenEntries.push({
          title: entry.title,
          source_url: entry.source_url
        });
        continue;
      }

      visibleEntries.push(entry);
    }

    visibleEntries.sort((a, b) =>
      (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)
    );

    diagnostics.push({
      type: "review-summary",
      totalBeforeReview: uniqueEntries.length,
      hiddenCount: hiddenEntries.length,
      visibleCount: visibleEntries.length
    });

    return json({
      success: true,
      scannedFiles: files.map(file => ({
        name: file.name,
        type: file.type
      })),
      markdownFileCount: markdownFiles.length,
      archiveCounts,
      reviewCount: reviewMap.size,
      hiddenCount: hiddenEntries.length,
      total: visibleEntries.length,
      entries: visibleEntries,
      diagnostics
    });
  } catch (error) {
    return json({
      success: false,
      error: "获取 PR Portfolio 失败",
      detail: error instanceof Error ? error.message : String(error)
    }, 500);
  }
}
