"use strict";

/* =========================================================
   Global View / 观澜泗渡
   Homepage V2
   File: /home-v2.js

   本文件仅供 index-v2.html 使用。
   不修改现有 index.html。
   ========================================================= */


/* =========================================================
   1. CMS loading state
   ========================================================= */

document.documentElement.classList.add("cms-loading");


/* =========================================================
   2. DOM helpers
   ========================================================= */

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));


/* =========================================================
   3. Shared article store
   ========================================================= */

/*
 * 保留 articles 这个变量名。
 * cms-integration.js 可以继续向该数组写入 CMS 内容。
 */
const articles = [];


/* =========================================================
   4. UI translations
   ========================================================= */

const translations = {
  zh: {
    brandCn: "观澜泗渡",

    navHome: "首页",
    navHomeEn: "Home",

    navAbout: "关于",
    navAboutEn: "About",

    catTech: "科技",
    catTechEn: "Tech",

    catBusiness: "商业",
    catBusinessEn: "Business",

    catCulture: "文化",
    catCultureEn: "Culture",

    catLife: "生活",
    catLifeEn: "Life",

    latestArticles: "最新资讯",

    prPortfolio: "PR作品",
    prFilterAll: "全部",
    prFilterCompany: "公司新闻",
    prFilterIndustry: "行业新闻",

    latestNews: "最新动态",

    searchPlaceholder: "搜索感兴趣的内容...",

    eyebrow: "全球视野 · 双语阅读",

    homeTitle: "连接世界，发现更多可能",

    homeSubtitle:
      "从科技创新到文化生活，读懂正在发生的变化。",

    filterAll: "全部",

    trendingTitle: "我的专栏",

    viewMoreArticles: "查看更多文章 →",

    worksTitle: "我的作品",

    worksEmpty: "暂无作品",

    newsletterIntro:
      "订阅观澜泗渡，获取双语资讯与编辑精选。",

    emailPlaceholder: "请输入您的邮箱地址",

    subscribe: "订阅",

    promoTitle:
      "观澜泗渡<br>以双语视角探索科技、商业与文化的交汇。",

    promoText: "",

    learnMore: "了解我们",

    noResults:
      "没有找到匹配的文章，试试其他关键词。",

    categoryEyebrow: "主题探索",

    aboutEyebrow: "关于我们",

    aboutTitle:
      "让信息跨越语言，让观点连接世界",

    aboutIntro:
      "观澜泗渡是一个聚焦科技、商业、文化与生活的双语资讯与观点分享平台。",

    aboutMissionTitle: "我们的定位",

    aboutMission:
      "我们希望通过清晰的内容结构，帮助读者发现值得关注的趋势、行业变化与文化故事。",

    aboutContentTitle: "内容与来源",

    aboutContent:
      "平台内容包括编辑整理、观点分享及依法获得授权或符合适用规则的转载内容。转载内容应在发布时标注原始来源、作者及原文链接（如适用）。文章所列来源名称仅作为示例，不代表相关机构已发布或认可本文。",

    aboutStandardsTitle: "编辑原则",

    aboutStandard1:
      "明确区分事实信息、分析观点与示例内容。",

    aboutStandard2:
      "对转载内容标注来源，尽可能保留原文语境与出处。",

    aboutStandard3:
      "发现错误时及时核查、更新或更正。",

    aboutStandard4:
      "尊重知识产权、隐私权与相关法律法规。",

    aboutContactTitle: "联系我们",

    contactText:
      "内容合作、版权及反馈：",

    disclaimerTitle: "免责声明",

    disclaimer:
      "本站是一个提供信息聚合、双语阅读与观点分享的平台，非新闻采编机构。本站内容来源于公开信息、第三方资料及编辑整理，仅供信息参考与交流，不代表任何机构或个人的正式立场。本站内容不构成投资、医疗、法律或其他专业建议，亦不应作为作出相关决策的唯一依据。用户应独立判断，必要时咨询具备相应资质的专业人士。本站致力于确保内容的准确性与时效性，但不保证所有信息始终完整、准确、及时或适用于特定情形。本站可能包含第三方网站链接，相关网站的内容、服务及隐私政策由其运营方负责。如您认为本站内容存在事实错误或侵犯合法权益，请通过本站公布的联系方式与我们联系。",

    footerDescription:
      "以双语视角连接全球资讯，让值得关注的想法跨越边界。",

    footerExplore: "探索内容",

    footerConnect: "关于与联系",

    footerContact: "联系我们",

    footerDisclaimer: "免责声明",

    rights: "保留所有权利。",

    footerDisclaimerShort:
      "本站为信息聚合与观点分享平台，非新闻采编机构。",

    sourceLabel: "来源",

    sourceNote: "来源说明",

    author: "作者",

    editorialTeam: "观澜泗渡编辑部",

    shareArticle: "分享文章链接",

    closeArticle: "关闭",

    shareCopied: "文章链接已复制。",

    shareFailed:
      "无法自动复制，请手动复制浏览器地址。",

    newsletterSuccess:
      "订阅页面已打开，请按照页面提示完成订阅。",

    newsletterError:
      "请输入有效的邮箱地址。",

    readTime: "分钟阅读",

    articlesCount: "篇文章",

    categoryDescriptions: {
      tech:
        "关注人工智能、数字技术、科学研究与创新如何改变工作、产业和日常生活。",

      business:
        "探索全球商业趋势、企业战略、市场变化与可持续增长。",

      culture:
        "发现艺术、设计、博物馆、创意产业与跨文化交流的新故事。",

      life:
        "从健康饮食到城市出行，关注日常生活中的选择与新趋势。"
    }
  },


  en: {
    brandCn: "观澜泗渡",

    navHome: "Home",
    navHomeEn: "首页",

    navAbout: "About",
    navAboutEn: "关于",

    catTech: "Technology",
    catTechEn: "科技",

    catBusiness: "Business",
    catBusinessEn: "商业",

    catCulture: "Culture",
    catCultureEn: "文化",

    catLife: "Life",
    catLifeEn: "生活",

    latestArticles: "Latest Articles",

    prPortfolio: "PR Portfolio",

    prFilterAll: "All",

    prFilterCompany: "Company News",

    prFilterIndustry: "Industry News",

    latestNews: "Latest",

    searchPlaceholder: "Search articles...",

    eyebrow:
      "Global perspectives · Bilingual reading",

    homeTitle:
      "Connect the world. Discover more.",

    homeSubtitle:
      "From technological innovation to culture and everyday life, explore the changes shaping our world.",

    filterAll: "All",

    trendingTitle: "My Column",

    viewMoreArticles:
      "View More Articles →",

    worksTitle: "My Works",

    worksEmpty:
      "No works available yet",

    newsletterIntro:
      "Get bilingual insights and editorial picks from Global View.",

    emailPlaceholder:
      "Enter your email address",

    subscribe: "Subscribe",

    promoTitle:
      "Global View<br>Explore the intersection of technology, business and culture through a bilingual lens.",

    promoText: "",

    learnMore: "About us",

    noResults:
      "No matching articles. Try another keyword.",

    categoryEyebrow:
      "Topic Explorer",

    aboutEyebrow: "About Us",

    aboutTitle:
      "Ideas across languages. Perspectives across borders.",

    aboutIntro:
      "Global View is a bilingual information and perspectives platform focused on technology, business, culture and life.",

    aboutMissionTitle:
      "Our Mission",

    aboutMission:
      "Through clear content organization and bilingual presentation, we aim to help readers discover noteworthy trends, industry developments, and cultural stories.",

    aboutContentTitle:
      "Content & Sources",

    aboutContent:
      "Content may include editorial summaries, commentary and reproduced material published with appropriate authorization or in accordance with applicable rules. Reproduced content should identify its original source, author and original link where applicable.",

    aboutStandardsTitle:
      "Editorial Principles",

    aboutStandard1:
      "Distinguish factual information, analysis and illustrative content.",

    aboutStandard2:
      "Attribute reproduced material and preserve context and provenance where possible.",

    aboutStandard3:
      "Review, update or correct errors when identified.",

    aboutStandard4:
      "Respect intellectual property, privacy and applicable laws.",

    aboutContactTitle:
      "Contact Us",

    contactText:
      "Editorial partnerships, copyright and feedback:",

    disclaimerTitle:
      "Disclaimer",

    disclaimer:
      "This website is a platform for information aggregation, bilingual reading, and opinion sharing rather than a news-gathering organization. Its content is provided for informational and discussion purposes only and does not constitute investment, medical, legal, or other professional advice.",

    footerDescription:
      "Connecting global news through a bilingual perspective, bringing ideas worth noticing across borders.",

    footerExplore: "Explore",

    footerConnect:
      "About & Contact",

    footerContact: "Contact Us",

    footerDisclaimer:
      "Disclaimer",

    rights:
      "All rights reserved.",

    footerDisclaimerShort:
      "This website is a platform for information aggregation and opinion sharing, not a news-gathering organization.",

    sourceLabel: "Source",

    sourceNote:
      "Source information",

    author: "Author",

    editorialTeam:
      "Global View Editorial Team",

    shareArticle:
      "Share article link",

    closeArticle: "Close",

    shareCopied:
      "Article link copied.",

    shareFailed:
      "Could not copy automatically. Copy the browser address manually.",

    newsletterSuccess:
      "The subscription page has opened. Follow the page instructions to complete your subscription.",

    newsletterError:
      "Please enter a valid email address.",

    readTime: "min read",

    articlesCount: "articles",

    categoryDescriptions: {
      tech:
        "Explore how AI, digital technologies, scientific research and innovation are changing work, industries and everyday life.",

      business:
        "Explore global business trends, corporate strategy, market shifts and sustainable growth.",

      culture:
        "Discover stories in art, design, museums, creative industries and cross-cultural exchange.",

      life:
        "From healthy food to urban mobility, explore choices and trends shaping everyday life."
    }
  }
};


/* =========================================================
   5. Core state
   ========================================================= */

let currentLang = "zh";

let activeFilter = "all";

let currentPage = "home";

let currentArticleId = null;

let previousFocus = null;

let currentSlide = 0;

let carouselTimer = null;

let searchScrollTimer = null;


/*
 * CMS 或 RSS 数据加载完成后，
 * featuredIds / tickerIds 会被重新生成。
 */
const featuredIds = [];

const tickerIds = [];


/* =========================================================
   6. Translation helpers
   ========================================================= */

function t(key) {
  return (
    translations[currentLang]?.[key] ??
    translations.zh?.[key] ??
    key
  );
}

function categoryName(category) {
  const map = {
    tech: "catTech",
    business: "catBusiness",
    culture: "catCulture",
    life: "catLife"
  };

  return t(map[category] || "catTech");
}


/* =========================================================
   7. Article helpers
   ========================================================= */

function articleById(id) {
  return articles.find(
    article => article.id === id
  );
}

function getArticleText(value) {
  if (
    value &&
    typeof value === "object"
  ) {
    return (
      value[currentLang] ??
      value.zh ??
      value.en ??
      ""
    );
  }

  return String(value ?? "");
}

function getArticleTitle(article) {
  return getArticleText(
    article?.title
  );
}

function getArticleExcerpt(article) {
  const result =
    getArticleText(article?.excerpt);

  return result || getArticleTitle(article);
}

function getArticleSubtitle(article) {
  const result =
    getArticleText(article?.subtitle);

  return result || getArticleExcerpt(article);
}

function getArticleAlt(article) {
  const result =
    getArticleText(article?.alt);

  return result || getArticleTitle(article);
}


/* =========================================================
   8. Date helpers
   ========================================================= */

function formatDate(date) {
  if (!date) return "";

  const value =
    new Date(`${date}T12:00:00`);

  if (
    Number.isNaN(value.getTime())
  ) {
    return date;
  }

  return new Intl.DateTimeFormat(
    currentLang === "zh"
      ? "zh-CN"
      : "en-US",
    {
      year: "numeric",
      month:
        currentLang === "zh"
          ? "long"
          : "short",
      day: "numeric"
    }
  ).format(value);
}

function readTimeText(minutes) {
  const value =
    Number(minutes) || 1;

  return currentLang === "zh"
    ? `${value} 分钟阅读`
    : `${value} min read`;
}

function updateDateLabel() {
  const now = new Date();

  const dateLabel =
    $("#todayDate");

  if (dateLabel) {
    dateLabel.textContent =
      new Intl.DateTimeFormat(
        currentLang === "zh"
          ? "zh-CN"
          : "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "short"
        }
      ).format(now);
  }

  const year =
    $("#copyrightYear");

  if (year) {
    year.textContent =
      String(now.getFullYear());
  }
}


/* =========================================================
   9. Theme
   ========================================================= */

function applyTheme(theme) {
  document.documentElement.dataset.theme =
    theme;

  const toggle =
    $("#themeToggle");

  if (!toggle) return;

  const dark =
    theme === "dark";

  toggle.innerHTML =
    `<svg width="17" height="17" aria-hidden="true">
      <use href="${
        dark
          ? "#i-sun"
          : "#i-moon"
      }"></use>
    </svg>`;

  toggle.setAttribute(
    "aria-label",
    dark
      ? "Switch to light mode"
      : "Switch to dark mode"
  );

  toggle.title =
    dark
      ? "Light mode"
      : "Dark mode";
}

function initTheme() {
  let saved = null;

  try {
    saved =
      localStorage.getItem(
        "gp-theme"
      );
  } catch (_) {}

  const systemDark =
    window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

  applyTheme(
    saved ||
      (
        systemDark
          ? "dark"
          : "light"
      )
  );
}


/* =========================================================
   10. Language
   ========================================================= */

function setLanguage(lang) {
  if (!translations[lang]) {
    return;
  }

  currentLang = lang;

  document.documentElement.lang =
    lang === "zh"
      ? "zh-CN"
      : "en";

  document.title =
    lang === "zh"
      ? "Global View | 观澜泗渡"
      : "Global View | Bilingual Global Insights";


  $$("[data-i18n]").forEach(
    element => {
      const key =
        element.dataset.i18n;

      if (
        translations[lang][key] ===
        undefined
      ) {
        return;
      }

      if (key === "promoTitle") {
        element.innerHTML = t(key);
      } else {
        element.textContent = t(key);
      }
    }
  );


  $$(
    "[data-i18n-placeholder]"
  ).forEach(element => {
    element.placeholder =
      t(
        element.dataset
          .i18nPlaceholder
      );
  });


  $$("[data-lang]").forEach(
    button => {
      const selected =
        button.dataset.lang ===
        lang;

      button.classList.toggle(
        "active",
        selected
      );

      button.setAttribute(
        "aria-pressed",
        String(selected)
      );
    }
  );


  /*
   * 不重新请求任何数据。
   * 这里只重绘需要随语言变化的界面。
   */
  refreshAutoNewsIds();

  renderTicker();
  renderFeatured();
  renderArticles();
  updateCategoryPage();
  updateDateLabel();

  try {
    localStorage.setItem(
      "gp-lang",
      currentLang
    );
  } catch (_) {}
}


/* =========================================================
   11. Fallback image settings
   ========================================================= */

window.globalViewFallbackImages = {
  tech: "",
  business: "",
  culture: "",
  life: ""
};

async function loadGlobalViewFallbackImages() {
  try {
    const response =
      await fetch(
        "/content/site-settings.json",
        {
          cache: "force-cache"
        }
      );

    if (!response.ok) {
      return;
    }

    const settings =
      await response.json();

    window.globalViewFallbackImages = {
      tech:
        settings.tech || "",

      business:
        settings.business || "",

      culture:
        settings.culture || "",

      life:
        settings.life || ""
    };
  } catch (error) {
    console.warn(
      "通用图片设置读取失败：",
      error
    );
  }
}


/* =========================================================
   12. Image list cache
   ========================================================= */

/*
 * V1 的主要性能瓶颈之一：
 *
 * 每渲染一张新闻图片都会重新请求
 * /sources.json?t=Date.now()
 *
 * V2 改为：
 *
 * 同一个分类第一次请求后缓存 Promise，
 * 后续所有图片直接复用。
 */

const globalViewImageListCache =
  new Map();

async function getGlobalViewImageList(
  category
) {
  if (
    globalViewImageListCache.has(
      category
    )
  ) {
    return globalViewImageListCache.get(
      category
    );
  }


  const folder =
    `/public/images/library/${category}`;


  const request =
    fetch(
      `${folder}/sources.json`,
      {
        cache: "force-cache"
      }
    )
      .then(response => {
        if (!response.ok) {
          throw new Error(
            `图片列表读取失败：HTTP ${response.status}`
          );
        }

        return response.json();
      })
      .then(records => {
        if (!Array.isArray(records)) {
          return [];
        }

        return records.filter(
          item =>
            item &&
            item.filename
        );
      })
      .catch(error => {
        /*
         * 请求失败时移除缓存，
         * 后续仍可重新尝试。
         */
        globalViewImageListCache.delete(
          category
        );

        throw error;
      });


  globalViewImageListCache.set(
    category,
    request
  );


  return request;
}


/* =========================================================
   13. Stable image selection
   ========================================================= */

/*
 * V1 使用 Math.random()。
 * 每次重新渲染语言、搜索或列表时图片都会改变。
 *
 * V2 根据 article.id 稳定选择图片。
 */

function getStableImageIndex(
  article,
  length
) {
  if (!length) return 0;


  const value =
    String(
      article?.id ||
      article?.title?.zh ||
      article?.title?.en ||
      article?.source ||
      ""
    );


  let hash = 0;


  for (
    let i = 0;
    i < value.length;
    i += 1
  ) {
    hash =
      (
        (hash << 5) -
        hash +
        value.charCodeAt(i)
      ) | 0;
  }


  return (
    Math.abs(hash) %
    length
  );
}


/* =========================================================
   14. Central image loader
   ========================================================= */

window.globalViewSetArticleImage =
  async function (
    img,
    article,
    options = {}
  ) {
    if (!img || !article) {
      return;
    }


    const category =
      [
        "tech",
        "business",
        "culture",
        "life"
      ].includes(
        article.category
      )
        ? article.category
        : "tech";


    /*
     * 第一张轮播图属于 LCP 候选。
     * 只有第一张使用 eager + high。
     */
    const priority =
      options.priority === true;


    img.decoding = "async";

    img.loading =
      priority
        ? "eager"
        : "lazy";


    try {
      img.fetchPriority =
        priority
          ? "high"
          : "low";
    } catch (_) {}


    img.style.visibility =
      "visible";


    /*
     * CMS 原图优先。
     */
    if (
      article.origin === "cms" &&
      article.image
    ) {
      img.onerror = null;

      img.src =
        article.image;

      return;
    }


    /*
     * 如果文章本身明确要求保留图片，
     * 同样允许直接使用。
     */
    if (
      options.useArticleImage === true &&
      article.image
    ) {
      img.onerror = null;

      img.src =
        article.image;

      return;
    }


    const folder =
      `/public/images/library/${category}`;


    try {
      const available =
        await getGlobalViewImageList(
          category
        );


      if (!available.length) {
        throw new Error(
          "本地图片列表为空"
        );
      }


      const index =
        getStableImageIndex(
          article,
          available.length
        );


      const item =
        available[index];


      img.onerror = () => {
        const fallback =
          window
            .globalViewFallbackImages?.[
              category
            ] ||
          article.fallbackImage ||
          article.image ||
          "";


        if (fallback) {
          img.onerror = null;

          img.src = fallback;
        } else {
          img.style.visibility =
            "hidden";
        }
      };


      img.src =
        `${folder}/${encodeURIComponent(
          item.filename
        )}`;
    } catch (error) {
      console.warn(
        "本地分类图片加载失败：",
        category,
        error
      );


      const fallback =
        window
          .globalViewFallbackImages?.[
            category
          ] ||
        article.fallbackImage ||
        article.image ||
        "";


      if (fallback) {
        img.onerror = null;

        img.src = fallback;
      } else {
        img.removeAttribute(
          "src"
        );

        img.style.visibility =
          "hidden";
      }
    }
  };


/* =========================================================
   15. Automatic-news language
   ========================================================= */

function getAutoArticleLanguage(
  article
) {
  if (
    !String(
      article?.id || ""
    ).startsWith("auto-")
  ) {
    return null;
  }


  const value =
    String(
      article.language ||
      article.lang ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    value === "zh" ||
    value.startsWith("zh-") ||
    value === "chinese"
  ) {
    return "zh";
  }


  if (
    value === "en" ||
    value.startsWith("en-") ||
    value === "english"
  ) {
    return "en";
  }


  const title =
    String(
      article.title?.zh ||
      article.title?.en ||
      ""
    );


  return /[\u3400-\u9fff]/.test(
    title
  )
    ? "zh"
    : "en";
}


/* =========================================================
   16. Refresh featured / ticker IDs
   ========================================================= */

function refreshAutoNewsIds() {
  const autoNews =
    articles
      .filter(
        article =>
          getAutoArticleLanguage(
            article
          ) === currentLang
      )
      .sort(
        (a, b) =>
          new Date(b.date) -
          new Date(a.date)
      );


  const featured = [];

  const preferredCategories = [
    "tech",
    "business",
    "culture",
    "life"
  ];


  preferredCategories.forEach(
    category => {
      const article =
        autoNews.find(
          item =>
            item.category ===
            category
        );


      if (article) {
        featured.push(
          article.id
        );
      }
    }
  );


  /*
   * 分类不足时使用其他自动新闻补足。
   */
  autoNews.forEach(article => {
    if (
      featured.length < 4 &&
      !featured.includes(
        article.id
      )
    ) {
      featured.push(
        article.id
      );
    }
  });


  /*
   * 如果 CMS 已经加载，
   * 可用 CMS 内容补足轮播。
   */
  articles
    .filter(
      article =>
        article.cms === true ||
        article.origin === "cms"
    )
    .forEach(article => {
      if (
        featured.length < 4 &&
        !featured.includes(
          article.id
        )
      ) {
        featured.push(
          article.id
        );
      }
    });


  featuredIds.splice(
    0,
    featuredIds.length,
    ...featured.slice(0, 4)
  );


  const ticker =
    autoNews
      .slice(0, 5)
      .map(
        article =>
          article.id
      );


  articles
    .filter(
      article =>
        article.cms === true ||
        article.origin === "cms"
    )
    .forEach(article => {
      if (
        ticker.length < 5 &&
        !ticker.includes(
          article.id
        )
      ) {
        ticker.push(
          article.id
        );
      }
    });


  tickerIds.splice(
    0,
    tickerIds.length,
    ...ticker.slice(0, 5)
  );


  currentSlide = 0;
}


/* =========================================================
   17. Featured carousel rendering
   ========================================================= */

function renderFeatured() {
  const track =
    $("#featuredTrack");

  const dotsContainer =
    $("#carouselDots");


  if (
    !track ||
    !dotsContainer
  ) {
    return;
  }


  track.replaceChildren();

  dotsContainer.replaceChildren();


  const availableIds =
    featuredIds.filter(
      id =>
        Boolean(
          articleById(id)
        )
    );


  availableIds.forEach(
    (id, index) => {
      const article =
        articleById(id);


      if (!article) {
        return;
      }


      const slide =
        document.createElement(
          "article"
        );


      slide.className =
        "featured-slide";

      slide.tabIndex = 0;

      slide.setAttribute(
        "role",
        "button"
      );

      slide.setAttribute(
        "aria-label",
        getArticleTitle(article)
      );


      slide.addEventListener(
        "click",
        () =>
          openArticle(id)
      );


      slide.addEventListener(
        "keydown",
        event => {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();

            openArticle(id);
          }
        }
      );


      const img =
        document.createElement(
          "img"
        );


      img.className =
        "featured-image";


      img.alt =
        getArticleAlt(article);


      /*
       * 性能关键点：
       * 只有真实显示的第一张轮播图属于高优先级。
       */
      window
        .globalViewSetArticleImage(
          img,
          article,
          {
            priority:
              index === 0
          }
        );


      const content =
        document.createElement(
          "div"
        );


      content.className =
        "featured-content";


      const categoryTag =
        document.createElement(
          "span"
        );


      categoryTag.className =
        "category-tag";


      categoryTag.textContent =
        categoryName(
          article.category
        );


      const title =
        document.createElement(
          "h2"
        );


      title.textContent =
        getArticleTitle(
          article
        );


      const excerpt =
        document.createElement(
          "p"
        );


      excerpt.textContent =
        getArticleExcerpt(
          article
        );


      const meta =
        document.createElement(
          "div"
        );


      meta.className =
        "featured-meta";


      const date =
        document.createElement(
          "span"
        );


      date.textContent =
        formatDate(
          article.date
        );


      const separatorOne =
        document.createElement(
          "span"
        );


      separatorOne.className =
        "dot";

      separatorOne.textContent =
        "|";


      const read =
        document.createElement(
          "span"
        );


      read.textContent =
        readTimeText(
          article.read
        );


      const separatorTwo =
        document.createElement(
          "span"
        );


      separatorTwo.className =
        "dot";

      separatorTwo.textContent =
        "|";


      const source =
        document.createElement(
          "span"
        );


      source.textContent =
        `${t("sourceLabel")}: ${
          article.source || ""
        }`;


      meta.append(
        date,
        separatorOne,
        read,
        separatorTwo,
        source
      );


      content.append(
        categoryTag,
        title,
        excerpt,
        meta
      );


      slide.append(
        img,
        content
      );


      track.appendChild(
        slide
      );


      const dot =
        document.createElement(
          "button"
        );


      dot.type = "button";


      dot.className =
        "carousel-dot" +
        (
          index === 0
            ? " active"
            : ""
        );


      dot.setAttribute(
        "aria-label",
        `Go to slide ${
          index + 1
        }`
      );


      dot.addEventListener(
        "click",
        event => {
          event.stopPropagation();

          goToSlide(index);
        }
      );


      dotsContainer.appendChild(
        dot
      );
    }
  );


  if (
    availableIds.length === 0
  ) {
    stopCarousel();

    track.style.transform =
      "translateX(0)";

    return;
  }


  updateCarouselPosition();

  startCarousel();
}


/* =========================================================
   18. Carousel movement
   ========================================================= */

function getSlideCount() {
  const track =
    $("#featuredTrack");

  return track
    ? track.querySelectorAll(
        ".featured-slide"
      ).length
    : 0;
}

function updateCarouselPosition() {
  const track =
    $("#featuredTrack");


  if (!track) return;


  const slideCount =
    getSlideCount();


  if (!slideCount) {
    currentSlide = 0;

    track.style.transform =
      "translateX(0)";

    return;
  }


  currentSlide =
    Math.max(
      0,
      Math.min(
        currentSlide,
        slideCount - 1
      )
    );


  track.style.transform =
    `translateX(-${
      currentSlide * 100
    }%)`;


  $$(".carousel-dot").forEach(
    (dot, index) => {
      dot.classList.toggle(
        "active",
        index === currentSlide
      );
    }
  );
}

function goToSlide(index) {
  const slideCount =
    getSlideCount();


  if (!slideCount) {
    return;
  }


  currentSlide =
    (
      (
        index %
        slideCount
      ) +
      slideCount
    ) %
    slideCount;


  updateCarouselPosition();

  startCarousel();
}

function nextSlide() {
  const slideCount =
    getSlideCount();


  if (!slideCount) {
    return;
  }


  currentSlide =
    (
      currentSlide + 1
    ) %
    slideCount;


  updateCarouselPosition();
}

function startCarousel() {
  stopCarousel();


  if (
    getSlideCount() <= 1
  ) {
    return;
  }


  carouselTimer =
    window.setInterval(
      nextSlide,
      6000
    );
}

function stopCarousel() {
  if (
    carouselTimer !== null
  ) {
    window.clearInterval(
      carouselTimer
    );

    carouselTimer = null;
  }
}


/* =========================================================
   19. Search highlighting
   ========================================================= */

function setSearchHighlight(
  element,
  text
) {
  if (!element) return;


  const input =
    $("#searchInput");


  const query =
    input
      ? input.value
          .trim()
      : "";


  element.replaceChildren();


  const content =
    String(text || "");


  if (!query) {
    element.textContent =
      content;

    return;
  }


  const lowerContent =
    content.toLocaleLowerCase();


  const lowerQuery =
    query.toLocaleLowerCase();


  let start = 0;

  let index;


  while (
    (
      index =
        lowerContent.indexOf(
          lowerQuery,
          start
        )
    ) !== -1
  ) {
    element.appendChild(
      document.createTextNode(
        content.slice(
          start,
          index
        )
      )
    );


    const mark =
      document.createElement(
        "mark"
      );


    mark.textContent =
      content.slice(
        index,
        index + query.length
      );


    element.appendChild(
      mark
    );


    start =
      index +
      query.length;
  }


  element.appendChild(
    document.createTextNode(
      content.slice(start)
    )
  );
}


/* =========================================================
   20. Article cards
   ========================================================= */

function createArticleCard(article) {
  const card =
    document.createElement(
      "article"
    );


  card.className =
    "article-card";


  card.tabIndex = 0;


  card.setAttribute(
    "role",
    "button"
  );


  card.setAttribute(
    "aria-label",
    getArticleTitle(article)
  );


  card.addEventListener(
    "click",
    () =>
      openArticle(
        article.id
      )
  );


  card.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();

        openArticle(
          article.id
        );
      }
    }
  );


  const imageWrap =
    document.createElement(
      "div"
    );


  imageWrap.className =
    "card-image-wrap";


  const image =
    document.createElement(
      "img"
    );


  image.className =
    "card-image";


  image.alt =
    getArticleAlt(
      article
    );


  /*
   * 普通资讯全部低优先级懒加载。
   */
  window
    .globalViewSetArticleImage(
      image,
      article,
      {
        priority: false
      }
    );


  imageWrap.appendChild(
    image
  );


  const body =
    document.createElement(
      "div"
    );


  body.className =
    "card-body";


  const category =
    document.createElement(
      "span"
    );


  category.className =
    "category-tag";


  category.textContent =
    categoryName(
      article.category
    );


  const title =
    document.createElement(
      "h3"
    );


  title.className =
    "card-title serif";


  setSearchHighlight(
    title,
    getArticleTitle(article)
  );


  const excerpt =
    document.createElement(
      "p"
    );


  excerpt.className =
    "card-excerpt";


  setSearchHighlight(
    excerpt,
    getArticleExcerpt(article)
  );


  const meta =
    document.createElement(
      "div"
    );


  meta.className =
    "card-meta";


  const source =
    document.createElement(
      "span"
    );


  source.textContent =
    `${t("sourceLabel")}: ${
      article.source || ""
    }`;


  const read =
    document.createElement(
      "span"
    );


  read.textContent =
    readTimeText(
      article.read
    );


  meta.append(
    source,
    read
  );


  body.append(
    category,
    title,
    excerpt,
    meta
  );


  card.append(
    imageWrap,
    body
  );


  return card;
}


/* =========================================================
   21. Filtering
   ========================================================= */

function getFilteredArticles() {
  const input =
    $("#searchInput");


  const query =
    input
      ? input.value
          .trim()
          .toLocaleLowerCase()
      : "";


  let results =
    articles.filter(
      article => {
        /*
         * 首页普通资讯区域：
         * CMS 内容默认由专栏等模块呈现。
         * 搜索时仍允许搜索到 CMS 内容。
         */
        if (
          article.cms === true &&
          !query
        ) {
          return false;
        }


        const articleLanguage =
          getAutoArticleLanguage(
            article
          );


        if (
          articleLanguage &&
          articleLanguage !==
            currentLang
        ) {
          return false;
        }


        const categoryMatch =
          activeFilter === "all" ||
          article.category ===
            activeFilter;


        const haystack =
          [
            getArticleText(
              article.title
            ),

            getArticleText(
              article.excerpt
            ),

            article.title?.zh,
            article.title?.en,
            article.excerpt?.zh,
            article.excerpt?.en,

            (
              article.tags ||
              []
            ).join(" ")
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase();


        return (
          categoryMatch &&
          (
            !query ||
            haystack.includes(
              query
            )
          )
        );
      }
    );


  /*
   * 搜索时 CMS 优先。
   */
  if (query) {
    results.sort(
      (a, b) => {
        if (
          a.cms === true &&
          b.cms !== true
        ) {
          return -1;
        }


        if (
          a.cms !== true &&
          b.cms === true
        ) {
          return 1;
        }


        return (
          new Date(b.date) -
          new Date(a.date)
        );
      }
    );
  } else {
    results.sort(
      (a, b) =>
        new Date(b.date) -
        new Date(a.date)
    );
  }


  /*
   * 首页默认状态：
   * 科技 / 商业 / 文化 / 生活各显示一篇最新文章。
   */
  if (
    currentPage === "home" &&
    activeFilter === "all" &&
    !query
  ) {
    const seen =
      new Set();


    const limited = [];


    results.forEach(article => {
      if (
        seen.has(
          article.category
        )
      ) {
        return;
      }


      seen.add(
        article.category
      );


      limited.push(
        article
      );
    });


    return limited;
  }


  return results;
}


/* =========================================================
   22. Grid rendering
   ========================================================= */

function renderGrid(
  target,
  emptyTarget,
  list
) {
  if (!target) {
    return;
  }


  target.replaceChildren();


  list.forEach(
    article => {
      target.appendChild(
        createArticleCard(
          article
        )
      );
    }
  );


  if (emptyTarget) {
    emptyTarget.classList.toggle(
      "hidden",
      list.length !== 0
    );
  }
}

function renderArticles() {
  const filtered =
    getFilteredArticles();


  renderGrid(
    $("#articleGrid"),
    $("#emptyState"),
    filtered
  );


  const count =
    $("#articleCount");


  if (count) {
    count.textContent =
      `${filtered.length} ${
        t("articlesCount")
      }`;
  }


  if (
    [
      "tech",
      "business",
      "culture",
      "life"
    ].includes(currentPage)
  ) {
    renderCategoryGrid();
  }
}

function renderCategoryGrid() {
  const filtered =
    getFilteredArticles();


  renderGrid(
    $("#categoryArticleGrid"),
    $("#categoryEmptyState"),
    filtered
  );
}


/* =========================================================
   23. Filters
   ========================================================= */

function setFilter(filter) {
  activeFilter =
    filter;


  $$(".filter-btn").forEach(
    button => {
      const active =
        button.dataset.filter ===
        filter;


      button.classList.toggle(
        "active",
        active
      );


      button.setAttribute(
        "aria-pressed",
        String(active)
      );
    }
  );


  renderArticles();
}


/* =========================================================
   24. Ticker
   ========================================================= */

function renderTicker() {
  const content =
    $("#tickerContent");


  if (!content) return;


  content.replaceChildren();


  const entries =
    tickerIds
      .map(
        id =>
          articleById(id)
      )
      .filter(Boolean);


  if (!entries.length) {
    return;
  }


  /*
   * ticker 重复一次内容，
   * 用于形成连续滚动。
   */
  [
    ...entries,
    ...entries
  ].forEach(
    (article, index) => {
      const item =
        document.createElement(
          "button"
        );


      item.type = "button";


      item.className =
        "ticker-item";


      item.textContent =
        getArticleTitle(
          article
        );


      item.addEventListener(
        "click",
        () =>
          openArticle(
            article.id
          )
      );


      if (
        index >=
        entries.length
      ) {
        item.setAttribute(
          "aria-hidden",
          "true"
        );

        item.tabIndex = -1;
      }


      content.appendChild(
        item
      );
    }
  );
}


/* =========================================================
   25. END OF PART 1
   ========================================================= */

/*
 * home-v2.js 第 1/2 部分到这里结束。
 * 下一段必须紧接在本注释后。
 *
 * !!! 不要 Commit !!!
 */"use strict";

/* =========================================================
   Global View / 观澜泗渡
   Homepage V2
   File: /home-v2.js

   本文件仅供 index-v2.html 使用。
   不修改现有 index.html。
   ========================================================= */


/* =========================================================
   1. CMS loading state
   ========================================================= */

document.documentElement.classList.add("cms-loading");


/* =========================================================
   2. DOM helpers
   ========================================================= */

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));


/* =========================================================
   3. Shared article store
   ========================================================= */

/*
 * 保留 articles 这个变量名。
 * cms-integration.js 可以继续向该数组写入 CMS 内容。
 */
const articles = [];


/* =========================================================
   4. UI translations
   ========================================================= */

const translations = {
  zh: {
    brandCn: "观澜泗渡",

    navHome: "首页",
    navHomeEn: "Home",

    navAbout: "关于",
    navAboutEn: "About",

    catTech: "科技",
    catTechEn: "Tech",

    catBusiness: "商业",
    catBusinessEn: "Business",

    catCulture: "文化",
    catCultureEn: "Culture",

    catLife: "生活",
    catLifeEn: "Life",

    latestArticles: "最新资讯",

    prPortfolio: "PR作品",
    prFilterAll: "全部",
    prFilterCompany: "公司新闻",
    prFilterIndustry: "行业新闻",

    latestNews: "最新动态",

    searchPlaceholder: "搜索感兴趣的内容...",

    eyebrow: "全球视野 · 双语阅读",

    homeTitle: "连接世界，发现更多可能",

    homeSubtitle:
      "从科技创新到文化生活，读懂正在发生的变化。",

    filterAll: "全部",

    trendingTitle: "我的专栏",

    viewMoreArticles: "查看更多文章 →",

    worksTitle: "我的作品",

    worksEmpty: "暂无作品",

    newsletterIntro:
      "订阅观澜泗渡，获取双语资讯与编辑精选。",

    emailPlaceholder: "请输入您的邮箱地址",

    subscribe: "订阅",

    promoTitle:
      "观澜泗渡<br>以双语视角探索科技、商业与文化的交汇。",

    promoText: "",

    learnMore: "了解我们",

    noResults:
      "没有找到匹配的文章，试试其他关键词。",

    categoryEyebrow: "主题探索",

    aboutEyebrow: "关于我们",

    aboutTitle:
      "让信息跨越语言，让观点连接世界",

    aboutIntro:
      "观澜泗渡是一个聚焦科技、商业、文化与生活的双语资讯与观点分享平台。",

    aboutMissionTitle: "我们的定位",

    aboutMission:
      "我们希望通过清晰的内容结构，帮助读者发现值得关注的趋势、行业变化与文化故事。",

    aboutContentTitle: "内容与来源",

    aboutContent:
      "平台内容包括编辑整理、观点分享及依法获得授权或符合适用规则的转载内容。转载内容应在发布时标注原始来源、作者及原文链接（如适用）。文章所列来源名称仅作为示例，不代表相关机构已发布或认可本文。",

    aboutStandardsTitle: "编辑原则",

    aboutStandard1:
      "明确区分事实信息、分析观点与示例内容。",

    aboutStandard2:
      "对转载内容标注来源，尽可能保留原文语境与出处。",

    aboutStandard3:
      "发现错误时及时核查、更新或更正。",

    aboutStandard4:
      "尊重知识产权、隐私权与相关法律法规。",

    aboutContactTitle: "联系我们",

    contactText:
      "内容合作、版权及反馈：",

    disclaimerTitle: "免责声明",

    disclaimer:
      "本站是一个提供信息聚合、双语阅读与观点分享的平台，非新闻采编机构。本站内容来源于公开信息、第三方资料及编辑整理，仅供信息参考与交流，不代表任何机构或个人的正式立场。本站内容不构成投资、医疗、法律或其他专业建议，亦不应作为作出相关决策的唯一依据。用户应独立判断，必要时咨询具备相应资质的专业人士。本站致力于确保内容的准确性与时效性，但不保证所有信息始终完整、准确、及时或适用于特定情形。本站可能包含第三方网站链接，相关网站的内容、服务及隐私政策由其运营方负责。如您认为本站内容存在事实错误或侵犯合法权益，请通过本站公布的联系方式与我们联系。",

    footerDescription:
      "以双语视角连接全球资讯，让值得关注的想法跨越边界。",

    footerExplore: "探索内容",

    footerConnect: "关于与联系",

    footerContact: "联系我们",

    footerDisclaimer: "免责声明",

    rights: "保留所有权利。",

    footerDisclaimerShort:
      "本站为信息聚合与观点分享平台，非新闻采编机构。",

    sourceLabel: "来源",

    sourceNote: "来源说明",

    author: "作者",

    editorialTeam: "观澜泗渡编辑部",

    shareArticle: "分享文章链接",

    closeArticle: "关闭",

    shareCopied: "文章链接已复制。",

    shareFailed:
      "无法自动复制，请手动复制浏览器地址。",

    newsletterSuccess:
      "订阅页面已打开，请按照页面提示完成订阅。",

    newsletterError:
      "请输入有效的邮箱地址。",

    readTime: "分钟阅读",

    articlesCount: "篇文章",

    categoryDescriptions: {
      tech:
        "关注人工智能、数字技术、科学研究与创新如何改变工作、产业和日常生活。",

      business:
        "探索全球商业趋势、企业战略、市场变化与可持续增长。",

      culture:
        "发现艺术、设计、博物馆、创意产业与跨文化交流的新故事。",

      life:
        "从健康饮食到城市出行，关注日常生活中的选择与新趋势。"
    }
  },


  en: {
    brandCn: "观澜泗渡",

    navHome: "Home",
    navHomeEn: "首页",

    navAbout: "About",
    navAboutEn: "关于",

    catTech: "Technology",
    catTechEn: "科技",

    catBusiness: "Business",
    catBusinessEn: "商业",

    catCulture: "Culture",
    catCultureEn: "文化",

    catLife: "Life",
    catLifeEn: "生活",

    latestArticles: "Latest Articles",

    prPortfolio: "PR Portfolio",

    prFilterAll: "All",

    prFilterCompany: "Company News",

    prFilterIndustry: "Industry News",

    latestNews: "Latest",

    searchPlaceholder: "Search articles...",

    eyebrow:
      "Global perspectives · Bilingual reading",

    homeTitle:
      "Connect the world. Discover more.",

    homeSubtitle:
      "From technological innovation to culture and everyday life, explore the changes shaping our world.",

    filterAll: "All",

    trendingTitle: "My Column",

    viewMoreArticles:
      "View More Articles →",

    worksTitle: "My Works",

    worksEmpty:
      "No works available yet",

    newsletterIntro:
      "Get bilingual insights and editorial picks from Global View.",

    emailPlaceholder:
      "Enter your email address",

    subscribe: "Subscribe",

    promoTitle:
      "Global View<br>Explore the intersection of technology, business and culture through a bilingual lens.",

    promoText: "",

    learnMore: "About us",

    noResults:
      "No matching articles. Try another keyword.",

    categoryEyebrow:
      "Topic Explorer",

    aboutEyebrow: "About Us",

    aboutTitle:
      "Ideas across languages. Perspectives across borders.",

    aboutIntro:
      "Global View is a bilingual information and perspectives platform focused on technology, business, culture and life.",

    aboutMissionTitle:
      "Our Mission",

    aboutMission:
      "Through clear content organization and bilingual presentation, we aim to help readers discover noteworthy trends, industry developments, and cultural stories.",

    aboutContentTitle:
      "Content & Sources",

    aboutContent:
      "Content may include editorial summaries, commentary and reproduced material published with appropriate authorization or in accordance with applicable rules. Reproduced content should identify its original source, author and original link where applicable.",

    aboutStandardsTitle:
      "Editorial Principles",

    aboutStandard1:
      "Distinguish factual information, analysis and illustrative content.",

    aboutStandard2:
      "Attribute reproduced material and preserve context and provenance where possible.",

    aboutStandard3:
      "Review, update or correct errors when identified.",

    aboutStandard4:
      "Respect intellectual property, privacy and applicable laws.",

    aboutContactTitle:
      "Contact Us",

    contactText:
      "Editorial partnerships, copyright and feedback:",

    disclaimerTitle:
      "Disclaimer",

    disclaimer:
      "This website is a platform for information aggregation, bilingual reading, and opinion sharing rather than a news-gathering organization. Its content is provided for informational and discussion purposes only and does not constitute investment, medical, legal, or other professional advice.",

    footerDescription:
      "Connecting global news through a bilingual perspective, bringing ideas worth noticing across borders.",

    footerExplore: "Explore",

    footerConnect:
      "About & Contact",

    footerContact: "Contact Us",

    footerDisclaimer:
      "Disclaimer",

    rights:
      "All rights reserved.",

    footerDisclaimerShort:
      "This website is a platform for information aggregation and opinion sharing, not a news-gathering organization.",

    sourceLabel: "Source",

    sourceNote:
      "Source information",

    author: "Author",

    editorialTeam:
      "Global View Editorial Team",

    shareArticle:
      "Share article link",

    closeArticle: "Close",

    shareCopied:
      "Article link copied.",

    shareFailed:
      "Could not copy automatically. Copy the browser address manually.",

    newsletterSuccess:
      "The subscription page has opened. Follow the page instructions to complete your subscription.",

    newsletterError:
      "Please enter a valid email address.",

    readTime: "min read",

    articlesCount: "articles",

    categoryDescriptions: {
      tech:
        "Explore how AI, digital technologies, scientific research and innovation are changing work, industries and everyday life.",

      business:
        "Explore global business trends, corporate strategy, market shifts and sustainable growth.",

      culture:
        "Discover stories in art, design, museums, creative industries and cross-cultural exchange.",

      life:
        "From healthy food to urban mobility, explore choices and trends shaping everyday life."
    }
  }
};


/* =========================================================
   5. Core state
   ========================================================= */

let currentLang = "zh";

let activeFilter = "all";

let currentPage = "home";

let currentArticleId = null;

let previousFocus = null;

let currentSlide = 0;

let carouselTimer = null;

let searchScrollTimer = null;


/*
 * CMS 或 RSS 数据加载完成后，
 * featuredIds / tickerIds 会被重新生成。
 */
const featuredIds = [];

const tickerIds = [];


/* =========================================================
   6. Translation helpers
   ========================================================= */

function t(key) {
  return (
    translations[currentLang]?.[key] ??
    translations.zh?.[key] ??
    key
  );
}

function categoryName(category) {
  const map = {
    tech: "catTech",
    business: "catBusiness",
    culture: "catCulture",
    life: "catLife"
  };

  return t(map[category] || "catTech");
}


/* =========================================================
   7. Article helpers
   ========================================================= */

function articleById(id) {
  return articles.find(
    article => article.id === id
  );
}

function getArticleText(value) {
  if (
    value &&
    typeof value === "object"
  ) {
    return (
      value[currentLang] ??
      value.zh ??
      value.en ??
      ""
    );
  }

  return String(value ?? "");
}

function getArticleTitle(article) {
  return getArticleText(
    article?.title
  );
}

function getArticleExcerpt(article) {
  const result =
    getArticleText(article?.excerpt);

  return result || getArticleTitle(article);
}

function getArticleSubtitle(article) {
  const result =
    getArticleText(article?.subtitle);

  return result || getArticleExcerpt(article);
}

function getArticleAlt(article) {
  const result =
    getArticleText(article?.alt);

  return result || getArticleTitle(article);
}


/* =========================================================
   8. Date helpers
   ========================================================= */

function formatDate(date) {
  if (!date) return "";

  const value =
    new Date(`${date}T12:00:00`);

  if (
    Number.isNaN(value.getTime())
  ) {
    return date;
  }

  return new Intl.DateTimeFormat(
    currentLang === "zh"
      ? "zh-CN"
      : "en-US",
    {
      year: "numeric",
      month:
        currentLang === "zh"
          ? "long"
          : "short",
      day: "numeric"
    }
  ).format(value);
}

function readTimeText(minutes) {
  const value =
    Number(minutes) || 1;

  return currentLang === "zh"
    ? `${value} 分钟阅读`
    : `${value} min read`;
}

function updateDateLabel() {
  const now = new Date();

  const dateLabel =
    $("#todayDate");

  if (dateLabel) {
    dateLabel.textContent =
      new Intl.DateTimeFormat(
        currentLang === "zh"
          ? "zh-CN"
          : "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "short"
        }
      ).format(now);
  }

  const year =
    $("#copyrightYear");

  if (year) {
    year.textContent =
      String(now.getFullYear());
  }
}


/* =========================================================
   9. Theme
   ========================================================= */

function applyTheme(theme) {
  document.documentElement.dataset.theme =
    theme;

  const toggle =
    $("#themeToggle");

  if (!toggle) return;

  const dark =
    theme === "dark";

  toggle.innerHTML =
    `<svg width="17" height="17" aria-hidden="true">
      <use href="${
        dark
          ? "#i-sun"
          : "#i-moon"
      }"></use>
    </svg>`;

  toggle.setAttribute(
    "aria-label",
    dark
      ? "Switch to light mode"
      : "Switch to dark mode"
  );

  toggle.title =
    dark
      ? "Light mode"
      : "Dark mode";
}

function initTheme() {
  let saved = null;

  try {
    saved =
      localStorage.getItem(
        "gp-theme"
      );
  } catch (_) {}

  const systemDark =
    window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

  applyTheme(
    saved ||
      (
        systemDark
          ? "dark"
          : "light"
      )
  );
}


/* =========================================================
   10. Language
   ========================================================= */

function setLanguage(lang) {
  if (!translations[lang]) {
    return;
  }

  currentLang = lang;

  document.documentElement.lang =
    lang === "zh"
      ? "zh-CN"
      : "en";

  document.title =
    lang === "zh"
      ? "Global View | 观澜泗渡"
      : "Global View | Bilingual Global Insights";


  $$("[data-i18n]").forEach(
    element => {
      const key =
        element.dataset.i18n;

      if (
        translations[lang][key] ===
        undefined
      ) {
        return;
      }

      if (key === "promoTitle") {
        element.innerHTML = t(key);
      } else {
        element.textContent = t(key);
      }
    }
  );


  $$(
    "[data-i18n-placeholder]"
  ).forEach(element => {
    element.placeholder =
      t(
        element.dataset
          .i18nPlaceholder
      );
  });


  $$("[data-lang]").forEach(
    button => {
      const selected =
        button.dataset.lang ===
        lang;

      button.classList.toggle(
        "active",
        selected
      );

      button.setAttribute(
        "aria-pressed",
        String(selected)
      );
    }
  );


  /*
   * 不重新请求任何数据。
   * 这里只重绘需要随语言变化的界面。
   */
  refreshAutoNewsIds();

  renderTicker();
  renderFeatured();
  renderArticles();
  updateCategoryPage();
  updateDateLabel();

  try {
    localStorage.setItem(
      "gp-lang",
      currentLang
    );
  } catch (_) {}
}


/* =========================================================
   11. Fallback image settings
   ========================================================= */

window.globalViewFallbackImages = {
  tech: "",
  business: "",
  culture: "",
  life: ""
};

async function loadGlobalViewFallbackImages() {
  try {
    const response =
      await fetch(
        "/content/site-settings.json",
        {
          cache: "force-cache"
        }
      );

    if (!response.ok) {
      return;
    }

    const settings =
      await response.json();

    window.globalViewFallbackImages = {
      tech:
        settings.tech || "",

      business:
        settings.business || "",

      culture:
        settings.culture || "",

      life:
        settings.life || ""
    };
  } catch (error) {
    console.warn(
      "通用图片设置读取失败：",
      error
    );
  }
}


/* =========================================================
   12. Image list cache
   ========================================================= */

/*
 * V1 的主要性能瓶颈之一：
 *
 * 每渲染一张新闻图片都会重新请求
 * /sources.json?t=Date.now()
 *
 * V2 改为：
 *
 * 同一个分类第一次请求后缓存 Promise，
 * 后续所有图片直接复用。
 */

const globalViewImageListCache =
  new Map();

async function getGlobalViewImageList(
  category
) {
  if (
    globalViewImageListCache.has(
      category
    )
  ) {
    return globalViewImageListCache.get(
      category
    );
  }


  const folder =
    `/public/images/library/${category}`;


  const request =
    fetch(
      `${folder}/sources.json`,
      {
        cache: "force-cache"
      }
    )
      .then(response => {
        if (!response.ok) {
          throw new Error(
            `图片列表读取失败：HTTP ${response.status}`
          );
        }

        return response.json();
      })
      .then(records => {
        if (!Array.isArray(records)) {
          return [];
        }

        return records.filter(
          item =>
            item &&
            item.filename
        );
      })
      .catch(error => {
        /*
         * 请求失败时移除缓存，
         * 后续仍可重新尝试。
         */
        globalViewImageListCache.delete(
          category
        );

        throw error;
      });


  globalViewImageListCache.set(
    category,
    request
  );


  return request;
}


/* =========================================================
   13. Stable image selection
   ========================================================= */

/*
 * V1 使用 Math.random()。
 * 每次重新渲染语言、搜索或列表时图片都会改变。
 *
 * V2 根据 article.id 稳定选择图片。
 */

function getStableImageIndex(
  article,
  length
) {
  if (!length) return 0;


  const value =
    String(
      article?.id ||
      article?.title?.zh ||
      article?.title?.en ||
      article?.source ||
      ""
    );


  let hash = 0;


  for (
    let i = 0;
    i < value.length;
    i += 1
  ) {
    hash =
      (
        (hash << 5) -
        hash +
        value.charCodeAt(i)
      ) | 0;
  }


  return (
    Math.abs(hash) %
    length
  );
}


/* =========================================================
   14. Central image loader
   ========================================================= */

window.globalViewSetArticleImage =
  async function (
    img,
    article,
    options = {}
  ) {
    if (!img || !article) {
      return;
    }


    const category =
      [
        "tech",
        "business",
        "culture",
        "life"
      ].includes(
        article.category
      )
        ? article.category
        : "tech";


    /*
     * 第一张轮播图属于 LCP 候选。
     * 只有第一张使用 eager + high。
     */
    const priority =
      options.priority === true;


    img.decoding = "async";

    img.loading =
      priority
        ? "eager"
        : "lazy";


    try {
      img.fetchPriority =
        priority
          ? "high"
          : "low";
    } catch (_) {}


    img.style.visibility =
      "visible";


    /*
     * CMS 原图优先。
     */
    if (
      article.origin === "cms" &&
      article.image
    ) {
      img.onerror = null;

      img.src =
        article.image;

      return;
    }


    /*
     * 如果文章本身明确要求保留图片，
     * 同样允许直接使用。
     */
    if (
      options.useArticleImage === true &&
      article.image
    ) {
      img.onerror = null;

      img.src =
        article.image;

      return;
    }


    const folder =
      `/public/images/library/${category}`;


    try {
      const available =
        await getGlobalViewImageList(
          category
        );


      if (!available.length) {
        throw new Error(
          "本地图片列表为空"
        );
      }


      const index =
        getStableImageIndex(
          article,
          available.length
        );


      const item =
        available[index];


      img.onerror = () => {
        const fallback =
          window
            .globalViewFallbackImages?.[
              category
            ] ||
          article.fallbackImage ||
          article.image ||
          "";


        if (fallback) {
          img.onerror = null;

          img.src = fallback;
        } else {
          img.style.visibility =
            "hidden";
        }
      };


      img.src =
        `${folder}/${encodeURIComponent(
          item.filename
        )}`;
    } catch (error) {
      console.warn(
        "本地分类图片加载失败：",
        category,
        error
      );


      const fallback =
        window
          .globalViewFallbackImages?.[
            category
          ] ||
        article.fallbackImage ||
        article.image ||
        "";


      if (fallback) {
        img.onerror = null;

        img.src = fallback;
      } else {
        img.removeAttribute(
          "src"
        );

        img.style.visibility =
          "hidden";
      }
    }
  };


/* =========================================================
   15. Automatic-news language
   ========================================================= */

function getAutoArticleLanguage(
  article
) {
  if (
    !String(
      article?.id || ""
    ).startsWith("auto-")
  ) {
    return null;
  }


  const value =
    String(
      article.language ||
      article.lang ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    value === "zh" ||
    value.startsWith("zh-") ||
    value === "chinese"
  ) {
    return "zh";
  }


  if (
    value === "en" ||
    value.startsWith("en-") ||
    value === "english"
  ) {
    return "en";
  }


  const title =
    String(
      article.title?.zh ||
      article.title?.en ||
      ""
    );


  return /[\u3400-\u9fff]/.test(
    title
  )
    ? "zh"
    : "en";
}


/* =========================================================
   16. Refresh featured / ticker IDs
   ========================================================= */

function refreshAutoNewsIds() {
  const autoNews =
    articles
      .filter(
        article =>
          getAutoArticleLanguage(
            article
          ) === currentLang
      )
      .sort(
        (a, b) =>
          new Date(b.date) -
          new Date(a.date)
      );


  const featured = [];

  const preferredCategories = [
    "tech",
    "business",
    "culture",
    "life"
  ];


  preferredCategories.forEach(
    category => {
      const article =
        autoNews.find(
          item =>
            item.category ===
            category
        );


      if (article) {
        featured.push(
          article.id
        );
      }
    }
  );


  /*
   * 分类不足时使用其他自动新闻补足。
   */
  autoNews.forEach(article => {
    if (
      featured.length < 4 &&
      !featured.includes(
        article.id
      )
    ) {
      featured.push(
        article.id
      );
    }
  });


  /*
   * 如果 CMS 已经加载，
   * 可用 CMS 内容补足轮播。
   */
  articles
    .filter(
      article =>
        article.cms === true ||
        article.origin === "cms"
    )
    .forEach(article => {
      if (
        featured.length < 4 &&
        !featured.includes(
          article.id
        )
      ) {
        featured.push(
          article.id
        );
      }
    });


  featuredIds.splice(
    0,
    featuredIds.length,
    ...featured.slice(0, 4)
  );


  const ticker =
    autoNews
      .slice(0, 5)
      .map(
        article =>
          article.id
      );


  articles
    .filter(
      article =>
        article.cms === true ||
        article.origin === "cms"
    )
    .forEach(article => {
      if (
        ticker.length < 5 &&
        !ticker.includes(
          article.id
        )
      ) {
        ticker.push(
          article.id
        );
      }
    });


  tickerIds.splice(
    0,
    tickerIds.length,
    ...ticker.slice(0, 5)
  );


  currentSlide = 0;
}


/* =========================================================
   17. Featured carousel rendering
   ========================================================= */

function renderFeatured() {
  const track =
    $("#featuredTrack");

  const dotsContainer =
    $("#carouselDots");


  if (
    !track ||
    !dotsContainer
  ) {
    return;
  }


  track.replaceChildren();

  dotsContainer.replaceChildren();


  const availableIds =
    featuredIds.filter(
      id =>
        Boolean(
          articleById(id)
        )
    );


  availableIds.forEach(
    (id, index) => {
      const article =
        articleById(id);


      if (!article) {
        return;
      }


      const slide =
        document.createElement(
          "article"
        );


      slide.className =
        "featured-slide";

      slide.tabIndex = 0;

      slide.setAttribute(
        "role",
        "button"
      );

      slide.setAttribute(
        "aria-label",
        getArticleTitle(article)
      );


      slide.addEventListener(
        "click",
        () =>
          openArticle(id)
      );


      slide.addEventListener(
        "keydown",
        event => {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();

            openArticle(id);
          }
        }
      );


      const img =
        document.createElement(
          "img"
        );


      img.className =
        "featured-image";


      img.alt =
        getArticleAlt(article);


      /*
       * 性能关键点：
       * 只有真实显示的第一张轮播图属于高优先级。
       */
      window
        .globalViewSetArticleImage(
          img,
          article,
          {
            priority:
              index === 0
          }
        );


      const content =
        document.createElement(
          "div"
        );


      content.className =
        "featured-content";


      const categoryTag =
        document.createElement(
          "span"
        );


      categoryTag.className =
        "category-tag";


      categoryTag.textContent =
        categoryName(
          article.category
        );


      const title =
        document.createElement(
          "h2"
        );


      title.textContent =
        getArticleTitle(
          article
        );


      const excerpt =
        document.createElement(
          "p"
        );


      excerpt.textContent =
        getArticleExcerpt(
          article
        );


      const meta =
        document.createElement(
          "div"
        );


      meta.className =
        "featured-meta";


      const date =
        document.createElement(
          "span"
        );


      date.textContent =
        formatDate(
          article.date
        );


      const separatorOne =
        document.createElement(
          "span"
        );


      separatorOne.className =
        "dot";

      separatorOne.textContent =
        "|";


      const read =
        document.createElement(
          "span"
        );


      read.textContent =
        readTimeText(
          article.read
        );


      const separatorTwo =
        document.createElement(
          "span"
        );


      separatorTwo.className =
        "dot";

      separatorTwo.textContent =
        "|";


      const source =
        document.createElement(
          "span"
        );


      source.textContent =
        `${t("sourceLabel")}: ${
          article.source || ""
        }`;


      meta.append(
        date,
        separatorOne,
        read,
        separatorTwo,
        source
      );


      content.append(
        categoryTag,
        title,
        excerpt,
        meta
      );


      slide.append(
        img,
        content
      );


      track.appendChild(
        slide
      );


      const dot =
        document.createElement(
          "button"
        );


      dot.type = "button";


      dot.className =
        "carousel-dot" +
        (
          index === 0
            ? " active"
            : ""
        );


      dot.setAttribute(
        "aria-label",
        `Go to slide ${
          index + 1
        }`
      );


      dot.addEventListener(
        "click",
        event => {
          event.stopPropagation();

          goToSlide(index);
        }
      );


      dotsContainer.appendChild(
        dot
      );
    }
  );


  if (
    availableIds.length === 0
  ) {
    stopCarousel();

    track.style.transform =
      "translateX(0)";

    return;
  }


  updateCarouselPosition();

  startCarousel();
}


/* =========================================================
   18. Carousel movement
   ========================================================= */

function getSlideCount() {
  const track =
    $("#featuredTrack");

  return track
    ? track.querySelectorAll(
        ".featured-slide"
      ).length
    : 0;
}

function updateCarouselPosition() {
  const track =
    $("#featuredTrack");


  if (!track) return;


  const slideCount =
    getSlideCount();


  if (!slideCount) {
    currentSlide = 0;

    track.style.transform =
      "translateX(0)";

    return;
  }


  currentSlide =
    Math.max(
      0,
      Math.min(
        currentSlide,
        slideCount - 1
      )
    );


  track.style.transform =
    `translateX(-${
      currentSlide * 100
    }%)`;


  $$(".carousel-dot").forEach(
    (dot, index) => {
      dot.classList.toggle(
        "active",
        index === currentSlide
      );
    }
  );
}

function goToSlide(index) {
  const slideCount =
    getSlideCount();


  if (!slideCount) {
    return;
  }


  currentSlide =
    (
      (
        index %
        slideCount
      ) +
      slideCount
    ) %
    slideCount;


  updateCarouselPosition();

  startCarousel();
}

function nextSlide() {
  const slideCount =
    getSlideCount();


  if (!slideCount) {
    return;
  }


  currentSlide =
    (
      currentSlide + 1
    ) %
    slideCount;


  updateCarouselPosition();
}

function startCarousel() {
  stopCarousel();


  if (
    getSlideCount() <= 1
  ) {
    return;
  }


  carouselTimer =
    window.setInterval(
      nextSlide,
      6000
    );
}

function stopCarousel() {
  if (
    carouselTimer !== null
  ) {
    window.clearInterval(
      carouselTimer
    );

    carouselTimer = null;
  }
}


/* =========================================================
   19. Search highlighting
   ========================================================= */

function setSearchHighlight(
  element,
  text
) {
  if (!element) return;


  const input =
    $("#searchInput");


  const query =
    input
      ? input.value
          .trim()
      : "";


  element.replaceChildren();


  const content =
    String(text || "");


  if (!query) {
    element.textContent =
      content;

    return;
  }


  const lowerContent =
    content.toLocaleLowerCase();


  const lowerQuery =
    query.toLocaleLowerCase();


  let start = 0;

  let index;


  while (
    (
      index =
        lowerContent.indexOf(
          lowerQuery,
          start
        )
    ) !== -1
  ) {
    element.appendChild(
      document.createTextNode(
        content.slice(
          start,
          index
        )
      )
    );


    const mark =
      document.createElement(
        "mark"
      );


    mark.textContent =
      content.slice(
        index,
        index + query.length
      );


    element.appendChild(
      mark
    );


    start =
      index +
      query.length;
  }


  element.appendChild(
    document.createTextNode(
      content.slice(start)
    )
  );
}


/* =========================================================
   20. Article cards
   ========================================================= */

function createArticleCard(article) {
  const card =
    document.createElement(
      "article"
    );


  card.className =
    "article-card";


  card.tabIndex = 0;


  card.setAttribute(
    "role",
    "button"
  );


  card.setAttribute(
    "aria-label",
    getArticleTitle(article)
  );


  card.addEventListener(
    "click",
    () =>
      openArticle(
        article.id
      )
  );


  card.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();

        openArticle(
          article.id
        );
      }
    }
  );


  const imageWrap =
    document.createElement(
      "div"
    );


  imageWrap.className =
    "card-image-wrap";


  const image =
    document.createElement(
      "img"
    );


  image.className =
    "card-image";


  image.alt =
    getArticleAlt(
      article
    );


  /*
   * 普通资讯全部低优先级懒加载。
   */
  window
    .globalViewSetArticleImage(
      image,
      article,
      {
        priority: false
      }
    );


  imageWrap.appendChild(
    image
  );


  const body =
    document.createElement(
      "div"
    );


  body.className =
    "card-body";


  const category =
    document.createElement(
      "span"
    );


  category.className =
    "category-tag";


  category.textContent =
    categoryName(
      article.category
    );


  const title =
    document.createElement(
      "h3"
    );


  title.className =
    "card-title serif";


  setSearchHighlight(
    title,
    getArticleTitle(article)
  );


  const excerpt =
    document.createElement(
      "p"
    );


  excerpt.className =
    "card-excerpt";


  setSearchHighlight(
    excerpt,
    getArticleExcerpt(article)
  );


  const meta =
    document.createElement(
      "div"
    );


  meta.className =
    "card-meta";


  const source =
    document.createElement(
      "span"
    );


  source.textContent =
    `${t("sourceLabel")}: ${
      article.source || ""
    }`;


  const read =
    document.createElement(
      "span"
    );


  read.textContent =
    readTimeText(
      article.read
    );


  meta.append(
    source,
    read
  );


  body.append(
    category,
    title,
    excerpt,
    meta
  );


  card.append(
    imageWrap,
    body
  );


  return card;
}


/* =========================================================
   21. Filtering
   ========================================================= */

function getFilteredArticles() {
  const input =
    $("#searchInput");


  const query =
    input
      ? input.value
          .trim()
          .toLocaleLowerCase()
      : "";


  let results =
    articles.filter(
      article => {
        /*
         * 首页普通资讯区域：
         * CMS 内容默认由专栏等模块呈现。
         * 搜索时仍允许搜索到 CMS 内容。
         */
        if (
          article.cms === true &&
          !query
        ) {
          return false;
        }


        const articleLanguage =
          getAutoArticleLanguage(
            article
          );


        if (
          articleLanguage &&
          articleLanguage !==
            currentLang
        ) {
          return false;
        }


        const categoryMatch =
          activeFilter === "all" ||
          article.category ===
            activeFilter;


        const haystack =
          [
            getArticleText(
              article.title
            ),

            getArticleText(
              article.excerpt
            ),

            article.title?.zh,
            article.title?.en,
            article.excerpt?.zh,
            article.excerpt?.en,

            (
              article.tags ||
              []
            ).join(" ")
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase();


        return (
          categoryMatch &&
          (
            !query ||
            haystack.includes(
              query
            )
          )
        );
      }
    );


  /*
   * 搜索时 CMS 优先。
   */
  if (query) {
    results.sort(
      (a, b) => {
        if (
          a.cms === true &&
          b.cms !== true
        ) {
          return -1;
        }


        if (
          a.cms !== true &&
          b.cms === true
        ) {
          return 1;
        }


        return (
          new Date(b.date) -
          new Date(a.date)
        );
      }
    );
  } else {
    results.sort(
      (a, b) =>
        new Date(b.date) -
        new Date(a.date)
    );
  }


  /*
   * 首页默认状态：
   * 科技 / 商业 / 文化 / 生活各显示一篇最新文章。
   */
  if (
    currentPage === "home" &&
    activeFilter === "all" &&
    !query
  ) {
    const seen =
      new Set();


    const limited = [];


    results.forEach(article => {
      if (
        seen.has(
          article.category
        )
      ) {
        return;
      }


      seen.add(
        article.category
      );


      limited.push(
        article
      );
    });


    return limited;
  }


  return results;
}


/* =========================================================
   22. Grid rendering
   ========================================================= */

function renderGrid(
  target,
  emptyTarget,
  list
) {
  if (!target) {
    return;
  }


  target.replaceChildren();


  list.forEach(
    article => {
      target.appendChild(
        createArticleCard(
          article
        )
      );
    }
  );


  if (emptyTarget) {
    emptyTarget.classList.toggle(
      "hidden",
      list.length !== 0
    );
  }
}

function renderArticles() {
  const filtered =
    getFilteredArticles();


  renderGrid(
    $("#articleGrid"),
    $("#emptyState"),
    filtered
  );


  const count =
    $("#articleCount");


  if (count) {
    count.textContent =
      `${filtered.length} ${
        t("articlesCount")
      }`;
  }


  if (
    [
      "tech",
      "business",
      "culture",
      "life"
    ].includes(currentPage)
  ) {
    renderCategoryGrid();
  }
}

function renderCategoryGrid() {
  const filtered =
    getFilteredArticles();


  renderGrid(
    $("#categoryArticleGrid"),
    $("#categoryEmptyState"),
    filtered
  );
}


/* =========================================================
   23. Filters
   ========================================================= */

function setFilter(filter) {
  activeFilter =
    filter;


  $$(".filter-btn").forEach(
    button => {
      const active =
        button.dataset.filter ===
        filter;


      button.classList.toggle(
        "active",
        active
      );


      button.setAttribute(
        "aria-pressed",
        String(active)
      );
    }
  );


  renderArticles();
}


/* =========================================================
   24. Ticker
   ========================================================= */

function renderTicker() {
  const content =
    $("#tickerContent");


  if (!content) return;


  content.replaceChildren();


  const entries =
    tickerIds
      .map(
        id =>
          articleById(id)
      )
      .filter(Boolean);


  if (!entries.length) {
    return;
  }


  /*
   * ticker 重复一次内容，
   * 用于形成连续滚动。
   */
  [
    ...entries,
    ...entries
  ].forEach(
    (article, index) => {
      const item =
        document.createElement(
          "button"
        );


      item.type = "button";


      item.className =
        "ticker-item";


      item.textContent =
        getArticleTitle(
          article
        );


      item.addEventListener(
        "click",
        () =>
          openArticle(
            article.id
          )
      );


      if (
        index >=
        entries.length
      ) {
        item.setAttribute(
          "aria-hidden",
          "true"
        );

        item.tabIndex = -1;
      }


      content.appendChild(
        item
      );
    }
  );
}


/* =========================================================
   25. END OF PART 1
   ========================================================= */

/* =========================================================
   26. Automatic news classification
   ========================================================= */

function classifyAutoNews(item) {
  const title =
    String(item?.title || "")
      .toLowerCase();

  const excerpt =
    String(item?.excerpt || "")
      .toLowerCase();

  const titleText = title;

  const fullText =
    `${title} ${excerpt}`;


  const culturePattern =
    /文化|艺术|博物馆|美术馆|电影|影视|音乐|演唱会|出版|设计展|展览|文学|文化遗产|文物|考古发现|戏剧|戏曲|舞蹈|纪录片|culture|museum|art exhibition|film|movie|cinema|music|concert|publishing|literature|theatre|theater|novel|heritage|archaeology|dance|documentary/;


  const techPattern =
    /人工智能|机器学习|大模型|机器人|芯片|半导体|软件|网络安全|云计算|数据中心|量子计算|科技|技术突破|科研|科学研究|航天|卫星|火箭发射|太空探索|生物科技|生物技术|创新药|新药研发|药物研发|临床试验|药品获批|基因|细胞治疗|医疗器械|电池技术|新能源技术|军事技术|军用无人机|无人作战|导弹技术|雷达系统|战斗机|军舰|武器系统|technology|artificial intelligence|machine learning|robotics|semiconductor|chip|software|cybersecurity|cloud computing|quantum computing|scientific research|space exploration|satellite|rocket launch|biotech|biotechnology|drug development|clinical trial|gene therapy|cell therapy|medical device|military technology|military drone|missile technology|radar system|fighter jet|warship|weapons system/;


  const businessPattern =
    /商业|财经|经济增长|宏观经济|股市|股票|股价|证券|债券|基金|汇率|央行|利率|通货膨胀|投资|融资|上市|财报|营收|利润|企业|公司|并购|收购|ipo|供应链|贸易|关税|出口|进口|制造业|房地产市场|银行|保险|金融|军工企业|国防承包商|军费开支|军火出口|business|finance|financial market|stock market|share price|economy|economic growth|central bank|interest rate|inflation|investment|funding|ipo|earnings|revenue|profit|company|corporate|merger|acquisition|supply chain|trade|tariff|export|import|manufacturing|real estate market|banking|insurance|defense contractor|defence contractor|defense spending|defence spending|arms exports/;


  const lifePattern =
    /生活|健康|疾病预防|公共卫生|医院|患者|医疗服务|饮食|食品安全|餐饮|旅游|旅行|交通|出行|城市|住房|教育|学校|大学|就业|职场|消费者|消费|气候变化|极端天气|环境保护|污染|能源价格|自然灾害|地震|洪水|台风|火灾|事故|公共安全|社会保障|养老金|家庭|儿童|青少年|战争伤亡|平民|难民|人道主义|撤离居民|停电|物价|health|public health|hospital|patient|food safety|restaurant|travel|tourism|transport|commute|city|housing|education|school|university|employment|consumer|climate change|extreme weather|environmental protection|pollution|natural disaster|earthquake|flood|typhoon|wildfire|accident|public safety|social security|pension|family|children|teenagers|civilian casualties|civilians|refugees|humanitarian|evacuation|power outage|cost of living/;


  if (
    culturePattern.test(titleText)
  ) {
    return "culture";
  }


  if (
    techPattern.test(titleText)
  ) {
    return "tech";
  }


  if (
    businessPattern.test(titleText)
  ) {
    return "business";
  }


  if (
    lifePattern.test(titleText)
  ) {
    return "life";
  }


  if (
    culturePattern.test(fullText)
  ) {
    return "culture";
  }


  if (
    techPattern.test(fullText)
  ) {
    return "tech";
  }


  if (
    businessPattern.test(fullText)
  ) {
    return "business";
  }


  if (
    lifePattern.test(fullText)
  ) {
    return "life";
  }


  return "tech";
}


/* =========================================================
   27. Convert auto-news record
   ========================================================= */

function makeAutoNewsArticle(
  item,
  index
) {
  if (
    !item ||
    !item.title ||
    !item.source_url
  ) {
    return null;
  }


  const title =
    String(item.title)
      .trim();


  const excerpt =
    String(
      item.excerpt || ""
    )
      .replace(
        /&nbsp;/gi,
        " "
      )
      .trim();


  const category =
    classifyAutoNews(item);


  const dateValue =
    new Date(item.date);


  const date =
    Number.isNaN(
      dateValue.getTime()
    )
      ? new Date()
          .toISOString()
          .slice(0, 10)

      : dateValue
          .toISOString()
          .slice(0, 10);


  const language =
    String(
      item.language ||
      item.lang ||
      ""
    )
      .trim()
      .toLowerCase();


  const safeId =
    String(
      item.id ||
      `${date}-${index}`
    )
      .replace(
        /[^a-zA-Z0-9_-]/g,
        "-"
      );


  const fallbackImage =
    window
      .globalViewFallbackImages?.[
        category
      ] || "";


  return {
    id:
      `auto-${index}-${safeId}`,

    category,

    language,

    title: {
      zh: title,
      en: title
    },

    excerpt: {
      zh:
        excerpt || title,

      en:
        excerpt || title
    },

    date,

    read:
      Number(item.read) || 1,

    source:
      String(
        item.source_name ||
        item.source ||
        "News source"
      ),

    externalUrl:
      String(
        item.source_url
      ),

    image:
      item.image ||
      fallbackImage,

    fallbackImage,

    alt: {
      zh: title,
      en: title
    },

    subtitle: {
      zh:
        excerpt || title,

      en:
        excerpt || title
    },

    body: {
      zh: [],
      en: []
    },

    tags: [
      category,
      "Auto News"
    ]
  };
}


/* =========================================================
   28. Load automatic news
   ========================================================= */

/*
 * 与 V1 不同：
 *
 * 1. 不再使用 ?t=Date.now()
 * 2. 不再使用 cache: "no-store"
 * 3. 保留超时和重试
 */

async function loadAutoNews() {
  let lastError = null;


  for (
    let attempt = 1;
    attempt <= 3;
    attempt += 1
  ) {
    const controller =
      new AbortController();


    const timeoutId =
      window.setTimeout(
        () =>
          controller.abort(),
        15000
      );


    try {
      const response =
        await fetch(
          "/auto-news.json",
          {
            cache: "default",

            signal:
              controller.signal
          }
        );


      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }


      const data =
        await response.json();


      if (
        !data ||
        !Array.isArray(
          data.items
        )
      ) {
        throw new Error(
          "auto-news.json 缺少 items 数组"
        );
      }


      /*
       * 删除此前生成的 auto- 数据，
       * 防止 loadAutoNews 被再次调用时重复加入。
       */
      for (
        let index =
          articles.length - 1;

        index >= 0;

        index -= 1
      ) {
        if (
          String(
            articles[index]?.id ||
            ""
          )
            .startsWith(
              "auto-"
            )
        ) {
          articles.splice(
            index,
            1
          );
        }
      }


      const existingIds =
        new Set(
          articles.map(
            article =>
              article.id
          )
        );


      const autoArticles =
        data.items
          .map(
            makeAutoNewsArticle
          )
          .filter(
            article =>
              article &&
              !existingIds.has(
                article.id
              )
          );


      articles.push(
        ...autoArticles
      );


      articles.sort(
        (a, b) =>
          new Date(b.date) -
          new Date(a.date)
      );


      refreshAutoNewsIds();

      renderTicker();

      renderFeatured();

      renderArticles();

      updateCategoryPage();


      console.info(
        `自动新闻已载入：${autoArticles.length} 条`
      );


      return autoArticles;
    } catch (error) {
      lastError = error;


      if (
        attempt < 3
      ) {
        await new Promise(
          resolve =>
            window.setTimeout(
              resolve,
              attempt * 450
            )
        );
      }
    } finally {
      window.clearTimeout(
        timeoutId
      );
    }
  }


  console.error(
    "自动新闻加载失败，保留现有首页内容：",
    lastError
  );


  return [];
}


/* =========================================================
   29. Category page
   ========================================================= */

function updateCategoryPage() {
  if (
    ![
      "tech",
      "business",
      "culture",
      "life"
    ].includes(currentPage)
  ) {
    return;
  }


  const title =
    $("#categoryPageTitle");


  if (title) {
    title.textContent =
      categoryName(
        currentPage
      );
  }


  const description =
    $("#categoryPageDesc");


  if (description) {
    description.textContent =
      t(
        "categoryDescriptions"
      )?.[currentPage] ||
      "";
  }


  renderCategoryGrid();
}


/* =========================================================
   30. Navigation
   ========================================================= */

function syncPageVisibility(
  page
) {
  const home =
    $("#homePage");

  const category =
    $("#categoryPage");

  const about =
    $("#aboutPage");


  home?.classList.toggle(
    "hidden",
    page !== "home"
  );


  category?.classList.toggle(
    "hidden",
    ![
      "tech",
      "business",
      "culture",
      "life"
    ].includes(page)
  );


  about?.classList.toggle(
    "hidden",
    page !== "about"
  );


  $$(".nav-link").forEach(
    button => {
      button.classList.toggle(
        "active",
        button.dataset.page ===
          page
      );
    }
  );


  const nav =
    $("#mainNav");

  nav?.classList.remove(
    "open"
  );


  const menu =
    $("#menuToggle");


  if (menu) {
    menu.setAttribute(
      "aria-expanded",
      "false"
    );


    menu.innerHTML =
      `<svg
        width="20"
        height="20"
        aria-hidden="true"
      >
        <use href="#i-menu"></use>
      </svg>`;
  }
}

function syncFilters() {
  $$(".filter-btn").forEach(
    button => {
      const active =
        button.dataset.filter ===
        activeFilter;


      button.classList.toggle(
        "active",
        active
      );


      button.setAttribute(
        "aria-pressed",
        String(active)
      );
    }
  );
}

function navigate(
  page,
  options = {}
) {
  const validPages = [
    "home",
    "tech",
    "business",
    "culture",
    "life",
    "about"
  ];


  if (
    !validPages.includes(page)
  ) {
    page = "home";
  }


  currentPage = page;


  activeFilter =
    [
      "tech",
      "business",
      "culture",
      "life"
    ].includes(page)
      ? page
      : "all";


  syncPageVisibility(page);

  syncFilters();


  if (
    page === "home"
  ) {
    renderArticles();
  }


  if (
    [
      "tech",
      "business",
      "culture",
      "life"
    ].includes(page)
  ) {
    updateCategoryPage();

    renderArticles();
  }


  const wantedHash =
    `#${page}`;


  if (
    location.hash !==
    wantedHash
  ) {
    history.pushState(
      { page },
      "",
      wantedHash
    );
  }


  if (
    options.scrollTop !== false
  ) {
    window.scrollTo({
      top: 0,

      behavior:
        options.instant
          ? "auto"
          : "smooth"
    });
  }
}

function navigateWithoutHistory(
  page
) {
  const validPages = [
    "home",
    "tech",
    "business",
    "culture",
    "life",
    "about"
  ];


  if (
    !validPages.includes(page)
  ) {
    page = "home";
  }


  currentPage = page;


  activeFilter =
    [
      "tech",
      "business",
      "culture",
      "life"
    ].includes(page)
      ? page
      : "all";


  syncPageVisibility(page);

  syncFilters();


  if (
    page === "home"
  ) {
    renderArticles();
  }


  if (
    [
      "tech",
      "business",
      "culture",
      "life"
    ].includes(page)
  ) {
    updateCategoryPage();
  }
}


/* =========================================================
   31. Article modal
   ========================================================= */

function renderModalArticle(id) {
  const article =
    articleById(id);


  if (!article) {
    return;
  }


  const image =
    $("#modalImage");


  if (image) {
    image.alt =
      getArticleAlt(
        article
      );


    window
      .globalViewSetArticleImage(
        image,
        article,
        {
          priority: false,

          useArticleImage:
            article.origin ===
              "cms"
        }
      );
  }


  const category =
    $("#modalCategory");


  if (category) {
    category.textContent =
      categoryName(
        article.category
      );
  }


  const title =
    $("#modalTitle");


  if (title) {
    title.textContent =
      getArticleTitle(
        article
      );
  }


  const subtitle =
    $("#modalSubtitle");


  if (subtitle) {
    subtitle.textContent =
      getArticleSubtitle(
        article
      );
  }


  const author =
    $("#modalAuthor");


  if (author) {
    author.textContent =
      `${t("author")}: ${
        article.author ||
        t("editorialTeam")
      }`;
  }


  const date =
    $("#modalDate");


  if (date) {
    date.textContent =
      formatDate(
        article.date
      );
  }


  const read =
    $("#modalReadTime");


  if (read) {
    read.textContent =
      readTimeText(
        article.read
      );
  }


  const body =
    $("#modalBody");


  if (body) {
    body.replaceChildren();


    const section =
      document.createElement(
        "section"
      );


    section.className =
      "article-language-section";


    section.lang =
      currentLang === "zh"
        ? "zh-CN"
        : "en";


    let paragraphs =
      article.body?.[
        currentLang
      ];


    if (
      !Array.isArray(
        paragraphs
      )
    ) {
      paragraphs =
        article.body?.zh ||
        article.body?.en ||
        [];
    }


    if (
      typeof paragraphs ===
      "string"
    ) {
      paragraphs =
        paragraphs
          .split(/\n{2,}/)
          .map(
            item =>
              item.trim()
          )
          .filter(Boolean);
    }


    if (
      Array.isArray(
        paragraphs
      )
    ) {
      paragraphs.forEach(
        text => {
          const paragraph =
            document.createElement(
              "p"
            );


          paragraph.textContent =
            String(text || "");


          section.appendChild(
            paragraph
          );
        }
      );
    }


    /*
     * CMS 文章若没有可用正文，
     * 至少显示摘要，不让弹窗完全空白。
     */
    if (
      !section.children.length
    ) {
      const paragraph =
        document.createElement(
          "p"
        );


      paragraph.textContent =
        getArticleExcerpt(
          article
        );


      section.appendChild(
        paragraph
      );
    }


    body.appendChild(
      section
    );
  }


  const source =
    $("#modalSource");


  if (source) {
    source.textContent =
      `${t("sourceNote")}: ${
        article.source ||
        ""
      }`;
  }


  const tags =
    $("#modalTags");


  if (tags) {
    tags.replaceChildren();


    (
      article.tags ||
      []
    ).forEach(tag => {
      const span =
        document.createElement(
          "span"
        );


      span.className =
        "tag";


      span.textContent =
        `# ${tag}`;


      tags.appendChild(
        span
      );
    });
  }


  const shareMessage =
    $("#shareMessage");


  shareMessage?.classList.add(
    "hidden"
  );
}

function openArticle(id) {
  const article =
    articleById(id);


  if (!article) {
    return;
  }


  /*
   * RSS 自动新闻继续打开原始来源。
   */
  if (
    article.externalUrl
  ) {
    window.open(
      article.externalUrl,
      "_blank",
      "noopener,noreferrer"
    );

    return;
  }


  currentArticleId = id;

  previousFocus =
    document.activeElement;


  renderModalArticle(id);


  const modal =
    $("#articleModal");


  modal?.classList.add(
    "open"
  );


  document.body.classList.add(
    "modal-open"
  );


  $("#modalClose")?.focus();


  history.replaceState(
    {
      page: currentPage,
      article: id
    },
    "",
    `#article-${encodeURIComponent(
      id
    )}`
  );
}

function closeArticle() {
  const modal =
    $("#articleModal");


  modal?.classList.remove(
    "open"
  );


  document.body.classList.remove(
    "modal-open"
  );


  currentArticleId = null;


  const cleanHash =
    currentPage === "home"
      ? "#home"
      : `#${currentPage}`;


  history.replaceState(
    {
      page: currentPage
    },
    "",
    cleanHash
  );


  if (
    previousFocus &&
    typeof previousFocus.focus ===
      "function"
  ) {
    previousFocus.focus();
  }
}


/* =========================================================
   32. Share article
   ========================================================= */

async function shareCurrentArticle() {
  const article =
    articleById(
      currentArticleId
    );


  if (!article) {
    return;
  }


  const shareUrl =
    `${location.origin}${location.pathname}#article-${encodeURIComponent(
      article.id
    )}`;


  const message =
    $("#shareMessage");


  message?.classList.remove(
    "hidden",
    "success",
    "error"
  );


  try {
    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(
        shareUrl
      );
    } else {
      const input =
        document.createElement(
          "textarea"
        );


      input.value =
        shareUrl;


      input.style.position =
        "fixed";

      input.style.opacity =
        "0";


      document.body.appendChild(
        input
      );


      input.select();


      const copied =
        document.execCommand(
          "copy"
        );


      input.remove();


      if (!copied) {
        throw new Error(
          "Clipboard unavailable"
        );
      }
    }


    if (message) {
      message.classList.add(
        "success"
      );

      message.textContent =
        t("shareCopied");
    }
  } catch (_) {
    if (message) {
      message.classList.add(
        "error"
      );

      message.textContent =
        t("shareFailed");
    }
  }
}


/* =========================================================
   33. Carousel pointer swipe
   ========================================================= */

function initCarouselSwipe() {
  const carousel =
    $("#featuredCarousel");

  const track =
    $("#featuredTrack");


  if (
    !carousel ||
    !track
  ) {
    return;
  }


  track.style.touchAction =
    "pan-y";


  let pointerStartX = 0;

  let pointerStartY = 0;

  let pointerLastX = 0;

  let isDragging = false;

  let isHorizontalDrag =
    false;

  let activePointerId =
    null;

  let suppressClickUntil =
    0;


  carousel.addEventListener(
    "pointerdown",
    event => {
      if (
        event.pointerType ===
          "mouse" &&
        event.button !== 0
      ) {
        return;
      }


      if (
        event.target.closest(
          "button"
        )
      ) {
        return;
      }


      activePointerId =
        event.pointerId;


      pointerStartX =
        event.clientX;


      pointerStartY =
        event.clientY;


      pointerLastX =
        event.clientX;


      isDragging = true;

      isHorizontalDrag =
        false;


      stopCarousel();
    }
  );


  carousel.addEventListener(
    "pointermove",
    event => {
      if (
        !isDragging ||
        event.pointerId !==
          activePointerId
      ) {
        return;
      }


      pointerLastX =
        event.clientX;


      const deltaX =
        event.clientX -
        pointerStartX;


      const deltaY =
        event.clientY -
        pointerStartY;


      if (!isHorizontalDrag) {
        if (
          Math.abs(deltaX) <
          8
        ) {
          return;
        }


        if (
          Math.abs(deltaX) <=
          Math.abs(deltaY)
        ) {
          return;
        }


        isHorizontalDrag =
          true;


        try {
          carousel.setPointerCapture(
            event.pointerId
          );
        } catch (_) {}
      }


      event.preventDefault();
    },
    {
      passive: false
    }
  );


  function finishDrag(
    event
  ) {
    if (
      !isDragging ||
      event.pointerId !==
        activePointerId
    ) {
      return;
    }


    const deltaX =
      pointerLastX -
      pointerStartX;


    const horizontal =
      isHorizontalDrag;


    isDragging = false;

    isHorizontalDrag =
      false;


    try {
      if (
        carousel.hasPointerCapture(
          event.pointerId
        )
      ) {
        carousel.releasePointerCapture(
          event.pointerId
        );
      }
    } catch (_) {}


    activePointerId =
      null;


    if (
      event.type ===
        "pointerup" &&
      horizontal &&
      Math.abs(deltaX) >=
        40
    ) {
      suppressClickUntil =
        Date.now() + 500;


      const count =
        getSlideCount();


      if (count) {
        goToSlide(
          deltaX < 0
            ? currentSlide + 1
            : currentSlide - 1
        );
      }
    } else {
      startCarousel();
    }
  }


  carousel.addEventListener(
    "pointerup",
    finishDrag
  );


  carousel.addEventListener(
    "pointercancel",
    finishDrag
  );


  carousel.addEventListener(
    "click",
    event => {
      if (
        Date.now() <
        suppressClickUntil
      ) {
        event.preventDefault();

        event.stopPropagation();

        event.stopImmediatePropagation();

        suppressClickUntil = 0;
      }
    },
    true
  );
}


/* =========================================================
   34. General event listeners
   ========================================================= */

function bindEvents() {
  $("#themeToggle")?.addEventListener(
    "click",
    () => {
      const next =
        document.documentElement
          .dataset.theme ===
          "dark"
          ? "light"
          : "dark";


      applyTheme(next);


      try {
        localStorage.setItem(
          "gp-theme",
          next
        );
      } catch (_) {}
    }
  );


  $$("[data-lang]").forEach(
    button => {
      button.addEventListener(
        "click",
        () => {
          setLanguage(
            button.dataset.lang
          );
        }
      );
    }
  );


  $("#carouselPrev")?.addEventListener(
    "click",
    () => {
      goToSlide(
        currentSlide - 1
      );
    }
  );


  $("#carouselNext")?.addEventListener(
    "click",
    () => {
      goToSlide(
        currentSlide + 1
      );
    }
  );


  $("#featuredCarousel")?.addEventListener(
    "mouseenter",
    stopCarousel
  );


  $("#featuredCarousel")?.addEventListener(
    "mouseleave",
    startCarousel
  );


  $("#filterRow")?.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          "[data-filter]"
        );


      if (button) {
        setFilter(
          button.dataset.filter
        );
      }
    }
  );


  $("#categoryFilterRow")?.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          "[data-filter]"
        );


      if (button) {
        setFilter(
          button.dataset.filter
        );
      }
    }
  );


  $("#searchInput")?.addEventListener(
    "input",
    () => {
      renderArticles();


      window.clearTimeout(
        searchScrollTimer
      );


      const query =
        $("#searchInput")
          ?.value
          .trim();


      if (!query) {
        return;
      }


      searchScrollTimer =
        window.setTimeout(
          () => {
            const resultArea =
              currentPage ===
                "home"

                ? $("#articleCount") ||
                  $("#articleGrid")

                : $("#categoryArticleGrid");


            resultArea?.scrollIntoView(
              {
                behavior:
                  "smooth",

                block:
                  "start"
              }
            );
          },
          600
        );
    }
  );


  document.addEventListener(
    "click",
    event => {
      const pageButton =
        event.target.closest(
          "[data-page]"
        );


      const pageLink =
        event.target.closest(
          "[data-page-link]"
        );


      const target =
        pageButton?.dataset.page ||
        pageLink?.dataset.pageLink;


      if (!target) {
        return;
      }


      event.preventDefault();

      navigate(target);
    }
  );


  $("#menuToggle")?.addEventListener(
    "click",
    () => {
      const nav =
        $("#mainNav");


      if (!nav) {
        return;
      }


      const open =
        nav.classList.toggle(
          "open"
        );


      const button =
        $("#menuToggle");


      button?.setAttribute(
        "aria-expanded",
        String(open)
      );


      if (button) {
        button.innerHTML =
          `<svg
            width="20"
            height="20"
            aria-hidden="true"
          >
            <use href="${
              open
                ? "#i-close"
                : "#i-menu"
            }"></use>
          </svg>`;
      }
    }
  );


  $("#searchBox")?.addEventListener(
    "click",
    event => {
      const box =
        $("#searchBox");


      if (
        window.innerWidth <=
          560 &&
        box &&
        !box.classList.contains(
          "expanded"
        )
      ) {
        event.preventDefault();

        box.classList.add(
          "expanded"
        );

        $("#searchInput")
          ?.focus();
      }
    }
  );


  document.addEventListener(
    "click",
    event => {
      if (
        window.innerWidth >
        560
      ) {
        return;
      }


      const box =
        $("#searchBox");


      if (
        !box ||
        box.contains(
          event.target
        )
      ) {
        return;
      }


      const input =
        $("#searchInput");


      if (
        !input?.value.trim()
      ) {
        box.classList.remove(
          "expanded"
        );
      }
    }
  );


  $("#modalClose")?.addEventListener(
    "click",
    closeArticle
  );


  $("#closeArticleBtn")?.addEventListener(
    "click",
    closeArticle
  );


  $("#articleModal")?.addEventListener(
    "click",
    event => {
      if (
        event.target ===
        $("#articleModal")
      ) {
        closeArticle();
      }
    }
  );


  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key ===
          "Escape" &&
        $("#articleModal")
          ?.classList
          .contains("open")
      ) {
        closeArticle();
      }
    }
  );


  $("#shareArticleBtn")?.addEventListener(
    "click",
    shareCurrentArticle
  );


  $("#footerDisclaimerLink")
    ?.addEventListener(
      "click",
      event => {
        event.preventDefault();


        navigate(
          "about",
          {
            scrollTop:
              false
          }
        );


        requestAnimationFrame(
          () => {
            $("#disclaimer")
              ?.scrollIntoView(
                {
                  behavior:
                    "smooth",

                  block:
                    "start"
                }
              );
          }
        );
      }
    );


  window.addEventListener(
    "scroll",
    () => {
      $("#backTop")
        ?.classList
        .toggle(
          "visible",
          window.scrollY >
            450
        );
    },
    {
      passive: true
    }
  );


  $("#backTop")?.addEventListener(
    "click",
    () => {
      window.scrollTo({
        top: 0,

        behavior:
          "smooth"
      });
    }
  );


  window.addEventListener(
    "popstate",
    () => {
      const hash =
        location.hash
          .replace("#", "");


      if (
        hash.startsWith(
          "article-"
        )
      ) {
        const id =
          decodeURIComponent(
            hash.slice(
              "article-".length
            )
          );


        if (
          articleById(id)
        ) {
          openArticle(id);
        }

        return;
      }


      navigateWithoutHistory(
        hash || "home"
      );
    }
  );
}


/* =========================================================
   35. Newsletter
   ========================================================= */

function initNewsletter() {
  const form =
    $("#newsletterForm");


  if (!form) {
    return;
  }


  form.addEventListener(
    "submit",
    () => {
      const message =
        $("#newsletterMessage");


      if (!message) {
        return;
      }


      message.classList.remove(
        "hidden",
        "error"
      );


      message.classList.add(
        "success"
      );


      message.textContent =
        t(
          "newsletterSuccess"
        );


      /*
       * 不 preventDefault。
       * 保留 Buttondown 表单原本的实际提交行为。
       */
    }
  );
}


/* =========================================================
   36. CMS integration hooks
   ========================================================= */

/*
 * cms-integration.js 的具体内部实现继续使用原文件。
 *
 * 为了兼容 CMS 脚本在写入 articles 后主动刷新首页，
 * 暴露一个简单刷新入口。
 */

window.globalViewRefreshHome =
  function () {
    articles.sort(
      (a, b) =>
        new Date(b.date) -
        new Date(a.date)
    );


    refreshAutoNewsIds();

    renderTicker();

    renderFeatured();

    renderArticles();

    updateCategoryPage();
  };


/*
 * 若外部脚本需要读取中央文章数组，
 * 可以使用该变量。
 */
window.globalViewArticles =
  articles;


/* =========================================================
   37. Detect externally-added articles
   ========================================================= */

/*
 * 现有 cms-integration.js 可能仍直接操作 articles。
 * 为降低耦合，每隔很短时间检查一次文章数量变化。
 *
 * 最多持续 15 秒，之后停止。
 * 这不是长时间轮询。
 */

function watchInitialExternalArticles() {
  let previousLength =
    articles.length;


  let checks = 0;


  const timer =
    window.setInterval(
      () => {
        checks += 1;


        if (
          articles.length !==
          previousLength
        ) {
          previousLength =
            articles.length;


          window
            .globalViewRefreshHome();
        }


        if (
          checks >= 30
        ) {
          window.clearInterval(
            timer
          );


          document
            .documentElement
            .classList
            .remove(
              "cms-loading"
            );
        }
      },
      500
    );
}


/* =========================================================
   38. Initial page
   ========================================================= */

function openInitialRoute() {
  const hash =
    location.hash
      .replace("#", "");


  if (
    hash.startsWith(
      "article-"
    )
  ) {
    const id =
      decodeURIComponent(
        hash.slice(
          "article-".length
        )
      );


    if (
      articleById(id)
    ) {
      navigateWithoutHistory(
        "home"
      );

      openArticle(id);

      return;
    }
  }


  if (
    [
      "home",
      "tech",
      "business",
      "culture",
      "life",
      "about"
    ].includes(hash)
  ) {
    navigateWithoutHistory(
      hash
    );

    return;
  }


  navigateWithoutHistory(
    "home"
  );
}


/* =========================================================
   39. Initialisation
   ========================================================= */

async function init() {
  /*
   * 1. 立即完成不依赖网络的界面。
   */
  initTheme();

  bindEvents();

  initCarouselSwipe();

  initNewsletter();


  /*
   * 2. 恢复语言偏好。
   */
  let savedLang = "zh";


  try {
    savedLang =
      localStorage.getItem(
        "gp-lang"
      ) ||
      "zh";
  } catch (_) {}


  if (
    !translations[savedLang]
  ) {
    savedLang = "zh";
  }


  currentLang =
    savedLang;


  /*
   * 3. 首先更新静态文案。
   */
  setLanguage(
    savedLang
  );


  openInitialRoute();


  /*
   * 4. 图片设置允许浏览器缓存。
   *    不阻塞整个页面。
   */
  loadGlobalViewFallbackImages()
    .catch(
      () => {}
    );


  /*
   * 5. 自动新闻异步加载。
   *
   * 让浏览器先完成一次首屏绘制，
   * 再进入 JSON 请求及列表渲染。
   */
  window.setTimeout(
    () => {
      loadAutoNews()
        .catch(
          error => {
            console.error(
              "自动新闻初始化失败：",
              error
            );
          }
        );
    },
    0
  );


  /*
   * 6. 观察 CMS 初始写入。
   */
  watchInitialExternalArticles();
}


/* =========================================================
   40. Start
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      init().catch(
        error => {
          console.error(
            "Homepage V2 初始化失败：",
            error
          );


          document
            .documentElement
            .classList
            .remove(
              "cms-loading"
            );
        }
      );
    },
    {
      once: true
    }
  );
} else {
  init().catch(
    error => {
      console.error(
        "Homepage V2 初始化失败：",
        error
      );


      document
        .documentElement
        .classList
        .remove(
          "cms-loading"
        );
    }
  );
}


/* =========================================================
   END OF /home-v2.js
   ========================================================= */
