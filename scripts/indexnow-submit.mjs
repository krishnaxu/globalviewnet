
import fs from "node:fs/promises";

const SITE_HOST = "globalviewnet.pages.dev";
const SITE_ORIGIN = `https://${SITE_HOST}`;
const KEY = process.env.INDEXNOW_KEY;
const KEY_LOCATION = `${SITE_ORIGIN}/${KEY}.txt`;
const API_URL = "https://api.indexnow.org/indexnow";

if (!KEY) {
  throw new Error("缺少 INDEXNOW_KEY，请先在 GitHub Secrets 中设置。");
}

const listFile = process.argv[2];

if (!listFile) {
  throw new Error("缺少变更文件列表参数。");
}

const changedFiles = (await fs.readFile(listFile, "utf8"))
  .split(/\r?\n/)
  .map((file) => file.trim())
  .filter((file) => file.endsWith(".md") && file.startsWith("content/posts/"));

const urls = new Set();

for (const file of changedFiles) {
  let content;

  try {
    content = await fs.readFile(file, "utf8");
  } catch {
    // 文件已不存在时跳过；本版本只处理新增和更新的文章。
    console.log(`跳过无法读取的文件：${file}`);
    continue;
  }

  const frontMatter = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);

  if (!frontMatter) {
    console.log(`跳过没有有效 Front Matter 的文件：${file}`);
    continue;
  }

  const metadata = frontMatter[1];
  const slug = metadata.match(/^slug:\s*["']?([^\s"'#]+)["']?\s*$/m)?.[1];
  const published = metadata.match(/^published:\s*(true|false)\s*$/m)?.[1];

  if (published !== "true" || !slug) {
    console.log(`跳过未发布或缺少 slug 的文章：${file}`);
    continue;
  }

  // 防止异常 slug 生成站外网址或非文章路径。
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    console.log(`跳过格式异常的 slug：${slug}`);
    continue;
  }

  urls.add(`${SITE_ORIGIN}/posts/${slug}`);
}

if (urls.size === 0) {
  console.log("没有需要提交的已发布文章，本次不调用 IndexNow。");
  process.exit(0);
}

const urlList = [...urls];

console.log(`准备提交 ${urlList.length} 个文章网址：`);
for (const url of urlList) {
  console.log(`- ${url}`);
}

const response = await fetch(API_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json; charset=utf-8",
  },
  body: JSON.stringify({
    host: SITE_HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  }),
});

const responseText = await response.text();

console.log(`IndexNow HTTP 状态码：${response.status}`);
if (responseText) {
  console.log(`响应内容：${responseText.slice(0, 500)}`);
}

if (response.status !== 200 && response.status !== 202) {
  throw new Error(`IndexNow 提交失败，HTTP ${response.status}`);
}

console.log("IndexNow 已接受本次网址提交。");
