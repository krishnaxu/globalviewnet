import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_FILE = path.join(ROOT, "wechat-news.json");

const QUERIES = [
  "DrG的雍熙路",
  "金斯瑞 DrG的雍熙路",
  "ADC DrG的雍熙路",
  "AIDD DrG的雍熙路",
  "细胞治疗 DrG的雍熙路",
  "基因治疗 DrG的雍熙路",
  "核酸药物 DrG的雍熙路",
  "抗体药物 DrG的雍熙路"
];

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

function normalizeUrl(rawUrl = "") {
  if (!rawUrl) return "";

  try {
    const value = decodeHtml(rawUrl);
    const url = new URL(value, "https://weixin.sogou.com");

    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function isWechatArticleUrl(rawUrl = "") {
  try {
    const url = new URL(rawUrl);

    return (
      url.hostname === "mp.weixin.qq.com" &&
      (url.pathname === "/s" || url.pathname.startsWith("/s/"))
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

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...HEADERS,
        ...(options.headers || {})
      },
      redirect: options.redirect || "follow",
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
  const results = [];

  const itemRegex =
    /<li\b[^>]*id=["']sogou_vr_[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;

  const blocks = [...html.matchAll(itemRegex)];

  for (const blockMatch of blocks) {
    const block = blockMatch[1];

    const titleMatch =
      block.match(
        /<h3\b[^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i
      ) ||
      block.match(
        /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i
      );

    if (!titleMatch) continue;

    const searchLink = normalizeUrl(titleMatch[1]);
    const title = stripHtml(titleMatch[2]);

    if (!searchLink || !title) continue;

    const summaryMatch = block.match(
      /<p\b[^>]*class=["'][^"']*txt-info[^"']*["'][^>]*>([\s\S]*?)<\/p>/i
    );

    const accountMatch = block.match(
      /<a\b[^>]*class=["'][^"']*account[^"']*["'][^>]*>([\s\S]*?)<\/a>/i
    );

    results.push({
      title,
      searchLink,
      summary: summaryMatch ? stripHtml(summaryMatch[1]) : "",
      account: accountMatch ? stripHtml(accountMatch[1]) : ""
    });
  }

  return results;
}

function extractWechatUrlFromText(text = "") {
  const decoded = decodeHtml(text)
    .replace(/\\x26/g, "&")
    .replace(/\\x3d/g, "=")
    .replace(/\\\//g, "/")
    .replace(/\\u0026/g, "&");

  const directMatch = decoded.match(
    /https?:\/\/mp\.weixin\.qq\.com\/s\/?[A-Za-z0-9_-]+(?:\?[^"'<> ]*)?/i
  );

  if (directMatch && isWechatArticleUrl(directMatch[0])) {
    return directMatch[0];
  }

  const bizMatch = decoded.match(
    /https?:\/\/mp\.weixin\.qq\.com\/s\?[^"'<> ]+/i
  );

  if (bizMatch && isWechatArticleUrl(bizMatch[0])) {
    return bizMatch[0];
  }

  return "";
}

async function resolveSogouLink(searchLink) {
  if (isWechatArticleUrl(searchLink)) {
    return searchLink;
  }

  try {
    const first = await request(searchLink, {
      redirect: "manual"
    });

    const location = first.response.headers.get("location");

    if (location) {
      const resolvedLocation = normalizeUrl(location);

      if (isWechatArticleUrl(resolvedLocation)) {
        return resolvedLocation;
      }
    }

    const bodyUrl = extractWechatUrlFromText(first.body);

    if (bodyUrl) {
      return bodyUrl;
    }

    const urlParts = [
      ...first.body.matchAll(
        /url\s*\+?=\s*['"]([^'"]+)['"]/gi
      )
    ].map((match) => match[1]);

    if (urlParts.length > 0) {
      const combined = decodeHtml(urlParts.join(""))
        .replace(/\\x26/g, "&")
        .replace(/\\x3d/g, "=")
        .replace(/\\\//g, "/");

      const combinedUrl = normalizeUrl(combined);

      if (isWechatArticleUrl(combinedUrl)) {
        return combinedUrl;
      }
    }

    const second = await request(searchLink, {
      redirect: "follow"
    });

    if (isWechatArticleUrl(second.response.url)) {
      return second.response.url;
    }

    return extractWechatUrlFromText(second.body);
  } catch (error) {
    console.warn(
      `[wechat] 跳转链接解析失败：${error.message}`
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

    return Array.isArray(data)
      ? data.filter((item) =>
          isWechatArticleUrl(item.url || item.link || "")
        )
      : [];
  } catch {
    return [];
  }
}

function deduplicate(items) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const output = [];

  for (const item of items) {
    const url = item.url || item.link || "";
    const titleKey = String(item.title || "")
      .replace(/\s+/g, "")
      .toLowerCase();

    if (!isWechatArticleUrl(url)) continue;
    if (!titleKey) continue;
    if (seenUrls.has(url) || seenTitles.has(titleKey)) continue;

    seenUrls.add(url);
    seenTitles.add(titleKey);

    output.push({
      ...item,
      url,
      link: url
    });
  }

  return output;
}

async function searchQuery(query) {
  const params = new URLSearchParams({
    type: "2",
    query,
    ie: "utf8",
    _sug_: "n",
    _sug_type_: ""
  });

  const searchUrl =
    "https://weixin.sogou.com/weixin?" +
    params.toString();

  console.log(`[wechat] 正在搜索：${query}`);

  const { response, body } = await request(searchUrl);

  console.log(
    `[wechat] HTTP ${response.status}，页面长度 ${body.length}`
  );

  if (
    /验证码|访问过于频繁|异常访问|请输入验证码|antispider/i.test(
      body
    )
  ) {
    console.warn(
      `[wechat] 搜索“${query}”触发搜狗反爬`
    );

    return [];
  }

  const candidates = parseSearchResults(body);

  console.log(
    `[wechat] 解析到 ${candidates.length} 个候选结果`
  );

  const articles = [];

  for (const candidate of candidates.slice(0, 10)) {
    if (
      candidate.account &&
      !candidate.account.includes("DrG") &&
      !candidate.account.includes("雍熙路")
    ) {
      continue;
    }

    const articleUrl = await resolveSogouLink(
      candidate.searchLink
    );

    if (!isWechatArticleUrl(articleUrl)) {
      continue;
    }

    articles.push({
      id: createId(articleUrl),
      title: candidate.title,
      url: articleUrl,
      link: articleUrl,
      summary: candidate.summary,
      description: candidate.summary,
      source: candidate.account || "DrG的雍熙路",
      platform: "wechat",
      category: "微信",
      keyword: query,
      publishedAt: "",
      pubDate: "",
      collectedAt: new Date().toISOString()
    });

    console.log(`[wechat] 找到：${candidate.title}`);
    console.log(`[wechat] 链接：${articleUrl}`);

    await new Promise((resolve) =>
      setTimeout(resolve, 800)
    );
  }

  return articles;
}

async function main() {
  console.log("[wechat] 搜狗微信文章发现开始");

  const existing = readExisting();
  const discovered = [];

  for (const query of QUERIES) {
    try {
      const items = await searchQuery(query);
      discovered.push(...items);
    } catch (error) {
      console.error(
        `[wechat] 搜索“${query}”失败：${error.message}`
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 2000)
    );
  }

  const finalItems = deduplicate([
    ...discovered,
    ...existing
  ]).slice(0, 100);

  fs.writeFileSync(
    OUTPUT_FILE,
    `${JSON.stringify(finalItems, null, 2)}\n`,
    "utf8"
  );

  console.log(
  );

  console.log(
    `[wechat] 微信候选文章累计 ${finalItems.length} 篇`
  );

  console.log(
    `[wechat] 已写入 wechat-news.json`
  );
}

main().catch((error) => {
  console.error("[wechat] 程序失败：", error);
  process.exitCode = 1;
});
