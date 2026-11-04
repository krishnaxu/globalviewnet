import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const AUTO_NEWS_FILE = path.join(ROOT, "auto-news.json");
const WECHAT_NEWS_FILE = path.join(ROOT, "wechat-news.json");

const KEYWORDS = [
  "DrG的雍熙路",
  "金斯瑞 DrG的雍熙路",
  "细胞治疗 DrG的雍熙路",
  "基因治疗 DrG的雍熙路",
  "核酸药物 DrG的雍熙路",
  "抗体药物 DrG的雍熙路",
  "ADC DrG的雍熙路",
  "AIDD DrG的雍熙路"
];

const MAX_ITEMS = 80;

function decodeXml(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, number) =>
      String.fromCharCode(Number(number))
    )
    .trim();
}

function stripHtml(value = "") {
  return decodeXml(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTag(block, tagName) {
  const pattern = new RegExp(
    `<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`,
    "i"
  );

  const match = block.match(pattern);
  return match ? decodeXml(match[1]) : "";
}

function normalizeUrl(rawUrl = "") {
  if (!rawUrl) return "";

  try {
    const url = new URL(decodeXml(rawUrl));

    [
      "from",
      "scene",
      "clicktime",
      "enterid",
      "sessionid",
      "subscene",
      "ascene",
      "pass_ticket",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content"
    ].forEach((key) => url.searchParams.delete(key));

    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function isWechatArticleUrl(rawUrl = "") {
  try {
    const url = new URL(normalizeUrl(rawUrl));

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

function extractWechatUrl(...values) {
  for (const value of values) {
    const decoded = decodeXml(String(value || ""));

    const matches = decoded.match(
      /https?:\/\/mp\.weixin\.qq\.com\/s\/?[A-Za-z0-9_-]+(?:\?[^"'<> ]*)?/gi
    ) || [];

    for (const match of matches) {
      const normalized = normalizeUrl(match);

      if (isWechatArticleUrl(normalized)) {
        return normalized;
      }
    }

    const direct = normalizeUrl(decoded);

    if (isWechatArticleUrl(direct)) {
      return direct;
    }
  }

  return "";
}

function createStableId(value = "") {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `wechat-${(hash >>> 0).toString(16)}`;
}

function parseRss(xml, keyword) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  return blocks
    .map((block) => {
      const title = stripHtml(getTag(block, "title"));
      const rssLink = getTag(block, "link");
      const descriptionRaw = getTag(block, "description");
      const description = stripHtml(descriptionRaw);
      const pubDateRaw = getTag(block, "pubDate");

      const link = extractWechatUrl(
        rssLink,
        descriptionRaw,
        block
      );

      let publishedAt = "";

      if (pubDateRaw) {
        const parsedDate = new Date(pubDateRaw);

        if (!Number.isNaN(parsedDate.getTime())) {
          publishedAt = parsedDate.toISOString();
        }
      }

      return {
        id: createStableId(link),
        title,
        url: link,
        link,
        summary: description,
        description,
        source: "DrG的雍熙路",
        platform: "wechat",
        category: "微信",
        keyword,
        publishedAt,
        pubDate: publishedAt,
        collectedAt: new Date().toISOString()
      };
    })
    .filter((item) => {
      return (
        item.title &&
        isWechatArticleUrl(item.url)
      );
    });
}

function deduplicate(items) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const output = [];

  for (const item of items) {
    const urlKey = normalizeUrl(item.url || item.link || "");
    const titleKey = String(item.title || "")
      .replace(/\s+/g, "")
      .toLowerCase();

    if (!isWechatArticleUrl(urlKey)) continue;
    if (!titleKey) continue;

    if (
      seenUrls.has(urlKey) ||
      seenTitles.has(titleKey)
    ) {
      continue;
    }

    seenUrls.add(urlKey);
    seenTitles.add(titleKey);

    output.push({
      ...item,
      url: urlKey,
      link: urlKey,
      source: "DrG的雍熙路",
      platform: "wechat"
    });
  }

  return output;
}

function sortByDate(items) {
  return [...items].sort((a, b) => {
    const aTime = new Date(
      a.publishedAt || a.pubDate || a.date || 0
    ).getTime();

    const bTime = new Date(
      b.publishedAt || b.pubDate || b.date || 0
    ).getTime();

    return (Number.isNaN(bTime) ? 0 : bTime) -
      (Number.isNaN(aTime) ? 0 : aTime);
  });
}

async function fetchWithTimeout(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
        Accept:
          "application/rss+xml,application/xml,text/xml,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
      }
    });

    const body = await response.text();

    console.log(
      `[wechat] HTTP ${response.status}, body length ${body.length}`
    );

    if (!response.ok) {
      throw new Error(`请求失败：HTTP ${response.status}`);
    }

    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function searchKeyword(keyword) {
  const query =
    `site:mp.weixin.qq.com/s/ "${keyword}"`;

  const url =
    "https://www.bing.com/search?format=rss&q=" +
    encodeURIComponent(query);

  console.log(`[wechat] 正在搜索：${keyword}`);

  const xml = await fetchWithTimeout(url);

  if (!/<rss|<feed|<item/i.test(xml)) {
    throw new Error(
      `关键词“${keyword}”没有返回有效 RSS`
    );
  }

  const items = parseRss(xml, keyword);

  console.log(
    `[wechat] 关键词“${keyword}”找到 ${items.length} 篇真实微信文章`
  );

  return items;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(
      fs.readFileSync(filePath, "utf8")
    );
  } catch (error) {
    throw new Error(
      `${path.basename(filePath)} 不是有效 JSON：${error.message}`
    );
  }
}

function getDataAdapter(data) {
  if (Array.isArray(data)) {
    return {
      items: data,
      rebuild(items) {
        return items;
      }
    };
  }

  for (const key of ["news", "items", "articles"]) {
    if (data && Array.isArray(data[key])) {
      return {
        items: data[key],
        rebuild(items) {
          return {
            ...data,
            items,
            updatedAt: new Date().toISOString()
          };
        }
      };
    }
  }

  return {
    items: [],
    rebuild(items) {
      return items;
    }
  };
}

function isFakeWechatItem(item) {
  return (
    item?.platform === "wechat" &&
    !isWechatArticleUrl(item.url || item.link || "")
  );
}

function saveJson(filePath, data) {
  fs.writeFileSync(
    filePath,
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8"
  );
}

async function main() {
  console.log("[wechat] 微信文章自动收录开始");

  const results = [];
  const failures = [];

  for (const keyword of KEYWORDS) {
    try {
      const items = await searchKeyword(keyword);
      results.push(...items);
    } catch (error) {
      failures.push({
        keyword,
        error: error.message
      });

      console.error(
        `[wechat] “${keyword}”搜索失败：${error.message}`
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 1200)
    );
  }

  const wechatItems = sortByDate(
    deduplicate(results)
  ).slice(0, MAX_ITEMS);

  console.log(
    `[wechat] 真实微信文章去重后共 ${wechatItems.length} 篇`
  );

  /*
   * 无论本次是否找到文章，都要覆盖旧 wechat-news.json，
   * 清除此前混入的官网、百科等普通网页。
   */
  saveJson(WECHAT_NEWS_FILE, wechatItems);

  const existingData = readJson(AUTO_NEWS_FILE);
  const adapter = getDataAdapter(existingData);

  /*
   * 删除此前错误标记为微信、但链接并非微信文章的内容。
   */
  const cleanedExistingItems = adapter.items.filter(
    (item) => !isFakeWechatItem(item)
  );

  const mergedItems = sortByDate(
    deduplicate([
      ...wechatItems,
      ...cleanedExistingItems.filter((item) =>
        isWechatArticleUrl(item.url || item.link || "")
      )
    ])
  );

  const nonWechatItems = cleanedExistingItems.filter(
    (item) =>
      item?.platform !== "wechat" &&
      !isWechatArticleUrl(item.url || item.link || "")
  );

  const finalItems = [
    ...mergedItems,
    ...nonWechatItems
  ].slice(0, 500);

  saveJson(
    AUTO_NEWS_FILE,
    adapter.rebuild(finalItems)
  );

  console.log(
    `[wechat] 已清理并写入 wechat-news.json：${wechatItems.length} 篇`
  );

  console.log(
    `[wechat] 已清理 auto-news.json 中的假微信结果`
  );

  if (failures.length > 0) {
    console.warn(
      `[wechat] 有 ${failures.length} 个关键词搜索失败`
    );
  }

  if (wechatItems.length === 0) {
    console.warn(
      "[wechat] 本次未发现真实 mp.weixin.qq.com/s/ 文章，未写入普通网页"
    );
  }

  console.log("[wechat] 微信文章自动收录完成");
}

main().catch((error) => {
  console.error("[wechat] 程序运行失败：", error);
  process.exitCode = 1;
});
