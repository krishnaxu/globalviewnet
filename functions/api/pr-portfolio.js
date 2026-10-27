
const REPO = "krishnaxu/globalviewnet";
const BRANCH = "main";
const PORTFOLIO_PATH = "content/pr-portfolio";

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
      "User-Agent": "globalviewnet-pr-portfolio/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API 请求失败：${response.status}`);
  }

  return response.json();
}

function parseMarkdown(markdown) {
  const match = markdown.match(
    /^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)/
  );

  if (!match) {
    return { meta: {}, body: markdown.trim() };
  }

  const meta = {};
  let currentKey = "";
  let blockLines = [];

  function saveBlock() {
    if (currentKey) {
      meta[currentKey] = blockLines.join("\n").trim();
    }
    currentKey = "";
    blockLines = [];
  }

  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);

    if (field) {
      saveBlock();

      const key = field[1];
      const value = field[2].trim();

      if (["|", "|-", ">", ">-"].includes(value)) {
        currentKey = key;
      } else {
        meta[key] = value
          .replace(/^(['"])([\s\S]*)\1$/, "$2")
          .trim();
      }
    } else if (currentKey) {
      blockLines.push(line.replace(/^(  |\t)/, ""));
    }
  }

  saveBlock();

  return {
    meta,
    body: markdown.slice(match[0].length).trim()
  };
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isTrue(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

async function readEntry(file, token) {
  const fileData = await githubRequest(file.url, token);
  const markdown = decodeBase64(fileData.content || "");
  const { meta, body } = parseMarkdown(markdown);

  if (!isTrue(meta.published)) {
    return null;
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

    for (const file of markdownFiles) {
      try {
        const entry = await readEntry(file, token);

        if (entry) {
          entries.push(entry);
          diagnostics.push({
            file: file.name,
            status: "included",
            title: entry.title
          });
        } else {
          diagnostics.push({
            file: file.name,
            status: "excluded",
            reason: "published is not true, or title/source_url is missing"
          });
        }
      } catch (error) {
        diagnostics.push({
          file: file.name,
          status: "error",
          reason: error instanceof Error
            ? error.message
            : String(error)
        });
      }
    }

    entries.sort((a, b) =>
      (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)
    );

    return json({
      success: true,
      scannedFiles: files.map(file => ({
        name: file.name,
        type: file.type
      })),
      markdownFileCount: markdownFiles.length,
      total: entries.length,
      entries,
      diagnostics
    });
  } catch (error) {
    return json({
      success: false,
      error: "获取 PR Portfolio 失败",
      detail: error instanceof Error
        ? error.message
        : String(error)
    }, 500);
  }
}
