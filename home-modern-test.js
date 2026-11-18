/*
 * Global View modern homepage test enhancer
 *
 * This script is deliberately non-destructive:
 * - it does not call or replace any production data endpoint;
 * - it does not replace production renderers, filters, language state or dark mode;
 * - it does not submit Newsletter forms;
 * - it does not start a second carousel timer;
 * - it only adds classes, alias anchors, navigation and fixed presentation covers.
 */
(function () {
  "use strict";

  if (window.GVModernTestUI && window.GVModernTestUI.version) {
    return;
  }

  var VERSION = "1.0.0";
  var observer = null;
  var refreshTimer = null;
  var menuButton = null;
  var mobileMenu = null;
  var lastFocused = null;

  var NAV_ITEMS = [
    {
      id: "pr-works",
      zh: "企业传播",
      en: "PR Portfolio",
      terms: ["企业传播", "PR作品", "PR案例", "PR Portfolio"]
    },
    {
      id: "industry-perspective",
      zh: "行业视角",
      en: "Industry Insights",
      terms: [
        "行业视角",
        "行业新闻",
        "Industry Insights",
        "Industry News"
      ]
    },
    {
      id: "media-works",
      zh: "媒体作品",
      en: "Media Features",
      terms: [
        "媒体作品",
        "Media Features",
        "Media Showcase",
        "Media Works"
      ]
    },
    {
      id: "news-brief",
      zh: "新闻速览",
      en: "Live News",
      terms: ["新闻速览", "Live News"]
    },
    {
      id: "about-us",
      zh: "关于我们",
      en: "About",
      terms: ["关于我们", "关于本站", "About Us", "About"]
    }
  ];

  var SECTION_RULES = [
    {
      key: "column",
      alias: "featured-column",
      sectionClass: "gv-column-section",
      blockClass: "gv-column-block",
      terms: [
        "专栏文章",
        "个人专栏",
        "专栏",
        "Featured Column",
        "Column"
      ]
    },
    {
      key: "pr",
      alias: "pr-works",
      sectionClass: "gv-pr-section",
      blockClass: "gv-pr-block",
      terms: NAV_ITEMS[0].terms
    },
    {
      key: "industry",
      alias: "industry-perspective",
      sectionClass: "gv-industry-section",
      blockClass: "gv-industry-block",
      terms: NAV_ITEMS[1].terms
    },
    {
      key: "media",
      alias: "media-works",
      sectionClass: "gv-media-section",
      blockClass: "gv-media-block",
      terms: NAV_ITEMS[2].terms
    },
    {
      key: "live",
      alias: "news-brief",
      sectionClass: "gv-live-section",
      blockClass: "gv-live-block",
      terms: NAV_ITEMS[3].terms
    },
    {
      key: "newsletter",
      alias: "newsletter",
      sectionClass: "gv-newsletter-section",
      blockClass: "gv-newsletter-block",
      terms: [
        "Newsletter",
        "订阅",
        "邮件订阅",
        "Subscribe",
        "Stay Updated"
      ]
    },
    {
      key: "about",
      alias: "about-us",
      sectionClass: "gv-about-section",
      blockClass: "gv-about-block",
      terms: NAV_ITEMS[4].terms
    }
  ];

  var CATEGORY_RULES = [
    {
      key: "technology",
      zh: "科技",
      en: "Technology",
      terms: ["科技", "Technology", "Tech"]
    },
    {
      key: "business",
      zh: "商业",
      en: "Business",
      terms: ["商业", "Business", "Finance"]
    },
    {
      key: "culture",
      zh: "文化",
      en: "Culture",
      terms: ["文化", "Culture", "Arts"]
    },
    {
      key: "life",
      zh: "生活",
      en: "Lifestyle",
      terms: ["生活", "Lifestyle", "Life"]
    }
  ];

  function text(node) {
    return String(
      node && node.textContent || ""
    ).replace(/\s+/g, " ").trim();
  }

  function normalized(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function containsTerm(value, terms) {
    var source = normalized(value);

    return terms.some(function (term) {
      return source.indexOf(
        normalized(term)
      ) !== -1;
    });
  }

  function directChildUnder(node, ancestor) {
    var current = node;

    while (
      current &&
      current.parentElement &&
      current.parentElement !== ancestor
    ) {
      current = current.parentElement;
    }

    return (
      current &&
      current.parentElement === ancestor
    )
      ? current
      : null;
  }

  function headingCandidates() {
    return Array.prototype.slice.call(
      document.querySelectorAll(
        "main h1, main h2, main h3, main [role='heading'], " +
        "section h1, section h2, section h3, section [role='heading']"
      )
    );
  }

  function findSectionByTerms(terms) {
    var headings = headingCandidates();
    var i;

    for (i = 0; i < headings.length; i += 1) {
      if (
        containsTerm(
          text(headings[i]),
          terms
        )
      ) {
        return (
          headings[i].closest(
            "section, [data-section], article, .section"
          ) ||
          headings[i].parentElement
        );
      }
    }

    var sections = Array.prototype.slice.call(
      document.querySelectorAll(
        "main section, main [data-section], body > section"
      )
    );

    for (i = 0; i < sections.length; i += 1) {
      if (
        containsTerm(
          text(sections[i]).slice(0, 500),
          terms
        )
      ) {
        return sections[i];
      }
    }

    return null;
  }

  function findCarousel() {
    var selectors = [
      "#column-carousel",
      "#featured-carousel",
      "#hero-carousel",
      "#posts-carousel",
      ".column-carousel",
      ".featured-carousel",
      ".hero-carousel",
      ".posts-carousel",
      "[data-carousel]",
      "[aria-roledescription='carousel']"
    ];

    var i;

    for (i = 0; i < selectors.length; i += 1) {
      var match = document.querySelector(
        selectors[i]
      );

      if (match) {
        return match;
      }
    }

    var likely = Array.prototype.slice.call(
      document.querySelectorAll(
        "main [class*='carousel'], " +
        "main [class*='slider'], " +
        "main [class*='swiper']"
      )
    );

    return likely.length
      ? likely[0]
      : null;
  }

  function ensureAlias(target, id) {
    if (!target || !id) {
      return null;
    }

    var existing = document.getElementById(id);

    if (existing) {
      return existing;
    }

    var anchor = document.createElement("span");

    anchor.id = id;
    anchor.className = "gv-anchor";
    anchor.setAttribute(
      "aria-hidden",
      "true"
    );

    target.parentNode.insertBefore(
      anchor,
      target
    );

    return anchor;
  }

  function identifySections() {
    var main =
      document.querySelector("main") ||
      document.body;

    var found = {};

    SECTION_RULES.forEach(function (rule) {
      var section =
        rule.key === "column"
          ? null
          : findSectionByTerms(rule.terms);

      if (rule.key === "column") {
        var carousel = findCarousel();

        section =
          carousel &&
          (
            carousel.closest(
              "section, [data-section], .section"
            ) ||
            carousel.parentElement
          );

        if (carousel) {
          carousel.classList.add(
            "gv-column-carousel"
          );
        }
      }

      if (!section) {
        return;
      }

      section.classList.add(
        "gv-section",
        rule.sectionClass
      );

      section.setAttribute(
        "data-gv-section",
        rule.key
      );

      ensureAlias(
        section,
        rule.alias
      );

      var block = directChildUnder(
        section,
        main
      );

      if (block) {
        block.classList.add(
          "gv-home-block",
          rule.blockClass
        );
      }

      found[rule.key] = section;
    });

    if (!found.newsletter) {
      var emailInput =
        document.querySelector(
          "form input[type='email']"
        );

      var newsletterSection =
        emailInput &&
        emailInput.closest(
          "section, [data-section], .section"
        );

      if (newsletterSection) {
        newsletterSection.classList.add(
          "gv-section",
          "gv-newsletter-section"
        );

        newsletterSection.setAttribute(
          "data-gv-section",
          "newsletter"
        );

        ensureAlias(
          newsletterSection,
          "newsletter"
        );

        var newsletterBlock =
          directChildUnder(
            newsletterSection,
            main
          );

        if (newsletterBlock) {
          newsletterBlock.classList.add(
            "gv-home-block",
            "gv-newsletter-block"
          );
        }

        found.newsletter =
          newsletterSection;
      }
    }

    var uniqueBlocks =
      Array.prototype.slice.call(
        main.children
      ).filter(function (node) {
        return (
          node.classList &&
          node.classList.contains(
            "gv-home-block"
          )
        );
      });

    if (uniqueBlocks.length >= 4) {
      main.classList.add(
        "gv-home-layout"
      );
    }

    return found;
  }

  function detectLanguage() {
    var htmlLang = normalized(
      document.documentElement
        .getAttribute("lang")
    );

    var body = document.body;

    var bodySignals = normalized(
      (
        body &&
        body.getAttribute("data-lang")
      ) +
      " " +
      (
        body &&
        body.getAttribute("data-language")
      ) +
      " " +
      (
        body &&
        body.className
      )
    );

    if (
      htmlLang.indexOf("en") === 0 ||
      /(^|\s)(en|english)(\s|$)/
        .test(bodySignals)
    ) {
      return "en";
    }

    var activeEnglish =
      document.querySelector(
        "[data-lang='en'].active, " +
        "[data-language='en'].active, " +
        "[data-lang='en'][aria-pressed='true'], " +
        "[data-language='en'][aria-pressed='true']"
      );

    if (activeEnglish) {
      return "en";
    }

    var globalLanguage = normalized(
      (
        typeof window.currentLanguage === "string" &&
        window.currentLanguage
      ) ||
      (
        typeof window.currentLang === "string" &&
        window.currentLang
      ) ||
      (
        typeof window.siteLanguage === "string" &&
        window.siteLanguage
      ) ||
      ""
    );

    if (
      globalLanguage.indexOf("en") === 0
    ) {
      return "en";
    }

    try {
      var stored = normalized(
        localStorage.getItem("language") ||
        localStorage.getItem("lang") ||
        localStorage.getItem(
          "siteLanguage"
        ) ||
        ""
      );

      if (
        stored.indexOf("en") === 0
      ) {
        return "en";
      }
    } catch (error) {
      /*
       * Storage can be unavailable
       * in strict privacy modes.
       */
    }

    return "zh";
  }

  function navLabel(
    item,
    language,
    menu
  ) {
    if (language === "en") {
      return item.en;
    }

    return (
      "<span class='gv-nav-primary'>" +
        item.zh +
      "</span>" +
      "<small class='gv-nav-secondary'>" +
        item.en +
      "</small>"
    );
  }

  function markOriginalSectionLinks(
    header
  ) {
    if (!header) {
      return;
    }

    var terms = [
      "首页",
      "Home",
      "专栏",
      "Column"
    ];

    NAV_ITEMS.forEach(function (item) {
      terms = terms.concat(
        item.terms
      );
    });

    Array.prototype.slice.call(
      header.querySelectorAll(
        "nav a, .nav a, .navigation a"
      )
    ).forEach(function (link) {
      if (
        link.closest(
          ".gv-modern-nav, .gv-mobile-menu"
        )
      ) {
        return;
      }

      if (
        containsTerm(
          text(link),
          terms
        )
      ) {
        link.classList.add(
          "gv-original-section-link"
        );
      }
    });
  }

  function markOriginalBrand(header) {
    if (!header) {
      return;
    }

    var candidates =
      Array.prototype.slice.call(
        header.querySelectorAll(
          ".logo, .site-logo, .site-brand, .brand, " +
          "a[rel='home'], a[href='/'], " +
          "a[href='index.html'], a[href='./']"
        )
      );

    candidates.some(function (node) {
      if (
        node.classList.contains(
          "gv-brand"
        )
      ) {
        return false;
      }

      var signal =
        text(node) +
        " " +
        (
          node.getAttribute(
            "aria-label"
          ) ||
          ""
        );

      if (
        /global\s*view|观澜泗渡/i
          .test(signal) ||
        node.matches(
          ".logo, .site-logo, .site-brand, .brand"
        )
      ) {
        node.classList.add(
          "gv-original-brand"
        );

        return true;
      }

      return false;
    });
  }

  function findHeader() {
    return document.querySelector(
      "header, .site-header, " +
      ".main-header, .header, " +
      "[data-site-header]"
    );
  }

  function findHeaderInner(header) {
    if (!header) {
      return null;
    }

    var candidates = [
      ":scope > .container",
      ":scope > .wrapper",
      ":scope > .header-inner",
      ":scope > .nav-container",
      ":scope > div"
    ];

    var i;

    for (
      i = 0;
      i < candidates.length;
      i += 1
    ) {
      try {
        var match =
          header.querySelector(
            candidates[i]
          );

        if (match) {
          return match;
        }
      } catch (error) {
        /*
         * :scope fallback for
         * older engines.
         */
      }
    }

    return header;
  }

  function collectHeaderTools(
    header,
    inner
  ) {
    if (!header || !inner) {
      return;
    }

    var selectors = [
      "[data-language-switch]",
      "[data-lang]",
      ".language-switcher",
      ".lang-switcher",
      "[data-theme-toggle]",
      ".theme-toggle",
      ".dark-mode-toggle",
      "[aria-label*='search' i]",
      "[aria-label*='搜索']",
      ".search-toggle",
      ".search-button"
    ];

    var tools = [];

    selectors.forEach(
      function (selector) {
        try {
          Array.prototype.slice.call(
            header.querySelectorAll(
              selector
            )
          ).forEach(function (node) {
            if (
              tools.indexOf(node) === -1 &&
              !node.closest(
                ".gv-modern-nav, " +
                ".gv-mobile-menu"
              )
            ) {
              tools.push(node);
            }
          });
        } catch (error) {
          /*
           * Unsupported selector syntax
           * does not affect production controls.
           */
        }
      }
    );

    tools.forEach(function (node) {
      node.classList.add(
        "gv-preserved-tool"
      );
    });
  }

  function closeMenu(restoreFocus) {
    if (!menuButton || !mobileMenu) {
      return;
    }

    document.body.classList.remove(
      "gv-menu-open"
    );

    menuButton.setAttribute(
      "aria-expanded",
      "false"
    );

    mobileMenu.hidden = true;

    if (
      restoreFocus &&
      lastFocused
    ) {
      lastFocused.focus();
    }
  }

  function openMenu() {
    if (!menuButton || !mobileMenu) {
      return;
    }

    lastFocused =
      document.activeElement;

    document.body.classList.add(
      "gv-menu-open"
    );

    menuButton.setAttribute(
      "aria-expanded",
      "true"
    );

    mobileMenu.hidden = false;

    var first =
      mobileMenu.querySelector("a");

    if (first) {
      first.focus();
    }
  }

  function toggleMenu() {
    if (
      document.body.classList
        .contains("gv-menu-open")
    ) {
      closeMenu(true);
    } else {
      openMenu();
    }
  }

  function renderNavigation() {
    var header = findHeader();

    if (!header) {
      return;
    }

    header.classList.add(
      "gv-modern-header"
    );

    var inner =
      findHeaderInner(header);

    if (!inner) {
      return;
    }

    inner.classList.add(
      "gv-header-inner"
    );

    markOriginalSectionLinks(header);
    markOriginalBrand(header);
    collectHeaderTools(
      header,
      inner
    );

    var brand =
      header.querySelector(
        ".gv-brand"
      );

    if (!brand) {
      brand =
        document.createElement("a");

      brand.className = "gv-brand";
      brand.href = "#top";

      brand.setAttribute(
        "aria-label",
        "Home"
      );

      brand.innerHTML =
        "<span class='gv-brand__en'>" +
          "Global View" +
        "</span>" +
        "<span class='gv-brand__cn'>" +
          "观澜泗渡" +
        "</span>";

      inner.insertBefore(
        brand,
        inner.firstChild
      );
    }

    ensureAlias(
      document.body.firstElementChild ||
        document.body,
      "top"
    );

    var language =
      detectLanguage();

    document.body.classList.toggle(
      "gv-language-en",
      language === "en"
    );

    var languageChanged =
      header.getAttribute(
        "data-gv-language"
      ) !== language;

    var nav =
      header.querySelector(
        ".gv-modern-nav"
      );

    var navCreated = false;

    if (!nav) {
      nav =
        document.createElement("nav");

      nav.className =
        "gv-modern-nav";

      inner.appendChild(nav);
      navCreated = true;
    }

    if (
      navCreated ||
      languageChanged
    ) {
      nav.setAttribute(
        "aria-label",
        language === "en"
          ? "Primary navigation"
          : "主要板块"
      );

      nav.innerHTML =
        NAV_ITEMS.map(
          function (item) {
            return (
              "<a href='#" +
              item.id +
              "'>" +
              navLabel(
                item,
                language,
                false
              ) +
              "</a>"
            );
          }
        ).join("");
    }

    menuButton =
      header.querySelector(
        ".gv-more-button"
      );

    var buttonCreated = false;

    if (!menuButton) {
      menuButton =
        document.createElement(
          "button"
        );

      menuButton.type = "button";
      menuButton.className =
        "gv-more-button";

      menuButton.setAttribute(
        "aria-expanded",
        "false"
      );

      menuButton.setAttribute(
        "aria-controls",
        "gv-mobile-menu"
      );

      menuButton.addEventListener(
        "click",
        toggleMenu
      );

      inner.appendChild(
        menuButton
      );

      buttonCreated = true;
    }

    if (
      buttonCreated ||
      languageChanged
    ) {
      menuButton.setAttribute(
        "aria-label",
        language === "en"
          ? "Open navigation menu"
          : "展开更多栏目"
      );

      menuButton.innerHTML =
        "<i></i><i></i><i></i>" +
        "<span>" +
          (
            language === "en"
              ? "More"
              : "更多"
          ) +
        "</span>";
    }

    mobileMenu =
      header.querySelector(
        ".gv-mobile-menu"
      );

    var menuCreated = false;

    if (!mobileMenu) {
      mobileMenu =
        document.createElement("div");

      mobileMenu.id =
        "gv-mobile-menu";

      mobileMenu.className =
        "gv-mobile-menu";

      mobileMenu.hidden = true;

      header.appendChild(
        mobileMenu
      );

      menuCreated = true;
    }

    if (
      menuCreated ||
      languageChanged
    ) {
      mobileMenu.innerHTML =
        "<div class='gv-mobile-menu__inner'>" +
          "<p class='gv-mobile-menu__title'>" +
            (
              language === "en"
                ? "Explore"
                : "全部栏目 · Explore"
            ) +
          "</p>" +
          "<nav class='gv-mobile-menu__grid' " +
            "aria-label='" +
            (
              language === "en"
                ? "Mobile navigation"
                : "移动端栏目"
            ) +
          "'>" +
            NAV_ITEMS.map(
              function (item) {
                return (
                  "<a href='#" +
                  item.id +
                  "'>" +
                  navLabel(
                    item,
                    language,
                    true
                  ) +
                  "</a>"
                );
              }
            ).join("") +
          "</nav>" +
        "</div>";

      Array.prototype.slice.call(
        mobileMenu.querySelectorAll("a")
      ).forEach(function (link) {
        link.addEventListener(
          "click",
          function () {
            closeMenu(false);
          }
        );
      });
    }

    header.setAttribute(
      "data-gv-language",
      language
    );
  }

  function createCover(key) {
    var cover =
      document.createElement("div");

    cover.className =
      "gv-fixed-news-cover";

    cover.setAttribute(
      "aria-hidden",
      "true"
    );

    var svgs = {
      technology:
        "<svg viewBox='0 0 800 440' " +
        "preserveAspectRatio='xMidYMid slice' " +
        "xmlns='http://www.w3.org/2000/svg'>" +
          "<defs>" +
            "<linearGradient id='gvt' x2='1' y2='1'>" +
              "<stop stop-color='#071426'/>" +
              "<stop offset='1' stop-color='#0c8098'/>" +
            "</linearGradient>" +
          "</defs>" +
          "<rect width='800' height='440' fill='url(#gvt)'/>" +
          "<g fill='none' stroke='#8be8ff' stroke-width='4' opacity='.36'>" +
            "<path d='M0 90h180l50 50h210l60-60h300'/>" +
            "<path d='M0 352h150l58-58h174l60 60h358'/>" +
          "</g>" +
          "<rect x='285' y='112' width='230' height='220' rx='38' " +
            "fill='#8cecff' opacity='.14' stroke='#c6f6ff' stroke-width='4'/>" +
          "<path d='M350 220h100M400 170v100' stroke='#d7faff' " +
            "stroke-width='13' stroke-linecap='round' opacity='.75'/>" +
        "</svg>",

      business:
        "<svg viewBox='0 0 800 440' " +
        "preserveAspectRatio='xMidYMid slice' " +
        "xmlns='http://www.w3.org/2000/svg'>" +
          "<defs>" +
            "<linearGradient id='gvb' x2='1' y2='1'>" +
              "<stop stop-color='#1471da'/>" +
              "<stop offset='1' stop-color='#06162b'/>" +
            "</linearGradient>" +
          "</defs>" +
          "<rect width='800' height='440' fill='url(#gvb)'/>" +
          "<g fill='#b8dcff' opacity='.2'>" +
            "<rect x='68' y='174' width='100' height='220'/>" +
            "<rect x='205' y='112' width='122' height='282'/>" +
            "<rect x='365' y='204' width='105' height='190'/>" +
            "<rect x='510' y='70' width='145' height='324'/>" +
          "</g>" +
          "<path d='M40 348l160-102 132 40 150-158 110 65 168-120' " +
            "fill='none' stroke='#e0f0ff' stroke-width='12' opacity='.5'/>" +
        "</svg>",

      culture:
        "<svg viewBox='0 0 800 440' " +
        "preserveAspectRatio='xMidYMid slice' " +
        "xmlns='http://www.w3.org/2000/svg'>" +
          "<defs>" +
            "<linearGradient id='gvc' x2='1' y2='1'>" +
              "<stop stop-color='#b9824d'/>" +
              "<stop offset='1' stop-color='#142136'/>" +
            "</linearGradient>" +
          "</defs>" +
          "<rect width='800' height='440' fill='url(#gvc)'/>" +
          "<circle cx='650' cy='90' r='170' fill='#ffe2ba' opacity='.3'/>" +
          "<path d='M62 430V170c0-72 58-130 130-130s130 58 130 130v260' " +
            "fill='none' stroke='#ffedcf' stroke-width='38' opacity='.2'/>" +
          "<path d='M0 370Q230 260 420 365t380-34' fill='none' " +
            "stroke='#f7d7ae' stroke-width='23' opacity='.25'/>" +
        "</svg>",

      life:
        "<svg viewBox='0 0 800 440' " +
        "preserveAspectRatio='xMidYMid slice' " +
        "xmlns='http://www.w3.org/2000/svg'>" +
          "<defs>" +
            "<linearGradient id='gvl' x2='1' y2='1'>" +
              "<stop stop-color='#365840'/>" +
              "<stop offset='1' stop-color='#9d7b4e'/>" +
            "</linearGradient>" +
          "</defs>" +
          "<rect width='800' height='440' fill='url(#gvl)'/>" +
          "<circle cx='655' cy='82' r='155' fill='#fff3ce' opacity='.25'/>" +
          "<path d='M105 345V205l160-126 160 126v140' fill='none' " +
            "stroke='#f5ead0' stroke-width='18' opacity='.42' " +
            "stroke-linejoin='round'/>" +
          "<path d='M470 352c18-152 105-218 248-229-6 142-86 226-248 229Z' " +
            "fill='#bce0ae' opacity='.32'/>" +
          "<path d='M490 330c68-72 123-121 202-177' fill='none' " +
            "stroke='#eff7d4' stroke-width='9' opacity='.48'/>" +
        "</svg>"
    };

    cover.innerHTML = svgs[key];

    return cover;
  }

  function findCategoryCard(
    section,
    rule
  ) {
    if (!section) {
      return null;
    }

    var headings =
      Array.prototype.slice.call(
        section.querySelectorAll(
          "h2, h3, h4, [role='heading'], " +
          "[data-category], [data-channel]"
        )
      );

    var i;

    for (
      i = 0;
      i < headings.length;
      i += 1
    ) {
      var signal =
        text(headings[i]) +
        " " +
        (
          headings[i].getAttribute(
            "data-category"
          ) ||
          ""
        ) +
        " " +
        (
          headings[i].getAttribute(
            "data-channel"
          ) ||
          ""
        );

      if (
        containsTerm(
          signal,
          rule.terms
        )
      ) {
        return (
          headings[i].closest(
            "article, li, [data-category], " +
            "[data-channel], .card, " +
            "[class*='card'], [class*='item']"
          ) ||
          headings[i].parentElement
        );
      }
    }

    return null;
  }

  function installFixedNewsCovers(
    liveSection
  ) {
    if (!liveSection) {
      return;
    }

    var cards = [];

    CATEGORY_RULES.forEach(
      function (rule) {
        var card =
          findCategoryCard(
            liveSection,
            rule
          );

        if (
          !card ||
          card.classList.contains(
            "gv-cover-installed"
          )
        ) {
          return;
        }

        card.classList.add(
          "gv-news-card",
          "gv-card",
          "gv-cover-installed"
        );

        card.setAttribute(
          "data-gv-news-category",
          rule.key
        );

        card.insertBefore(
          createCover(rule.key),
          card.firstChild
        );

        cards.push(card);
      }
    );

    if (cards.length === 4) {
      var parent =
        cards[0].parentElement;

      if (
        parent &&
        cards.every(
          function (card) {
            return (
              card.parentElement === parent
            );
          }
        )
      ) {
        parent.classList.add(
          "gv-news-grid"
        );
      }
    }
  }

  function decorateCards(sections) {
    [
      "pr",
      "industry",
      "media",
      "about"
    ].forEach(function (key) {
      var section =
        sections[key];

      if (!section) {
        return;
      }

      Array.prototype.slice.call(
        section.querySelectorAll(
          "article, .card, [class*='card']"
        )
      ).forEach(function (card) {
        card.classList.add(
          "gv-card"
        );
      });
    });

    var search =
      document.querySelector(
        "input[type='search'], " +
        "[role='search'] input, " +
        ".search-input, #search-input"
      );

    if (search) {
      search.classList.add(
        "gv-modern-search"
      );
    }

    var backToTop =
      document.querySelector(
        "#back-to-top, .back-to-top, " +
        "[data-back-to-top], " +
        "[aria-label*='top' i], " +
        "[aria-label*='顶部']"
      );

    if (backToTop) {
      backToTop.classList.add(
        "gv-back-to-top"
      );
    }
  }

  function refresh() {
    if (!document.body) {
      return;
    }

    document.body.classList.add(
      "gv-modern-ready"
    );

    var sections =
      identifySections();

    renderNavigation();

    installFixedNewsCovers(
      sections.live
    );

    decorateCards(sections);
  }

  function scheduleRefresh() {
    window.clearTimeout(
      refreshTimer
    );

    refreshTimer =
      window.setTimeout(
        refresh,
        120
      );
  }

  function watch() {
    if (
      observer ||
      !document.documentElement
    ) {
      return;
    }

    observer =
      new MutationObserver(
        function (mutations) {
          var meaningful =
            mutations.some(
              function (mutation) {
                return (
                  mutation.type === "childList" ||
                  (
                    mutation.type === "attributes" &&
                    mutation.target ===
                      document.documentElement
                  )
                );
              }
            );

          if (meaningful) {
            scheduleRefresh();
          }
        }
      );

    observer.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          "lang",
          "data-theme",
          "data-lang",
          "data-language",
          "class"
        ]
      }
    );
  }

  document.addEventListener(
    "keydown",
    function (event) {
      if (
        event.key === "Escape" &&
        document.body.classList
          .contains("gv-menu-open")
      ) {
        closeMenu(true);
      }
    }
  );

  document.addEventListener(
    "click",
    function (event) {
      var target =
        event.target &&
        event.target.closest &&
        event.target.closest(
          "[data-language-switch], " +
          "[data-lang], " +
          ".language-switcher, " +
          ".lang-switcher"
        );

      if (target) {
        window.setTimeout(
          scheduleRefresh,
          0
        );
      }
    }
  );

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        refresh();
        watch();
      },
      {
        once: true
      }
    );
  } else {
    refresh();
    watch();
  }

  window.GVModernTestUI =
    Object.freeze({
      version: VERSION,
      refresh: refresh,
      openMenu: openMenu,
      closeMenu: closeMenu,
      destroy: function () {
        if (observer) {
          observer.disconnect();
          observer = null;
        }

        window.clearTimeout(
          refreshTimer
        );

        closeMenu(false);
      }
    });
}());
