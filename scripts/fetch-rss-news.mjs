
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const FEEDS_FILE = resolve(ROOT, "scripts/rss-feeds.json");
const OUTPUT_FILE = resolve(ROOT, "data/rss-candidates.json");
const SEEN_FILE = resolve(ROOT, "data/rss-seen.json");

const MAX_ITEMS_PER_FEED = 30;
const REQUEST_TIMEOUT_MS = 15000;

function cleanText(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tagValue(xml, names) {
  for (const name of names) {
    const escaped = name.replace(":", "\\:");
    const pattern = new RegExp(
      `<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}\\s*>`,
      "i"
    );
    const match = xml.match(pattern);
    if (match) return cleanText(match[1]);
  }
  return "";
}

function getItems(xml) {
  const rssItems = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item\s*>/gi)]
    .map((match) => match[1]);

  if (rssItems.length) return rssItems;

  return [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry\s*>/gi)]
    .map((match) => match[1]);
}

function getLink(item) {
  const atomLink = item.match(
    /<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i
  );
  if (atomLink) return atomLink[1].trim();

  return tagValue(item, ["link", "guid"]);
}

function getDate(item) {
  return tagValue(item, ["pubDate", "published", "updated", "dc:date"]);
}

function getDescription(item) {
  return tagValue(item, ["description", "summary", "content:encoded", "content"]);
}

function makeId(url, title) {
  return createHash("sha256")
    .update((url || title).trim().toLowerCase())
    .digest("hex");
}

function isRecent(dateString) {
  if (!dateString) return false;

  const timestamp = Date.parse(dateString);
  if (!Number.isFinite(timestamp)) return false;

  // 只处理最近 7 天内的新闻，避免首次运行导入大量历史文章。
  const age = Date.now() - timestamp;
  return age >= -60 * 60 * 1000 && age <= 7 * 24 * 60 * 60 * 1000;
}

function matchesTopics(item, topics) {
  if (!topics?.length) return true;

  const text = `${item.title} ${item.description}`.toLowerCase();

  const keywordMap = {
    biotech: ["biotech", "biotechnology", "biopharma"],
    antibody: ["antibody", "antibodies", "adc", "monoclonal"],
    "cell-therapy": ["cell therapy", "car-t", "cellular therapy"],
    "gene-therapy": ["gene therapy", "gene editing", "genome editing"],
    "nucleic-acid": ["rna", "mrna", "sirna", "antisense", "oligonucleotide"],
    "biomedical-research": ["biomedical", "biotechnology", "clinical research"]
  };

  return topics.some((topic) => {
    const words = keywordMap[topic] || [topic.replaceAll("-", " ")];
    return words.some((word) => text.includes(word));
  });
}

async function fetchFeed(feed) {
  const response = await fetch(feed.url, {
    headers: {
      "User-Agent": "GlobalViewNewsBot/1.0 (+https://globalviewnet.pages.dev)",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml"
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const xml = await response.text();

  if (!/<(?:rss|feed|rdf:RDF)\b/i.test(xml)) {
    throw new Error("响应内容不像有效 RSS/Atom XML");
  }

  return getItems(xml).slice(0, MAX_ITEMS_PER_FEED).map((item) => {
    const title = tagValue(item, ["title"]);
    const url = getLink(item);
    const date = getDate(item);
    const description = getDescription(item);

    return {
      id: makeId(url, title),
      source_id: feed.id,
      source_name: feed.name,
      title,
      url,
      date,
      description,
      fetched_at: new Date().toISOString()
    };
  }).filter((item) =>
    item.title &&
    item.url &&
    /^https?:\/\//i.test(item.url) &&
    isRecent(item.date) &&
    matchesTopics(item, feed.topics)
  );
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function main() {
  const config = await readJson(FEEDS_FILE, { feeds: [] });
  const seen = await readJson(SEEN_FILE, []);
  const seenIds = new Set(seen);
  const candidates = [];
  const feedErrors = [];

  for (const feed of config.feeds.filter((entry) => entry.enabled)) {
    try {
      const items = await fetchFeed(feed);
      for (const item of items) {
        if (!seenIds.has(item.id)) {
          candidates.push(item);
        }
      }
      console.log(`[OK] ${feed.name}: ${items.length} 条符合条件`);
    } catch (error) {
      feedErrors.push({ source: feed.name, error: error.message });
      console.error(`[ERROR] ${feed.name}: ${error.message}`);
    }
  }

  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(
    OUTPUT_FILE,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        mode: "dry-run",
        candidates,
        feed_errors: feedErrors
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log(`测试完成：发现 ${candidates.length} 条未处理候选新闻。`);
  console.log(`候选结果已写入 ${OUTPUT_FILE}`);
  console.log("当前为 dry-run 模式，不会发布文章。");
}

main().catch((error) => {
  console.error("RSS 抓取任务失败：", error);
  process.exitCode = 1;
});
