"use strict";

document.documentElement.classList.add("cms-loading");

var articles = [];
var currentLang = "zh";
var currentPage = "home";
var currentSlide = 0;
var activeFilter = "all";
var carouselTimer = null;
var searchTimer = null;
var fallbackImages = { tech: "", business: "", culture: "", life: "" };
var featuredIds = [];
var tickerIds = [];

var $ = function (selector, root) {
  return (root || document).querySelector(selector);
};

var $$ = function (selector, root) {
  return Array.from((root || document).querySelectorAll(selector));
};

var translations = {
  zh: {
    brandCn: "观澜泗渡",
    navHome: "首页",
    navAbout: "关于",
    catTech: "科技",
    catBusiness: "商业",
    catCulture: "文化",
    catLife: "生活",
    latestArticles: "最新资讯",
    latestNews: "最新动态",
    prPortfolio: "PR作品",
    prFilterCompany: "公司新闻",
    prFilterIndustry: "行业新闻",
    searchPlaceholder: "搜索感兴趣的内容...",
    eyebrow: "全球视野 · 双语阅读",
    homeTitle: "连接世界，发现更多可能",
    homeSubtitle: "从科技创新到文化生活，读懂正在发生的变化。",
    filterAll: "全部",
    trendingTitle: "我的专栏",
    viewMoreArticles: "查看更多文章 →",
    worksTitle: "我的作品",
    worksEmpty: "暂无作品",
    newsletterIntro: "订阅观澜泗渡，获取双语资讯与编辑精选。",
    emailPlaceholder: "请输入您的邮箱地址",
    subscribe: "订阅",
    promoTitle: "观澜泗渡<br>以双语视角探索科技、商业与文化的交汇。",
    learnMore: "了解我们",
    noResults: "没有找到匹配的文章，试试其他关键词。",
    categoryEyebrow: "主题探索",
    aboutEyebrow: "关于我们",
    aboutTitle: "让信息跨越语言，让观点连接世界",
    aboutIntro: "观澜泗渡是一个聚焦科技、商业、文化与生活的双语资讯与观点分享平台。",
    aboutMissionTitle: "我们的定位",
    aboutMission: "我们希望通过清晰的内容结构，帮助读者发现值得关注的趋势、行业变化与文化故事。",
    aboutContentTitle: "内容与来源",
    aboutContent: "平台内容包括编辑整理、观点分享及依法获得授权或符合适用规则的转载内容。",
    aboutStandardsTitle: "编辑原则",
    aboutStandard1: "明确区分事实信息、分析观点与示例内容。",
    aboutStandard2: "对转载内容标注来源，尽可能保留原文语境与出处。",
    aboutStandard3: "发现错误时及时核查、更新或更正。",
    aboutStandard4: "尊重知识产权、隐私权与相关法律法规。",
    aboutContactTitle: "联系我们",
    contactText: "内容合作、版权及反馈：",
    disclaimerTitle: "免责声明",
    disclaimer: "本站为信息聚合、双语阅读与观点分享平台，非新闻采编机构。内容仅供参考，不构成投资、医疗、法律或其他专业建议。",
    footerDescription: "以双语视角连接全球资讯，让值得关注的想法跨越边界。",
    footerExplore: "探索内容",
    footerConnect: "关于与联系",
    footerContact: "联系我们",
    footerDisclaimer: "免责声明",
    footerDisclaimerShort: "本站为信息聚合与观点分享平台，非新闻采编机构。",
    rights: "保留所有权利。",
    sourceLabel: "来源",
    articlesCount: "篇文章",

    categoryDescriptions: {
      tech: "关注人工智能、数字技术、科学研究与创新。",
      business: "探索商业趋势、企业战略、市场变化与可持续增长。",
      culture: "发现艺术、设计、博物馆与跨文化交流。",
      life: "关注健康、城市、教育与日常生活趋势。"
    }
  },

  en: {
    brandCn: "观澜泗渡",
    navHome: "Home",
    navAbout: "About",
    catTech: "Technology",
    catBusiness: "Business",
    catCulture: "Culture",
    catLife: "Life",
    latestArticles: "Latest Articles",
    latestNews: "Latest",
    prPortfolio: "PR Portfolio",
    prFilterCompany: "Company News",
    prFilterIndustry: "Industry News",
    searchPlaceholder: "Search articles...",
    eyebrow: "Global perspectives · Bilingual reading",
    homeTitle: "Connect the world. Discover more.",
    homeSubtitle: "Explore the changes shaping technology, business, culture and life.",
    filterAll: "All",
    trendingTitle: "My Column",
    viewMoreArticles: "View More Articles →",
    worksTitle: "My Works",
    worksEmpty: "No works available yet",
    newsletterIntro: "Get bilingual insights and selected stories from Global View.",
    emailPlaceholder: "Enter your email address",
    subscribe: "Subscribe",
    promoTitle: "Global View<br>Explore technology, business and culture through a bilingual lens.",
    learnMore: "About us",
    noResults: "No matching articles. Try another keyword.",
    categoryEyebrow: "Topic Explorer",
    aboutEyebrow: "About Us",
    aboutTitle: "Ideas across languages. Perspectives across borders.",
    aboutIntro: "Global View is a bilingual information and perspectives platform.",
    aboutMissionTitle: "Our Mission",
    aboutMission: "We help readers discover noteworthy trends, industry developments and cultural stories.",
    aboutContentTitle: "Content & Sources",
    aboutContent: "Content includes editorial summaries, commentary and appropriately attributed material.",
    aboutStandardsTitle: "Editorial Principles",
    aboutStandard1: "Distinguish factual information, analysis and commentary.",
    aboutStandard2: "Attribute reproduced material and preserve its context.",
    aboutStandard3: "Review and correct errors when identified.",
    aboutStandard4: "Respect intellectual property, privacy and applicable laws.",
    aboutContactTitle: "Contact Us",
    contactText: "Editorial partnerships, copyright and feedback:",
    disclaimerTitle: "Disclaimer",
    disclaimer: "This is an information aggregation and perspectives platform, not a news-gathering organization. Content does not constitute professional advice.",
    footerDescription: "Connecting global information and ideas through a bilingual perspective.",
    footerExplore: "Explore",
    footerConnect: "About & Contact",
    footerContact: "Contact Us",
    footerDisclaimer: "Disclaimer",
    footerDisclaimerShort: "An information aggregation and perspectives platform.",
    rights: "All rights reserved.",
    sourceLabel: "Source",
    articlesCount: "articles",

    categoryDescriptions: {
      tech: "Technology, AI, science and innovation.",
      business: "Business trends, corporate strategy and markets.",
      culture: "Art, design, museums and cross-cultural exchange.",
      life: "Health, cities, education and everyday life."
    }
  }
};

var t = function (key) {
  return translations[currentLang][key] !== undefined
    ? translations[currentLang][key]
    : translations.zh[key] !== undefined
      ? translations.zh[key]
      : key;
};

var articleById = function (id) {
  return articles.find(function (article) {
    return article.id === id;
  });
};

var categoryName = function (category) {
  return t({
    tech: "catTech",
    business: "catBusiness",
    culture: "catCulture",
    life: "catLife"
  }[category] || "catTech");
};

var readTimeText = function (minutes) {
  var value = Number(minutes) || 1;

  return currentLang === "zh"
    ? value + " 分钟阅读"
    : value + " min read";
};

function localized(value) {
  if (value && typeof value === "object") {
    return value[currentLang] || value.zh || value.en || "";
  }

  return String(value || "");
}

function formatDate(value) {
  if (!value) return "";

  var date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    currentLang === "zh" ? "zh-CN" : "en-US",
    {
      year: "numeric",
      month: currentLang === "zh" ? "long" : "short",
      day: "numeric"
    }
  ).format(date);
}

function autoLanguage(article) {
  if (!String(article && article.id || "").startsWith("auto-")) {
    return null;
  }

  var lang = String(article.language || article.lang || "").toLowerCase();

  if (lang.startsWith("zh")) return "zh";
  if (lang.startsWith("en")) return "en";

  return /[\u3400-\u9fff]/.test(localized(article.title))
    ? "zh"
    : "en";
}

async function loadFallbackImages() {
  try {
    var response = await fetch(
      "/content/site-settings.json",
      { cache: "force-cache" }
    );

    if (!response.ok) return;

    var data = await response.json();

    fallbackImages = {
      tech: data.tech || "",
      business: data.business || "",
      culture: data.culture || "",
      life: data.life || ""
    };
  } catch (error) {
    console.warn("V3 fallback images unavailable:", error);
  }
}

window.globalViewSetArticleImage = function (
  image,
  article,
  options
) {
  if (!image || !article) return;

  options = options || {};

  image.decoding = "async";
  image.loading = options.priority ? "eager" : "lazy";

  try {
    image.fetchPriority = options.priority ? "high" : "low";
  } catch (_) {}

  image.src =
    article.origin === "cms" && article.image
      ? article.image
      : fallbackImages[article.category] || article.image || "";

  if (!image.src) {
    image.style.visibility = "hidden";
  }
};

function refreshIds() {
  var visible = articles
    .filter(function (article) {
      return autoLanguage(article) === currentLang;
    })
    .sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });

  var selected = [];

  ["tech", "business", "culture", "life"].forEach(
    function (category) {
      var match = visible.find(function (article) {
        return article.category === category;
      });

      if (match) {
        selected.push(match.id);
      }
    }
  );

  visible.forEach(function (article) {
    if (
      selected.length < 4 &&
      !selected.includes(article.id)
    ) {
      selected.push(article.id);
    }
  });

  featuredIds.splice(
    0,
    featuredIds.length,
    ...selected.slice(0, 4)
  );

  tickerIds.splice(
    0,
    tickerIds.length,
    ...visible
      .slice(0, 8)
      .map(function (article) {
        return article.id;
      })
  );

  currentSlide = 0;
}

var renderFeatured = function () {
  var track = $("#featuredTrack");
  var dots = $("#carouselDots");

  if (!track || !dots) return;

  track.replaceChildren();
  dots.replaceChildren();

  featuredIds.forEach(function (id, index) {
    var article = articleById(id);

    if (!article) return;

    var slide = document.createElement("article");

    slide.className = "featured-slide";
    slide.tabIndex = 0;

    slide.addEventListener("click", function () {
      openArticle(id);
    });

    slide.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openArticle(id);
      }
    });

    var image = document.createElement("img");

    image.className = "featured-image";
    image.alt =
      localized(article.alt) ||
      localized(article.title);

    window.globalViewSetArticleImage(
      image,
      article,
      { priority: index === 0 }
    );

    var content = document.createElement("div");
    content.className = "featured-content";

    var tag = document.createElement("span");
    tag.className = "category-tag";
    tag.textContent = categoryName(article.category);

    var title = document.createElement("h2");
    title.textContent = localized(article.title);

    var excerpt = document.createElement("p");
    excerpt.textContent = localized(article.excerpt);

    var meta = document.createElement("div");
    meta.className = "featured-meta";

    meta.textContent =
      formatDate(article.date) +
      " | " +
      readTimeText(article.read) +
      " | " +
      t("sourceLabel") +
      ": " +
      (article.source || "");

    content.append(
      tag,
      title,
      excerpt,
      meta
    );

    slide.append(
      image,
      content
    );

    track.appendChild(slide);

    var dot = document.createElement("button");

    dot.type = "button";
    dot.className =
      "carousel-dot" +
      (index === 0 ? " active" : "");

    dot.setAttribute(
      "aria-label",
      "Slide " + (index + 1)
    );

    dot.addEventListener("click", function (event) {
      event.stopPropagation();
      goToSlide(index);
    });

    dots.appendChild(dot);
  });

  updateCarouselPosition();
  startCarousel();
};

var renderTicker = function () {
  var container = $("#tickerContent");

  if (!container) return;

  container.replaceChildren();

  var entries = tickerIds
    .map(articleById)
    .filter(Boolean);

  entries
    .concat(entries)
    .forEach(function (article, index) {
      var button = document.createElement("button");

      button.type = "button";
      button.className = "ticker-item";
      button.textContent = localized(article.title);

      button.addEventListener("click", function () {
        openArticle(article.id);
      });

      if (index >= entries.length) {
        button.tabIndex = -1;
        button.setAttribute("aria-hidden", "true");
      }

      container.appendChild(button);
    });
};

function createCard(article) {
  var card = document.createElement("article");

  card.className = "article-card";
  card.tabIndex = 0;

  card.addEventListener("click", function () {
    openArticle(article.id);
  });

  card.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openArticle(article.id);
    }
  });

  var imageWrap = document.createElement("div");
  imageWrap.className = "card-image-wrap";

  var image = document.createElement("img");

  image.className = "card-image";
  image.alt =
    localized(article.alt) ||
    localized(article.title);

  window.globalViewSetArticleImage(
    image,
    article
  );

  imageWrap.appendChild(image);

  var body = document.createElement("div");
  body.className = "card-body";

  var tag = document.createElement("span");

  tag.className = "category-tag";
  tag.textContent = categoryName(article.category);

  var title = document.createElement("h3");

  title.className = "card-title";
  title.textContent = localized(article.title);

  var excerpt = document.createElement("p");

  excerpt.className = "card-excerpt";
  excerpt.textContent = localized(article.excerpt);

  var meta = document.createElement("div");
  meta.className = "card-meta";

  var source = document.createElement("span");

  source.textContent =
    t("sourceLabel") +
    ": " +
    (article.source || "");

  var time = document.createElement("span");
  time.textContent = readTimeText(article.read);

  meta.append(source, time);

  body.append(
    tag,
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

function filteredArticles() {
  var searchInput = $("#searchInput");

  var query = String(
    searchInput ? searchInput.value : ""
  )
    .trim()
    .toLowerCase();

  var list = articles
    .filter(function (article) {
      if (
        article.cms === true &&
        !query
      ) {
        return false;
      }

      var language = autoLanguage(article);

      if (
        language &&
        language !== currentLang
      ) {
        return false;
      }

      if (
        activeFilter !== "all" &&
        article.category !== activeFilter
      ) {
        return false;
      }

      var text = [
        article.title && article.title.zh,
        article.title && article.title.en,
        article.excerpt && article.excerpt.zh,
        article.excerpt && article.excerpt.en,
        (article.tags || []).join(" ")
      ]
        .join(" ")
        .toLowerCase();

      return !query || text.includes(query);
    })
    .sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });

  if (
    currentPage === "home" &&
    activeFilter === "all" &&
    !query
  ) {
    var seen = new Set();

    return list.filter(function (article) {
      if (seen.has(article.category)) {
        return false;
      }

      seen.add(article.category);
      return true;
    });
  }

  return list;
}

function renderGrid(grid, empty, list) {
  if (!grid) return;

  grid.replaceChildren();

  list.forEach(function (article) {
    grid.appendChild(
      createCard(article)
    );
  });

  if (empty) {
    empty.classList.toggle(
      "hidden",
      list.length > 0
    );
  }
}

var renderArticles = function () {
  var list = filteredArticles();

  renderGrid(
    $("#articleGrid"),
    $("#emptyState"),
    list
  );

  var count = $("#articleCount");

  if (count) {
    count.textContent =
      list.length +
      " " +
      t("articlesCount");
  }

  if (
    ["tech", "business", "culture", "life"]
      .includes(currentPage)
  ) {
    renderCategoryGrid();
  }
};

var renderCategoryGrid = function () {
  renderGrid(
    $("#categoryArticleGrid"),
    $("#categoryEmptyState"),
    filteredArticles()
  );
};

var renderTrending = function () {};

var updateCarouselPosition = function () {
  var track = $("#featuredTrack");

  if (!track) return;

  var count = track.children.length;

  if (!count) {
    currentSlide = 0;
    track.style.transform = "translateX(0)";
    return;
  }

  currentSlide =
    ((currentSlide % count) + count) % count;

  track.style.transform =
    "translateX(-" +
    currentSlide * 100 +
    "%)";

  $$(".carousel-dot").forEach(
    function (dot, index) {
      dot.classList.toggle(
        "active",
        index === currentSlide
      );
    }
  );
};

function goToSlide(index) {
  currentSlide = index;
  updateCarouselPosition();
  startCarousel();
}

function nextSlide() {
  currentSlide += 1;
  updateCarouselPosition();
}

function stopCarousel() {
  if (carouselTimer) {
    clearInterval(carouselTimer);
    carouselTimer = null;
  }
}

var startCarousel = function () {
  stopCarousel();

  var track = $("#featuredTrack");

  if (
    track &&
    track.children.length > 1
  ) {
    carouselTimer = setInterval(
      nextSlide,
      6000
    );
  }
};

function updateCategoryPage() {
  if (
    !["tech", "business", "culture", "life"]
      .includes(currentPage)
  ) {
    return;
  }

  var title = $("#categoryPageTitle");
  var description = $("#categoryPageDesc");

  if (title) {
    title.textContent =
      categoryName(currentPage);
  }

  if (description) {
    description.textContent =
      t("categoryDescriptions")[currentPage] || "";
  }

  renderCategoryGrid();
}

function syncFilters() {
  $$(".filter-btn").forEach(
    function (button) {
      var selected =
        button.dataset.filter === activeFilter;

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
}

function redraw() {
  refreshIds();
  renderTicker();
  renderFeatured();
  renderArticles();
  renderTrending();
  updateCategoryPage();
}

function setLanguage(language, redrawPage) {
  if (!translations[language]) return;

  currentLang = language;

  document.documentElement.lang =
    language === "zh"
      ? "zh-CN"
      : "en";

  $$("[data-i18n]").forEach(
    function (element) {
      var key = element.dataset.i18n;

      if (
        translations[language][key] ===
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

  $$("[data-i18n-placeholder]").forEach(
    function (element) {
      element.placeholder =
        t(element.dataset.i18nPlaceholder);
    }
  );

  $$("[data-lang]").forEach(
    function (button) {
      var selected =
        button.dataset.lang === language;

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

  try {
    localStorage.setItem(
      "gp-lang",
      language
    );
  } catch (_) {}

  if (redrawPage !== false) {
    redraw();
  }
}

function setFilter(filter, redrawPage) {
  activeFilter = filter;

  syncFilters();

  if (redrawPage !== false) {
    renderArticles();
  }
}

function navigate(page, addHistory) {
  var valid = [
    "home",
    "tech",
    "business",
    "culture",
    "life",
    "about"
  ];

  if (!valid.includes(page)) {
    page = "home";
  }

  currentPage = page;

  activeFilter =
    ["tech", "business", "culture", "life"]
      .includes(page)
      ? page
      : "all";

  if ($("#homePage")) {
    $("#homePage").classList.toggle(
      "hidden",
      page !== "home"
    );
  }

  if ($("#categoryPage")) {
    $("#categoryPage").classList.toggle(
      "hidden",
      !["tech", "business", "culture", "life"]
        .includes(page)
    );
  }

  if ($("#aboutPage")) {
    $("#aboutPage").classList.toggle(
      "hidden",
      page !== "about"
    );
  }

  $$(".nav-link").forEach(
    function (button) {
      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    }
  );

  if ($("#mainNav")) {
    $("#mainNav").classList.remove("open");
  }

  if ($("#menuToggle")) {
    $("#menuToggle").setAttribute(
      "aria-expanded",
      "false"
    );
  }

  syncFilters();
  renderArticles();
  updateCategoryPage();

  if (
    addHistory !== false &&
    location.hash !== "#" + page
  ) {
    history.pushState(
      { page: page },
      "",
      "#" + page
    );
  }

  window.scrollTo({
    top: 0,
    behavior:
      addHistory === false
        ? "auto"
        : "smooth"
  });
}

var openArticle = function (id) {
  var article = articleById(id);

  if (
    article &&
    article.externalUrl
  ) {
    window.open(
      article.externalUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }
};

function classify(item) {
  var text = (
    String(item.title || "") +
    " " +
    String(item.excerpt || "")
  ).toLowerCase();

  if (
    /文化|艺术|博物馆|电影|音乐|文学|culture|museum|film|music|art/
      .test(text)
  ) {
    return "culture";
  }

  if (
    /商业|财经|投资|融资|股市|公司|并购|business|finance|market|company|investment/
      .test(text)
  ) {
    return "business";
  }

  if (
    /健康|生活|教育|旅游|城市|气候|health|life|education|travel|city|climate/
      .test(text)
  ) {
    return "life";
  }

  return "tech";
}

function makeAutoArticle(item, index) {
  if (
    !item ||
    !item.title ||
    !item.source_url
  ) {
    return null;
  }

  var title =
    String(item.title).trim();

  var excerpt =
    String(item.excerpt || "").trim();

  var rawDate =
    new Date(item.date);

  return {
    id:
      "auto-" +
      index +
      "-" +
      String(item.id || index)
        .replace(
          /[^a-zA-Z0-9_-]/g,
          "-"
        ),

    category: classify(item),

    language:
      String(item.language || "")
        .toLowerCase(),

    title: {
      zh: title,
      en: title
    },

    excerpt: {
      zh: excerpt || title,
      en: excerpt || title
    },

    alt: {
      zh: title,
      en: title
    },

    read: 1,

    date:
      Number.isNaN(rawDate.getTime())
        ? new Date()
            .toISOString()
            .slice(0, 10)
        : rawDate
            .toISOString()
            .slice(0, 10),

    source:
      String(
        item.source_name ||
        "News source"
      ),

    externalUrl:
      String(item.source_url),

    image:
      item.image || "",

    tags: [
      "Auto News"
    ]
  };
}

async function loadAutoNews() {
  try {
    var response = await fetch(
      "/auto-news.json",
      { cache: "default" }
    );

    if (!response.ok) {
      throw new Error(
        "HTTP " + response.status
      );
    }

    var data =
      await response.json();

    if (!Array.isArray(data.items)) {
      throw new Error(
        "Invalid auto-news data"
      );
    }

    for (
      var i = articles.length - 1;
      i >= 0;
      i -= 1
    ) {
      if (
        String(
          articles[i].id || ""
        ).startsWith("auto-")
      ) {
        articles.splice(i, 1);
      }
    }

    articles.push(
      ...data.items
        .map(makeAutoArticle)
        .filter(Boolean)
    );

    articles.sort(function (a, b) {
      return new Date(b.date) -
        new Date(a.date);
    });

    redraw();

    console.info(
      "V3 automatic news loaded:",
      data.items.length
    );
  } catch (error) {
    console.error(
      "V3 automatic news failed:",
      error
    );
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme =
    theme;

  var button = $("#themeToggle");

  if (!button) return;

  button.innerHTML =
    '<svg width="17" height="17" aria-hidden="true">' +
    '<use href="' +
    (
      theme === "dark"
        ? "#i-sun"
        : "#i-moon"
    ) +
    '"></use></svg>';
}

function bindSwipe() {
  var carousel =
    $("#featuredCarousel");

  if (!carousel) return;

  var startX = 0;
  var startY = 0;

  carousel.style.touchAction =
    "pan-y";

  carousel.addEventListener(
    "pointerdown",
    function (event) {
      startX = event.clientX;
      startY = event.clientY;

      stopCarousel();
    }
  );

  carousel.addEventListener(
    "pointerup",
    function (event) {
      var dx =
        event.clientX - startX;

      var dy =
        event.clientY - startY;

      if (
        Math.abs(dx) >= 45 &&
        Math.abs(dx) > Math.abs(dy)
      ) {
        goToSlide(
          currentSlide +
          (dx < 0 ? 1 : -1)
        );
      } else {
        startCarousel();
      }
    }
  );
}

function bindEvents() {
  if ($("#themeToggle")) {
    $("#themeToggle").addEventListener(
      "click",
      function () {
        var next =
          document.documentElement
            .dataset.theme === "dark"
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
  }

  $$("[data-lang]").forEach(
    function (button) {
      button.addEventListener(
        "click",
        function () {
          setLanguage(
            button.dataset.lang
          );
        }
      );
    }
  );

  if ($("#carouselPrev")) {
    $("#carouselPrev").addEventListener(
      "click",
      function () {
        goToSlide(
          currentSlide - 1
        );
      }
    );
  }

  if ($("#carouselNext")) {
    $("#carouselNext").addEventListener(
      "click",
      function () {
        goToSlide(
          currentSlide + 1
        );
      }
    );
  }

  [
    $("#filterRow"),
    $("#categoryFilterRow")
  ].forEach(function (row) {
    if (!row) return;

    row.addEventListener(
      "click",
      function (event) {
        var button =
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
  });

  if ($("#searchInput")) {
    $("#searchInput").addEventListener(
      "input",
      function () {
        renderArticles();

        clearTimeout(searchTimer);

        if (!this.value.trim()) return;

        searchTimer = setTimeout(
          function () {
            var target =
              currentPage === "home"
                ? $("#articleGrid")
                : $("#categoryArticleGrid");

            if (target) {
              target.scrollIntoView({
                behavior: "smooth",
                block: "start"
              });
            }
          },
          400
        );
      }
    );
  }

  document.addEventListener(
    "click",
    function (event) {
      var pageButton =
        event.target.closest(
          "[data-page]"
        );

      var pageLink =
        event.target.closest(
          "[data-page-link]"
        );

      var page =
        pageButton
          ? pageButton.dataset.page
          : pageLink
            ? pageLink.dataset.pageLink
            : "";

      if (page) {
        event.preventDefault();
        navigate(page, true);
      }

      var box = $("#searchBox");
      var input = $("#searchInput");

      if (
        window.innerWidth <= 560 &&
        box &&
        input &&
        !box.contains(event.target) &&
        !input.value.trim()
      ) {
        box.classList.remove(
          "expanded"
        );
      }
    }
  );

  if ($("#menuToggle")) {
    $("#menuToggle").addEventListener(
      "click",
      function () {
        var nav = $("#mainNav");

        var open =
          nav &&
          nav.classList.toggle(
            "open"
          );

        this.setAttribute(
          "aria-expanded",
          String(Boolean(open))
        );
      }
    );
  }

  if ($("#searchBox")) {
    $("#searchBox").addEventListener(
      "click",
      function (event) {
        if (
          window.innerWidth <= 560 &&
          !this.classList.contains(
            "expanded"
          )
        ) {
          event.preventDefault();

          this.classList.add(
            "expanded"
          );

          if ($("#searchInput")) {
            $("#searchInput").focus();
          }
        }
      }
    );
  }

  window.addEventListener(
    "scroll",
    function () {
      var button = $("#backTop");

      if (button) {
        button.classList.toggle(
          "visible",
          window.scrollY > 400
        );
      }
    },
    { passive: true }
  );

  if ($("#backTop")) {
    $("#backTop").addEventListener(
      "click",
      function () {
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      }
    );
  }

  window.addEventListener(
    "popstate",
    function () {
      navigate(
        location.hash.slice(1) ||
        "home",
        false
      );
    }
  );

  bindSwipe();
}

function init() {
  var savedTheme = "light";
  var savedLanguage = "zh";

  try {
    savedTheme =
      localStorage.getItem(
        "gp-theme"
      ) ||
      (
        matchMedia(
          "(prefers-color-scheme:dark)"
        ).matches
          ? "dark"
          : "light"
      );

    savedLanguage =
      localStorage.getItem(
        "gp-lang"
      ) ||
      "zh";
  } catch (_) {}

  applyTheme(savedTheme);
  bindEvents();

  setLanguage(
    translations[savedLanguage]
      ? savedLanguage
      : "zh",
    false
  );

  navigate(
    location.hash.slice(1) ||
    "home",
    false
  );

  loadFallbackImages()
    .then(function () {
      loadAutoNews();
    });

  var date = $("#todayDate");

  if (date) {
    date.textContent =
      new Intl.DateTimeFormat(
        currentLang === "zh"
          ? "zh-CN"
          : "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric"
        }
      ).format(new Date());
  }

  var year = $("#copyrightYear");

  if (year) {
    year.textContent =
      String(
        new Date().getFullYear()
      );
  }

  setTimeout(function () {
    document.documentElement
      .classList
      .remove("cms-loading");
  }, 12000);
}

window.GlobalViewHome = {
  articles: articles,
  refresh: redraw
};

if (
  document.readyState === "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    init,
    { once: true }
  );
} else {
  init();
}
