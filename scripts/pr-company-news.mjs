import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = "https://www.genscript.com.cn";
const LIST_URL = `${BASE_URL}/special/news`;
const START_DATE = "2023-01-18";
const OUTPUT_FILE = "content/pr-portfolio/company-news.json";
const MAX_PAGES = 50;
const SOURCE = "GenScript Official Website";

function decodeHTML(value = "") {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    );
}

function stripHTML(value = "") {
  return decodeHTML(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

function getMeta(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];

  for (const tag of tags) {
    const key =
      tag.match(/\bname=["']([^"']+)["']/i)?.[1] ||
      tag.match(/\bproperty=["']([^"']+)["']/i)?.[1];

    if (key?.toLowerCase() !== name.toLowerCase()) continue;

    return decodeHTML(
      tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] || ""
    ).trim();
  }

  return "";
}

function getTitle(html) {
  return (
    getMeta(html, "og:title") ||
    getMeta(html, "twitter:title") ||
    stripHTML(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "")
  ).replace(/\s*[-|｜]\s*金斯瑞.*$/i, "").trim();
}

function getArticleDate(html) {
  const candidates = [
    getMeta(html, "article:published_time"),
    getMeta(html, "date"),
    getMeta(html, "publishdate"),
    html.match(/\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/)?.[0] || ""
  ];

  for (const candidate of candidates) {
    const match = candidate.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);

    if (match) {
      return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    }
  }

  return "";
}

function getArticleBody(html) {
  const selectors = [
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
    /<div\b[^>]*class=["'][^"']*(?:article-content|article-detail|news-content|news-detail|content-detail)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<main\b[^>]*>([\s\S]*?)<\/main>/i
  ];

  for (const pattern of selectors) {
    const match = html.match(pattern);

    if (match?.[1]) {
      const text = stripHTML(match[1]);

      if (text.length > 100) return text;
    }
  }

  return "";
}

async function fetchHTML(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; GlobalViewNetPRBot/1.0)",
      "Accept": "text/html,application/xhtml+xml"
    },
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  return response.text();
}

function extractListing(html) {
  const results = [];
  const anchorPattern =
    /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = anchorPattern.exec(html)) !== null) {
    const href = decodeHTML(match[1]).trim();
    const title = stripHTML(match[2]);

    if (!title || /查看更多|登录|注册|联系我们|在线订购/.test(title)) {
      continue;
    }

    let url;

    try {
      url = new URL(href, BASE_URL);
    } catch {
      continue;
    }

    if (
      url.hostname !== "www.genscript.com.cn" ||
      !url.pathname.endsWith(".html")
    ) {
      continue;
    }

    const nearbyHTML = html.slice(
      match.index,
      Math.min(html.length, match.index + 1000)
    );

    const dateMatch = nearbyHTML.match(
      /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/
    );

    const date = dateMatch
      ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
      : "";

    if (!date) continue;

    results.push({
      title,
      source_url: url.href,
      date
    });
  }

  return results;
}

async function readExisting() {
  try {
    const content = await fs.readFile(OUTPUT_FILE, "utf8");
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function main() {
  const existing = await readExisting();
  const byURL = new Map(
    existing
      .filter(item => item.source_url)
      .map(item => [item.source_url, item])
  );

  let reachedStartDate = false;
  let discovered = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const listURL = new URL(LIST_URL);
    listURL.searchParams.set("page", String(page));
    listURL.searchParams.set("src", "pullmenu");

    console.log(`抓取新闻列表第 ${page} 页：${listURL.href}`);

    let listingHTML;

    try {
      listingHTML = await fetchHTML(listURL.href);
    } catch (error) {
      console.error(`列表页抓取失败：${error.message}`);
      break;
    }

    const articles = extractListing(listingHTML);

    if (articles.length === 0) {
      console.log("本页没有识别到文章，停止翻页。");
      break;
    }

    const pageDates = articles.map(item => item.date);
    console.log(
      `本页识别到 ${articles.length} 篇文章，日期范围：${pageDates.at(-1)} 至 ${pageDates[0]}`
    );

    for (const article of articles) {
      if (article.date < START_DATE) {
        reachedStartDate = true;
        continue;
      }

      if (byURL.has(article.source_url)) continue;

      console.log(`抓取正文：${article.title}`);

      try {
        const html = await fetchHTML(article.source_url);
        const title = getTitle(html) || article.title;
        const date = getArticleDate(html) || article.date;
        const body = getArticleBody(html);
        const excerpt = getMeta(html, "description") ||
          getMeta(html, "og:description");

        if (date < START_DATE) {
          reachedStartDate = true;
          continue;
        }

        byURL.set(article.source_url, {
          slug: `company-${Buffer.from(article.source_url).toString("hex").slice(-20)}`,
          title,
          source: SOURCE,
          source_url: article.source_url,
          date,
          excerpt: stripHTML(excerpt),
          body,
          cover_image: getMeta(html, "og:image"),
          published: true,
          fetched_at: new Date().toISOString()
        });

        discovered++;
      } catch (error) {
        console.error(`文章抓取失败：${article.source_url}；${error.message}`);
      }
    }

    if (pageDates.every(date => date < START_DATE) || reachedStartDate) {
      console.log(`已到达历史起点 ${START_DATE}，停止翻页。`);
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 800));
  }

  const output = [...byURL.values()]
    .filter(item => item.date >= START_DATE)
    .sort((a, b) => b.date.localeCompare(a.date));

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(
    OUTPUT_FILE,
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8"
  );

  console.log(`本次新增：${discovered} 篇`);
  console.log(`当前累计：${output.length} 篇`);
  console.log(`数据文件：${OUTPUT_FILE}`);

  if (!reachedStartDate) {
    console.warn(
      `警告：尚未确认抓到 ${START_DATE} 附近的历史边界，请检查日志和官网分页。`
    );
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
