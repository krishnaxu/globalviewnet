
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
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

// 正文专用：保留段落、小标题和换行。
function htmlToFormattedText(value = "") {
  return decodeHTML(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(br|hr)\b[^>]*>/gi, "\n")
      .replace(
        /<\/(p|div|section|article|li|h[1-6]|blockquote|tr)>/gi,
        "\n\n"
      )
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
  )
    .replace(/\s*[-|｜]\s*金斯瑞.*$/i, "")
    .trim();
}

function normalizeDate(value = "") {
  const match = value.match(
    /(20\d{2})\s*(?:年|[-/.])\s*(\d{1,2})\s*(?:月|[-/.])\s*(\d{1,2})\s*日?/
  );

  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return "";
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getArticleDate(html) {
  // 只优先接受明确的发布时间元数据。
  const metaCandidates = [
    getMeta(html, "article:published_time"),
    getMeta(html, "date"),
    getMeta(html, "publishdate")
  ];

  for (const candidate of metaCandidates) {
    const date = normalizeDate(candidate);
    if (date) return date;
  }

  // 找到包含文章标题的 h1，再检查其后方的日期。
  const title = getTitle(html);
  const headings = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || [];

  for (const heading of headings) {
    if (!title || !stripHTML(heading).includes(title)) continue;

    const headingIndex = html.indexOf(heading);
    const nearbyHTML = html.slice(
      headingIndex + heading.length,
      headingIndex + heading.length + 2000
    );

    const chineseDate = nearbyHTML.match(
      /20\d{2}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/
    );

    if (chineseDate) {
      const date = normalizeDate(chineseDate[0]);
      if (date) return date;
    }

    const standardDate = nearbyHTML.match(
      /\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/
    );

    if (standardDate) {
      const date = normalizeDate(standardDate[0]);
      if (date) return date;
    }
  }

  // 不再从整页随意选取第一个日期。
  return "";
}

function extractBalancedElement(html, openingMatch, tagName) {
  if (!openingMatch) return "";

  const start = openingMatch.index + openingMatch[0].length;
  const tokenPattern = new RegExp(
    `<\\/?${tagName}\\b[^>]*>`,
    "gi"
  );

  tokenPattern.lastIndex = start;
  let depth = 1;
  let match;

  while ((match = tokenPattern.exec(html)) !== null) {
    const token = match[0];

    if (/^<\//.test(token)) {
      depth--;

      if (depth === 0) {
        return html.slice(start, match.index);
      }
    } else if (!/\/\s*>$/.test(token)) {
      depth++;
    }
  }

  return "";
}

function looksLikeNavigation(text) {
  return (
    /登录\s*注册|用户中心|在线订购|返回顶部/.test(text) ||
    /产品类型.{0,30}服务类型/.test(text)
  );
}


function getArticleBody(html) {
  if (typeof html !== "string" || !html.trim()) {
    return "";
  }

  const startMatch = html.match(
    /<p\b[^>]*class=["'][^"']*\bpText\b[^"']*["'][^>]*>/i
  );

  if (!startMatch || startMatch.index === undefined) {
    return "";
  }

  // 从正文第一个 pText 段落开始，向后提取文章内容。
  const startIndex = startMatch.index;
  const tail = html.slice(startIndex);

  // 查找正文区域的结束标志，避免把整页导航等内容一起抓进来。
  const endPatterns = [
    /<p\b[^>]*class=["'][^"']*\bpText\s+mb-80\b[^>]*>[\s\S]*?<\/p\s*>/i,
    /<div\b[^>]*class=["'][^"']*\b(?:article-footer|article-share|share-box)\b[^>]*>/i
  ];

  let endIndex = -1;

  for (const pattern of endPatterns) {
    const match = pattern.exec(tail);

    if (match && match.index !== undefined) {
      const candidateEnd = pattern.source.includes("mb-80")
        ? match.index + match[0].length
        : match.index;

      if (endIndex === -1 || candidateEnd < endIndex) {
        endIndex = candidateEnd;
      }
    }
  }

  // 找不到结束标志时，先提取到最近的外层 div 结束位置。
  if (endIndex === -1) {
    const closingDiv = tail.lastIndexOf("</div>");
    if (closingDiv > 0) {
      endIndex = closingDiv;
    }
  }

  const bodyHTML = (endIndex > 0 ? tail.slice(0, endIndex) : tail)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .trim();

  const plainText = stripHTML(bodyHTML).replace(/\s+/g, " ").trim();

  return plainText.length >= 100 ? bodyHTML : "";
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
      ? normalizeDate(dateMatch[0])
      : "";

    if (!date) continue;

    results.push({
      title,
      source_url: url.href,
      date
    });
  }

  // 同一链接只保留一条。
  const unique = new Map();

  for (const item of results) {
    if (!unique.has(item.source_url)) {
      unique.set(item.source_url, item);
    }
  }

  return [...unique.values()];
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

function hasBody(item) {
  if (
    typeof item.body !== "string" ||
    item.body.trim().length <= 100
  ) {
    return false;
  }

  if (looksLikeNavigation(item.body)) {
    return false;
  }

  if (/公司新闻\s*20\d{2}年\d{1,2}月\d{1,2}日/.test(item.body)) {
    return false;
  }

  return true;
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
  let repaired = 0;
  let bodyFailures = 0;
  let fetchFailures = 0;

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

      const existingItem = byURL.get(article.source_url);

      // 正文通过基本检查的文章不重复抓取。
   if (
  existingItem &&
  hasBody(existingItem) &&
  /<\/?(p|h[1-6]|strong|b|em|ul|ol|li|img|table)\b/i.test(existingItem.body)
) {
  continue;
}
      const isRepair = Boolean(existingItem);

      console.log(
        `${isRepair ? "补抓缺失正文" : "抓取新文章"}：${article.title}`
      );

      try {
        const html = await fetchHTML(article.source_url);
        const title = getTitle(html) || article.title;
        const pageDate = getArticleDate(html);
        const body = getArticleBody(html);

        const excerpt =
          getMeta(html, "description") ||
          getMeta(html, "og:description");

        const coverImage = getMeta(html, "og:image");
        const previous = existingItem || {};

        // 列表日期作为文章日期的后备来源，优先于旧归档日期。
        const date = pageDate || article.date || previous.date || "";

        if (!date || date < START_DATE) {
          if (date && date < START_DATE) {
            reachedStartDate = true;
          }

          console.warn(
            `日期不符合归档范围，跳过本条：${article.source_url}`
          );
          continue;
        }

        // 新正文提取失败时，只保留通过基本检查的旧正文。
        const finalBody = body || (
          hasBody(previous) ? previous.body : ""
        );

        const updatedItem = {
          ...previous,
          slug:
            previous.slug ||
            `company-${Buffer.from(article.source_url).toString("hex").slice(-20)}`,
          title: title || previous.title || article.title,
          source: previous.source || SOURCE,
          source_url: article.source_url,
          date,
          excerpt: stripHTML(excerpt) || previous.excerpt || "",
          body: finalBody,
          cover_image: coverImage || previous.cover_image || "",
          published: previous.published ?? true,
          fetched_at: new Date().toISOString()
        };

        byURL.set(article.source_url, updatedItem);

        if (body) {
          console.log(`正文提取成功，字符数：${body.length}`);

          if (isRepair) {
            repaired++;
          } else {
            discovered++;
          }
        } else {
          bodyFailures++;

          console.warn(
            `正文仍未可靠提取，保留有效旧正文或空正文，等待下次重试：${article.source_url}`
          );
        }
      } catch (error) {
        fetchFailures++;

        console.error(
          `文章抓取失败：${article.source_url}；${error.message}`
        );
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (pageDates.every(date => date < START_DATE) || reachedStartDate) {
      console.log(`已到达历史起点 ${START_DATE}，停止翻页。`);
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 800));
  }

  const output = [...byURL.values()]
    .filter(item => item.date && item.date >= START_DATE)
    .sort((a, b) => b.date.localeCompare(a.date));

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });

  await fs.writeFile(
    OUTPUT_FILE,
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8"
  );

  const missingBodyCount = output.filter(item => !hasBody(item)).length;

  console.log("========== 抓取结果 ==========");
  console.log(`本次新增且正文成功：${discovered} 篇`);
  console.log(`本次补齐旧正文：${repaired} 篇`);
  console.log(`本次正文提取失败：${bodyFailures} 篇`);
  console.log(`本次请求失败：${fetchFailures} 篇`);
  console.log(`归档文章总数：${output.length} 篇`);
  console.log(`归档中仍缺正文：${missingBodyCount} 篇`);
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
