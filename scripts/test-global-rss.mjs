import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const CONFIG = resolve("scripts/rss-feeds-global.json");
const OUTPUT_DIR = resolve("data");
const OUTPUT_FILE = resolve(OUTPUT_DIR, "global-rss-test-results.json");
const TIMEOUT_MS = 15000;

async function testFeed(feed) {
  if (!feed.enabled) {
    return {
      id: feed.id,
      name: feed.name,
      status: "skipped",
      count: 0
    };
  }

  try {
    const response = await fetch(feed.url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "GlobalView-RSS-Test/1.0",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xml = await response.text();

    if (!xml.trim() || !/<(rss|feed|rdf:RDF)\b/i.test(xml)) {
      throw new Error("响应内容不是可识别的 RSS/Atom XML");
    }

    const items = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];

    const titles = items.map((match) => {
      const found = match[2].match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i);
      return found
        ? found[1]
            .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
            .replace(/<[^>]+>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;|&apos;/g, "'")
            .trim()
        : "";
    }).filter(Boolean);

    return {
      id: feed.id,
      name: feed.name,
      url: feed.url,
      status: titles.length ? "ok" : "empty",
      httpStatus: response.status,
      count: titles.length,
      sampleTitles: titles.slice(0, 3)
    };
  } catch (error) {
    return {
      id: feed.id,
      name: feed.name,
      url: feed.url,
      status: "error",
      count: 0,
      error: error.message
    };
  }
}

async function main() {
  const config = JSON.parse(await readFile(CONFIG, "utf8"));
  const results = [];

  for (const feed of config.feeds) {
    const result = await testFeed(feed);
    results.push(result);

    if (result.status === "ok") {
      console.log(`[OK] ${result.name}: 获取到 ${result.count} 条，示例：${result.sampleTitles[0]}`);
    } else if (result.status === "empty") {
      console.log(`[WARN] ${result.name}: 地址可访问，但没有解析到新闻条目`);
    } else if (result.status === "skipped") {
      console.log(`[SKIP] ${result.name}: 已停用`);
    } else {
      console.log(`[ERROR] ${result.name}: ${result.error}`);
    }
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    OUTPUT_FILE,
    JSON.stringify({
      testedAt: new Date().toISOString(),
      total: results.length,
      passed: results.filter((item) => item.status === "ok").length,
      results
    }, null, 2),
    "utf8"
  );

  console.log("");
  console.log(`测试完成：${results.filter((item) => item.status === "ok").length}/${results.length} 个来源成功解析到新闻。`);
  console.log(`结果文件：${OUTPUT_FILE}`);
  console.log("本脚本仅测试 RSS，不会创建或发布文章。");
}

main().catch((error) => {
  console.error("测试脚本执行失败：", error.message);
  process.exitCode = 1;
});
