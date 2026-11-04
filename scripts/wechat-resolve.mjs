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

const SEED_FILE = path.join(
  process.cwd(),
  "content",
  "pr-portfolio",
  "wechat-seed-urls.txt"
);

const STATE_FILE = path.join(process.cwd(), "wechat-backfill-state.json");

const QUERY = "DrG的雍熙路";
const START_DATE = "2022-12-01";
const FILTER_LABEL = "一周内";
const MAX_OPEN_PER_RUN = 12;
const MAX_FILTER_PAGES = 3;
const MAX_DEFAULT_PAGES = 6;
const MAX_SEEDS_PER_RUN = 15;
const MAX_SEED_ERRORS = 5;
const DEPRIORITIZE_AFTER = 3;
const ARTICLE_TIMEOUT_MS = 45000;
const TOTAL_LIMIT_MS = 480000;

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function pause(minMs, maxMs) {
  return sleep(minMs + Math.floor(Math.random() * (maxMs - minMs)));
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

function isCaptchaText(text) {
  return /验证码|访问过于频繁|异常访问|请输入验证码/.test(String(text || ""));
}

function isCaptchaUrl(value) {
  var text = String(value || "");
  return text.indexOf("captcha") >= 0 || text.indexOf("antispider") >= 0;
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

function pad2(value) {
  return ("0" + value).slice(-2);
}

function beijingToday() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function describeUrl(value) {
  try {
    var url = new URL(value, "https://weixin.sogou.com");
    var keep = ["type", "tsn", "page"];
    var parts = [];

    url.searchParams.forEach(function (v, k) {
      parts.push(k + "=" + (keep.indexOf(k) >= 0 ? v : "…"));
    });

    return url.hostname + url.pathname + (parts.length ? "?" + parts.join("&") : "");
  } catch (error) {
    return "（无法解析）";
  }
}

function withPageParam(value, pageNo) {
  var url = new URL(value);
  url.searchParams.set("page", String(pageNo));
  return url.toString();
}

function buildDefaultUrl() {
  return (
    "https://weixin.sogou.com/weixin?" +
    new URLSearchParams({
      type: "2",
      query: QUERY,
      ie: "utf8",
      _sug_: "n",
      _sug_type_: ""
    }).toString()
  );
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

function readState() {
  var empty = {
    version: 2,
    windows: {},
    rejected: {},
    attempts: {},
    seeds: {},
    seedErrors: {}
  };

  if (!fs.existsSync(STATE_FILE)) {
    return empty;
  }

  try {
    var data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    var rejected = data.rejected || {};
    var released = 0;

    Object.keys(rejected).forEach(function (key) {
      if (String(rejected[key].reason || "").indexOf("连续") === 0) {
        delete rejected[key];
        released += 1;
      }
    });

    if (released > 0) {
      console.log(
        "[wechat] 已恢复 " + released + " 篇此前因“连续失败”被放弃的文章，本轮会重新尝试"
      );
    }

    return {
      version: 2,
      windows: data.windows || {},
      rejected: rejected,
      attempts: data.attempts || {},
      seeds: data.seeds || {},
      seedErrors: data.seedErrors || {}
    };
  } catch (error) {
    console.log("[wechat] 进度文件无法解析，重新开始记录：" + error.message);
    return empty;
  }
}

function writeState(state) {
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(state, null, 2) + "\n",
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
    return match[1] + "-" + pad2(match[2]) + "-" + pad2(match[3]);
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

/* ---------- 链接文件：粘贴文章链接即可收录 ---------- */

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, function (_, n) {
      return String.fromCodePoint(Number(n));
    })
    .replace(/&#x([0-9a-f]+);/gi, function (_, n) {
      return String.fromCodePoint(parseInt(n, 16));
    });
}

function unescapeJs(value) {
  return String(value || "")
    .replace(/\\x([0-9a-f]{2})/gi, function (_, h) {
      return String.fromCharCode(parseInt(h, 16));
    })
    .replace(/\\u([0-9a-f]{4})/gi, function (_, h) {
      return String.fromCharCode(parseInt(h, 16));
    });
}

function stripTags(value) {
  return decodeEntities(
    String(value || "")
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

function htmlMeta(html, key) {
  var tags = html.match(/<meta\b[^>]*>/gi) || [];

  for (var i = 0; i < tags.length; i += 1) {
    var tag = tags[i];
    var nameMatch =
      tag.match(/\bproperty=["']([^"']+)["']/i) ||
      tag.match(/\bname=["']([^"']+)["']/i);

    if (!nameMatch || nameMatch[1].toLowerCase() !== key.toLowerCase()) {
      continue;
    }

    var contentMatch = tag.match(/\bcontent=["']([^"']*)["']/i);
    return decodeEntities(contentMatch ? contentMatch[1] : "").trim();
  }

  return "";
}

function extractSeedUrls(text) {
  var decoded = String(text || "").replace(/&amp;/gi, "&");

  var matches =
    decoded.match(
      /https?:\/\/mp\.weixin\.qq\.com\/s(?:\/|\?)[^\s"'<>，。；、）】》“”‘’（【]+/gi
    ) || [];

  var seen = new Set();
  var output = [];

  matches.forEach(function (raw) {
    var url = raw
      .replace(/#.*$/, "")
      .replace(/[)\]）】。，、；;,.!！?？]+$/, "")
      .replace(/^http:/i, "https:");

    if (isArticleUrl(url) && !seen.has(url)) {
      seen.add(url);
      output.push(url);
    }
  });

  return output;
}

function parseSeedHtml(html) {
  var titleCandidates = [
    htmlMeta(html, "og:title"),
    unescapeJs(
      ((html.match(/\bvar\s+msg_title\s*=\s*(['"])([\s\S]*?)\1/i) || [])[2]) || ""
    ),
    htmlMeta(html, "twitter:title"),
    ((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1]) || ""
  ];

  var title = "";

  for (var i = 0; i < titleCandidates.length && !title; i += 1) {
    title = stripTags(titleCandidates[i]);
  }

  if (!title) {
    return { error: "读不到标题" };
  }

  var date = "";
  var dateSource = "";

  var ctMatch = html.match(/\bct\s*=\s*["']?(\d{10})/);
  var publishMatch = html.match(/\bvar\s+publish_time\s*=\s*["']?(\d{10})/i);

  if (ctMatch) {
    date = toDate(ctMatch[1], "");
    dateSource = "ct 时间戳";
  } else if (publishMatch) {
    date = toDate(publishMatch[1], "");
    dateSource = "publish_time 时间戳";
  }

  if (!date) {
    var metaDate = [
      htmlMeta(html, "article:published_time"),
      htmlMeta(html, "publishdate"),
      htmlMeta(html, "date")
    ].join(" ");

    var metaMatch = metaDate.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);

    if (metaMatch) {
      date = metaMatch[1] + "-" + pad2(metaMatch[2]) + "-" + pad2(metaMatch[3]);
      dateSource = "meta 标签";
    }
  }

  if (!date) {
    var loose = html.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);

    if (loose) {
      date = loose[1] + "-" + pad2(loose[2]) + "-" + pad2(loose[3]);
      dateSource = "页面文字推断（请核对）";
    }
  }

  if (!date) {
    return { error: "读不到发布日期" };
  }

  var bodyMatch = html.match(
    /<div\b[^>]*id=["']js_content["'][^>]*>([\s\S]*?)<\/div>\s*(?:<script|<div|<\/body)/i
  );

  var body = bodyMatch ? stripTags(bodyMatch[1]) : "";

  if (body.length < 300) {
    return { error: "正文过短或读不到（" + body.length + " 字符）" };
  }

  return {
    title: title,
    date: date,
    dateSource: dateSource,
    body: body,
    excerpt: stripTags(htmlMeta(html, "og:description") || htmlMeta(html, "description")),
    cover: htmlMeta(html, "og:image") || htmlMeta(html, "twitter:image")
  };
}

async function fetchSeed(url) {
  var response;

  try {
    response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(30000)
    });
  } catch (error) {
    return { status: "error", message: "请求失败：" + error.message };
  }

  var html = await response.text().catch(function () {
    return "";
  });

  var hasContent = html.indexOf("js_content") >= 0;

  if (
    isCaptchaUrl(response.url) ||
    (!hasContent && /wappoc_appmsgcaptcha|环境异常|完成验证|验证码/.test(html))
  ) {
    return { status: "blocked" };
  }

  if (!response.ok) {
    return { status: "error", message: "HTTP " + response.status };
  }

  if (!hasContent) {
    return { status: "error", message: "页面里没有正文（文章可能已删除或被限制）" };
  }

  return { status: "ok", html: html };
}

/* ---------- 搜狗：打开文章 ---------- */

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
      reason: "搜狗跳转 20 秒内没有到达微信"
    };
  }

  var finalUrl = target.url();

  if (isCaptchaUrl(finalUrl)) {
    return { status: "captcha" };
  }

  if (!isArticleUrl(finalUrl)) {
    return { status: "skip", reason: "最终地址不是微信文章：" + describeUrl(finalUrl) };
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
  var state = readState();
  var today = beijingToday();
  var seedOnly = process.env.GITHUB_EVENT_NAME === "push";

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

  var addedFromSeeds = 0;
  var addedFromSogou = 0;
  var opened = 0;
  var blocked = false;
  var context = null;
  var page = null;
  var links = null;
  var currentUrl = "";
  var lastListUrl = "https://weixin.sogou.com/";

  function saveRecord(record) {
    archive.push(record);

    archive.sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    });

    writeArchive(archive);

    knownTitles.add(normalizeTitle(record.title));
    knownUrls.add(record.source_url);
  }

  /* ----- A. 链接文件 ----- */

  async function collectSeeds() {
    var result = { found: 0, pending: 0, saved: 0, blocked: false };

    if (!fs.existsSync(SEED_FILE)) {
      console.log(
        "[wechat] 没有链接文件 content/pr-portfolio/wechat-seed-urls.txt，跳过这一步"
      );
      return result;
    }

    var urls = extractSeedUrls(fs.readFileSync(SEED_FILE, "utf8"));
    result.found = urls.length;

    var pending = urls.filter(function (url) {
      return !(state.seeds[url] && state.seeds[url].done);
    });

    result.pending = pending.length;

    console.log(
      "[wechat] 链接文件：识别到 " + urls.length + " 个文章链接，待处理 " + pending.length + " 个"
    );

    var handled = 0;

    for (var i = 0; i < pending.length; i += 1) {
      var url = pending[i];

      if (handled >= MAX_SEEDS_PER_RUN) {
        console.log(
          "[wechat] 本轮已处理 " + handled + " 个链接，其余 " +
            (pending.length - i) + " 个留给下一轮"
        );
        break;
      }

      handled += 1;

      var fetched = await fetchSeed(url);

      if (fetched.status === "blocked") {
        result.blocked = true;
        console.log(
          "[wechat] 微信返回验证码页面，链接文件本轮到此为止，其余留给下一轮：" +
            describeUrl(url)
        );
        break;
      }

      var problem = "";
      var info = null;

      if (fetched.status === "error") {
        problem = fetched.message;
      } else {
        info = parseSeedHtml(fetched.html);

        if (info.error) {
          problem = info.error;
        }
      }

      if (problem) {
        var errors = (state.seedErrors[url] || 0) + 1;
        state.seedErrors[url] = errors;

        if (errors >= MAX_SEED_ERRORS) {
          state.seeds[url] = {
            done: true,
            result: "failed",
            reason: problem,
            at: new Date().toISOString()
          };

          console.log(
            "[wechat] 链接已失败 " + errors + " 次，不再重试（" + problem + "）：" + url
          );
        } else {
          console.log(
            "[wechat] 链接暂时失败（第 " + errors + " 次，" + problem + "）：" + describeUrl(url)
          );
        }

        writeState(state);
        await pause(1500, 3000);
        continue;
      }

      if (info.date < START_DATE) {
        state.seeds[url] = {
          done: true,
          result: "tooOld",
          date: info.date,
          at: new Date().toISOString()
        };

        console.log("[wechat] 早于起始日期 " + START_DATE + "，不收录（" + info.date + "）：" + info.title);
        writeState(state);
        await pause(1500, 3000);
        continue;
      }

      if (knownUrls.has(url) || knownTitles.has(normalizeTitle(info.title))) {
        state.seeds[url] = {
          done: true,
          result: "exists",
          at: new Date().toISOString()
        };

        console.log("[wechat] 已在归档，跳过：" + info.title);
        writeState(state);
        await pause(1500, 3000);
        continue;
      }

      saveRecord({
        slug:
          "wechat-" +
          crypto.createHash("sha256").update(url).digest("hex").slice(0, 20),
        title: info.title,
        source: "Industry News",
        source_url: url,
        date: info.date,
        excerpt: info.excerpt,
        body: info.body,
        cover_image: info.cover,
        published: true,
        fetched_at: new Date().toISOString()
      });

      state.seeds[url] = {
        done: true,
        result: "saved",
        at: new Date().toISOString()
      };

      delete state.seedErrors[url];
      writeState(state);
      result.saved += 1;
      addedFromSeeds += 1;

      console.log(
        "[wechat] 已保存（链接文件）：" + info.title + "（" + info.date +
          "，日期来源：" + info.dateSource + "，正文 " + info.body.length + " 字符）"
      );

      await pause(1500, 3000);
    }

    return result;
  }

  /* ----- B. 搜狗 ----- */

  async function guardCaptcha() {
    var landed = page.url();

    var text = await page
      .locator("body")
      .innerText()
      .catch(function () {
        return "";
      });

    if (isCaptchaText(text) || isCaptchaUrl(landed)) {
      var error = new Error("搜狗触发验证码");
      error.code = "CAPTCHA";
      throw error;
    }
  }

  async function openList(url) {
    currentUrl = url;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
      referer: lastListUrl
    });

    await page.waitForTimeout(2000);
    await guardCaptcha();

    var landed = page.url();
    var onList = landed.indexOf("weixin.sogou.com/weixin") >= 0;

    if (onList) {
      lastListUrl = landed;
    }

    return onList;
  }

  async function warmUp() {
    await page.goto("https://weixin.sogou.com/", {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.waitForTimeout(1500);

    var onList = await openList(buildDefaultUrl());

    var names = (await context.cookies("https://weixin.sogou.com"))
      .map(function (cookie) {
        return cookie.name;
      })
      .sort();

    console.log(
      "[wechat] 预热完成，搜索页" + (onList ? "正常" : "未能打开") +
        "；搜狗 Cookie：" + (names.join("、") || "无")
    );

    return onList;
  }

  async function probeList() {
    try {
      var tsnLinks = page.locator("a[href*='tsn=']");
      var nextCount = await page.locator("a#sogou_next").count();
      var tsnCount = await tsnLinks.count();

      console.log(
        "[wechat] 页面结构：下一页链接 " + nextCount + " 个；含 tsn= 的时间筛选链接 " +
          tsnCount + " 个"
      );

      for (var k = 0; k < Math.min(tsnCount, 6); k += 1) {
        var anchor = tsnLinks.nth(k);

        var label = String(
          (await anchor.textContent().catch(function () {
            return "";
          })) || ""
        ).trim();

        var href = String(
          (await anchor.getAttribute("href").catch(function () {
            return "";
          })) || ""
        );

        console.log("[wechat]   时间筛选 " + label + " -> " + describeUrl(href));
      }
    } catch (error) {
      console.log("[wechat] 页面结构探测失败：" + error.message);
    }
  }

  async function applyTimeFilter() {
    var anchors = page.locator("a[href*='tsn=']");
    var total = await anchors.count();

    for (var k = 0; k < total; k += 1) {
      var anchor = anchors.nth(k);

      var label = String(
        (await anchor.textContent().catch(function () {
          return "";
        })) || ""
      ).trim();

      if (label.indexOf(FILTER_LABEL) < 0) {
        continue;
      }

      var before = page.url();

      var navigated = page
        .waitForURL(
          function (u) {
            var text = u.toString();
            return text !== before && /tsn=/.test(text);
          },
          { timeout: 15000, waitUntil: "domcontentloaded" }
        )
        .then(function () {
          return true;
        })
        .catch(function () {
          return false;
        });

      await anchor.evaluate(function (element) {
        element.click();
      });

      var reached = await navigated;

      if (reached) {
        await page.waitForTimeout(1800);
      }

      await guardCaptcha();

      var landed = page.url();
      var ok = reached && landed.indexOf("weixin.sogou.com/weixin") >= 0;

      console.log(
        "[wechat] 点击“" + FILTER_LABEL + "”后落点：" + describeUrl(landed) +
          (ok ? "" : "（筛选没有生效）")
      );

      if (ok) {
        currentUrl = landed;
        lastListUrl = landed;
      }

      return ok;
    }

    console.log("[wechat] 页面上没有找到“" + FILTER_LABEL + "”筛选链接");
    return false;
  }

  async function clickNext() {
    var next = page.locator("a#sogou_next");

    if ((await next.count()) === 0) {
      next = page.locator("a:has-text('下一页')");
    }

    if ((await next.count()) === 0) {
      return false;
    }

    var before = page.url();

    var moved = page
      .waitForURL(
        function (u) {
          return u.toString() !== before;
        },
        { timeout: 15000, waitUntil: "domcontentloaded" }
      )
      .then(function () {
        return true;
      })
      .catch(function () {
        return false;
      });

    try {
      await next.first().click({ timeout: 10000 });
    } catch (error) {
      console.log("[wechat] 点击“下一页”失败：" + String(error.message).split("\n")[0]);
      return false;
    }

    await moved;
    await page.waitForTimeout(2000);
    await guardCaptcha();

    var landed = page.url();

    if (landed.indexOf("weixin.sogou.com/weixin") < 0) {
      return false;
    }

    currentUrl = landed;
    lastListUrl = landed;
    return true;
  }

  async function readTitles() {
    var total = await links.count();
    var titles = [];

    for (var j = 0; j < total; j += 1) {
      var text = await links
        .nth(j)
        .innerText()
        .catch(function () {
          return "";
        });

      titles.push(String(text || "").trim());
    }

    return titles;
  }

  async function findLinkIndex(wanted) {
    var titles = await readTitles();

    for (var j = 0; j < titles.length; j += 1) {
      if (normalizeTitle(titles[j]) === normalizeTitle(wanted)) {
        return j;
      }
    }

    return -1;
  }

  async function backToList() {
    if (page.url().indexOf("weixin.sogou.com/weixin") < 0) {
      await openList(currentUrl);
    }
  }

  function reject(key, title, reason) {
    state.rejected[key] = {
      title: title,
      reason: reason,
      at: new Date().toISOString()
    };

    console.log("[wechat] 已记录并不再打开：" + reason + "：" + title);
  }

  function transient(key, title, reason) {
    var count = (state.attempts[key] || 0) + 1;
    state.attempts[key] = count;

    console.log(
      "[wechat] 暂时没打开（累计失败 " + count + " 次，不会被放弃）：" + reason + "：" + title
    );

    return "retry";
  }

  async function handleItem(listTitle) {
    var key = normalizeTitle(listTitle);
    var linkIndex = await findLinkIndex(listTitle);

    if (linkIndex < 0) {
      try {
        await openList(currentUrl);
     "CAPTCHA") {
          return "captcha";
        }
      }

      linkIndex = await findLinkIndex(listTitle);

      if (linkIndex < 0) {
        return "lost";
      }
    }

    opened += 1;
    console.log("[wechat] 正在打开：" + listTitle);

    var result = null;

    try {
      result = await withTimeout(
        openAndRead(context, page, links.nth(linkIndex)),
        ARTICLE_TIMEOUT_MS,
        "单篇文章"
      );
    } catch (error) {
      await closeExtraPages(context, page);
      return transient(key, listTitle, error.message);
    }

    await closeExtraPages(context, page);

    if (result.status === "captcha") {
      console.log("[wechat] 微信弹出验证码，本轮停止，已获取的文章保留");
      return "captcha";
    }

    if (result.status === "skip") {
      return transient(key, listTitle, result.reason);
    }

    var info = result.info;
    var account = String(info.account || "").trim();
    var body = cleanBody(info.body);
    var verified = /DrG|雍熙路/.test(account) || body.indexOf("雍熙路") >= 0;

    if (!verified) {
      reject(key, listTitle, "不是 DrG的雍熙路 的文章（" + account + "）");
      return "rejected";
    }

    if (body.length < 300) {
      reject(key, listTitle, "正文过短（" + body.length + " 字符）");
      return "rejected";
    }

    var title = String(info.title || listTitle).trim();
    var articleDate = toDate(info.ct, info.publishText);

    if (!articleDate) {
      reject(key, listTitle, "读不到发布日期");
      return "rejected";
    }

    if (articleDate < START_DATE) {
      reject(key, listTitle, "早于起始日期 " + START_DATE + "（" + articleDate + "）");
      return "rejected";
    }

    var sourceUrl = String(info.ogUrl || "")
      .replace(/^http:/, "https:")
      .replace(/#.*$/, "");

    if (!isArticleUrl(sourceUrl)) {
      sourceUrl = result.finalUrl;
    }

    if (knownUrls.has(sourceUrl) || knownTitles.has(normalizeTitle(title))) {
      knownTitles.add(key);
      return "exists";
    }

    saveRecord({
      slug: makeSlug(sourceUrl),
      title: title,
      source: "Industry News",
      source_url: sourceUrl,
      date: articleDate,
      excerpt: String(info.description || "").trim(),
      body: body,
      cover_image: info.cover || "",
      published: true,
      fetched_at: new Date().toISOString()
    });

    knownTitles.add(key);
    delete state.attempts[key];
    writeState(state);
    addedFromSogou += 1;

    console.log(
      "[wechat] 已保存：" + title + "（" + articleDate + "，正文 " + body.length + " 字符）"
    );

    return "saved";
  }

  async function processTitles(titles) {
    var summary = { retries: 0, captcha: false, budget: false, lost: false, archived: 0 };

    var fresh = [];
    var stubborn = [];

    titles.forEach(function (title) {
      var key = normalizeTitle(title);

      if (!key) {
        return;
      }

      if (knownTitles.has(key)) {
        summary.archived += 1;
        return;
      }

      if (state.rejected[key]) {
        return;
      }

      if ((state.attempts[key] || 0) >= DEPRIORITIZE_AFTER) {
        stubborn.push(title);
      } else {
        fresh.push(title);
      }
    });

    var ordered = fresh.concat(stubborn);

    for (var i = 0; i < ordered.length; i += 1) {
      if (opened >= MAX_OPEN_PER_RUN) {
        summary.budget = true;
        break;
      }

      var status = await handleItem(ordered[i]);

      if (status === "captcha") {
        summary.captcha = true;
        break;
      }

      if (status === "lost") {
        console.log("[wechat] 列表页丢失，无法继续点击这一页的文章，本页到此为止");
        summary.lost = true;
        break;
      }

      if (status === "retry") {
        summary.retries += 1;
      }

      writeState(state);

      try {
        await backToList();
      } catch (error) {
        if (error.code === "CAPTCHA") {
          summary.captcha = true;
          break;
        }

        summary.lost = true;
        break;
      }

      await pause(2500, 4000);
    }

    return summary;
  }

  async function walkList(maxPages) {
    var result = { captcha: false, pages: 0, listed: 0, archived: 0 };
    var prevFirst = "";

    for (var p = 1; p <= maxPages; p += 1) {
      if (p > 1) {
        var ok = false;

        try {
          ok = await clickNext();

          if (!ok) {
            console.log("[wechat] 没能点到“下一页”，改为在当前网址上换成第 " + p + " 页");
            ok = await openList(withPageParam(currentUrl, p));
          }
        } catch (error) {
          if (error.code === "CAPTCHA") {
            result.captcha = true;
            console.log("[wechat] 搜狗列表页触发验证码，本轮停止，已获取的文章保留");
            break;
          }

          console.log("[wechat] 翻页出错，停止翻页：" + String(error.message).split("\n")[0]);
          break;
        }

        if (!ok) {
          console.log("[wechat] 第 " + p + " 页无法打开（可能已是最后一页），停止翻页");
          break;
        }
      }

      var titles = await readTitles();

      if (titles.length === 0 || titles[0] === prevFirst) {
        break;
      }

      prevFirst = titles[0];
      result.pages = p;
      result.listed += titles.length;

      console.log("[wechat] 第 " + p + " 页：" + titles.length + " 条");

      var pageSummary = await processTitles(titles);
      result.archived += pageSummary.archived;

      if (pageSummary.captcha) {
        result.captcha = true;
        break;
      }

      if (pageSummary.budget) {
        console.log("[wechat] 本轮已达到打开上限，其余留给下一轮");
        break;
      }

      if (pageSummary.lost || titles.length < 10) {
        break;
      }

      await pause(3000, 5000);
    }

    return result;
  }

  async function collectFromSogou() {
    var browser = await chromium.launch({ headless: true });
    var source = "";

    try {
      context = await browser.newContext({
        locale: "zh-CN",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/130.0.0.0 Safari/537.36",
        viewport: { width: 1365, height: 900 }
      });

      page = await context.newPage();
      page.setDefaultTimeout(15000);
      links = page.locator("li[id^='sogou_vr_'] h3 a");

      var warmed = false;

      try {
        warmed = await warmUp();

        if (warmed) {
          await probeList();
        }
      } catch (error) {
        if (error.code === "CAPTCHA") {
          blocked = true;
          console.log("[wechat] 预热时触发验证码，本轮停止，已获取的文章保留");
          return source;
        }

        console.log("[wechat] 预热失败，继续尝试：" + error.message);
      }

      var filteredOk = false;
      var listed = 0;
      var filterArchived = 0;

      if (warmed) {
        try {
          filteredOk = await applyTimeFilter();
        } catch (error) {
          if (error.code === "CAPTCHA") {
            blocked = true;
            console.log("[wechat] 点击时间筛选后出现验证码，本轮停止，已获取的文章保留");
            return source;
          }

          console.log("[wechat] 时间筛选出错：" + error.message);
        }
      }

      if (filteredOk) {
        var weekly = await walkList(MAX_FILTER_PAGES);

        listed = weekly.listed;
        filterArchived = weekly.archived;
        source = FILTER_LABEL + "筛选（" + weekly.pages + " 页，共 " + weekly.listed + " 条）";

        if (weekly.captcha) {
          blocked = true;
          return source;
        }

        if (listed === 0) {
          console.log("[wechat] “" + FILTER_LABEL + "”筛选后没有结果，再用默认排序补查一遍");
        } else if (filterArchived === listed) {
          console.log("[wechat] “" + FILTER_LABEL + "”内的文章都已在归档里");
        }
      } else if (warmed) {
        console.log("[wechat] 时间筛选没有生效，改用默认排序");
      }

      if (!filteredOk || listed === 0) {
        try {
          var onList = await openList(buildDefaultUrl());

          if (!onList) {
            throw new Error("默认搜索页打不开，落点：" + describeUrl(page.url()));
          }

          var walked = await walkList(MAX_DEFAULT_PAGES);
          source = "默认排序（" + walked.pages + " 页，共 " + walked.listed + " 条，相关性排序，不保证是最新）";

          if (walked.captcha) {
            blocked = true;
          }
        } catch (error) {
          if (error.code === "CAPTCHA") {
            blocked = true;
            console.log("[wechat] 搜狗列表页触发验证码，本轮停止");
          } else {
            console.log("[wechat] 默认排序失败：" + error.message);
          }
        }
      }
    } finally {
      await browser.close().catch(function () {});
    }

    return source;
  }

  var watchdog = setTimeout(function () {
    console.log("[wechat] 达到总时长上限，结束本轮；已保存的文章和进度不受影响");
    writeState(state);
    process.exit(0);
  }, TOTAL_LIMIT_MS);

  var sogouSource = "";
  var seedResult = { found: 0, pending: 0, saved: 0, blocked: false };

  try {
    seedResult = await collectSeeds();

    if (seedOnly) {
      console.log("[wechat] 本次由链接文件的改动触发，只处理链接文件，不访问搜狗");
    } else {
      sogouSource = await collectFromSogou();
    }
  } finally {
    clearTimeout(watchdog);
    writeState(state);
  }

  console.log(
    "[wechat] 本轮新增 " + (addedFromSeeds + addedFromSogou) + " 篇（链接文件 " +
      addedFromSeeds + " 篇，搜狗 " + addedFromSogou + " 篇）；归档累计 " +
      archive.length + " 篇"
  );

  if (sogouSource) {
    console.log("[wechat] 搜狗列表来源：" + sogouSource);
  }

  var newest = archive.slice().sort(function (a, b) {
    return String(b.date || "").localeCompare(String(a.date || ""));
  })[0];

  console.log(
    "[wechat] 北京时间今天：" + today + "；归档里最新的一篇：" +
      (newest ? newest.date + "《" + newest.title + "》" : "（空）")
  );

  var rejectedCount = Object.keys(state.rejected).length;
  var stuck = Object.keys(state.attempts).filter(function (key) {
    return state.attempts[key] >= DEPRIORITIZE_AFTER && !state.rejected[key];
  }).length;

  console.log(
    "[wechat] 已确定不收录 " + rejectedCount + " 篇；打不开次数较多、已降低优先级 " + stuck + " 篇"
  );

  if (blocked || seedResult.blocked) {
    console.log("[wechat] 本轮因验证码提前结束，下一次运行会继续");
  }
}

main().catch(function (error) {
  console.error("[wechat] 运行失败：" + error.message);
  process.exitCode = 1;
});
