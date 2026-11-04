import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_FILE = path.join(ROOT, "wechat-news.json");

const QUERY = "DrG的雍熙路";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/130.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Referer": "https://weixin.sogou.com/"
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
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

function normalizeUrl(raw = "") {
  if (!raw) return "";

  try {
    return new URL(
      decodeHtml(raw),
      "https://weixin.sogou.com"
    ).toString();
  } catch {
    return "";
  }
}

function isWechatUrl(raw = "") {
  try {
    const url = new URL(raw);

    return (
      url.hostname === "mp.weixin.qq.com" &&
      (
        url.pathname === "/s" ||
        url.pathname.startsWith("/s/")
      )
    );
  } catch {
    return false;
  }
}

function createId(value = "") {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return `wechat-${(hash >>> 0).toString(16)}`;
}

async function request(url, redirect = "follow") {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    20000
  );

  try {
    const response = await fetch(url, {
      headers: HEADERS,
      redirect,
      signal: controller.signal
    });

    const body = await response.text();

    return {
      response,
      body
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseSearchResults(html) {
  const articles = [];

  const blocks = html.match(
    /<li\b[^>]*id=["']sogou_vr_[^"']*["'][^>]*>[\s\S]*?<\/li>/gi
  ) || [];

  for (const block of blocks) {
    const anchor =
      block.match(
        /<h3[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i
      ) ||
      block.match(
        /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i
      );

    if (!anchor) continue;

    const link = normalizeUrl(anchor[1]);
    const title = stripHtml(anchor[2]);

    if (!link || !title) continue;

    const summaryMatch = block.match(
      /<p[^>]*class=["'][^"']*txt-info[^"']*["'][^>]*>([\s\S]*?)<\/p>/i
    );

    const accountMatches = [
      ...block.matchAll(
        /<a[^>]*>([\s\S]*?)<\/a>/gi
      )
    ];

    let account = "";

    for (const match of accountMatches) {
      const text = stripHtml(match[1]);

      if (
        text.includes("DrG") ||
        text.includes("雍熙路")
      ) {
        account = text;
        break;
      }
    }

    articles.push({
      title,
      searchLink: link,
      summary: summaryMatch
        ? stripHtml(summaryMatch[1])
        : "",
      account
    });
  }

  return articles;
}

function extractDirectWechatUrl(text = "") {
  const decoded = decodeHtml(text)
    .replace(/\\\//g, "/")
    .replace(/\\x26/gi, "&")
    .replace(/\\x3d/gi, "=")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003d/gi, "=");

  const matches = decoded.match(
    /https?:\/\/mp\.weixin\.qq\.com\/s(?:\/[A-Za-z0-9_-]+|\?[^"'<> ]+)/gi
  ) || [];

  for (const match of matches) {
    if (isWechatUrl(match)) {
      return match;
    }
  }

  return "";
}

function rebuildSogouJavascriptUrl(html = "") {
  const fragments = [];

  const patterns = [
    /url\s*\+=\s*['"]([^'"]+)['"]/gi,
    /url\s*=\s*url\s*\+\s*['"]([^'"]+)['"]/gi
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      fragments.push(match[1]);
    }
  }

  if (!fragments.length) {
    return "";
  }

  const combined = fragments
    .join("")
    .replace(/\\\//g, "/")
    .replace(/\\x26/gi, "&")
    .replace(/\\x3d/gi, "=")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003d/gi, "=");

  const direct = extractDirectWechatUrl(combined);

  if (direct) {
    return direct;
  }

  const normalized = normalizeUrl(combined);

  return isWechatUrl(normalized)
    ? normalized
    : "";
}

async function resolveCandidate(candidate) {
  console.log(
    `[wechat] 正在解析候选：${candidate.title}`
  );

  try {
    if (isWechatUrl(candidate.searchLink)) {
      return candidate.searchLink;
    }

    const first = await request(
      candidate.searchLink,
      "manual"
    );

    const location =
      first.response.headers.get("location");

    if (location) {
      const redirected = normalizeUrl(location);

      if (isWechatUrl(redirected)) {
        return redirected;
      }
    }

    let articleUrl =
      extractDirectWechatUrl(first.body);

    if (articleUrl) {
      return articleUrl;
    }

    articleUrl =
      rebuildSogouJavascriptUrl(first.body);

    if (articleUrl) {
      return articleUrl;
    }

    /*
     * 搜狗跳转页可能通过 JavaScript 分段生成 URL。
     * 再尝试解析所有字符串片段。
     */
    const quotedStrings = [
      ...first.body.matchAll(
        /['"]([^'"]{5,})['"]/g
      )
    ].map(match => match[1]);

    const combined = quotedStrings
      .join("")
      .replace(/\\\//g, "/")
      .replace(/\\x26/gi, "&")
      .replace(/\\x3d/gi, "=");

    articleUrl =
      extractDirectWechatUrl(combined);

    if (articleUrl) {
      return articleUrl;
    }

    console.log(
      `[wechat] 未解析出微信地址：${candidate.title}`
    );

    return "";
  } catch (error) {
    console.log(
      `[wechat] 候选解析失败：${error.message}`
    );

    return "";
  }
}

function readExisting() {
  if (!fs.existsSync(OUTPUT_FILE)) {
    return [];
  }

  try {
    const data = JSON.parse(
      fs.readFileSync(OUTPUT_FILE, "utf8")
    );

    if (!Array.isArray(data)) {
      return [];
    }

    return data.filter(item =>
      isWechatUrl(item.url || item.link || "")
    );
  } catch {
    return [];
  }
}

function deduplicate(items) {
  const urls = new Set();
  const titles = new Set();

  return items.filter(item => {
    const url = item.url || item.link || "";

    const title = String(item.title || "")
      .replace(/\s+/g, "")
      .toLowerCase();

    if (!isWechatUrl(url)) {
      return false;
    }

    if (!title) {
      return false;
    }

    if (
      urls.has(url) ||
      titles.has(title)
    ) {
      return false;
    }

    urls.add(url);
    titles.add(title);

    return true;
  });
}

async function main() {
  console.log("[wechat] 微信自动发现开始");

  const params = new URLSearchParams({
    type: "2",
    query: QUERY,
    ie: "utf8",
    _sug_: "n",
    _sug_type_: ""
  });

  const searchUrl =
    "https://weixin.sogou.com/weixin?" +
    params.toString();

  const { response, body } =
    await request(searchUrl);

  console.log(
    `[wechat] 搜索 HTTP ${response.status}`
  );

  console.log(
    `[wechat] 搜索页面长度 ${body.length}`
  );

  if (
    /验证码|访问过于频繁|异常访问|请输入验证码|antispider/i.test(
      body
    )
  ) {
    throw new Error(
      "首次搜索即触发搜狗反爬"
    );
  }

  const candidates =
    parseSearchResults(body);

  console.log(
    `[wechat] 搜狗返回 ${candidates.length} 个候选`
  );

  const discovered = [];

  for (
    const candidate of candidates.slice(0, 10)
  ) {
    const articleUrl =
      await resolveCandidate(candidate);

    if (articleUrl) {
      console.log(
        `[wechat] 成功解析：${candidate.title}`
      );

      console.log(
        `[wechat] 微信地址：${articleUrl}`
      );

      discovered.push({
        id: createId(articleUrl),
        title: candidate.title,
        url: articleUrl,
        link: articleUrl,
        summary: candidate.summary,
        description: candidate.summary,
        source:
          candidate.account ||
          "DrG的雍熙路",
        platform: "wechat",
        category: "微信",
        keyword: QUERY,
        publishedAt: "",
        pubDate: "",
        collectedAt:
          new Date().toISOString()
      });
    }

    /*
     * 故意放慢速度，减少触发搜狗反爬。
     */
    await sleep(3500);
  }

  const existing =
    readExisting();

  const finalItems =
    deduplicate([
      ...discovered,
      ...existing
    ]).slice(0, 100);

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      finalItems,
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log(
    `[wechat] 本次成功发现 ${deduplicate(discovered).length} 篇真实微信文章`
  );

  console.log(
    `[wechat] 微信文章累计 ${finalItems.length} 篇`
  );

  console.log(
    "[wechat] 微信自动发现完成"
  );
}

main().catch(error => {
  console.error(
    "[wechat] 运行失败：",
    error.message
  );

  process.exitCode = 1;
});
