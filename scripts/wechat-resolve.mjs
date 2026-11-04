import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const CANDIDATES_FILE = path.join(
  ROOT,
  "wechat-candidates.json"
);
const OUTPUT_FILE = path.join(
  ROOT,
  "wechat-news.json"
);
const QUERY = "DrG的雍熙路";

function readArray(file) {
  if (!fs.existsSync(file)) {
    return [];
  }

  const data = JSON.parse(
    fs.readFileSync(file, "utf8")
  );

  return Array.isArray(data) ? data : [];
}

function isWechatUrl(value = "") {
  try {
    const url = new URL(value);

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

function normalizeTitle(value = "") {
  return String(value)
    .replace(
      /[\s?？!！;；:：,，。"“”'‘’]/g,
      ""
    )
    .toLowerCase();
}

function createId(value = "") {
  let hash = 2166136261;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `wechat-${(hash >>> 0).toString(16)}`;
}

function merge(items) {
  const byUrl = new Map();

  for (const item of items) {
    const url = item.url || item.link || "";

    if (!isWechatUrl(url)) {
      continue;
    }

    byUrl.set(url, {
      ...item,
      url,
      link: url
    });
  }

  return [...byUrl.values()];
}

async function sleep(milliseconds) {
  await new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );
}

async function main() {
  const candidates = readArray(
    CANDIDATES_FILE
  );

  if (!candidates.length) {
    throw new Error(
      "wechat-candidates.json 为空"
    );
  }

  const oldArticles = readArray(
    OUTPUT_FILE
  );

  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    locale: "zh-CN",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/130.0.0.0 Safari/537.36",
    viewport: {
      width: 1365,
      height: 900
    }
  });

  const page = await context.newPage();

  const searchUrl =
    "https://weixin.sogou.com/weixin?" +
    new URLSearchParams({
      type: "2",
      query: QUERY,
      ie: "utf8",
      _sug_: "n",
      _sug_type_: ""
    }).toString();

  await page.goto(searchUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  await page.waitForTimeout(2500);

  const bodyText = await page
    .locator("body")
    .innerText()
    .catch(() => "");

  if (
    /验证码|访问过于频繁|异常访问|请输入验证码/.test(
      bodyText
    )
  ) {
    throw new Error(
      "浏览器访问搜狗时触发反爬"
    );
  }

  const resultLinks = page.locator(
    "li[id^='sogou_vr_'] h3 a"
  );

  const count = await resultLinks.count();

  console.log(
    `[wechat] 浏览器找到 ${count} 个候选链接`
  );

  if (!count) {
    throw new Error(
      "浏览器未找到候选链接"
    );
  }

  const discovered = [];
  const limit = Math.min(count, 10);

  for (
    let index = 0;
    index < limit;
    index += 1
  ) {
    const links = page.locator(
      "li[id^='sogou_vr_'] h3 a"
    );

    const link = links.nth(index);
    const title = (
      await link.innerText()
    ).trim();

    console.log(
      `[wechat] 正在打开：${title}`
    );

    let articlePage = null;

    try {
      const popupPromise = context
        .waitForEvent("page", {
          timeout: 10000
        })
        .catch(() => null);

      await link.click({
        timeout: 10000
      });

      articlePage = await popupPromise;

      if (!articlePage) {
        await page.waitForTimeout(2500);

        if (isWechatUrl(page.url())) {
          articlePage = page;
        }
      }

      if (!articlePage) {
        console.log(
          "[wechat] 点击后未打开文章页面"
        );

        continue;
      }

      await articlePage
        .waitForLoadState(
          "domcontentloaded",
          {
            timeout: 20000
          }
        )
        .catch(() => {});

      await articlePage.waitForTimeout(
        1500
      );

      const finalUrl = articlePage.url();

      if (!isWechatUrl(finalUrl)) {
        console.log(
          `[wechat] 最终地址不是微信文章：${finalUrl}`
        );

        continue;
      }

      const candidate = candidates.find(
        (item) =>
          normalizeTitle(item.title) ===
          normalizeTitle(title)
      );

      discovered.push({
        id: createId(finalUrl),
        title,
        url: finalUrl,
        link: finalUrl,
        summary:
          candidate?.summary || "",
        description:
          candidate?.summary || "",
        source: "DrG的雍熙路",
        platform: "wechat",
        category: "微信",
        publishedAt: "",
        pubDate: "",
        collectedAt:
          new Date().toISOString()
      });

      console.log(
        `[wechat] 成功解析：${finalUrl}`
      );
    } catch (error) {
      console.log(
        `[wechat] 打开失败：${error.message}`
      );
    } finally {
      if (
        articlePage &&
        articlePage !== page
      ) {
        await articlePage
          .close()
          .catch(() => {});
      }

      if (page.url() !== searchUrl) {
        await page.goto(searchUrl, {
          waitUntil:
            "domcontentloaded",
          timeout: 30000
        });

        await page.waitForTimeout(
          1800
        );
      }
    }

    await sleep(3500);
  }

  await browser.close();

  if (!discovered.length) {
    throw new Error(
      "浏览器已点击候选文章，但没有获得真实微信地址；保留旧数据"
    );
  }

  const finalItems = merge([
    ...discovered,
    ...oldArticles
  ]).slice(0, 100);

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      finalItems,
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log(
    `[wechat] 本次解析 ${discovered.length} 篇真实微信文章`
  );

  console.log(
    `[wechat] 微信文章累计 ${finalItems.length} 篇`
  );
}

main().catch((error) => {
  console.error(
    "[wechat] 运行失败：",
    error.message
  );

  process.exitCode = 1;
});
