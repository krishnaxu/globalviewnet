
import fs from "node:fs";

const CONFIG_PATH = "scripts/rss-feeds-global.json";
const HOURS = 24;
const MAX_PER_FEED = 100;
const MAX_OUTPUT = 40;
const TIMEOUT_MS = 15000;

const RULES = [
  {
    topic: "国际与地缘政治",
    patterns: [
      /\biran\b|\biranian\b|\bwar\b|\bmissile\b|\bnuclear weapon/i,
      /\bmilitary\b|\bairstrike\b|\bdrone attack\b|\barmed conflict\b/i,
      /\bhormuz\b|\bred sea\b|\bsouth china sea\b|\bblack sea\b/i,
      /\btrump\b|\brubio\b|\bputin\b|\bxi jinping\b|\bnetanyahu\b/i,
      /\bdiplomacy\b|\bsanctions\b|\bceasefire\b|\bhostilities\b/i,
      /\bnato\b|\bg20\b|\bun security council\b|\bforeign minister\b/i,
      /伊朗|战争|导弹|核武器|军事冲突|空袭|无人机袭击|霍尔木兹|红海|黑海|北约|制裁|停火|外交|峰会|G20|特朗普|普京|卢比奥/
    ]
  },
  {
    topic: "财经与宏观经济",
    patterns: [
      /\bfederal reserve\b|\bfed\b|\binterest rate\b|\brate cut\b|\brate hike\b/i,
      /\binflation\b|\bgdp\b|\bunemployment\b|\bcentral bank\b|\bmonetary policy\b/i,
      /\bstock market\b|\bshares plunge\b|\bmarket selloff\b|\bbond yields\b/i,
      /\bmsci\b|\bcurrency\b|\bsovereign debt\b|\brecession\b/i,
      /美联储|利率|降息|加息|通胀|GDP|央行|货币政策|股市|暴跌|债券收益率|明晟|MSCI|汇率|经济衰退/
    ]
  },
  {
    topic: "科技与人工智能",
    patterns: [
      /\bartificial intelligence\b|\bAI model\b|\bopen.weight\b|\bmachine learning\b/i,
      /\bsemiconductor\b|\bchipmaker\b|\bGPU\b|\bdata center\b|\bcybersecurity\b/i,
      /\brobotics?\b|\bautonomous vehicle\b|\bspaceX\b|\bsatellite\b/i,
      /人工智能|大模型|开源模型|芯片|半导体|数据中心|网络安全|机器人|自动驾驶|卫星|航天/
    ]
  },
  {
    topic: "能源与气候",
    patterns: [
      /\boil prices?\b|\bnatural gas\b|\brefinery\b|\belectricity prices?\b/i,
      /\bclimate change\b|\bcarbon emissions\b|\brenewable energy\b|\bpower grid\b/i,
      /油价|天然气|炼油厂|电价|气候变化|碳排放|可再生能源|电网/
    ]
  },
  {
    topic: "商业与产业",
    patterns: [
      /\bacquisition\b|\bmerger\b|\bbankruptcy\b|\brestructuring\b/i,
      /\bquarterly earnings\b|\brevenue\b|\bprofit warning\b|\bmajor investment\b/i,
      /\bCEO\b|\bcompany launches\b|\bstrategic partnership\b/i,
      /收购|并购|破产重整|季度业绩|营收|利润|重大投资|战略合作|控股股东/
    ]
  },
  {
    topic: "科学与研究",
    patterns: [
      /\bclinical trial\b|\bscientists discover\b|\bpeer.reviewed\b/i,
      /\bspace telescope\b|\bgenome\b|\bquantum computing\b|\bresearchers found\b/i,
      /临床试验|科学家发现|同行评审|太空望远镜|基因组|量子计算|研究发现/
    ]
  },
  {
    topic: "社会与公共安全",
    patterns: [
      /\bshooting\b|\bmass casualty\b|\bplane crash\b|\btrain derailment\b/i,
      /\bearthquake\b|\bflooding\b|\bwildfire\b|\bschool collapse\b/i,
      /枪击|伤亡|坠机|列车脱轨|地震|洪水|山火|学校坍塌|公共安全/
    ]
  }
];

const MAJOR_EVENT_RULES = [
  { name: "伊朗与中东局势", pattern: /iran|iranian|hormuz|伊朗|霍尔木兹|中东战争/i, bonus: 3 },
  { name: "军事冲突与袭击", pattern: /war|airstrike|missile|drone attack|military strike|袭击|空袭|导弹|军事冲突/i, bonus: 3 },
  { name: "重大外交与国际组织", pattern: /nato|g20|summit|foreign minister|sanctions|联合国|北约|G20|峰会|制裁|外长/i, bonus: 2 },
  { name: "央行与宏观政策", pattern: /federal reserve|fed chair|interest rate|central bank|美联储|央行|利率决议|货币政策/i, bonus: 2 },
  { name: "重大金融市场波动", pattern: /market plunge|stocks plunge|market crash|selloff|暴跌|股灾|熔断/i, bonus: 2 },
  { name: "重大安全事故", pattern: /mass shooting|mass casualty|major earthquake|plane crash|重大枪击|重大伤亡|强震|重大事故/i, bonus: 2 }
];

const LOW_VALUE_RULES = [
  /签约仪式|启动仪式|开工仪式|战略合作|携手打造|亮相.*活动|精彩回顾/,
  /机器人舞台剧|戏剧节|展会现场|活动圆满举行|成功举办/,
  /ceremony|event recap|highlights from|joins forces to create|strategic partnership/i,
  /ordinary product launch|daily briefing|weekend reading/i
];

const ROUTINE_WORDS =
  /签约|合作|开工|揭牌|启动仪式|活动|亮相|战略合作|ceremony|partnership|event recap/i;

function cleanText(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      try { return String.fromCodePoint(Number(n)); } catch { return ""; }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ""; }
    })
    .replace(/\s+/g, " ")
    .trim();
}

function tagValue(block, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(
    new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}\\s*>`, "i")
  );
  return match ? cleanText(match[1]) : "";
}

function linkValue(block) {
  const atomLink = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (atomLink) return cleanText(atomLink[1]);
  return tagValue(block, "link");
}

function parseFeed(xml) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi)
    ?? xml.match(/<entry\b[\s\S]*?<\/entry>/gi)
    ?? [];

  return blocks.map((block) => ({
    title: tagValue(block, "title"),
    link: linkValue(block),
    description: tagValue(block, "description") || tagValue(block, "summary") || tagValue(block, "content"),
    date: tagValue(block, "pubDate") || tagValue(block, "published") || tagValue(block, "updated")
  })).filter((item) => item.title && item.link);
}

function stripTracking(url) {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|oc$|ved$|usg$|hl$|gl$|ceid$)/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function isGoogleRedirect(url) {
  return /(^|\.)news\.google\.com$/i.test(new URL(url).hostname);
}

function tokenize(text) {
  return new Set(
    cleanText(text).toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length > 1)
  );
}

function similarity(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  if (!A.size || !B.size) return 0;
  let intersection = 0;
  for (const token of A) if (B.has(token)) intersection++;
  return intersection / (A.size + B.size - intersection);
}

function classify(title, description) {
  const text = `${title} ${description}`;
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) return rule.topic;
  }
  return "其他 / 待判断";
}

function matchingMajorEvent(text) {
  return MAJOR_EVENT_RULES.find((rule) => rule.pattern.test(text)) ?? null;
}

function scoreNews(item, now) {
  const text = `${item.title} ${item.description}`;
  const topic = classify(item.title, item.description);
  const ageHours = Math.max(0, (now - item.timestamp) / 3600000);

  const freshness = ageHours <= 6 ? 2 : ageHours <= 18 ? 1 : 0;

  let impact = 0;
  const majorEvent = matchingMajorEvent(text);

  if (majorEvent) impact += majorEvent.bonus;
  if (/record high|first time|historic|unprecedented|暴跌|首次|创纪录|历史性|重大/i.test(text)) impact += 1;
  if (/death|killed|casualties|emergency|crisis|危机|死亡|伤亡|紧急状态/i.test(text)) impact += 1;
  if (/billion|trillion|25亿元|百亿美元|万亿美元/i.test(text)) impact += 1;
  impact = Math.min(4, impact);

  let information = 1;
  if (/\d/.test(text)) information++;
  if (/announced|approved|ruled|ordered|resigned|elected|launched|acquisition|宣布|批准|裁定|下令|辞职|当选|发布|收购/i.test(text)) information++;
  information = Math.min(2, information);

  const sourceQuality = item.sourceId.startsWith("google-news-") ? 0 : 1;
  let penalty = 0;

  if (LOW_VALUE_RULES.some((pattern) => pattern.test(text))) penalty += 2;
  else if (ROUTINE_WORDS.test(text) && !majorEvent) penalty += 1;

  if (item.title.length < 24 && item.description.length < 60) penalty += 1;

  const score = Math.max(0, Math.min(10, freshness + impact + information + sourceQuality - penalty));
  const priority = score >= 7 ? "优先核查" : score >= 5 ? "值得关注" : score >= 3 ? "一般候选" : "低优先级";

  const checks = [];
  if (isGoogleRedirect(item.link)) checks.push("Google News 中转链接：需确认原始报道地址");
  if (item.description.length < 100) checks.push("摘要不足：需要打开原文核实");
  if (/first time|record high|unprecedented|首次|创纪录|历史性/i.test(text)) checks.push("含首次或纪录性表述：核实比较范围与数据口径");
  if (/killed|casualties|attack|strike|死亡|伤亡|袭击|空袭/i.test(text)) checks.push("涉及冲突或伤亡：核实最新进展");
  if (majorEvent) checks.push(`重大事件规则命中：${majorEvent.name}`);

  return {
    ...item,
    topic,
    score,
    priority,
    freshness,
    impact,
    information,
    sourceQuality,
    penalty,
    checks
  };
}

function eventKey(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  const patterns = [
    [/iran|hormuz|伊朗|霍尔木兹/, "iran-hormuz"],
    [/federal reserve|fed chair|warsh|美联储|沃什/, "fed-policy"],
    [/tuojing|拓荆科技|无锡尚积/, "tuojing-acquisition"],
    [/school shooting|school shooter|校园枪击|学校枪击/, "school-shooting"],
    [/indonesia.*market|indonesian stocks|印尼股市|明晟.*分类/, "indonesia-market"],
    [/houthi|houthis|胡塞/, "houthi-attacks"],
    [/canton fair|广交会/, "canton-fair"],
    [/russia.*g20|g20.*russia|俄罗斯.*G20|G20.*俄罗斯/, "russia-g20"]
  ];
  return patterns.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

function makeGroups(items) {
  const groups = [];

  for (const item of items) {
    const key = eventKey(item);
    let target = null;

    if (key) target = groups.find((group) => group.eventKey === key);

    if (!target) {
      target = groups.find((group) =>
        !key &&
        !group.eventKey &&
        similarity(group.primary.title, item.title) >= 0.48
      );
    }

    if (target) {
      target.items.push(item);
      if (item.score > target.primary.score) target.primary = item;
      target.score = Math.max(...target.items.map((entry) => entry.score));
    } else {
      groups.push({
        eventKey: key,
        primary: item,
        items: [item],
        score: item.score
      });
    }
  }

  return groups.sort((a, b) => b.score - a.score);
}

async function fetchFeed(feed) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: { "user-agent": "GlobalNewsReadOnlyPreview/5.0" }
    });

    const body = await response.text();

    if (!response.ok) {
      return { feed, ok: false, status: response.status, error: `HTTP ${response.status}`, items: [], bodyStart: body.slice(0, 180) };
    }

    const items = parseFeed(body).slice(0, MAX_PER_FEED);
    if (items.length === 0) {
      return {
        feed, ok: false, status: response.status,
        error: "HTTP 请求成功，但未解析到 RSS/Atom 条目",
        items: [],
        bodyStart: body.slice(0, 240).replace(/\s+/g, " ")
      };
    }

    return { feed, ok: true, status: response.status, items };
  } catch (error) {
    return {
      feed, ok: false, error: error.name === "AbortError" ? "请求超时" : error.message,
      items: []
    };
  } finally {
    clearTimeout(timeout);
  }
}

function printGroup(group, index) {
  const item = group.primary;
  console.log(`\n${index + 1}. [${item.topic}] ${item.title}`);
  console.log(`综合分：${item.score}/10 | 优先级：${item.priority} | 来源：${item.sourceName} | 时间：${new Date(item.timestamp).toISOString()}`);
  console.log(`分项：时效 ${item.freshness}/2；影响 ${item.impact}/4；信息增量 ${item.information}/2；来源 ${item.sourceQuality}/1；降权 ${item.penalty}`);
  if (group.eventKey) console.log(`事件组：${group.eventKey}`);
  console.log(`原始标题：${item.title}`);
  console.log(`链接：${item.link}`);
  if (item.description) console.log(`摘要：${item.description.slice(0, 260)}`);
  if (item.checks.length) console.log(`待核查：${item.checks.join("；")}`);
  console.log(`相关报道：${group.items.length} 条`);
  for (const related of group.items.filter((entry) => entry !== item).slice(0, 3)) {
    console.log(`  - [${related.sourceName}] ${related.title}`);
    console.log(`    ${related.link}`);
  }
}

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const feeds = config.feeds.filter((feed) => feed.enabled);
  const now = Date.now();
  const cutoff = now - HOURS * 3600000;

  console.log("=".repeat(76));
  console.log("全球新闻筛选 V5（最后一轮规则优化，只读预览）");
  console.log(`执行时间：${new Date(now).toISOString()}`);
  console.log(`时间窗口：最近 ${HOURS} 小时`);
  console.log("不写入文件、不创建文章、不发布内容。");
  console.log("规则评分只用于初筛，不代表事实核查。");
  console.log("=".repeat(76));

  const results = await Promise.all(feeds.map(fetchFeed));
  const allItems = [];

  for (const result of results) {
    if (!result.ok) {
      console.log(`[异常] ${result.feed.name}：${result.error}`);
      if (result.status) console.log(`  HTTP 状态：${result.status}`);
      if (result.bodyStart) console.log(`  返回内容开头：${result.bodyStart}`);
      continue;
    }

    const parsed = result.items.map((raw) => {
      const timestamp = Date.parse(raw.date);
      return {
        ...raw,
        title: cleanText(raw.title),
        description: cleanText(raw.description),
        link: stripTracking(raw.link),
        timestamp: Number.isFinite(timestamp) ? timestamp : now,
        sourceId: result.feed.id,
        sourceName: result.feed.name
      };
    });

    const recent = parsed.filter((item) => item.timestamp >= cutoff && item.timestamp <= now + 3600000);
    allItems.push(...recent);
    console.log(`[成功] ${result.feed.name}：解析 ${parsed.length} 条，最近24小时 ${recent.length} 条`);
  }

  const seen = new Set();
  const unique = allItems.filter((item) => {
    const key = item.link;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const scored = unique.map((item) => scoreNews(item, now));
  const groups = makeGroups(scored);
  const lowPriority = groups.filter((group) => group.score < 3);
  const mainList = groups.filter((group) => group.score >= 3).slice(0, MAX_OUTPUT);

  console.log("\n" + "=".repeat(76));
  console.log("V5 筛选统计");
  console.log("=".repeat(76));
  console.log(`最近24小时原始条目：${allItems.length}`);
  console.log(`按链接去重后：${unique.length}`);
  console.log(`事件/近似报道分组：${groups.length}`);
  console.log(`低优先级分组（低于3分）：${lowPriority.length}`);
  console.log(`进入主列表的新闻组：${mainList.length}`);
  console.log(`重大事件规则命中条目：${scored.filter((item) => matchingMajorEvent(`${item.title} ${item.description}`)).length}`);
  console.log(`分类为“其他 / 待判断”：${scored.filter((item) => item.topic === "其他 / 待判断").length}`);

  console.log("\n" + "=".repeat(76));
  console.log("V5 新闻预览");
  console.log("=".repeat(76));

  mainList.forEach(printGroup);

  console.log("\n" + "=".repeat(76));
  console.log("V5 预览结束：请人工检查排序、分类、事件合并和原文链接。");
  console.log("=".repeat(76));
}

main().catch((error) => {
  console.error("[致命错误]", error);
  process.exitCode = 1;
});
