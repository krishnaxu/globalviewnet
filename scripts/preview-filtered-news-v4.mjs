
import fs from "node:fs/promises";

const CONFIG_PATH = "scripts/rss-feeds-global.json";
const HOURS = 24;
const MAX_PER_FEED = 100;
const MAX_OUTPUT = 40;
const USER_AGENT = "GlobalNewsPreview/4.0";

const TOPIC_RULES = [
  {
    category: "国际与地缘政治",
    tags: ["外交", "国际关系", "地缘政治"],
    re: /geopolit|diplomac|sanction|ceasefire|invasion|missile|war\b|conflict|president|election|parliament|白宫|外交|制裁|停火|导弹|战争|冲突|总统|大选|选举|议会|地缘|霍尔木兹|胡塞/
  },
  {
    category: "财经与宏观经济",
    tags: ["宏观经济", "金融市场"],
    re: /\bfederal reserve\b|\bfed\b|interest rate|inflation|central bank|treasury|bond yield|stock market|shares? (?:rise|fall|surge|drop)|currency|exchange rate|economy|gdp\b|就业数据|通胀|利率|美联储|央行|宏观经济|股市|股价|汇率|国债|债券|黄金|人民币|美元|印尼股市/
  },
  {
    category: "科技与人工智能",
    tags: ["人工智能", "数字科技"],
    re: /\bartificial intelligence\b|\bai\b|large language model|semiconductor|chipmaker|robotics?|cybersecurity|data breach|cloud computing|autonomous driving|人工智能|大模型|半导体|芯片|机器人|网络安全|数据泄露|云计算|自动驾驶|脑机接口|无人机/
  },
  {
    category: "能源与气候",
    tags: ["能源", "气候"],
    re: /oil price|crude oil|natural gas|electricity grid|renewable energy|climate change|extreme weather|carbon emission|energy supply|能源|原油|油价|天然气|电网|可再生能源|气候变化|极端天气|碳排放|能源供应|海上运输/
  },
  {
    category: "商业与产业",
    tags: ["企业动态", "产业"],
    re: /acquisition|merger|takeover|ipo\b|bankruptcy|layoffs?|quarterly results|revenue|profit warning|strategic partnership|factory|manufacturing|收购|并购|要约收购|破产|裁员|季度业绩|营收|净利润|战略合作|工厂|制造业|试生产|产业链|融资|上市公司/
  },
  {
    category: "科学与研究",
    tags: ["科学研究", "技术突破"],
    re: /scientists? (?:discover|found|develop)|researchers? (?:discover|find|develop)|peer.reviewed|clinical trial|study finds|research shows|space telescope|quantum|scientific breakthrough|科学家|研究发现|研究显示|临床试验|同行评审|望远镜|量子|科研突破|基础研究/
  },
  {
    category: "社会与公共安全",
    tags: ["公共安全", "社会"],
    re: /shooting|school shooting|earthquake|building collapse|train crash|plane crash|mass casualty|missing children|public health|outbreak|recall notice|枪击|校园枪击|地震|建筑坍塌|列车事故|飞机失事|伤亡|失踪儿童|公共卫生|疫情|召回/
  }
];

const LOW_VALUE_RULES = [
  /grand opening|ribbon.?cutting|anniversary celebration|photo gallery|event highlights/i,
  /活动圆满举行|隆重举行|成功举办|主场活动|启动仪式|开幕式|闭幕式|签约仪式|参观考察/,
  /from scientist to entrepreneur|人物专访|专访|独家访谈|精彩回顾/,
  /daily briefing|morning briefing|财经早餐|市场早报/
];

const CORPORATE_BOILERPLATE =
  /shareholder meeting notice|reply to inquiry letter|response to inquiry|routine announcement|stock exchange inquiry|股东大会通知|问询函回复|提示性公告|例行公告|关于.*的公告/;

const IMPACT_SIGNALS = [
  { points: 2, re: /war\b|invasion|ceasefire|missile attack|killed \d+|major earthquake|emergency|national security|战争|入侵|停火|导弹袭击|死亡|遇难|重大地震|紧急状态|国家安全/i },
  { points: 2, re: /central bank|interest rate|inflation|sanctions|tariff|acquisition|merger|bankruptcy|regulator|approval|利率|通胀|央行|制裁|关税|收购|并购|破产|监管机构|获批|批准/i },
  { points: 1, re: /artificial intelligence|semiconductor|clinical trial|scientific breakthrough|robot|重大突破|人工智能|半导体|临床试验|技术突破|机器人/i }
];

function decodeEntities(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    );
}

function stripHtml(value = "") {
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function tagValue(xml, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}\\s*>`,
    "i"
  );
  return xml.match(re)?.[1]?.trim() ?? "";
}

function parseDate(value) {
  const n = Date.parse(value || "");
  return Number.isFinite(n) ? n : null;
}

function parseFeed(xml, feed) {
  const blocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item\s*>/gi)
    ?? xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry\s*>/gi)
    ?? [];

  return blocks.slice(0, MAX_PER_FEED).map((block) => {
    const title = stripHtml(tagValue(block, "title"));
    const description = stripHtml(
      tagValue(block, "description") ||
      tagValue(block, "summary") ||
      tagValue(block, "content")
    );

    let link = stripHtml(tagValue(block, "link"));
    if (!link) {
      const href = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      link = href?.[1] ?? "";
    }

    const published =
      tagValue(block, "pubDate") ||
      tagValue(block, "published") ||
      tagValue(block, "updated") ||
      tagValue(block, "date");

    const time = parseDate(published);
    if (!title || !link || !time) return null;

    return {
      source: feed.name,
      sourceId: feed.id,
      title,
      description,
      link,
      publishedAt: new Date(time).toISOString(),
      timestamp: time
    };
  }).filter(Boolean);
}

function normalizeText(value = "") {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokenize(value) {
  return new Set(
    normalizeText(value)
      .split(/\s+/)
      .filter((word) => word.length > 1)
  );
}

function similarity(a, b) {
  const aa = tokenize(a);
  const bb = tokenize(b);
  if (!aa.size || !bb.size) return 0;

  let intersection = 0;
  for (const word of aa) if (bb.has(word)) intersection++;

  return intersection / (aa.size + bb.size - intersection);
}

function classify(item) {
  const text = `${item.title} ${item.description}`;
  for (const rule of TOPIC_RULES) {
    if (rule.re.test(text)) {
      return { category: rule.category, tags: rule.tags };
    }
  }

  return { category: "其他 / 待判断", tags: [] };
}

function scoreNews(item, now) {
  const ageHours = Math.max(0, (now - item.timestamp) / 3_600_000);
  const freshness = ageHours <= 3 ? 2 : ageHours <= 12 ? 1 : 0;

  const text = `${item.title} ${item.description}`;
  let impact = 0;
  const reasons = [];

  for (const signal of IMPACT_SIGNALS) {
    if (signal.re.test(text)) {
      impact += signal.points;
      reasons.push("命中重要事件信号");
    }
  }
  impact = Math.min(4, impact);

  const substantiveUpdate =
    /announces|announced|approves|approved|launches|launched|acquires|acquired|cuts rates|raises rates|record high|record low|breakthrough|first time|重大进展|宣布|获批|批准|收购|突破|创纪录|首次|大幅|暴跌|暴涨|遇难|袭击/i.test(text);

  const information = substantiveUpdate ? 2 : 0;

  let penalty = 0;
  if (LOW_VALUE_RULES.some((re) => re.test(item.title))) penalty += 2;
  if (CORPORATE_BOILERPLATE.test(text)) penalty += 2;
  if (/sponsored|advertorial|paid promotion|广告|推广|软文/i.test(text)) penalty += 3;
  if (item.title.length < 20 && item.description.length < 40) penalty += 1;

  const sourceQuality = item.sourceId.startsWith("google-news-") ? 0 : 1;
  const score = Math.max(
    0,
    Math.min(10, impact + information + freshness + sourceQuality - penalty)
  );

  const priority =
    score >= 7 ? "高优先级" :
    score >= 5 ? "值得关注" :
    score >= 3 ? "一般候选" : "低优先级";

  if (penalty) reasons.push(`低价值或模板化内容降权 ${penalty} 分`);
  if (item.sourceId.startsWith("google-news-")) reasons.push("聚合来源，需核对原始媒体");

  return {
    score,
    priority,
    freshness,
    impact,
    information,
    sourceQuality,
    penalty,
    reasons,
    ageHours: Math.round(ageHours * 10) / 10
  };
}

function verificationFlags(item) {
  const flags = [];
  const text = `${item.title} ${item.description}`;

  if (item.link.includes("news.google.com/rss/articles/")) {
    flags.push("Google News 中转链接：需确认原始报道地址");
  }
  if (!item.description || item.description.length < 50) {
    flags.push("摘要不足：需要打开原文核实");
  }
  if (/\bfirst\b|首次|创纪录|record high|record low|首例/i.test(text)) {
    flags.push("含首次或纪录性表述：核实比较范围与数据口径");
  }
  if (/killed|dead|casualties|shooting|missile attack|袭击|死亡|遇难|枪击/i.test(text)) {
    flags.push("涉及伤亡或袭击：核实最新进展及信息来源");
  }
  if (CORPORATE_BOILERPLATE.test(text)) {
    flags.push("疑似例行公告：判断是否具有实质新闻价值");
  }

  return flags;
}

function eventKey(item) {
  const text = normalizeText(`${item.title} ${item.description}`);

  const events = [
    ["hormuz-shipping", /hormuz|strait of hormuz|霍尔木兹/],
    ["fed-policy", /\bfed\b|federal reserve|美联储/],
    ["tuojing-acquisition", /拓荆科技|无锡尚积/],
    ["us-school-shooting", /school shooting|校园枪击/],
    ["indonesia-market", /indonesia.*market|印尼股市|明晟公司/],
    ["houthis-yemen", /houthi|胡塞武装/],
    ["china-canton-fair", /canton fair|广交会/]
  ];

  for (const [key, re] of events) {
    if (re.test(text)) return key;
  }

  return "";
}

function makeGroups(items) {
  const groups = [];

  for (const item of items) {
    let target = null;
    const key = eventKey(item);

    if (key) {
      target = groups.find((group) => group.eventKey === key);
    }

    if (!target) {
      target = groups.find((group) =>
        similarity(group.items[0].title, item.title) >= 0.78
      );
    }

    if (target) {
      target.items.push(item);
      target.bestScore = Math.max(target.bestScore, item.score);
    } else {
      groups.push({
        eventKey: key,
        items: [item],
        bestScore: item.score
      });
    }
  }

  return groups.sort((a, b) =>
    b.bestScore - a.bestScore ||
    b.items[0].timestamp - a.items[0].timestamp
  );
}

async function fetchFeed(feed) {
  try {
    const response = await fetch(feed.url, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(15_000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xml = await response.text();
    const parsed = parseFeed(xml, feed);

    return {
      feed,
      ok: true,
      parsed,
      error: ""
    };
  } catch (error) {
    return {
      feed,
      ok: false,
      parsed: [],
      error: error.message
    };
  }
}

async function main() {
  const config = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8"));
  const feeds = config.feeds.filter((feed) => feed.enabled);
  const now = Date.now();
  const cutoff = now - HOURS * 3_600_000;

  console.log("=".repeat(68));
  console.log("全球新闻筛选 V4（只读预览）");
  console.log(`执行时间：${new Date(now).toISOString()}`);
  console.log(`时间窗口：最近 ${HOURS} 小时`);
  console.log("不写入文件、不创建文章、不发布内容。");
  console.log("规则评分只用于初筛，不代表事实核查。");
  console.log("=".repeat(68));

  const results = await Promise.all(feeds.map(fetchFeed));
  const allRecent = [];

  for (const result of results) {
    const recent = result.parsed.filter(
      (item) => item.timestamp >= cutoff && item.timestamp <= now
    );

    allRecent.push(...recent);

    console.log(
      `[${result.ok ? "成功" : "失败"}] ${result.feed.name}：` +
      `解析 ${result.parsed.length} 条，最近24小时 ${recent.length} 条` +
      (result.error ? `；原因：${result.error}` : "")
    );
  }

  const seenLinks = new Set();
  const unique = allRecent.filter((item) => {
    if (seenLinks.has(item.link)) return false;
    seenLinks.add(item.link);
    return true;
  });

  for (const item of unique) {
    const classification = classify(item);
    const assessment = scoreNews(item, now);

    Object.assign(item, classification, assessment);
    item.verification = verificationFlags(item);
  }

  unique.sort((a, b) =>
    b.score - a.score ||
    b.timestamp - a.timestamp
  );

  const groups = makeGroups(unique);
  const mainGroups = groups.filter((group) => group.bestScore >= 3);
  const lowCount = groups.filter((group) => group.bestScore < 3).length;

  console.log("\n" + "=".repeat(68));
  console.log("筛选统计");
  console.log("=".repeat(68));
  console.log(`最近24小时原始条目：${allRecent.length}`);
  console.log(`按链接去重后：${unique.length}`);
  console.log(`事件/近似报道分组：${groups.length}`);
  console.log(`低优先级分组（低于3分）：${lowCount}`);
  console.log(`进入主列表的新闻组：${mainGroups.length}`);

  console.log("\n" + "=".repeat(68));
  console.log(`V4 新闻预览（最多 ${MAX_OUTPUT} 组）`);
  console.log("=".repeat(68));

  for (const [index, group] of mainGroups.slice(0, MAX_OUTPUT).entries()) {
    const lead = group.items[0];
    const originalTitle = lead.title;

    console.log(`\n${index + 1}. [${lead.category}] ${originalTitle}`);
    console.log(
      `综合分：${lead.score}/10 | 优先级：${lead.priority} | ` +
      `来源：${lead.source} | 时间：${lead.publishedAt}`
    );
    console.log(
      `分项：时效 ${lead.freshness}/2；影响 ${lead.impact}/4；` +
      `信息增量 ${lead.information}/2；来源 ${lead.sourceQuality}/1；` +
      `降权 ${lead.penalty}`
    );
    console.log(`主题标签：${lead.tags.length ? lead.tags.join("、") : "待判断"}`);
    console.log(`中文标题：${/[\u3400-\u9fff]/.test(originalTitle) ? originalTitle : "待翻译（保留英文原题）"}`);
    console.log(`原始标题：${originalTitle}`);
    console.log(`链接：${lead.link}`);

    if (lead.description) {
      console.log(`摘要：${lead.description.slice(0, 260)}`);
    }

    if (lead.verification.length) {
      console.log(`待核实：${lead.verification.join("；")}`);
    }

    if (group.items.length > 1) {
      console.log(`相关报道：${group.items.length - 1} 条`);
      for (const related of group.items.slice(1, 5)) {
        console.log(
          `  - [${related.source}] ${related.title}（${related.score}/10）`
        );
        console.log(`    ${related.link}`);
      }
      if (group.items.length > 5) {
        console.log(`  - 另有 ${group.items.length - 5} 条相关报道`);
      }
      console.log("  提示：归组只表示可能属于同一事件或相似主题，不代表事实完全一致。");
    }
  }

  console.log("\n" + "=".repeat(68));
  console.log("V4 预览结束：未写入文件、未创建文章、未发布内容。");
  console.log("请人工检查新闻重要性、分类、归组和待核实提示。");
  console.log("=".repeat(68));
}

main().catch((error) => {
  console.error("[致命错误]", error.message);
  process.exitCode = 1;
});
