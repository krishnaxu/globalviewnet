import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const AUTO_NEWS_FILE = path.join(ROOT, "auto-news.json");
const WECHAT_NEWS_FILE = path.join(ROOT, "wechat-news.json");

/*
 * 在这里填写你想自动收录的关键词。
 * 可以继续增加，但不要删除英文引号和逗号。
 */
const KEYWORDS = [
  "金斯瑞",
  "细胞治疗",
  "基因治疗",
  "核酸药物",
  "抗体药物",
  "ADC",
  "AIDD",
  "生物医药"
];

const MAX_DAYS = 14;
const MAX_ITEMS = 80;

function decodeXml(value = "") {
  return value
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

    const removableParameters = [
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
    ];

    for (const key of removableParameters) {
      url.searchParams.delete(key);
    }

    url.hash = "";
    return url.toString();
  } catch {
    return decodeXml(rawUrl);
  }
}

function parseRss(xml, keyword) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  return blocks
    .map((block) => {
      const title = stripHtml(getTag(block, "title"));
      const link = normalizeUrl(getTag(block, "link"));
      const description = stripHtml(getTag(block, "description"));
      const pubDateRaw = getTag(block, "pubDate");

      let publishedAt = "";

      if (pubDateRaw) {
        const parsedDate = new Date(pubDateRaw);

        if (!Number.isNaN(parsedDate.getTime())) {
          publishedAt = parsedDate.toISOString();
        }
      }

      return {
        id: createStableId(link || `${title}-${publishedAt}`),
        title,
        url: link,
        link,
        summary: description,
        description,
        source: "微信公众号",
        platform: "wechat",
        category: "微信",
        keyword,
        publishedAt,
        pubDate: publishedAt,
        collectedAt: new Date().toISOString()
      };
    })
    .filter((item) => item.title && item.url)
    .filter((item) => {
      return (
        item.url.includes("mp.weixin.qq.com") ||
        item.description.includes("mp.weixin.qq.com") ||
        item.source === "微信公众号"
      );
    });
}

function createStableId(value = "") {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `wechat-${(hash >>> 0).toString(16)}`;
}

function isRecent(item) {
  if (!item.publishedAt) return true;

  const timestamp = new Date(item.publishedAt).getTime();

  if (Number.isNaN(timestamp)) return true;

  const oldestAllowed =
    Date.now() - MAX_DAYS * 24 * 60 * 60 * 1000;

  return timestamp >= oldestAllowed;
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

    if (!urlKey || !titleKey) continue;
    if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue;

    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    output.push({
      ...item,
      url: urlKey,
      link: urlKey
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
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
        Accept:
          "application/rss+xml,application/xml,text/xml,text/html;q=0.9,*/*;q=0.8",
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
  const query = `site:mp.weixin.qq.com ${keyword}`;
  const url =
    `https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`;

  console.log(`[wechat] 正在搜索：${keyword}`);

  const xml = await fetchWithTimeout(url);

  if (!/<rss|<feed|<item/i.test(xml)) {
    throw new Error(`关键词“${keyword}”没有返回有效 RSS`);
  }

  const items = parseRss(xml, keyword);

  console.log(
    `[wechat] 关键词“${keyword}”解析到 ${items.length} 篇文章`
  );

  return items;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `${path.basename(filePath)} 不是有效 JSON：${error.message}`
    );
  }
}

function existingArrayFromAutoNews(data) {
  if (Array.isArray(data)) {
    return {
      items: data,
      rebuild(items) {
        return items;
      }
    };
  }

  if (data && Array.isArray(data.news)) {
    return {
      items: data.news,
      rebuild(items) {
        return {
          ...data,
          news: items,
          updatedAt: new Date().toISOString()
        };
      }
    };
  }

  if (data && Array.isArray(data.items)) {
    return {
      items: data.items,
      rebuild(items) {
        return {
          ...data,
          items,
          updatedAt: new Date().toISOString()
        };
      }
    };
  }

  if (data && Array.isArray(data.articles)) {
    return {
      items: data.articles,
      rebuild(items) {
        return {
          ...data,
          articles: items,
          updatedAt: new Date().toISOString()
        };
      }
    };
  }

  return {
    items: [],
    rebuild(items) {
      return items;
    }
  };
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
        `[wechat] 关键词“${keyword}”搜索失败：${error.message}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  const wechatItems = sortByDate(
    deduplicate(results.filter(isRecent))
  ).slice(0, MAX_ITEMS);

  console.log(`[wechat] 去重后共 ${wechatItems.length} 篇`);

  if (wechatItems.length === 0) {
    console.error("[wechat] 本次没有找到微信文章");
    console.error("[wechat] 失败信息：", failures);

    /*
     * 不覆盖原文件，避免一次搜索失败清空已有新闻。
     */
    process.exitCode = 1;
    return;
  }

  saveJson(WECHAT_NEWS_FILE, wechatItems);

  const existingData = readJson(AUTO_NEWS_FILE);
  const adapter = existingArrayFromAutoNews(existingData);

  const mergedItems = sortByDate(
    deduplicate([
      ...wechatItems,
      ...adapter.items
    ])
  ).slice(0, 500);

  const rebuiltData = adapter.rebuild(mergedItems);

  saveJson(AUTO_NEWS_FILE, rebuiltData);

  console.log(
    `[wechat] 已写入 wechat-news.json：${wechatItems.length} 篇`
  );

  console.log(
    `[wechat] 已更新 auto-news.json：${mergedItems.length} 篇`
  );

  if (failures.length > 0) {
    console.warn(
      `[wechat] 有 ${failures.length} 个关键词搜索失败，但其他结果已正常保存`
    );
  }

  console.log("[wechat] 微信文章自动收录完成");
}

main().catch((error) => {
  console.error("[wechat] 程序运行失败：", error);
  process.exitCode = 1;
});
