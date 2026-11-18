(function () {
  "use strict";

  var W = window;
  var D = document;

  var state = {
    lang: "zh",
    theme: "light",
    posts: [],
    works: [],
    pr: [],
    news: [],
    slide: 0,
    timer: null,
    query: ""
  };

  var ENDPOINTS = {
    posts: "/api/posts",
    works: "/api/works",
    pr: "/api/pr-portfolio",
    news: "/auto-news.json",
    settings: "/content/site-settings.json"
  };

  var I18N = {
    zh: {
      skip: "跳到主要内容",
      more: "更多",
      explore: "全部栏目",
      openSearch: "打开搜索",
      searchLabel: "搜索",
      searchPlaceholder: "搜索文章、作品与新闻",
      close: "关闭",
      brandEyebrow: "GLOBAL PERSPECTIVE",
      readColumns: "浏览专栏",
      viewLatest: "查看最新内容",
      bannerPanel: "观点 · 语境 · 影响",
      featuredColumnEyebrow: "FEATURED COLUMN",
      featuredColumn: "专栏文章",
      prTitle: "企业传播",
      prDescription: "企业新闻、传播项目与公关案例。",
      viewAllPr: "查看全部企业传播 →",
      industryTitle: "行业视角",
      industryDescription: "行业趋势、专业观察与深度文章。",
      viewAllIndustry: "查看全部行业视角 →",
      mediaTitle: "媒体作品",
      mediaDescription: "代表性媒体内容、报道与公开作品。",
      viewAllMedia: "查看全部媒体作品 →",
      liveTitle: "新闻速览",
      liveDescription: "科技、商业、文化与生活资讯即时更新。",
      technology: "科技",
      business: "商业",
      culture: "文化",
      life: "生活",
      newsletterTitle: "订阅更新",
      newsletterDescription: "定期获取最新专栏、行业观察与作品更新。",
      emailLabel: "电子邮箱",
      emailPlaceholder: "you@example.com",
      subscribe: "订阅",
      aboutTitle: "关于我们",
      loading: "正在载入…",
      empty: "暂无内容",
      error: "内容暂时无法载入",
      noResults: "没有匹配结果",
      success: "订阅成功，感谢关注。",
      invalidEmail: "请输入有效的电子邮箱。",
      subscribeError: "提交失败，请稍后重试。"
    },

    en: {
      skip: "Skip to content",
      more: "More",
      explore: "Explore",
      openSearch: "Open search",
      searchLabel: "Search",
      searchPlaceholder: "Search columns, projects and news",
      close: "Close",
      brandEyebrow: "GLOBAL PERSPECTIVE",
      readColumns: "Explore Columns",
      viewLatest: "View Latest",
      bannerPanel: "Ideas · Context · Impact",
      featuredColumnEyebrow: "FEATURED COLUMN",
      featuredColumn: "Columns",
      prTitle: "PR Portfolio",
      prDescription: "Corporate communications, PR projects and case studies.",
      viewAllPr: "View the PR Portfolio →",
      industryTitle: "Industry Insights",
      industryDescription:
        "Industry trends, professional analysis and in-depth perspectives.",
      viewAllIndustry: "Explore Industry Insights →",
      mediaTitle: "Media Features",
      mediaDescription:
        "Selected media coverage, published pieces and featured work.",
      viewAllMedia: "View All Media Features →",
      liveTitle: "Live News",
      liveDescription:
        "Live updates across Technology, Business, Culture and Lifestyle.",
      technology: "Technology",
      business: "Business",
      culture: "Culture",
      life: "Lifestyle",
      newsletterTitle: "Newsletter",
      newsletterDescription:
        "Receive the latest columns, industry insights and portfolio updates.",
      emailLabel: "Email address",
      emailPlaceholder: "you@example.com",
      subscribe: "Subscribe",
      aboutTitle: "About",
      loading: "Loading…",
      empty: "No content available",
      error: "Content is temporarily unavailable",
      noResults: "No matching results",
      success: "You’re subscribed. Thank you.",
      invalidEmail: "Please enter a valid email address.",
      subscribeError: "Unable to subscribe right now. Please try again."
    }
  };

  var NAV = [
    {
      id: "pr-portfolio",
      zh: "企业传播",
      en: "PR Portfolio"
    },
    {
      id: "industry-perspective",
      zh: "行业视角",
      en: "Industry Insights"
    },
    {
      id: "media-features",
      zh: "媒体作品",
      en: "Media Features"
    },
    {
      id: "live-news",
      zh: "新闻速览",
      en: "Live News"
    },
    {
      id: "about",
      zh: "关于我们",
      en: "About"
    }
  ];

  function $(selector, root) {
    return (root || D).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call(
      (root || D).querySelectorAll(selector)
    );
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      function (character) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "\"": "&quot;",
          "'": "&#39;"
        }[character];
      }
    );
  }

  function pick(object, keys, fallback) {
    var index;

    for (index = 0; index < keys.length; index += 1) {
      if (
        object &&
        object[keys[index]] != null &&
        object[keys[index]] !== ""
      ) {
        return object[keys[index]];
      }
    }

    return fallback || "";
  }

  function arrayFrom(value) {
    if (Array.isArray(value)) {
      return value;
    }

    if (value && Array.isArray(value.data)) {
      return value.data;
    }

    if (value && Array.isArray(value.items)) {
      return value.items;
    }

    if (value && Array.isArray(value.results)) {
      return value.results;
    }

    if (value && Array.isArray(value.posts)) {
      return value.posts;
    }

    if (value && Array.isArray(value.works)) {
      return value.works;
    }

    if (value && Array.isArray(value.articles)) {
      return value.articles;
    }

    return [];
  }

  function safeUrl(value, fallback) {
    try {
      var parsed = new URL(
        value || fallback || "#",
        location.href
      );

      return /^(https?:)$/.test(parsed.protocol)
        ? parsed.href
        : "#";
    } catch (error) {
      return fallback || "#";
    }
  }

  function formatDate(value) {
    var parsed = new Date(value || 0);

    if (isNaN(parsed.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat(
      state.lang === "en" ? "en-US" : "zh-CN",
      {
        year: "numeric",
        month: "short",
        day: "2-digit"
      }
    ).format(parsed);
  }

  function slug(value) {
    return encodeURIComponent(String(value || ""));
  }

  function imageOf(object) {
    return pick(
      object,
      [
        "image",
        "cover",
        "coverImage",
        "coverUrl",
        "thumbnail",
        "thumb",
        "featuredImage",
        "ogImage"
      ],
      ""
    );
  }

  function titleOf(object) {
    return pick(
      object,
      state.lang === "en"
        ? ["titleEn", "title_en", "englishTitle", "title"]
        : ["title", "titleZh", "title_zh", "chineseTitle"],
      ""
    );
  }

  function excerptOf(object) {
    return pick(
      object,
      state.lang === "en"
        ? [
            "excerptEn",
            "summaryEn",
            "descriptionEn",
            "excerpt",
            "summary",
            "description"
          ]
        : [
            "excerpt",
            "summary",
            "description",
            "excerptZh",
            "summaryZh"
          ],
      ""
    );
  }

  function dateOf(object) {
    return pick(
      object,
      [
        "date",
        "publishedAt",
        "publishDate",
        "pubDate",
        "createdAt",
        "updatedAt"
      ],
      ""
    );
  }

  function linkOf(object, type) {
    var direct = pick(
      object,
      [
        "url",
        "link",
        "href",
        "permalink",
        "externalUrl",
        "sourceUrl"
      ],
      ""
    );

    if (direct) {
      return safeUrl(direct);
    }

    var identifier = pick(
      object,
      ["slug", "id", "_id"],
      ""
    );

    if (type === "post") {
      return "column.html?slug=" + slug(identifier);
    }

    if (type === "work") {
      return "works.html?slug=" + slug(identifier);
    }

    if (type === "pr") {
      return "pr-portfolio-list.html?slug=" + slug(identifier);
    }

    return "#";
  }

  function t(key) {
    return (
      I18N[state.lang] &&
      I18N[state.lang][key]
    ) || key;
  }

  function setStatus(selector, key) {
    var node = $(selector);

    if (node) {
      node.textContent = key ? t(key) : "";
    }
  }

  function fetchJSON(path) {
    return fetch(path, {
      cache: "no-store",
      credentials: "same-origin"
    }).then(function (response) {
      if (!response.ok) {
        throw new Error(path + " " + response.status);
      }

      return response.json();
    });
  }

  function applyI18n() {
    D.documentElement.lang =
      state.lang === "en" ? "en" : "zh-CN";

    D.body.classList.toggle(
      "language-en",
      state.lang === "en"
    );

    $$("[data-i18n]").forEach(function (node) {
      node.textContent = t(
        node.getAttribute("data-i18n")
      );
    });

    $$("[data-i18n-placeholder]").forEach(function (node) {
      node.placeholder = t(
        node.getAttribute("data-i18n-placeholder")
      );
    });

    $$("[data-i18n-aria]").forEach(function (node) {
      node.setAttribute(
        "aria-label",
        t(node.getAttribute("data-i18n-aria"))
      );
    });

    $("#language-toggle").textContent =
      state.lang === "en" ? "中" : "EN";

    renderNavigation();
    renderPosts();
    renderPRPortfolio();
    renderIndustry();
    renderWorks();
    renderAutoNews();
    renderSearch();
  }

  function renderNavigation() {
    function label(item) {
      if (state.lang === "en") {
        return esc(item.en);
      }

      return (
        "<span class=\"nav-primary\">" +
          esc(item.zh) +
        "</span>" +
        "<small class=\"nav-secondary\">" +
          esc(item.en) +
        "</small>"
      );
    }

    $("#desktop-nav").innerHTML = NAV.map(
      function (item) {
        return (
          "<a href=\"#" +
          item.id +
          "\">" +
          label(item) +
          "</a>"
        );
      }
    ).join("");

    $("#mobile-nav").innerHTML = NAV.map(
      function (item) {
        return (
          "<a href=\"#" +
          item.id +
          "\">" +
          label(item) +
          "</a>"
        );
      }
    ).join("");

    $$("#mobile-nav a").forEach(function (anchor) {
      anchor.onclick = closeMenu;
    });
  }

  function normalizePost(object) {
    return {
      raw: object,
      title: titleOf(object),
      excerpt: excerptOf(object),
      date: dateOf(object),
      image: imageOf(object),
      link: linkOf(object, "post"),
      category: String(
        pick(
          object,
          ["category", "type", "section", "channel", "tags"],
          ""
        )
      )
    };
  }

  function normalizeWork(object) {
    return {
      raw: object,
      title: titleOf(object),
      excerpt: excerptOf(object),
      date: dateOf(object),
      image: imageOf(object),
      link: linkOf(object, "work")
    };
  }

  function normalizePR(object) {
    return {
      raw: object,
      title: titleOf(object),
      excerpt: excerptOf(object),
      date: dateOf(object),
      image: imageOf(object),
      link: linkOf(object, "pr")
    };
  }

  function postGroups() {
    var columns = [];
    var industry = [];

    state.posts
      .map(normalizePost)
      .forEach(function (post) {
        var category = post.category.toLowerCase();

        if (
          /industry|行业|wechat|微信/.test(category)
        ) {
          industry.push(post);
        } else {
          columns.push(post);
        }
      });

    if (!columns.length) {
      columns = state.posts.map(normalizePost);
    }

    return {
      columns: columns,
      industry: industry
    };
  }

  function renderPosts() {
    var slides = $("#column-slides");
    var dots = $("#column-dots");

    if (!slides) {
      return;
    }

    var items = postGroups().columns.slice(0, 6);

    if (!items.length) {
      slides.innerHTML =
        "<div class=\"empty-state\">" +
        t("empty") +
        "</div>";

      dots.innerHTML = "";
      return;
    }

    if (state.slide >= items.length) {
      state.slide = 0;
    }

    slides.innerHTML = items.map(
      function (item, index) {
        var media = item.image
          ? (
              "<div class=\"column-slide-media\">" +
                "<img src=\"" +
                esc(safeUrl(item.image)) +
                "\" alt=\"\" loading=\"" +
                (index ? "lazy" : "eager") +
                "\">" +
              "</div>"
            )
          : "<div class=\"column-slide-media\"></div>";

        return (
          "<article class=\"column-slide " +
          (index === state.slide ? "active" : "") +
          "\">" +
            media +
            "<div class=\"column-slide-copy\">" +
              "<small>FEATURED COLUMN</small>" +
              "<h3><a href=\"" +
              esc(item.link) +
              "\">" +
              esc(item.title) +
              "</a></h3>" +
              "<p>" +
              esc(item.excerpt) +
              "</p>" +
              "<time>" +
              esc(formatDate(item.date)) +
              "</time>" +
            "</div>" +
          "</article>"
        );
      }
    ).join("");

    dots.innerHTML = items.map(
      function (_, index) {
        return (
          "<button type=\"button\" class=\"" +
          (index === state.slide ? "active" : "") +
          "\" data-slide=\"" +
          index +
          "\" aria-label=\"Slide " +
          (index + 1) +
          "\"></button>"
        );
      }
    ).join("");

    $$("#column-dots button").forEach(function (button) {
      button.onclick = function () {
        showSlide(Number(button.dataset.slide));
      };
    });

    startCarousel();
  }

  function showSlide(index) {
    var count = postGroups().columns.slice(0, 6).length;

    if (!count) {
      return;
    }

    state.slide = (index + count) % count;

    $$(".column-slide").forEach(function (slide, slideIndex) {
      slide.classList.toggle(
        "active",
        slideIndex === state.slide
      );
    });

    $$("#column-dots button").forEach(function (button, buttonIndex) {
      button.classList.toggle(
        "active",
        buttonIndex === state.slide
      );
    });
  }

  function startCarousel() {
    clearInterval(state.timer);

    var count = postGroups().columns.slice(0, 6).length;

    if (
      count > 1 &&
      !matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
    ) {
      state.timer = setInterval(function () {
        showSlide(state.slide + 1);
      }, 6500);
    }
  }

  function leadCard(item, label) {
    var media = item.image
      ? (
          "<img src=\"" +
          esc(safeUrl(item.image)) +
          "\" alt=\"\" loading=\"lazy\">"
        )
      : "";

    return (
      media +
      "<div class=\"lead-copy\">" +
        "<small>" +
        esc(label) +
        "</small>" +
        "<h3><a href=\"" +
        esc(item.link) +
        "\">" +
        esc(item.title) +
        "</a></h3>" +
        "<p>" +
        esc(item.excerpt) +
        "</p>" +
        "<time>" +
        esc(formatDate(item.date)) +
        "</time>" +
      "</div>"
    );
  }

  function storyRows(items) {
    return items.map(function (item) {
      return (
        "<article class=\"story-row\">" +
          "<time>" +
          esc(formatDate(item.date)) +
          "</time>" +
          "<div>" +
            "<h3><a href=\"" +
            esc(item.link) +
            "\">" +
            esc(item.title) +
            "</a></h3>" +
            "<p>" +
            esc(item.excerpt) +
            "</p>" +
          "</div>" +
        "</article>"
      );
    }).join("");
  }

  function ensurePRSlots() {
    var container = $("#pr-portfolio-container");

    if (
      container &&
      !$("#pr-featured", container)
    ) {
      container.innerHTML =
        "<article id=\"pr-featured\" class=\"lead-card\"></article>" +
        "<div id=\"pr-list\" class=\"story-list\"></div>";
    }
  }

  function ensureWorkSlots() {
    var container = $("#works-container");

    if (
      container &&
      !$("#media-featured", container)
    ) {
      container.innerHTML =
        "<article id=\"media-featured\" class=\"media-lead\"></article>" +
        "<div id=\"media-grid\" class=\"media-grid\"></div>";
    }
  }

  function renderPRPortfolio() {
    var items = state.pr.map(normalizePR);

    if (!items.length) {
      return;
    }

    ensurePRSlots();

    $("#pr-featured").innerHTML =
      leadCard(items[0], "FEATURED PR PROJECT");

    $("#pr-list").innerHTML =
      storyRows(items.slice(1, 5));
  }

  function renderIndustry() {
    var items = postGroups().industry;

    if (!items.length) {
      items = postGroups().columns.slice(0, 5);
    }

    if (!items.length) {
      return;
    }

    $("#industry-featured").innerHTML =
      leadCard(items[0], "EDITOR'S PICK");

    $("#industry-list").innerHTML =
      storyRows(items.slice(1, 5));
  }

  function renderWorks() {
    var items = state.works.map(normalizeWork);

    if (!items.length) {
      return;
    }

    ensureWorkSlots();

    $("#media-featured").innerHTML =
      leadCard(items[0], "FEATURED MEDIA PIECE");

    $("#media-grid").innerHTML = items
      .slice(1, 5)
      .map(function (item) {
        return (
          "<article class=\"media-card\">" +
            (
              item.image
                ? (
                    "<img src=\"" +
                    esc(safeUrl(item.image)) +
                    "\" alt=\"\" loading=\"lazy\">"
                  )
                : ""
            ) +
            "<div class=\"media-card-body\">" +
              "<small>SELECTED MEDIA</small>" +
              "<h3><a href=\"" +
              esc(item.link) +
              "\">" +
              esc(item.title) +
              "</a></h3>" +
              "<p>" +
              esc(item.excerpt) +
              "</p>" +
            "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  var CATEGORY_ALIASES = {
    technology: ["technology", "tech", "科技"],
    business: ["business", "finance", "商业", "财经"],
    culture: ["culture", "arts", "文化"],
    life: ["life", "lifestyle", "生活"]
  };

  function newsCategory(object) {
    var value = String(
      pick(
        object,
        ["category", "type", "channel", "section"],
        ""
      )
    ).toLowerCase();

    var keys = Object.keys(CATEGORY_ALIASES);
    var index;

    for (index = 0; index < keys.length; index += 1) {
      if (
        CATEGORY_ALIASES[keys[index]].some(
          function (alias) {
            return (
              value === alias ||
              value.indexOf(alias) >= 0
            );
          }
        )
      ) {
        return keys[index];
      }
    }

    return "";
  }

  function normalizeNews(object) {
    return {
      title:
        titleOf(object) ||
        pick(object, ["headline", "name"], ""),
      date: dateOf(object),
      link: safeUrl(
        pick(
          object,
          ["url", "link", "href", "sourceUrl"],
          "#"
        )
      ),
      category: newsCategory(object)
    };
  }

  function newsItems(data) {
    if (Array.isArray(data)) {
      return data;
    }

    var output = [];

    Object.keys(data || {}).forEach(function (key) {
      if (Array.isArray(data[key])) {
        data[key].forEach(function (item) {
          if (!item.category) {
            item.category = key;
          }

          output.push(item);
        });
      }
    });

    return output;
  }

  function renderAutoNews() {
    var groups = {
      technology: [],
      business: [],
      culture: [],
      life: []
    };

    newsItems(state.news)
      .map(normalizeNews)
      .forEach(function (item) {
        if (
          item.category &&
          groups[item.category]
        ) {
          groups[item.category].push(item);
        }
      });

    Object.keys(groups).forEach(function (key) {
      var list = $("#" + key + "-news-list");

      list.innerHTML = groups[key]
        .slice(0, 4)
        .map(function (item) {
          return (
            "<li>" +
              "<a href=\"" +
              esc(item.link) +
              "\" target=\"_blank\" rel=\"noopener\">" +
              esc(item.title) +
              "</a>" +
              "<time>" +
              esc(formatDate(item.date)) +
              "</time>" +
            "</li>"
          );
        })
        .join("") || (
          "<li>" +
          t("empty") +
          "</li>"
        );
    });
  }

  function allSearchItems() {
    return postGroups().columns
      .concat(postGroups().industry)
      .concat(state.pr.map(normalizePR))
      .concat(state.works.map(normalizeWork))
      .concat(newsItems(state.news).map(normalizeNews));
  }

  function renderSearch() {
    var query = state.query
      .trim()
      .toLowerCase();

    var container = $("#search-results");

    if (!query) {
      container.innerHTML = "";
      return;
    }

    var results = allSearchItems()
      .filter(function (item) {
        return (
          item.title +
          " " +
          (item.excerpt || "")
        ).toLowerCase().indexOf(query) >= 0;
      })
      .slice(0, 20);

    container.innerHTML = results.map(function (item) {
      return (
        "<article class=\"search-result\">" +
          "<small>" +
          esc(formatDate(item.date)) +
          "</small>" +
          "<h3><a href=\"" +
          esc(item.link) +
          "\">" +
          esc(item.title) +
          "</a></h3>" +
          "<p>" +
          esc(item.excerpt || "") +
          "</p>" +
        "</article>"
      );
    }).join("") || (
      "<p>" +
      t("noResults") +
      "</p>"
    );
  }

  function loadSettings() {
    return fetchJSON(ENDPOINTS.settings)
      .then(function (settings) {
        var fieldMap = {
          "hero-title": [
            "heroTitle",
            "titleZh",
            "siteTitle",
            "title"
          ],
          "hero-description": [
            "heroDescription",
            "descriptionZh",
            "tagline",
            "description"
          ],
          "about-heading": [
            "aboutHeading",
            "aboutTitleZh",
            "aboutTitle"
          ],
          "about-description": [
            "aboutDescription",
            "aboutZh",
            "about"
          ],
          "contact-heading": [
            "contactHeading",
            "contactTitleZh",
            "contactTitle"
          ],
          "footer-description": [
            "footerDescription",
            "footerZh",
            "footerText"
          ],
          "footer-copyright": [
            "copyright",
            "footerCopyright"
          ]
        };

        Object.keys(fieldMap).forEach(function (id) {
          var node = $("#" + id);
          var value = pick(
            settings,
            fieldMap[id],
            ""
          );

          if (node && value) {
            node.textContent = value;
          }
        });

        var links = $("#contact-links");
        var email = pick(
          settings,
          ["email", "contactEmail"],
          ""
        );

        if (links && email) {
          links.innerHTML =
            "<a href=\"mailto:" +
            esc(email) +
            "\">" +
            esc(email) +
            "</a>";
        }
      })
      .catch(function () {
        if (!$("#hero-title").textContent) {
          $("#hero-title").textContent =
            "Global View";
        }

        if (!$("#hero-description").textContent) {
          $("#hero-description").textContent =
            state.lang === "en"
              ? "Ideas, context and communications in one clear view."
              : "聚合观点、行业与传播实践，清晰呈现每一次表达。";
        }
      });
  }

  function loadAll() {
    setStatus("#posts-status", "loading");
    setStatus("#pr-portfolio-status", "loading");
    setStatus("#works-status", "loading");
    setStatus("#auto-news-status", "loading");

    return Promise.allSettled([
      fetchJSON(ENDPOINTS.posts).then(function (value) {
        state.posts = arrayFrom(value);
        setStatus("#posts-status", "");
      }),

      fetchJSON(ENDPOINTS.works).then(function (value) {
        state.works = arrayFrom(value);
        setStatus("#works-status", "");
      }),

      fetchJSON(ENDPOINTS.pr).then(function (value) {
        state.pr = arrayFrom(value);
        setStatus("#pr-portfolio-status", "");
      }),

      fetchJSON(ENDPOINTS.news).then(function (value) {
        state.news = value;
        setStatus("#auto-news-status", "");
      }),

      loadSettings()
    ]).then(function (results) {
      if (results[0].status === "rejected") {
        setStatus("#posts-status", "error");
      }

      if (results[1].status === "rejected") {
        setStatus("#works-status", "error");
      }

      if (results[2].status === "rejected") {
        setStatus("#pr-portfolio-status", "error");
      }

      if (results[3].status === "rejected") {
        setStatus("#auto-news-status", "error");
      }

      renderPosts();
      renderPRPortfolio();
      renderIndustry();
      renderWorks();
      renderAutoNews();
    });
  }

  function openMenu() {
    var menu = $("#mobile-menu");
    var button = $("#more-toggle");

    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    D.body.classList.add("menu-open");

    var first = $("a", menu);

    if (first) {
      first.focus();
    }
  }

  function closeMenu() {
    var menu = $("#mobile-menu");
    var button = $("#more-toggle");

    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    D.body.classList.remove("menu-open");
  }

  function toggleSearch(open) {
    var panel = $("#search-panel");
    var button = $("#search-toggle");

    panel.hidden = !open;
    button.setAttribute(
      "aria-expanded",
      String(open)
    );

    if (open) {
      $("#search-input").focus();
    }
  }

  function setLanguage(language) {
    state.lang = /^en/i.test(language)
      ? "en"
      : "zh";

    try {
      localStorage.setItem(
        "siteLanguage",
        state.lang
      );
    } catch (error) {
      /* Storage is optional. */
    }

    W.currentLanguage = state.lang;
    applyI18n();
  }

  function toggleLanguage() {
    setLanguage(
      state.lang === "en"
        ? "zh"
        : "en"
    );
  }

  function setTheme(theme) {
    state.theme =
      theme === "dark"
        ? "dark"
        : "light";

    D.documentElement.dataset.theme =
      state.theme;

    D.body.dataset.theme =
      state.theme;

    try {
      localStorage.setItem(
        "siteTheme",
        state.theme
      );
    } catch (error) {
      /* Storage is optional. */
    }
  }

  function toggleTheme() {
    setTheme(
      state.theme === "dark"
        ? "light"
        : "dark"
    );
  }

  function bind() {
    $("#more-toggle").onclick = function () {
      if ($("#mobile-menu").hidden) {
        openMenu();
      } else {
        closeMenu();
      }
    };

    $("#search-toggle").onclick = function () {
      toggleSearch(
        $("#search-panel").hidden
      );
    };

    $("#search-close").onclick = function () {
      toggleSearch(false);
    };

    $("#language-toggle").onclick =
      toggleLanguage;

    $("#theme-toggle").onclick =
      toggleTheme;

    $("#column-prev").onclick = function () {
      showSlide(state.slide - 1);
    };

    $("#column-next").onclick = function () {
      showSlide(state.slide + 1);
    };

    $("#search-input").oninput = function (event) {
      state.query = event.target.value;
      renderSearch();
    };

    /*
     * Newsletter submission remains owned by
     * cms-integration.js or the form action.
     */

    $("#back-to-top").onclick = function () {
      scrollTo({
        top: 0,
        behavior: "smooth"
      });
    };

    addEventListener(
      "scroll",
      function () {
        $("#back-to-top").classList.toggle(
          "visible",
          scrollY > 600
        );
      },
      {
        passive: true
      }
    );

    D.addEventListener(
      "keydown",
      function (event) {
        if (event.key === "Escape") {
          closeMenu();
          toggleSearch(false);
        }
      }
    );
  }

  function init() {
    try {
      state.lang =
        (
          typeof W.currentLanguage === "string" &&
          W.currentLanguage
        ) ||
        localStorage.getItem("siteLanguage") ||
        "zh";

      state.theme =
        localStorage.getItem("siteTheme") ||
        (
          matchMedia(
            "(prefers-color-scheme: dark)"
          ).matches
            ? "dark"
            : "light"
        );
    } catch (error) {
      /* Storage is optional. */
    }

    W.currentLanguage = state.lang;

    setTheme(state.theme);
    bind();
    applyI18n();
    loadAll();
  }

  if (
    typeof W.currentLanguage !== "string"
  ) {
    W.currentLanguage = state.lang;
  }

  W.setLanguage =
    W.setLanguage ||
    setLanguage;

  W.toggleLanguage =
    W.toggleLanguage ||
    toggleLanguage;

  W.toggleTheme =
    W.toggleTheme ||
    toggleTheme;

  W.loadContent =
    W.loadContent ||
    loadAll;

  W.loadCMSContent =
    W.loadCMSContent ||
    loadAll;

  W.renderPosts =
    W.renderPosts ||
    renderPosts;

  W.renderWorks =
    W.renderWorks ||
    renderWorks;

  W.renderPRPortfolio =
    W.renderPRPortfolio ||
    renderPRPortfolio;

  W.renderAutoNews =
    W.renderAutoNews ||
    renderAutoNews;

  W.initializeCarousel =
    W.initializeCarousel ||
    renderPosts;

  W.performSearch =
    W.performSearch ||
    function (query) {
      state.query = query || "";
      renderSearch();
    };

  W.openSearch =
    W.openSearch ||
    function () {
      toggleSearch(true);
    };

  W.closeSearch =
    W.closeSearch ||
    function () {
      toggleSearch(false);
    };

  W.GVModernTest = {
    state: state,
    load: loadAll,
    render: {
      posts: renderPosts,
      pr: renderPRPortfolio,
      industry: renderIndustry,
      works: renderWorks,
      news: renderAutoNews
    }
  };

  if (D.readyState === "loading") {
    D.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }
}());
