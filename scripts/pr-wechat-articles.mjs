
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const START_DATE = "2022-11-01";
const OUTPUT_FILE = "content/pr-portfolio/wechat-articles.json";
const SOURCE = "Industry News";

const SEED_URLS = [
  "https://mp.weixin.qq.com/s/5GlmPbjsdhI6hRHPLwnTmA",
  "https://mp.weixin.qq.com/s/JLRp57XUFpo_qEamlVpIzw"
];

function decodeHTML(value = "") {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCodePoint(Number(n))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    );
}

function stripHTML(value = "") {
  return decodeHTML(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function getMeta(html, key) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];

  for (const tag of tags) {
    const name =
      tag.match(/\bproperty=["']([^"']+)["']/i)?.[1] ||
      tag.match(/\bname=["']([^"']+)["']/i)?.[1];

    if (name?.toLowerCase() !== key.toLowerCase()) {
      continue;
    }

    return decodeHTML(
      tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] || ""
    ).trim();
  }

  return "";
}

function getTitle(html) {
  const candidates = [
    html.match(
      /\bvar\s+msg_title\s*=\s*(['"])([\s\S]*?)\1/i
    )?.[2],
    getMeta(html, "og:title"),
    getMeta(html, "twitter:title"),
    html.match(
      /<title\b[^>]*>([\s\S]*?)<\/title>/i
    )?.[1]
  ];

  for (const value of candidates) {
    const title = stripHTML(value || "");
    if (title) return title;
  }

  return "";
}

function getDate(html) {
  const timestampCandidates = [
    html.match(
      /\bvar\s+publish_time\s*=\s*["']?(\d{10})/i
    )?.[1],
    html.match(
      /\bct\s*=\s*["']?(\d{10})/i
    )?.[1]
  ];

  for (const timestamp of timestampCandidates) {
    if (!timestamp) continue;

    const date = new Date(Number(timestamp) * 1000);

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  const candidates = [
    getMeta(html, "article:published_time"),
    getMeta(html, "publishdate"),
    getMeta(html, "date"),
    html.match(
      /\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/
    )?.[0] || ""
  ];

  for (const value of candidates) {
    const match = value.match(
      /(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/
    );

    if (match) {
      return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    }
  }

  return "";
}

function getBody(html) {
  const match = html.match(
    /<div\b[^>]*id=["']js_content["'][^>]*>([\s\S]*?)<\/div>\s*(?:<script|<div|<\/body)/i
  );

  if (match?.[1]) {
    return stripHTML(match[1]);
  }

  return "";
}

function getCover(html) {
  return (
    getMeta(html, "og:image") ||
    getMeta(html, "twitter:image")
  );
}

async function fetchArticle(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
    },
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  const title = getTitle(html);
  const date = getDate(html);
  const body = getBody(html);

  if (!title) {
    throw new Error(
      "未能从页面读取标题，可能被微信限制访问。"
    );
  }

  if (!date) {
    throw new Error(
      "未能读取文章日期，暂不写入归档。"
    );
  }

  if (date < START_DATE) {
    console.log(
      `跳过历史起点之前的文章：${title} (${date})`
    );
    return null;
  }

  const slug = `wechat-${createHash("sha256")
    .update(url)
    .digest("hex")
    .slice(0, 20)}`;

  return {
    slug,
    title,
    source: SOURCE,
    source_url: url,
    date,
    excerpt: stripHTML(
      getMeta(html, "og:description") ||
      getMeta(html, "description")
    ),
    body,
    cover_image: getCover(html),
    published: true,
    fetched_at: new Date().toISOString()
  };
}

async function readExisting() {
  try {
    const text = await fs.readFile(OUTPUT_FILE, "utf8");
    const data = JSON.parse(text);

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

  for (const url of SEED_URLS) {
    console.log(`尝试抓取：${url}`);

    try {
      const article = await fetchArticle(url);

      if (article) {
        byURL.set(article.source_url, {
          ...byURL.get(article.source_url),
          ...article
        });

        console.log(
          `成功读取：${article.title} (${article.date})`
        );
        console.log(
          `正文长度：${article.body.length} 字符`
        );
      }
    } catch (error) {
      console.error(`抓取失败：${url}`);
      console.error(error.message);
    }
  }

  const output = [...byURL.values()]
    .filter(item => item.date >= START_DATE)
    .sort((a, b) => b.date.localeCompare(a.date));

  await fs.mkdir(path.dirname(OUTPUT_FILE), {
    recursive: true
  });

  await fs.writeFile(
    OUTPUT_FILE,
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8"
  );

  console.log(`归档文章累计：${output.length} 篇`);
  console.log(`保存位置：${OUTPUT_FILE}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
