import fs from "node:fs";
import path from "node:path";

const OUTPUT_FILE = path.join(
  process.cwd(),
  "wechat-news.json"
);

const QUERY = "DrG的雍熙路";

const BASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/130.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  Referer: "https://weixin.sogou.com/"
};

let sessionCookie = "";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function decodeJavascript(value = "") {
  return decodeHtml(value)
    .replace(/\\x([0-9a-f]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\");
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

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `wechat-${(hash >>> 0).toString(16)}`;
}

function saveCookies(response) {
  let values = [];

  if (
    typeof response.headers.getSetCookie === "function"
  ) {
    values = response.headers.getSetCookie();
  } else {
    const value = response.headers.get("set-cookie");

    if (value) {
      values = value.split(
        /,(?=[^;,]+=[^;,]+;)/
      );
    }
  }

  const cookieMap = new Map();

  for (const existing of sessionCookie.split(";")) {
    const part = existing.trim();
    const separator = part.indexOf("=");

    if (separator > 0) {
      cookieMap.set(
        part.slice(0, separator),
        part.slice(separator + 1)
      );
    }
  }

  for (const cookie of values) {
    const firstPart = cookie.split(";")[0];
    const separator = firstPart.indexOf("=");

    if (separator > 0) {
      cookieMap.set(
        firstPart.slice(0, separator).trim(),
        firstPart.slice(separator + 1).trim()
      );
    }
  }

  sessionCookie = [...cookieMap.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

async function request(
  url,
  {
    redirect = "follow",
    referer = "https://weixin.sogou.com/"
  } = {}
) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    20000
  );

  try {
    const headers = {
      ...BASE_HEADERS,
      Referer: referer
    };

    if (sessionCookie) {
      headers.Cookie = sessionCookie;
    }

    const response = await fetch(url, {
      headers,
      redirect,
      signal: controller.signal
    });

    saveCookies(response);

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
  const output = [];

  const blocks = html.match(
    /<li\b[^>]*id=["']sogou_vr_[^"']*["'][^>]*>[\s\S]*?<\/li>/gi
  ) || [];

  for (const block of blocks) {
    const anchor =
      block.match(
        /<h3\b[^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i
      ) ||
      block.match(
        /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i
      );

    if (!anchor) continue;

    const searchLink = normalizeUrl(anchor[1]);
    const title = stripHtml(anchor[2]);

    if (!searchLink || !title) continue;

    const summaryMatch = block.match(
      /<p\b[^>]*class=["'][^"']*txt-info[^"']*["'][^>]*>([\s\S]*?)<\/p>/i
    );

    output.push({
      title,
      searchLink,
      summary: summaryMatch
        ? stripHtml(summaryMatch[1])
        : ""
    });
  }

  return output;
}

function addSogouVerification(rawUrl) {
  const url = normalizeUrl(rawUrl);

  if (!url || !url.includes("/link?url=")) {
    return url;
  }

  if (
    url.includes("&k=") &&
    url.includes("&h=")
  ) {
    return url;
  }

  const random = Math.floor(
    Math.random() * 100
  ) + 1;

  const urlIndex = url.indexOf("url=");

  if (urlIndex < 0) {
    return url;
  }

  /*
   * 搜狗页面点击文章时，会根据链接位置生成 k 和 h。
   */
  const characterIndex =
    urlIndex + 4 + 21 + random;

  const verificationCharacter =
    url.slice(
      characterIndex,
      characterIndex + 1
    ) || "0";

  const separator =
    url.includes("?") ? "&" : "?";

  return (
    url +
    separator +
    `k=${randomionCharacter
    )}`
  );
}

function extractWechatUrl(text = "") {
  const decoded = decodeJavascript(text);

  const patterns = [
    /https?:\/\/mp\.weixin\.qq\.com\/s\/[A-Za-z0-9_-]+(?:\?[^"'<> ]*)?/gi,
    /https?:\/\/mp\.weixin\.qq\.com\/s\?[^"'<> ]+/gi
  ];

  for (const pattern of patterns) {
    const matches = decoded.match(pattern) || [];

    for (const match of matches) {
      const cleaned = match
        .replace(/[\\);,]+$/g, "")
        .replace(/&amp;/g, "&");

      if (isWechatUrl(cleaned)) {
        return cleaned;
      }
    }
  }

  return "";
}

function rebuildJavascriptUrl(html = "") {
  const fragments = [];

  const fragmentPatterns = [
    /url\s*\+=\s*[^'"]*['"]/gi,
    /url\s*=\s*url\s*\+\s*[^'"]*['"]/gi,
    /url\s*=\s*[^'"]*mp\.weixin\.qq\.com[^'"]*['"]/gi
  ];

  for (const pattern of fragmentPatterns) {
    for (const match of html.matchAll(pattern)) {
      fragments.push(match[1]);
    }
  }

  if (!fragments.length) {
    return "";
  }

  const rebuilt = decodeJavascript(
    fragments.join("")
  );

  return extractWechatUrl(rebuilt);
}

async function resolveCandidate(candidate) {
  console.log(
    `[wechat] 正在解析：${candidate.title}`
  );

  const verifiedUrl = addSogouVerification(
    candidate.searchLink
  );

  try {
    const result = await request(
      verifiedUrl,
      {
        redirect: "manual",
        referer:
          "https://weixin.sogou.com/weixin?type=2&query=" +
          encodeURIComponent(QUERY)
      }
    );

    console.log(
      `[wechat] 跳转页 HTTP ${result.response.status}`
    );

    const location =
      result.response.headers.get("location");

    if (location) {
      const redirected = normalizeUrl(location);

      if (isWechatUrl(redirected)) {
        return redirected;
      }
    }

    const direct = extractWechatUrl(result.body);

    if (direct) {
      return direct;
    }

    const rebuilt =
      rebuildJavascriptUrl(result.body);

    if (rebuilt) {
      return rebuilt;
    }

    console.log(
      `[wechat] 未解析出微信地址：${candidate.title}`
    );

    return "";
  } catch (error) {
    console.log(
      `[wechat] 解析失败：${error.message}`
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
  const output = [];

  for (const item of items) {
    const url = item.url || item.link || "";

    const titleKey = String(item.title || "")
      .replace(/\s+/g, "")
      .toLowerCase();

    if (!isWechatUrl(url)) continue;
    if (!titleKey) continue;

    if (
      urls.has(url) ||
      titles.has(titleKey)
    ) {
      continue;
    }

    urls.add(url);
    titles.add(titleKey);

    output.push({
      ...item,
      url,
      link: url
    });
  }

  return output;
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

  const searchResult = await request(searchUrl);

  console.log(
    `[wechat] 搜索 HTTP ${searchResult.response.status}`
  );

  console.log(
    `[wechat] 搜索页面长度 ${searchResult.body.length}`
  );

  if (
    /验证码|访问过于频繁|异常访问|请输入验证码|antispider/i.test(
      searchResult.body
    )
  ) {
    throw new Error("首次搜索触发搜狗反爬");
  }

  const candidates = parseSearchResults(
    searchResult.body
  );

  console.log(
    `[wechat] 搜狗返回 ${candidates.length} 个候选`
  );

  const discovered = [];

  for (const candidate of candidates) {
    const articleUrl = await resolveCandidate(
      candidate
    );

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
        source: "DrG的雍熙路",
        platform: "wechat",
        category: "微信",
        keyword: QUERY,
        publishedAt: "",
        pubDate: "",
        collectedAt:
          new Date().toISOString()
      });
    }

    await sleep(5000);
  }

  const finalItems = deduplicate([
    ...discovered,
    ...readExisting()
  ]).slice(0, 100);

  fs.writeFileSync(
    OUTPUT_FILE,
    `${JSON.stringify(finalItems, null, 2)}\n`,
    "utf8"
  );

  console.log(
    `[wechat] 本次成功发现 ${
      deduplicate(discovered).length
    } 篇真实微信文章`
  );

  console.log(
    `[wechat] 微信文章累计 ${finalItems.length} 篇`
  );

  console.log("[wechat] 微信自动发现完成");
}

main().catch(error => {
  console.error(
    "[wechat] 运行失败：",
    error.message
  );

  process.exitCode = 1;
});
