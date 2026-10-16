
import fs from "node:fs";

const CONFIG = "scripts/rss-feeds-global.json";
const HOURS = 24;
const MAX_PER_FEED = 100;
const MAX_OUTPUT = 40;
const TIMEOUT_MS = 15000;

const now = Date.now();
const cutoff = now - HOURS * 60 * 60 * 1000;

const rules = {
  "国际与地缘政治": [
    /\b(war|military|missile|drone attack|airstrike|invasion|ceasefire|troops|territorial waters|nato|ukraine|russia|iran|hormuz|gaza|israel|houthi|diplomacy|summit|g20|sanctions|foreign minister|president meets)\b/i,
    /战争|军事|导弹|无人机袭击|空袭|入侵|停火|军队|领海|北约|乌克兰|俄罗斯|伊朗|霍尔木兹|加沙|以色列|胡塞|外交|峰会|制裁|外长|总统会晤/
  ],
  "财经与宏观经济": [
    /\b(federal reserve|fed\b|interest rate|inflation|gdp|central bank|stock market|shares plunge|market selloff|currency|rupee|yuan|bond yield|recession|unemployment|trade deficit|tariff|msci|oil prices|crude oil|forex|earnings)\b/i,
    /美联储|利率|通胀|国内生产总值|央行|股市|股价|汇率|卢比|人民币|国债收益率|衰退|失业|贸易逆差|关税|明晟|原油|油价|外汇|财报|暴跌|大涨/
  ],
  "科技与人工智能": [
    /\b(artificial intelligence|generative ai|large language model|openai|chatgpt|google ai|ai model|robotics|semiconductor|chipmaking|cybersecurity|spyware|malware|zero.click|zero.day|data breach|ransomware|cloud computing|quantum computing|autonomous vehicle)\b/i,
    /人工智能|生成式AI|大模型|芯片|半导体|机器人|网络安全|间谍软件|恶意软件|零点击|零日漏洞|数据泄露|勒索软件|云计算|量子计算|自动驾驶/
  ],
  "能源与环境": [
    /\b(climate change|global warming|wildfire|earthquake|flood|hurricane|typhoon|air pollution|haze|clean energy|renewable energy|power grid|electricity shortage|carbon emissions|oil exports|energy crisis)\b/i,
    /气候变化|全球变暖|野火|地震|洪水|飓风|台风|空气污染|雾霾|清洁能源|可再生能源|电网|电力短缺|碳排放|石油出口|能源危机/
  ],
  "商业与产业": [
    /\b(acquisition|acquires|merger|takeover|company launches|company announces|quarterly results|revenue growth|layoffs|ipo|factory|manufacturing|supply chain|investment deal|business expansion)\b/i,
    /收购|并购|合并|公司宣布|季度业绩|营收增长|裁员|IPO|工厂|制造业|供应链|投资协议|业务扩张/
  ],
  "科学与研究": [
    /\b(scientists|researchers|clinical trial|study finds|scientific study|peer.reviewed|space telescope|astronomy|genome|discovery|research paper)\b/i,
    /科学家|研究人员|临床试验|研究发现|同行评审|太空望远镜|天文学|基因组|科学发现|研究论文/
  ],
  "社会与公共安全": [
    /\b(shooting|school shooting|mass shooting|killed|missing persons|rescue operation|building collapse|explosion|public health|outbreak|election office|suspicious substance|court ruling|protest|disaster)\b/i,
    /枪击|校园枪击|大规模枪击|遇难|失踪|搜救|建筑坍塌|爆炸|公共卫生|疫情暴发|选举办公室|可疑物质|法院裁决|抗议|灾害/
  ]
};

const majorRules = [
  {
    name: "军事冲突与袭击",
    re: /\b(airstrike|missile attack|drone attack|military strike|invasion|armed conflict|warship attacked|ship attacked|troops killed|ceasefire collapsed)\b|空袭|导弹袭击|无人机袭击|军事打击|武装冲突|军舰遇袭|船只遭袭|停火破裂/i
  },
  {
    name: "重大外交与国际组织",
    re: /\b(nato invoked article 5|g20 leaders|un security council|peace deal signed|ceasefire agreement|summit agreement|diplomatic relations severed)\b|北约启动第五条|G20领导人|联合国安理会|和平协议签署|停火协议|峰会达成协议|断绝外交关系/i
  },
  {
    name: "重大金融市场波动",
    re: /\b(stock market|shares|equities|currency|bond yields|oil prices|crude oil|financial markets)\b.{0,70}\b(plunge|crash|surge|soar|tumble|record high|record low|halted)\b|\b(plunge|crash|surge|soar|tumble)\b.{0,70}\b(stock market|shares|equities|currency|bond yields|oil prices|crude oil|financial markets)\b|股市.{0,30}(暴跌|熔断|大涨|创纪录)|汇率.{0,30}(暴跌|大幅贬值)|油价.{0,30}(暴涨|暴跌)/i
  },
  {
    name: "重大公共安全事件",
    re: /\b(mass shooting|school shooting|building collapse|major explosion|mass casualty|dozens killed|hundreds killed|major earthquake|major wildfire)\b|大规模枪击|校园枪击|建筑坍塌|重大爆炸|群死群伤|数十人遇难|数百人遇难|强震|重大野火/i
  }
];

const lowValue = [
  /\b(early bird|save up to \$|discount code|buy tickets|register now|limited time offer|sponsor(ed)? content|promotional offer|event passes|conference passes|webinar registration)\b/i,
  /早鸟价|优惠码|立省|立即购票|限时优惠|赞助内容|促销活动|报名参会|会议门票/
];

function decode(s = "") {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTag(xml, name) {
  const re = new RegExp(
    `<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}\\s*>`,
    "i"
  );
  return decode(xml.match(re)?.[1] || "");
}

function getLink(xml) {
  const atom = xml.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (atom?.[1]) return decode(atom[1]);

  return getTag(xml, "link") || getTag(xml, "guid");
}

function getDate(xml) {
  const raw =
    getTag(xml, "pubDate") ||
    getTag(xml, "published") ||
    getTag(xml, "updated") ||
    getTag(xml, "dc:date");

  const value = Date.parse(raw);
  return Number.isFinite(value) ? value : null;
}

function stripTracking(raw) {
  try {
    const u = new URL(raw);
    for (const key of [...u.searchParams.keys()]) {
      if (
        /^utm_/i.test(key) ||
        ["fbclid", "gclid", "ocid", "at_medium", "at_campaign"].includes(key)
      ) {
        u.searchParams.delete(key);
      }
    }
    u.hash = "";
    return u.toString();
  } catch {
    return raw;
  }
}

function isGoogleRedirect(link) {
  try {
    return new URL(link).hostname.endsWith("news.google.com");
  } catch {
    return false;
  }
}

function textFor(item) {
  return `${item.title} ${item.description}`;
}

function classify(item) {
  const text = textFor(item);
  const hits = Object.entries(rules)
    .map(([category, patterns]) => ({
      category,
      count: patterns.reduce((sum, re) => sum + (re.test(text) ? 1 : 0), 0)
    }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count);

  if (!hits.length) return "其他 / 待判断";

  // 相同命中数时不随意选择，避免强行误分类。
  if (hits.length > 1 && hits[0].count === hits[1].count) {
    return "其他 / 待判断";
  }

  return hits[0].category;
}

function findMajor(item) {
  const text = textFor(item);
  return majorRules.filter(rule => rule.re.test(text)).map(rule => rule.name);
}

function isLowValue(item) {
  const text = textFor(item);
  return lowValue.some(re => re.test(text));
}

function score(item) {
  const category = item.category;
  const major = item.major.length > 0;
  const low = isLowValue(item);

  let points = 0;
  const ageHours = (now - item.time) / 3600000;

  if (ageHours <= 6) points += 2;
  else if (ageHours <= 12) points += 1;

  if (major) points += 3;

  if ([
    "国际与地缘政治",
    "财经与宏观经济",
    "社会与公共安全",
    "能源与环境"
  ].includes(category)) points += 2;

  if ([
    "科技与人工智能",
    "科学与研究",
    "商业与产业"
  ].includes(category)) points += 1;

  if (item.description.length >= 100) points += 1;

  if (low) points -= 5;
  if (isGoogleRedirect(item.link)) points -= 1;

  return Math.max(0, Math.min(10, points));
}

function eventKey(item) {
  const text = textFor(item).toLowerCase();

  const clusters = [
    ["iran-hormuz", /\b(iran|hormuz|strait of hormuz|iranian)\b|伊朗|霍尔木兹/],
    ["russia-ukraine", /\b(russia|ukraine|russian|ukrainian|starlink)\b|俄罗斯|乌克兰|星链/],
    ["fed-policy", /\b(federal reserve|fed\b|interest rate|warsh|central bank)\b|美联储|利率|沃什|央行/],
    ["indonesia-market", /\b(indonesia|indonesian|msci)\b|印尼|明晟/],
    ["school-shooting", /\b(school shooting|school shooter|elementary school shooting)\b|校园枪击|学校枪击/],
    ["school-collapse-pakistan", /\b(school roof collapse|school roof collapsed|pupils killed.*school)\b|学校屋顶坍塌|校园坍塌/],
    ["houthi-yemen", /\b(houthi|yemeni presidential palace)\b|胡塞|也门总统府/],
    ["singapore-haze", /\b(singapore haze|indonesia haze|severe haze)\b|新加坡雾霾|印尼雾霾/]
  ];

  for (const [key, re] of clusters) {
    if (re.test(text)) return key;
  }

  // 未识别的事件不强行合并，以免误删不同报道。
  return item.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "").slice(0, 90);
}

async function fetchFeed(feed) {
  const url = typeof feed === "string" ? feed : feed.url;
  const name = typeof feed === "string" ? feed : feed.name || feed.label || url;

  if (!url) return { name, items: [], error: "配置中缺少 URL" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "GlobalNewsReadOnlyPreview/1.0",
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml"
      }
    });

    if (!response.ok) {
      return { name, items: [], error: `HTTP ${response.status}` };
    }

    const xml = await response.text();
    const entries = xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)\s*>/gi) || [];

    const items = entries.slice(0, MAX_PER_FEED).map(entry => {
      const title = getTag(entry, "title");
      const description =
        getTag(entry, "description") ||
        getTag(entry, "summary") ||
        getTag(entry, "content:encoded") ||
        getTag(entry, "content");

      const link = getLink(entry);
      const time = getDate(entry);

      return {
        title,
        description,
        link: stripTracking(link),
        time,
        source: name
      };
    }).filter(x => x.title && x.link && x.time && x.time >= cutoff && x.time <= now);

    return {
      name,
      items,
      error: items.length ? null : `未解析到最近 ${HOURS} 小时内的有效条目`
    };
  } catch (error) {
    return {
      name,
      items: [],
      error: error.name === "AbortError" ? "请求超时" : error.message
    };
  } finally {
    clearTimeout(timer);
  }
}

function chooseRepresentative(items) {
  return [...items].sort((a, b) => {
    const aLow = isLowValue(a) ? 1 : 0;
    const bLow = isLowValue(b) ? 1 : 0;

    if (aLow !== bLow) return aLow - bLow;

    const aGoogle = isGoogleRedirect(a.link) ? 1 : 0;
    const bGoogle = isGoogleRedirect(b.link) ? 1 : 0;

    if (aGoogle !== bGoogle) return aGoogle - bGoogle;

    return b.description.length - a.description.length;
  })[0];
}

function displayTime(value) {
  return new Date(value).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

async function main() {
  console.log("=".repeat(76));
  console.log("全球新闻最终验收预览（只读；不写入、不发布）");
  console.log(`执行时间：${new Date(now).toISOString()}`);
  console.log(`时间窗口：最近 ${HOURS} 小时`);
  console.log("说明：规则评分用于初筛，不代表事实核查或自动翻译。");
  console.log("=".repeat(76));

  if (!fs.existsSync(CONFIG)) {
    console.error(`找不到 RSS 配置：${CONFIG}`);
    process.exitCode = 1;
    return;
  }

  const config = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  const feeds = Array.isArray(config) ? config : config.feeds;

  if (!Array.isArray(feeds) || feeds.length === 0) {
    console.error("RSS 配置中没有可用的信息源列表。");
    process.exitCode = 1;
    return;
  }

  const results = await Promise.all(feeds.map(fetchFeed));
  const all = results.flatMap(result => result.items);

  for (const result of results) {
    console.log(
      `${result.items.length ? "[成功]" : "[警告]"} ${result.name}：` +
      `${result.items.length} 条` +
      (result.error ? `；${result.error}` : "")
    );
  }

  const linkMap = new Map();
  for (const item of all) {
    if (!linkMap.has(item.link)) linkMap.set(item.link, item);
  }
  const unique = [...linkMap.values()];

  for (const item of unique) {
    item.category = classify(item);
    item.major = findMajor(item);
    item.score = score(item);
    item.lowValue = isLowValue(item);
    item.group = eventKey(item);
  }

  const grouped = new Map();
  for (const item of unique) {
    if (!grouped.has(item.group)) grouped.set(item.group, []);
    grouped.get(item.group).push(item);
  }

  const representatives = [...grouped.values()].map(items => {
    const item = chooseRepresentative(items);
    return {
      ...item,
      relatedCount: items.length - 1,
      related: items.filter(x => x.link !== item.link)
    };
  });

  representatives.sort((a, b) =>
    b.score - a.score || b.time - a.time
  );

  const lowValueCount = unique.filter(x => x.lowValue).length;
  const unresolvedCount = unique.filter(x => x.category === "其他 / 待判断").length;
  const majorCount = unique.filter(x => x.major.length > 0).length;
  const googleCount = unique.filter(x => isGoogleRedirect(x.link)).length;

  console.log("\n" + "=".repeat(76));
  console.log("最终验收统计");
  console.log("=".repeat(76));
  console.log(`最近24小时原始条目：${all.length}`);
  console.log(`按链接去重后：${unique.length}`);
  console.log(`事件/近似报道分组：${grouped.size}`);
  console.log(`低价值内容识别：${lowValueCount}`);
  console.log(`其他 / 待判断：${unresolvedCount}`);
  console.log(`重大事件规则命中条目：${majorCount}`);
  console.log(`仍为 Google News 中转链接：${googleCount}`);
  console.log(`进入主列表：${Math.min(MAX_OUTPUT, representatives.length)} 组`);

  console.log("\n" + "=".repeat(76));
  console.log("最终新闻预览");
  console.log("=".repeat(76));

  const output = representatives
    .filter(item => !item.lowValue)
    .slice(0, MAX_OUTPUT);

  output.forEach((item, index) => {
    console.log(`\n${index + 1}. [${item.category}] ${item.title}`);
    console.log(`综合分：${item.score}/10 | 来源：${item.source} | 时间：${displayTime(item.time)}`);
    console.log(`重大事件标签：${item.major.length ? item.major.join("、") : "无"}`);
    console.log(`原文链接：${item.link}`);
    console.log(`摘要：${item.description.slice(0, 320) || "暂无摘要"}`);
    if (item.relatedCount > 0) {
      console.log(`同组其他报道：${item.relatedCount} 条`);
      item.related.slice(0, 3).forEach(r => {
        console.log(`  - [${r.source}] ${r.title}`);
        console.log(`    ${r.link}`);
      });
    }
    const flags = [];
    if (isGoogleRedirect(item.link)) flags.push("Google News 中转链接，需核实原文");
    if (item.description.length < 80) flags.push("摘要较短，需打开原文核查");
    if (/\b(first|first-ever|record|record high|record low|unprecedented)\b|首次|首个|创纪录|历史新高|历史新低/i.test(item.title)) {
      flags.push("首次/纪录性表述，需核实比较范围");
    }
    if (/\b(killed|dead|missing|wounded|attack|shooting|explosion|collapse|war|missile)\b|遇难|死亡|失踪|受伤|袭击|枪击|爆炸|坍塌|战争|导弹/i.test(item.title)) {
      flags.push("涉及冲突或伤亡，需核实最新进展");
    }
    if (flags.length) console.log(`待核查：${flags.join("；")}`);
  });

  console.log("\n" + "=".repeat(76));
  console.log("验收提示");
  console.log("=".repeat(76));
  console.log("1. 本脚本只输出到 Actions 日志，不创建或修改任何文件。");
  console.log("2. 规则分类和事件分组是启发式判断，可能漏判或误判。");
  console.log("3. Google News 中转链接不会被伪装成已核实的原始链接。");
  console.log("4. 英文标题保持原文，不会假装已经翻译。");
  console.log("5. 重大事件、伤亡、市场波动和首次/纪录性说法均需核查原文。");
}

main().catch(error => {
  console.error("最终验收脚本运行失败：", error);
  process.exitCode = 1;
});
