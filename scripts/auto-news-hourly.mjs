
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const NEWS_DIR = path.join(ROOT, "content", "auto-news");
const JSON_FILE = path.join(ROOT, "auto-news.json");
const MAX_AGE_HOURS = 72;
const MAX_PER_FEED = 20;

const FEEDS = [
 
  {
    name: "中新网即时新闻",
    language: "zh",
    url: "https://www.chinanews.com.cn/rss/scroll-news.xml"
  },
  {
    name: "中新网国际新闻",
    language: "zh",
    url: "https://www.chinanews.com.cn/rss/world.xml"
  },
  {
    name: "中新网财经新闻",
    language: "zh",
    url: "https://www.chinanews.com.cn/rss/finance.xml"
  },

  {
    name: "BBC World",
    language: "en",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml"
  },
  {
    name: "CNBC Top News",
    language: "en",
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html"
  },
  {
    name: "TechCrunch",
    language: "en",
    url: "https://techcrunch.com/feed/"
  },
  {
    name: "Ars Technica",
    language: "en",
    url: "https://feeds.arstechnica.com/arstechnica/index"
  }
];

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    );
}

function cleanText(value = "") {
  return decodeXml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block, name) {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}\\s*>`,
    "i"
  );
  return block.match(re)?.[1] || "";
}

function readLink(block) {
  const atom = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (atom?.[1]) return decodeXml(atom[1]).trim();
  return cleanText(tag(block, "link"));
}

function parseFeed(xml) {
  function decodeEntities(value = "") {
    return String(value)
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .trim();
  }

  function resolveImage(url, articleUrl) {
    if (!url) return "";
    try {
      const resolved = new URL(decodeEntities(url), articleUrl);
      return ["http:", "https:"].includes(resolved.protocol)
        ? resolved.href
        : "";
    } catch {
      return "";
    }
  }

  function extractImage(block, description, link) {
    const patterns = [
      /<(?:\w[\w.-]*:)?thumbnail\b[^>]*\burl\s*=\s*["']([^"']+)["']/i,
      /<(?:\w[\w.-]*:)?content\b[^>]*\burl\s*=\s*["']([^"']+)["']/i,
      /<enclosure\b[^>]*\burl\s*=\s*["']([^"']+)["'][^>]*\btype\s*=\s*["']image\/[^"']+["']/i,
      /<enclosure\b[^>]*\btype\s*=\s*["']image\/[^"']+["'][^>]*\burl\s*=\s*["']([^"']+)["']/i
    ];

    for (const pattern of patterns) {
      const match = block.match(pattern);
      if (match) {
        const imageUrl = resolveImage(match[1], link);
        if (imageUrl) return imageUrl;
      }
    }

    const htmlContent =
      block.match(/<(?:\w[\w.-]*:)?encoded\b[^>]*>([\s\S]*?)<\/(?:\w[\w.-]*:)?encoded\s*>/i)?.[1] ||
      block.match(/<content:encoded\b[^>]*>([\s\S]*?)<\/content:encoded\s*>/i)?.[1] ||
      description ||
      "";

    const imageMatch =
      htmlContent.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i) ||
      htmlContent.match(/<img\b[^>]*\bdata-src\s*=\s*["']([^"']+)["']/i);

    return imageMatch ? resolveImage(imageMatch[1], link) : "";
  }

  const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];

  return blocks.map((match) => {
    const block = match[2];
    const title = cleanText(tag(block, "title"));
    const link = readLink(block);

    const description =
      tag(block, "description") ||
      tag(block, "summary") ||
      tag(block, "content");

    const dateText =
      cleanText(tag(block, "pubDate")) ||
      cleanText(tag(block, "published")) ||
      cleanText(tag(block, "updated")) ||
      cleanText(tag(block, "date"));

    const timestamp = Date.parse(dateText);
    const image = extractImage(block, description, link);

    return {
      title,
      link,
      excerpt: cleanText(description).slice(0, 700),
      date: Number.isFinite(timestamp)
        ? new Date(timestamp).toISOString()
        : "",
      image
    };
  }).filter((item) => item.title && item.link && item.date);
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid)$/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return value.trim();
  }
}

function slugFor(url, title) {
  const prefix = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 45) || "news";

  const hash = crypto.createHash("sha256")
    .update(normalizeUrl(url))
    .digest("hex")
    .slice(0, 12);

  return `${prefix}-${hash}`;
}

function yamlString(value = "") {
  return JSON.stringify(String(value));
}

function readFrontmatter(file) {
  const raw = fs.readFileSync(file, "utf8");
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);

  if (!match) return null;

  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!field) continue;

    let value = field[2].trim();
    if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (value.startsWith('"')) {
      try { value = JSON.parse(value); } catch {}
    }

    fields[field[1]] = value;
  }

  return fields;
}

function loadExisting() {
  fs.mkdirSync(NEWS_DIR, { recursive: true });

  const files = fs.readdirSync(NEWS_DIR)
    .filter((file) => file.endsWith(".md"));

  const items = [];
  const knownUrls = new Set();

  for (const file of files) {
    const fullPath = path.join(NEWS_DIR, file);
    const fields = readFrontmatter(fullPath);
    if (!fields) continue;

    if (fields.source_url) {
      knownUrls.add(normalizeUrl(String(fields.source_url)));
    }

    // Existing CMS records are not overwritten by the crawler.
    items.push({
      id: String(fields.slug || file.replace(/\.md$/, "")),
      language: fields.language === "en" ? "en" : "zh",
      title: String(fields.title || ""),
      excerpt: String(fields.excerpt || ""),
      date: String(fields.date || ""),
      source_name: String(fields.source_name || ""),
      source_url: String(fields.source_url || ""),
      published: fields.published !== false,
      file
    });
  }

  return { items, knownUrls };
}

function writeNews(item) {
  const slug = slugFor(item.link, item.title);
  const file = path.join(NEWS_DIR, `${slug}.md`);

  if (fs.existsSync(file)) return false;

  const content = [
    "---",
    `slug: ${yamlString(slug)}`,
    `language: ${yamlString(item.language)}`,
    `title: ${yamlString(item.title)}`,
    `excerpt: ${yamlString(item.excerpt)}`,
    `date: ${yamlString(item.date)}`,
    `source_name: ${yamlString(item.source_name)}`,
    `source_url: ${yamlString(item.link)}`,
    "published: true",
    "---",
    "",
    item.excerpt,
    "",
    `原文链接：${item.link}`,
    ""
  ].join("\n");

  fs.writeFileSync(file, content, "utf8");
  return true;
}

async function fetchFeed(feed) {
  const response = await fetch(feed.url, {
    headers: { "User-Agent": "GlobalViewNet-RSS/1.0" },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const xml = await response.text();
  const cutoff = Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000;

  return parseFeed(xml)
    .filter((item) => Date.parse(item.date) >= cutoff)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, MAX_PER_FEED)
    .map((item) => ({ ...item, language: feed.language, source_name: feed.name }));
}

async function main() {
  const { items, knownUrls } = loadExisting();
  let added = 0;
  let failedFeeds = 0;

  for (const feed of FEEDS) {
    try {
      const articles = await fetchFeed(feed);
      for (const article of articles) {
        const normalized = normalizeUrl(article.link);
        if (knownUrls.has(normalized)) continue;

        const created = writeNews(article);
        knownUrls.add(normalized);
        if (created) added++;
      }

      console.log(`${feed.name}: ${articles.length} items checked`);
    } catch (error) {
      failedFeeds++;
      console.error(`${feed.name}: ${error.message}`);
    }
  }

  // Re-read records so the JSON reflects CMS edits and unpublishing.
  const refreshed = loadExisting();
  const publicItems = refreshed.items
    .filter((item) => item.published && item.title && item.source_url)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 300)
    .map(({ id, language, title, excerpt, date, source_name, source_url }) => ({
      id, language, title, excerpt, date, source_name, source_url
    }));

  fs.writeFileSync(
    JSON_FILE,
    JSON.stringify({ generated_at: new Date().toISOString(), items: publicItems }, null, 2) + "\n",
    "utf8"
  );

  console.log(`New records: ${added}`);
  console.log(`Published records in auto-news.json: ${publicItems.length}`);
  console.log(`Feeds with errors: ${failedFeeds}/${FEEDS.length}`);

  if (failedFeeds === FEEDS.length) {
    throw new Error("All RSS feeds failed; refusing to treat this run as successful.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
