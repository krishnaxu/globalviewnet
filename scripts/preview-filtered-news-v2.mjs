
import fs from "node:fs/promises";

const CONFIG_PATH = "scripts/rss-feeds-global.json";
const HOURS_BACK = 24;
const MAX_PER_SOURCE = 100;
const MAX_OUTPUT = 40;

function cleanText(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block, names) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}\\s*>`,
      "i"
    );
    const match = block.match(pattern);
    if (match) return cleanText(match[1]);
  }
  return "";
}

function extractLink(block) {
  const atomLinks = [...block.matchAll(
    /<link\b([^>]*)\/?>/gi
  )];

  for (const match of atomLinks) {
    const attrs = match[1] || "";
    const href = attrs.match(/\bhref=["']([^"']+)["']/i);
    const rel = attrs.match(/\brel=["']([^"']+)["']/i);

    if (href && (!rel || rel[1] === "alternate")) {
      return href[1].trim();
    }
  }

  return extractTag(block, ["link"]);
}

function parseFeed(xml) {
  const blocks = xml.match(
    /<(?:item|entry)\b[^>]*>[\s\S]*?<\/(?:item|entry)\s*>/gi
  ) || [];

  return blocks.map((block) => ({
    title: extractTag(block, ["title"]),
    description: extractTag(block, [
      "description",
      "summary",
      "content:encoded",
      "content"
    ]),
    date: extractTag(block, [
      "pubDate",
      "published",
      "updated",
      "dc:date"
    ]),
    link: extractLink(block)
  })).filter((item) => item.title && item.link);
}

function classify(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();

  // Specific subjects are checked before broad international terms.
  const rules = [
    {
      category: "财经",
      patterns: [
        /\bfed\b|federal reserve|central bank|interest rate|inflation|gdp|bond yield|currency|exchange rate|forex|stock market|shares|investor|treasury|monetary policy|oil price|gold price|debt market|ipo/,
        /美联储|央行|利率|通胀|汇率|外汇|股市|股票|股价|债券|国债|货币政策|财政政策|黄金|油价|原油|市值|回购|融资|营收|财报|经济增长|国内生产总值/
      ]
    },
    {
      category: "科技与网络安全",
      patterns: [
        /cybersecurity|cyber attack|malware|ransomware|zero.click|zero.day|semiconductor|chipmaker|artificial intelligence|\bai\b|robotics|quantum computing|spacecraft|rocket launch|software vulnerability/,
        /网络安全|恶意软件|勒索软件|零点击|零日漏洞|半导体|芯片|人工智能|大模型|机器人|量子计算|航天|火箭|软件漏洞|科技成果转化/
      ]
    },
    {
      category: "能源与气候",
      patterns: [
        /oil exports|natural gas|electricity grid|renewable energy|climate change|carbon emissions|power plant|nuclear reactor|air pollution|haze/,
        /石油出口|天然气|电网|可再生能源|气候变化|碳排放|发电厂|核电|空气污染|烟霾|能源供应/
      ]
    },
    {
      category: "商业与产业",
      patterns: [
        /acquisition|acquires|merger|takeover|buyback|share repurchase|company earnings|revenue growth|startup funding|private equity|retail sales/,
        /收购|并购|要约收购|股份回购|企业业绩|营收增长|创业融资|私募股权|零售销售|产业链|供应链/
      ]
    },
    {
      category: "政治与法律",
      patterns: [
        /election|presidential race|parliament|legislation|lawsuit|sues |court ruling|voting law|citizenship check|government policy|minister resigns|president signs/,
        /选举|总统大选|议会|立法|起诉|法院裁决|投票法|公民身份核查|政府政策|部长辞职|签署法案|监管新规/
      ]
    },
    {
      category: "国际与冲突",
      patterns: [
        /war|military|missile|airstrike|invasion|ceasefire|hostage|armed group|diplomatic row|sanctions|strait of hormuz|attack on|attacked|conflict/,
        /战争|军事|导弹|空袭|入侵|停火|人质|武装组织|外交争端|制裁|霍尔木兹|袭击|冲突|地缘政治/
      ]
    },
    {
      category: "社会与公共安全",
      patterns: [
        /school shooting|school collapse|bus crash|train crash|mass casualty|missing children|public health|hospital|education|suspicious substances|temple plot/,
        /校园枪击|学校倒塌|交通事故|列车事故|重大伤亡|失踪儿童|公共卫生|医院|教育|可疑物质|公共安全|空气质量/
      ]
    },
    {
      category: "科学与研究",
      patterns: [
        /\bscientific study\b|\bresearchers\b|\bscientists\b|peer.reviewed|new species|archaeology|space telescope/,
        /科学研究|研究人员|科学家|同行评审|新物种|考古|太空望远镜|基础研究/
      ]
    }
  ];

  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.category;
    }
  }

  return "其他 / 待判断";
}

function scoreNews(item, category, ageHours) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  let impact = 0;
  let freshness = 0;
  let signal = 0;
  const reasons = [];

  if (ageHours <= 3) freshness = 3;
  else if (ageHours <= 6) freshness = 2;
  else if (ageHours <= 12) freshness = 1;
  else freshness = 0;

  const majorEvent = [
    /killed|dead|fatal|mass shooting|missile attack|airstrike|ceasefire|invasion|emergency|crisis|record high|record low/,
    /死亡|遇难|枪击|导弹袭击|空袭|停火|入侵|紧急状态|危机|创纪录|重大事故/
  ];

  const policyOrMarket = [
    /central bank|interest rate|federal reserve|election|lawsuit|sanction|acquisition|merger|regulation|currency crisis/,
    /央行|利率|美联储|选举|诉讼|制裁|收购|并购|监管|汇率危机/
  ];

  const broadImpact = [
    /global|nationwide|international|cross.border|supply chain|oil exports|presidential|national security/,
    /全球|全国|国际|跨境|供应链|石油出口|总统|国家安全/
  ];

  if (majorEvent.some((p) => p.test(text))) {
    impact += 3;
    reasons.push("重大事件关键词");
  }

  if (policyOrMarket.some((p) => p.test(text))) {
    impact += 2;
    reasons.push("政策、市场或企业重大事项");
  }

  if (broadImpact.some((p) => p.test(text))) {
    impact += 1;
    reasons.push("可能具有较广影响");
  }

  if (["国际与冲突", "政治与法律", "能源与气候"].includes(category)) {
    signal += 2;
  } else if (["财经", "科技与网络安全", "商业与产业"].includes(category)) {
    signal += 2;
  } else if (category === "社会与公共安全") {
    signal += 2;
  } else if (category === "其他 / 待判断") {
    signal -= 1;
    reasons.push("主题未明确识别");
  }

  const lowPriority = [
    /what to know|explainer|how to|tips for|guide to|opinion|commentary/,
    /消费指南|使用教程|怎么选|攻略|观点评论|深度解读/
  ];

  if (lowPriority.some((p) => p.test(text))) {
    signal -= 2;
    reasons.push("指南、解释或评论类内容，降低优先级");
  }

  const score = Math.max(0, Math.min(10, freshness + impact + signal));

  return {
    score,
    freshness,
    impact,
    signal,
    reasons: [
      `时效 ${freshness}/3`,
      `影响 ${impact}/6`,
      `编辑信号 ${signal}`,
      ...reasons
    ]
  };
}

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokens(title) {
  return new Set(
    normalizeTitle(title)
      .split(/\s+/)
      .filter((word) => word.length > 2)
  );
}

function similarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);

  if (!A.size || !B.size) return 0;

  let overlap = 0;
  for (const word of A) {
    if (B.has(word)) overlap++;
  }

  return overlap / (A.size + B.size - overlap);
}

function eventHints(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();

  const groups = [
    {
      id: "hormuz-shipping",
      patterns: [/hormuz|霍尔木兹/]
    },
    {
      id: "tuojing-acquisition",
      patterns: [/拓荆科技|无锡尚积|tuojing/]
    },
    {
      id: "us-school-shooting",
      patterns: [/school shooting|校园枪击/]
    },
    {
      id: "fed-policy",
      patterns: [/federal reserve|\bfed\b|美联储/]
    },
    {
      id: "india-rupee",
      patterns: [/indian rupee|rupee.*dollar|印度卢比/]
    },
    {
      id: "us-election-voting",
      patterns: [/mail voters|voting law|election office|选举办公室|邮寄投票/]
    }
  ];

  const matched = groups.find((group) =>
    group.patterns.some((pattern) => pattern.test(text))
  );

  return matched ? matched.id : "";
}

function isGoogleNewsLink(url) {
  return /^https?:\/\/news\.google\.com\//i.test(url);
}

async function main() {
  const now = Date.now();
  const cutoff = now - HOURS_BACK * 3600000;

  const config = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8"));
  const feeds = (config.feeds || []).filter((feed) => feed.enabled && feed.url);

  const allItems = [];
  const feedStats = [];

  console.log("========================================");
  console.log("全球新闻筛选 V2（只读预览）");
  console.log(`执行时间：${new Date(now).toISOString()}`);
  console.log(`时间窗口：最近 ${HOURS_BACK} 小时`);
  console.log("不会写入文章、修改网站或发布内容。");
  console.log("分类、评分与事件识别均为规则初筛，不等于事实核查。");
  console.log("========================================\n");

  for (const feed of feeds) {
    try {
      const response = await fetch(feed.url, {
        headers: {
          "User-Agent": "GlobalViewNewsPreview/2.0",
          "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml"
        },
        signal: AbortSignal.timeout(20000)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const xml = await response.text();
      const parsed = parseFeed(xml).slice(0, MAX_PER_SOURCE);
      let freshCount = 0;

      for (const item of parsed) {
        const publishedAt = Date.parse(item.date);
        if (!Number.isFinite(publishedAt)) continue;

        const ageHours = (now - publishedAt) / 3600000;
        if (ageHours < 0 || publishedAt < cutoff) continue;

        freshCount++;

        const category = classify(item);
        const scoring = scoreNews(item, category, ageHours);

        allItems.push({
          ...item,
          source: feed.name || feed.id,
          sourceId: feed.id,
          publishedAt,
          ageHours,
          category,
          ...scoring,
          eventHint: eventHints(item),
          googleNewsRedirect: isGoogleNewsLink(item.link)
        });
      }

      feedStats.push({
        name: feed.name || feed.id,
        fetched: parsed.length,
        fresh: freshCount,
        status: "成功"
      });

      console.log(
        `[成功] ${feed.name || feed.id}：解析 ${parsed.length} 条，最近24小时 ${freshCount} 条`
      );
    } catch (error) {
      feedStats.push({
        name: feed.name || feed.id,
        fetched: 0,
        fresh: 0,
        status: `失败：${error.message}`
      });

      console.log(`[失败] ${feed.name || feed.id}：${error.message}`);
    }
  }

  allItems.sort((a, b) => b.score - a.score || b.publishedAt - a.publishedAt);

  const output = [];
  const eventGroups = new Map();

  for (const item of allItems) {
    const eventKey = item.eventHint;

    if (eventKey && eventGroups.has(eventKey)) {
      const group = eventGroups.get(eventKey);
      group.relatedReports.push({
        title: item.title,
        source: item.source,
        link: item.link,
        category: item.category
      });
      continue;
    }

    const nearDuplicate = output.find((existing) =>
      similarity(existing.title, item.title) >= 0.72
    );

    if (nearDuplicate) {
      nearDuplicate.relatedReports.push({
        title: item.title,
        source: item.source,
        link: item.link,
        category: item.category
      });
      continue;
    }

    const record = {
      ...item,
      relatedReports: []
    };

    output.push(record);

    if (eventKey) {
      eventGroups.set(eventKey, record);
    }
  }

  const selected = output.slice(0, MAX_OUTPUT);

  console.log("\n========================================");
  console.log("来源统计");
  console.log("========================================");

  for (const stat of feedStats) {
    console.log(
      `${stat.name} | ${stat.status} | 原始候选 ${stat.fetched} | 24小时内 ${stat.fresh}`
    );
  }

  console.log("\n========================================");
  console.log(`筛选候选（最多 ${MAX_OUTPUT} 条）`);
  console.log("========================================");

  if (!selected.length) console.log("没有找到符合时间窗口的新闻。");

  selected.forEach((item, index) => {
    console.log(`\n${index + 1}. [${item.category}] ${item.title}`);
    console.log(`   综合分：${item.score}/10`);
    console.log(`   分项：时效 ${item.freshness}/3；影响 ${item.impact}/6；编辑信号 ${item.signal}`);
    console.log(`   来源：${item.source}`);
    console.log(`   时间：${new Date(item.publishedAt).toISOString()}`);
    console.log(`   链接：${item.link}`);

    if (item.googleNewsRedirect) {
      console.log("   链接提示：这是 Google News 中转链接，发布前需尽量确认原始媒体链接。");
    }

    console.log(`   评分说明：${item.reasons.join("；")}`);

    if (item.relatedReports.length) {
      console.log(`   相关报道：${item.relatedReports.length} 条`);
      for (const related of item.relatedReports) {
        console.log(`      - [${related.source}] ${related.title}`);
        console.log(`        ${related.link}`);
      }
      console.log("   注意：相关报道仅归组展示，仍需人工判断是否属于同一事件。");
    }
  });

  console.log("\n========================================");
  console.log("V2 预览结束：没有写入文件，没有创建文章，没有发布内容。");
  console.log("请人工检查分类、评分、事件归组和链接，再决定是否继续优化。");
  console.log("========================================");
}

main().catch((error) => {
  console.error("V2 筛选预览失败：", error);
  process.exitCode = 1;
});
