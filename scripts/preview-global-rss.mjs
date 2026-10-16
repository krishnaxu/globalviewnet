import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const CONFIG = resolve("scripts/rss-feeds-global.json");
const TIMEOUT_MS = 15000;
const MAX_TITLES_PER_FEED = 10;

function decodeXml(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

async function previewFeed(feed) {
  console.log(`\n========== ${feed.name} ==========`);

  if (!feed.enabled) {
    console.log("[SKIP] 来源已停用");
    return;
  }

  try {
    const response = await fetch(feed.url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "GlobalView-RSS-Preview/1.0",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*"
      }
    });

    if (!response.ok) {
      console.log(`[ERROR] HTTP ${response.status}`);
      return;
    }

    const xml = await response.text();
    const items = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];

    console.log(`解析到 ${items.length} 条新闻，以下展示最多 ${MAX_TITLES_PER_FEED} 条：`);

    for (const [index, item] of items.slice(0, MAX_TITLES_PER_FEED).entries()) {
      const titleMatch = item[2].match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i);
      const dateMatch = item[2].match(/<(pubDate|published|updated|dc:date)\b[^>]*>([\s\S]*?)<\/\1>/i);
      const linkMatch = item[2].match(/<link\b[^>]*>([\s\S]*?)<\/link>/i)
        || item[2].match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);

      const title = titleMatch ? decodeXml(titleMatch[1]) : "(未解析到标题)";
      const date = dateMatch ? decodeXml(dateMatch[2]) : "未提供发布时间";
      const link = linkMatch ? decodeXml(linkMatch[1]) : "未解析到链接";

      console.log(`${index + 1}. ${title}`);
      console.log(`   时间：${date}`);
      console.log(`   链接：${link}`);
    }
  } catch (error) {
    console.log(`[ERROR] ${error.message}`);
  }
}

async function main() {
  const config = JSON.parse(await readFile(CONFIG, "utf8"));

  console.log("GlobalView 全领域 RSS 新闻预览");
  console.log("仅展示新闻标题、时间和链接，不会创建或发布文章。");

  for (const feed of config.feeds) {
    await previewFeed(feed);
  }

  console.log("\n预览结束。");
}

main().catch((error) => {
  console.error("预览脚本执行失败：", error.message);
  process.exitCode = 1;
});
