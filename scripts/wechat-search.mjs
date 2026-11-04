import fs from "node:fs";
import path from "node:path";

const OUTPUT_FILE = path.join(
  process.cwd(),
  "wechat-candidates.json"
);

const QUERY = "DrG的雍熙路";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/130.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  Referer: "https://weixin.sogou.com/"
};

function decodeHtml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value = "") {
  return decodeHtml(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value = "") {
  try {
    return new URL(
      decodeHtml(value),
      "https://weixin.sogou.com"
    ).toString();
  } catch {
    return "";
  }
}

function createId(value = "") {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return `candidate-${(hash >>> 0).toString(16)}`;
}

function parseCandidates(html) {
  const blocks =
    html.match(
      /<li\b[^>]*id=["']sogou_vr_[^"']*["'][^>]*>[\s\S]*?<\/li>/gi
    ) || [];

  const now = new Date().toISOString();
  const output = [];

  for (const block of blocks) {
    const anchor = block.match(
      /<h3\b[^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/i
    );

    if (!anchor) {
      continue;
    }

    const title = stripHtml(anchor[2]);
    const searchUrl = normalizeUrl(anchor[1]);

    if (!title || !searchUrl) {
      continue;
    }

    const summaryMatch = block.match(
      /<p\b[^>]*class=["'][^"']*txt-info[^"']*["'][^>]*>([\s\S]*?)<\/p>/i
    );

    const accountMatches = [
      ...block.matchAll(
        /<a\b[^>]*>([\s\S]*?)<\/a>/gi
      )
    ];

    const account =
      accountMatches
        .map((item) => stripHtml(item[1]))
        .find(
          (text) =>
            text.includes("DrG") ||
            text.includes("雍熙路")
        ) || "DrG的雍熙路";

    output.push({
      id: createId(title),
      title,
      account,
      summary: summaryMatch
        ? stripHtml(summaryMatch[1])
        : "",
      search_url: searchUrl,
      status: "pending_url",
      discovered_at: now
    });
  }

  return output;
}

function readExisting() {
  if (!fs.existsSync(OUTPUT_FILE)) {
    return [];
  }

  try {
    const data = JSON.parse(
      fs.readFileSync(OUTPUT_FILE, "utf8")
    );

    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function mergeCandidates(current, existing) {
  const byTitle = new Map();

  for (const item of existing) {
    if (item && item.title) {
      byTitle.set(
        item.title.trim(),
        item
      );
    }
  }

  for (const item of current) {
    const key = item.title.trim();
    const previous = byTitle.get(key);

    byTitle.set(
      key,
      previous
        ? {
            ...previous,
            ...item,
            discovered_at:
              previous.discovered_at ||
              item.discovered_at
          }
        : item
    );
  }

  return [...byTitle.values()].slice(0, 200);
}

async function main() {
  console.log(
    "[wechat] 开始发现 DrG 微信候选文章"
  );

  const params = new URLSearchParams({
    type: "2",
    query: QUERY,
    ie: "utf8",
    _sug_: "n",
    _sug_type_: ""
  });

  const url =
    "https://weixin.sogou.com/weixin?" +
    params.toString();

  const response = await fetch(url, {
    headers: HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(20000)
  });

  const html = await response.text();

  console.log(
    `[wechat] HTTP ${response.status}，页面长度 ${html.length}`
  );

  if (!response.ok) {
    throw new Error(
      `搜狗请求失败：HTTP ${response.status}`
    );
  }

  if (
    /验证码|访问过于频繁|异常访问|请输入验证码|antispider/i.test(
      html
    )
  ) {
    throw new Error(
      "搜狗触发反爬，本次不覆盖旧数据"
    );
  }

  const current = parseCandidates(html);

  console.log(
    `[wechat] 本次发现 ${current.length} 个候选标题`
  );

  if (current.length === 0) {
    throw new Error(
      "未解析到候选标题，本次不覆盖旧数据"
    );
  }

  const existing = readExisting();

  const merged = mergeCandidates(
    current,
    existing
  );

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      merged,
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log(
    `[wechat] 候选标题累计 ${merged.length} 条`
  );

  console.log(
    "[wechat] 已更新 wechat-candidates.json"
  );
}

main().catch((error) => {
  console.error(
    "[wechat] 运行失败：",
    error.message
  );

  process.exitCode = 1;
});
