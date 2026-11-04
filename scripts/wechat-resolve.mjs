import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";

const ARCHIVE_FILE = path.join(
  process.cwd(),
  "content",
  "pr-portfolio",
  "wechat-articles.json"
);

const QUERY = "DrG的雍熙路";
const MAX_CANDIDATES = 8;
const ARTICLE_TIMEOUT_MS = 45000;
const TOTAL_LIMIT_MS = 270000;

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function withTimeout(promise, ms, label) {
  var timer;

  var timeout = new Promise(function (resolve, reject) {
    timer = setTimeout(function () {
      reject(new Error(label + "超时"));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(function () {
    clearTimeout(timer);
  });
}

function normalizeTitle(value) {
  return String(value || "")
    .replace(/[\s\u3000?？!！;；:：,，。、"“”'‘’()（）]/g, "")
    .toLowerCase();
}

function isCaptchaUrl(value) {
  return String(value || "").indexOf("captcha") >= 0;
}

function isArticleUrl(value) {
  try {
    var url = new URL(value);

    return (
      url.hostname === "mp.weixin.qq.com" &&
      (url.pathname === "/s" || url.pathname.indexOf("/s/") === 0)
    );
  } catch (error) {
    return false;
  }
}

function readArchive() {
  if (!fs.existsSync(ARCHIVE_FILE)) {
    return [];
  }

  var data = JSON.parse(fs.readFileSync(ARCHIVE_FILE, "utf8"));

  if (!Array.isArray(data)) {
    throw new Error("wechat-articles.json 顶层不是数组，已停止，避免覆盖原文件");
  }

  return data;
}

function writeArchive(items) {
  fs.mkdirSync(path.dirname(ARCHIVE_FILE), { recursive: true });
  fs.writeFileSync(
    ARCHIVE_FILE,
    JSON.stringify(items, null, 2) + "\n",
    "utf8"
  );
}

function makeSlug(url) {
  return (
    "wechat-" +
    crypto.createHash("sha1").update(url).digest("hex").slice(0, 20)
  );
}

function cleanBody(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toDate(ct, publishText) {
  if (ct && /^\d{9,11}$/.test(String(ct))) {
    var shifted = Number(ct) * 1000 + 8 * 3600 * 1000;
    return new Date(shifted).toISOString().slice(0, 10);
  }

  var match = String(publishText || "").match(
    /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/
  );

  if (match) {
    var month = ("0" + match[2]).slice(-2);
    var day = ("0" + match[3]).slice(-2);
    return match[1] + "-" + month + "-" + day;
  }

  return "";
}

var extractInPage = function () {
  function meta(name) {
    var node = document.querySelector('meta[property="' + name + '"]');
    return node ? node.getAttribute("content") || "" : "";
  }

  var content = document.querySelector("#js_content");
  var nameNode = document.querySelector("#js_name");
  var titleNode = document.querySelector("#activity-name");
  var timeNode = document.querySelector("#publish_time");
  var html = document.documentElement.innerHTML;
  var ctMatch = html.match(/\bct\s*=\s*["']?(\d{10})/);

  return {
    title: titleNode ? titleNode.innerText.trim() : meta("og:title"),
    account: nameNode ? nameNode.innerText.trim() : "",
    body: content ? content.innerText : "",
    cover: meta("og:image"),
    description: meta("og:description"),
    ogUrl: meta("og:url"),
    ct: ctMatch ? ctMatch[1] : "",
    publishText: timeNode ? timeNode.innerText : ""
  };
};

async function openAndRead(context, page, link) {
  var popupPromise = context
    .waitForEvent("page", { timeout: 10000 })
    .catch(function () {
      return null;
    });

  await link.click({ timeout: 10000 });

  var popup = await popupPromise;
  var target = popup || page;

  try {
    await target.waitForURL(/mp\.weixin\.qq\.com/, {
      timeout: 20000,
      waitUntil: "domcontentloaded"
    });
  } catch (error) {
    return {
      status: "skip",
      reason: "搜狗跳转 20 秒内没有到达微信：" + target.url()
    };
  }

  var finalUrl = target.url();

  if (isCaptchaUrl(finalUrl)) {
    return { status: "captcha" };
  }

  if (!isArticleUrl(finalUrl)) {
    return { status: "skip", reason: "最终地址不是微信文章：" + finalUrl };
  }

  try {
    await target.waitForSelector("#js_content", { timeout: 12000 });
  } catch (error) {
    var text = await target
      .evaluate(function () {
        return document.body ? document.body.innerText : "";
      })
      .catch(function () {
        return "";
      });

    if (/环境异常|完成验证|验证码/.test(text)) {
      return { status: "captcha" };
    }

    return { status: "skip", reason: "文章正文没有加载出来" };
  }

  var info = await target.evaluate(extractInPage);

  return { status: "ok", info: info, finalUrl: finalUrl };
}

async function closeExtraPages(context, page) {
  var pages = context.pages();

  for (var index = 0; index < pages.length; index += 1) {
    if (pages[index] !== page) {
      await pages[index].close().catch(function () {});
    }
  }
}

async function main() {
  var archive = readArchive();

  var knownTitles = new Set(
    archive.map(function (item) {
      return normalizeTitle(item.title);
    })
  );

  var knownUrls = new Set(
    archive.map(function (item) {
      return item.source_url;
    })
  );

  var added = 0;
  var blocked = false;

  var watchdog = setTimeout(function () {
    console.log("[wechat] 达到总时长上限，结束本轮；已保存的文章不受影响");
    process.exit(0);
  }, TOTAL_LIMIT_MS);

  var browser = await chromium.launch({ headless: true });

  try {
    var context = await browser.newContext({
      locale: "zh-CN",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/130.0.0.0 Safari/537.36",
      viewport: { width: 1365, height: 900 }
    });

    var page = await context.newPage();
    page.setDefaultTimeout(15000);

    var searchUrl =
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

    var searchText = await page
      .locator("body")
      .innerText()
      .catch(function () {
        return "";
      });

    if (/验证码|访问过于频繁|异常访问|请输入验证码/.test(searchText)) {
      throw new Error("搜狗搜索页触发反爬，本轮停止");
    }

    var links = page.locator("li[id^='sogou_vr_'] h3 a");
    var count = await links.count();

    console.log("[wechat] 搜狗返回 " + count + " 个候选");

    if (!count) {
      throw new Error("没有找到候选文章");
    }

    var limit = Math.min(count, MAX_CANDIDATES);
    var titles = [];

    for (var t = 0; t < limit; t += 1) {
      titles.push((await links.nth(t).innerText()).trim());
    }

    for (var i = 0; i < limit && !blocked; i += 1) {
      var listTitle = titles[i];

      if (knownTitles.has(normalizeTitle(listTitle))) {
        console.log("[wechat] 已归档，跳过：" + listTitle);
        continue;
      }

      console.log("[wechat] 正在打开：" + listTitle);

      try {
        var result = await withTimeout(
          openAndRead(context, page, links.nth(i)),
          ARTICLE_TIMEOUT_MS,
          "单篇文章"
        );

        if (result.status === "captcha
