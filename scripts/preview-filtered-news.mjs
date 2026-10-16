
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
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCodePoint(Number(n))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    )
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block, names) {
  for (const name of names) {
    const pattern = new RegExp(
      `<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}\\s*>`,
      "i"
    );
    const match = block.match(pattern);
    if (match) return cleanText(match[1]);
  }
  return "";
}

function extractLink(block) {
  const atomLink = block.match(
    /<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i
  );
  if (atomLink) return atomLink[1].trim();

  return extractTag(block, ["link"]);
}

function parseFeed(xml) {
  const blocks = xml.match(
    /<(?:item|entry)\b[^>]*>[\s\S]*?<\/(?:item|entry)\s*>/gi
  ) || [];

  return blocks.map((block) => {
    const title = extractTag(block, ["title"]);
    const description = extractTag(block, [
      "description",
      "summary",
      "content:encoded",
      "content"
    ]);
    const date = extractTag(block, [
      "pubDate",
      "published",
      "updated",
      "dc:date"
    ]);
    const link = extractLink(block);

    return { title, description, date, link };
  }).filter((item) => item.title && item.link);
}

function classify(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();

  const rules = [
    {
      category: "国际",
      patterns: [
        /war|conflict|military|missile|attack|invasion|ceasefire/,
        /外交|国际|战争|冲突|袭击|军事|停火|制裁|峰会|联合国|北约/
      ]
    },
    {
      category: "政治与政策",
      patterns: [
        /government|election|president|parliament|regulation|legislation/,
        /政府|选举|总统|议会|监管|法规|政策|立法|部长|内阁/
      ]
    },
    {
      category: "能源与气候",
      patterns: [
        /energy|oil price|gas price|electricity|renewable|climate|emissions/,
        /能源|石油|天然气|电力|可再生|气候|碳排放|电网|核电/
      ]
    },
    {
      category: "财经",
      patterns: [
        /stock|shares|market|investor|bond|debt|ipo|interest rate|inflation|fed\b|economy|gdp/,
        /股市|股票|股价|市场|投资者|债券|债务|利率|通胀|美联储|经济|gdp|融资/
      ]
    },
    {
      category: "科技",
      patterns: [
        /\bai\b|artificial intelligence|semiconductor|chip|cybersecurity|software|robot|space|rocket|quantum/,
        /人工智能|大模型|芯片|半导体|网络安全|软件|机器人|航天|火箭|量子|科技/
      ]
    },
    {
      category: "商业",
      patterns: [
        /company|business|corporate|acquisition|merger|revenue|earnings|retail|startup/,
        /企业|公司|商业|收购|并购|营收|业绩|零售|创业公司/
      ]
    },
    {
      category: "科学与社会",
      patterns: [
        /science|research|study|health|hospital|education|environment|disaster/,
        /科学|研究|健康|医院|教育|环境|灾害|事故|学校/
      ]
    }
  ];

  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.category;
    }
  }

  return "其他";
}

function scoreNews(item, category, ageHours) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  let score = 0;
  const reasons = [];

  if (ageHours <= 6) {
    score += 3;
    reasons.push("最近6小时");
  } else if (ageHours <= 12) {
    score += 2;
    reasons.push("最近12小时");
  } else if (ageHours <= 24) {
    score += 1;
    reasons.push("最近24小时");
  }

  const highImpact = [
    /war|conflict|attack|missile|sanction|ceasefire|election/,
    /crisis|emergency|record high|record low|major deal|acquisition/,
    /重大|突破|首次|创纪录|危机|紧急|制裁|停火|并购|收购|获批/
  ];

  if (highImpact.some((pattern) => pattern.test(text))) {
    score += 3;
    reasons.push("可能涉及重大事件");
  }

  const policy = [
    /central bank|interest rate|federal reserve|government policy|regulation/,
    /央行|利率|货币政策|财政政策|监管政策|政府政策/
  ];

  if (policy.some((pattern) => pattern.test(text))) {
    score += 2;
    reasons.push("政策或宏观经济相关");
  }

  if (["国际", "政治与政策", "能源与气候"].includes(category)) {
    score += 2;
    reasons.push("公共事务相关");
  }

  if (["财经", "科技", "商业"].includes(category)) {
    score += 1;
    reasons.push("产业或市场相关");
  }

  const lowPriority = [
    /what to know|explainer|how to|tips for|guide to/,
    /访谈|人物专访|消费指南|使用教程|怎么选|攻略/
  ];

  if (lowPriority.some((pattern) => pattern.test(text))) {
    score -= 2;
    reasons.push("解释性或指南类内容，降低优先级");
  }

  if (category === "其他") {
    score -= 1;
    reasons.push("主题暂未明确识别");
  }

  return { score, reasons };
}

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function titleTokens(title) {
  return new Set(
    normalizeTitle(title)
      .split(/\s+/)
      .filter((word) => word.length > 2)
  );
}

function similarity(a, b) {
  const A = titleTokens(a);
  const B = titleTokens(b);

  if (!A.size || !B.size) return 0;

  let overlap = 0;
  for (const word of A) {
    if (B.has(word)) overlap++;
  }

  return overlap / (A.size + B.size - overlap);
}

async function main() {
  const now = Date.now();
  const cutoff = now - HOURS_BACK * 60 * 60 * 1000;

  const config = JSON.parse(
    await fs.readFile(CONFIG_PATH, "utf8")
  );

  const feeds = (config.feeds || []).filter(
    (feed) => feed.enabled && feed.url
  );

  const allItems = [];
  const feedStats = [];

  console.log("========================================");
  console.log("全球新闻筛选预览（只读模式）");
  console.log(`执行时间：${new Date(now).toISOString()}`);
  console.log(`时间窗口：最近 ${HOURS_BACK} 小时`);
  console.log("不会创建、修改或发布任何文章。");
  console.log("========================================\n");

  for (const feed of feeds) {
    try {
      const response = await fetch(feed.url, {
        headers: {
          "User-Agent": "GlobalViewNewsPreview/1.0",
          "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml"
        },
        signal: AbortSignal.timeout(20000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

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
        const { score, reasons } = scoreNews(
          item,
          category,
          ageHours
        );

        allItems.push({
          ...item,
          source: feed.name || feed.id,
          sourceId: feed.id,
          publishedAt,
          ageHours,
          category,
          score,
          reasons
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

      console.log(
        `[失败] ${feed.name || feed.id}：${error.message}`
      );
    }
  }

  allItems.sort((a, b) => b.score - a.score || b.publishedAt - a.publishedAt);

  const deduplicated = [];

  for (const item of allItems) {
    const duplicate = deduplicated.find(
      (existing) =>
        similarity(existing.title, item.title) >= 0.72
    );

    if (duplicate) {
      duplicate.duplicateSources.push(item.source);
      duplicate.alternativeLinks.push(item.link);
      continue;
    }

    deduplicated.push({
      ...item,
      duplicateSources: [],
      alternativeLinks: []
    });
  }

  const output = deduplicated.slice(0, MAX_OUTPUT);

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

  if (!output.length) {
    console.log("没有找到符合时间窗口的新闻。");
  }

  output.forEach((item, index) => {
    console.log(`\n${index + 1}. [${item.category}] ${item.title}`);
    console.log(`   评分：${item.score}`);
    console.log(`   来源：${item.source}`);
    console.log(`   时间：${new Date(item.publishedAt).toISOString()}`);
    console.log(`   链接：${item.link}`);
    console.log(`   理由：${item.reasons.join("；") || "规则未识别明显特征"}`);

    if (item.duplicateSources.length) {
      console.log(
        `   相似报道来源：${[...new Set(item.duplicateSources)].join("、")}`
      );
    }

    if (item.alternativeLinks.length) {
      console.log(
        `   其他链接：${[...new Set(item.alternativeLinks)].join(" | ")}`
      );
    }
  });

  console.log("\n========================================");
  console.log("预览结束：未写入文件，未创建文章，未发布内容。");
  console.log("注意：评分和去重均为初步规则，不代表事实核查或编辑终审。");
  console.log("========================================");
}

main().catch((error) => {
  console.error("筛选预览失败：", error);
  process.exitCode = 1;
});
