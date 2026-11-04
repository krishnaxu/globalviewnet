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

const STATE_FILE = path.join(process.cwd(), "wechat-backfill-state.json");

const QUERY = "DrG的雍熙路";
const START_DATE = "2022-12-01";
const MAX_OPEN_PER_RUN = 12;
const MAX_PAGES_PER_WINDOW = 10;
const MAX_ATTEMPTS = 3;
const SETTLE_DAYS = 31;
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

function addDays(dateText, days) {
  var date = new Date(dateText + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function buildWindows(startDate, today) {
  var windows = [];
  var year = Number(startDate.slice(0, 4));
  var month = Number(startDate.slice(5, 7));
  var endYear = Number(today.slice(0, 4));
  var endMonth = Number(today.slice(5, 7));

  while (year < endYear || (year === endYear && month <= endMonth)) {
    var key = year + "-" + pad2(month);
    var first = key + "-01";
    var last = key + "-" + pad2(lastDayOfMonth(year, month));

    windows.push({
      key: key,
      ft: first < startDate ? startDate : first,
      et: last > today ? today : last
    });

    month += 1;

    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  windows.reverse();
  return windows;
}

function buildListUrl(ft, et, pageNo) {
  var params = {
    type: "2",
    query: QUERY,
    ie: "utf8",
    _sug_: "n",
    _sug_type_: ""
  };

  if (ft && et) {
    params.tsn = "5";
    params.ft = ft;
    params.et = et;
  }

  if (pageNo > 1) {
    params.page = String(pageNo);
  }

  return "https://weixin.sogou.com/weixin?" + new URLSearchParams(params).toString();
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
  var empty = { version: 1, windows: {}, rejected: {}, attempts: {} };

  if (!fs.existsSync(STATE_FILE)) {
    return empty;
  }

  try {
    var data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));

    return {
      version: 1,
      windows: data.windows || {},
      rejected: data.rejected || {},
      attempts: data.attempts || {}
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
  var state = readState();
  var today = beijingToday();
  var settleBefore = addDays(today, -SETTLE_DAYS);
  var windows = buildWindows(START_DATE, today);

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
  var opened = 0;
  var blocked = false;
  var context = null;
  var page = null;
  var links = null;
  var currentUrl = "";

  async function openList(url) {
    currentUrl = url;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
      referer: "https://weixin.sogou.com/"
    });

    await page.waitForTimeout(2000);

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

    return landed.indexOf("weixin.sogou.com/weixin") >= 0;
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

  function retryOrReject(key, title, reason) {
    var count = (state.attempts[key] || 0) + 1;
    state.attempts[key] = count;

    if (count >= MAX_ATTEMPTS) {
      reject(key, title, "连续 " + MAX_ATTEMPTS + " 次失败（" + reason + "）");
      return "rejected";
    }

    console.log(
      "[wechat] 暂时跳过（第 " + count + " 次）：" + reason + "：" + title
    );

    return "retry";
  }

  async function handleItem(listTitle) {
    var key = normalizeTitle(listTitle);
    var linkIndex = await findLinkIndex(listTitle);

    if (linkIndex < 0) {
      return retryOrReject(key, listTitle, "列表已变化，找不到该文章");
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
      return retryOrReject(key, listTitle, error.message);
    }

    await closeExtraPages(context, page);

    if (result.status === "captcha") {
      console.log("[wechat] 微信弹出验证码，本轮停止，已获取的文章保留");
      return "captcha";
    }

    if (result.status === "skip") {
      return retryOrReject(key, listTitle, result.reason);
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

    archive.push({
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

    archive.sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    });

    writeArchive(archive);

    knownTitles.add(key);
    knownTitles.add(normalizeTitle(title));
    knownUrls.add(sourceUrl);
    delete state.attempts[key];
    writeState(state);
    added += 1;

    console.log(
      "[wechat] 已保存：" +
        title +
        "（" +
        articleDate +
        "，正文 " +
        body.length +
        " 字符）"
    );

    return "saved";
  }

  async function processTitles(titles) {
    var summary = { retries: 0, captcha: false, budget: false, archived: 0 };

    for (var i = 0; i < titles.length; i += 1) {
      var key = normalizeTitle(titles[i]);

      if (!key) {
        continue;
      }

      if (knownTitles.has(key)) {
        summary.archived += 1;
        continue;
      }

      if (state.rejected[key]) {
        continue;
      }

      if (opened >= MAX_OPEN_PER_RUN) {
        summary.budget = true;
        break;
      }

      var status = await handleItem(titles[i]);

      if (status === "captcha") {
        summary.captcha = true;
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

        summary.retries += 1;
      }

      await pause(2500, 4000);
    }

    return summary;
  }

  var watchdog = setTimeout(function () {
    console.log("[wechat] 达到总时长上限，结束本轮；已保存的文章和进度不受影响");
    process.exit(0);
  }, TOTAL_LIMIT_MS);

  var browser = await chromium.launch({ headless: true });

  var doneCount = 0;
  var unfinished = [];
  var truncatedMonths = [];
  var unsupported = false;
  var suspect = false;
  var probed = false;
  var landing = "";
  var lastSignature = "";

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

    for (var wi = 0; wi < windows.length; wi += 1) {
      var win = windows[wi];
      var ws = state.windows[win.key] || {};

      if (ws.done) {
        doneCount += 1;
        continue;
      }

      if (blocked || unsupported || suspect || opened >= MAX_OPEN_PER_RUN) {
        unfinished.push(win.key);
        continue;
      }

      var listed = 0;
      var archivedInList = 0;
      var retries = 0;
      var captcha = false;
      var budget = false;
      var ended = false;
      var previousFirst = "";
      var pageNo = 1;
      var savedBefore = added;

      try {
        for (pageNo = 1; pageNo <= MAX_PAGES_PER_WINDOW; pageNo += 1) {
          var onList = await openList(buildListUrl(win.ft, win.et, pageNo));

          if (!onList) {
            if (!probed) {
              unsupported = true;
              landing = page.url();
            } else {
              retries += 1;
            }

            break;
          }

          probed = true;

          var titles = await readTitles();

          if (pageNo === 1) {
            var signature = titles.slice(0, 5).join("|");

            if (signature && signature === lastSignature) {
              suspect = true;
              break;
            }

            if (signature) {
              lastSignature = signature;
            }
          }

          if (titles.length === 0 || titles[0] === previousFirst) {
            ended = true;
            break;
          }

          previousFirst = titles[0];
          listed += titles.length;

          var summary = await processTitles(titles);

          retries += summary.retries;
          archivedInList += summary.archived;

          if (summary.captcha) {
            captcha = true;
            blocked = true;
            break;
          }

          if (summary.budget) {
            budget = true;
            break;
          }

          if (titles.length < 10) {
            ended = true;
            break;
          }

          await pause(3000, 5000);
        }
      } catch (error) {
        if (error.code === "CAPTCHA") {
          captcha = true;
          blocked = true;
          console.log("[wechat] 搜狗列表页触发验证码，本轮停止，已获取的文章保留");
        } else {
          throw error;
        }
      }

      var truncated =
        !ended && !captcha && !budget && !unsupported && !suspect &&
        pageNo > MAX_PAGES_PER_WINDOW;

      var finished =
        !captcha && !budget && !unsupported && !suspect && retries === 0 &&
        (ended || truncated);

      if (unsupported || suspect) {
        unfinished.push(win.key);
        continue;
      }

      if (finished && listed === 0) {
        ws.zeroRuns = (ws.zeroRuns || 0) + 1;
      } else if (listed > 0) {
        ws.zeroRuns = 0;
      }

      var emptyConfirmed = listed > 0 || (ws.zeroRuns || 0) >= 2;

      if (finished && emptyConfirmed && win.et < settleBefore) {
        ws.done = true;
        doneCount += 1;
      }

      ws.listed = listed;
      ws.truncated = truncated;
      ws.checkedAt = new Date().toISOString();
      state.windows[win.key] = ws;
      writeState(state);

      if (!finished) {
        unfinished.push(win.key);
      }

      console.log(
        "[wechat] " + win.key +
          " | 搜狗列出 " + listed + " 条 | 已在归档 " + archivedInList +
          " | 本月新增 " + (added - savedBefore) +
          " | " + (ws.done ? "已完成" : finished && !emptyConfirmed ? "无结果，下一轮再确认一次" : finished ? "本月未满 " + SETTLE_DAYS + " 天，下次继续核对" : "未完成")
      );

      if (!blocked && !budget) {
        await pause(3000, 5000);
      }
    }

    if (suspect) {
      console.log(
        "[wechat] 搜狗的日期筛选似乎没有生效：相邻两个月的第一页结果完全相同。已停止按月处理，没有把任何月份标记为完成"
      );
    }

    if (unsupported) {
      console.log(
        "[wechat] 搜狗没有接受按月筛选，页面落点：" + landing +
          "；改用默认排序，只处理第一页"
      );

      try {
        var defaultOk = await openList(buildListUrl("", "", 1));

        if (!defaultOk) {
          throw new Error("默认搜索页也无法打开，落点：" + page.url());
        }

        var defaultTitles = await readTitles();
        console.log("[wechat] 默认排序返回 " + defaultTitles.length + " 条");

        var fallback = await processTitles(defaultTitles);

        if (fallback.captcha) {
          blocked = true;
        }
      } catch (error) {
        if (error.code === "CAPTCHA") {
          blocked = true;
          console.log("[wechat] 搜狗列表页触发验证码，本轮停止");
        } else {
          throw error;
        }
      }
    }
  } finally {
    await browser.close().catch(function () {});
    clearTimeout(watchdog);
    writeState(state);
  }

  var rejectedCount = Object.keys(state.rejected).length;

  truncatedMonths = Object.keys(state.windows)
    .filter(function (key) {
      return state.windows[key].truncated;
    })
    .sort()
    .reverse();

  console.log(
    "[wechat] 本轮新增 " + added + " 篇；归档累计 " + archive.length + " 篇"
  );

  console.log(
    "[wechat] 按月进度：已完成 " + doneCount + "/" + windows.length +
      " 个月；已记录不再打开 " + rejectedCount + " 篇"
  );

  if (unfinished.length > 0 && !unsupported && !suspect) {
    console.log(
      "[wechat] 尚未完成 " + unfinished.length + " 个月，最近的几个：" +
        unfinished.slice(0, 4).join("、")
    );
  }

  if (truncatedMonths.length > 0) {
    console.log(
      "[wechat] 注意：这些月份翻满 " + MAX_PAGES_PER_WINDOW +
        " 页仍有结果，搜狗不再继续提供，可能有遗漏：" + truncatedMonths.join("、")
    );
  }

  if (blocked) {
    console.log("[wechat] 本轮因验证码提前结束，下一次运行会从未完成的月份继续");
  }
}

main().catch(function (error) {
  console.error("[wechat] 运行失败：" + error.message);
  process.exitCode = 1;
});
