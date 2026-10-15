
/**
 * Global View CMS Integration
 * CMS文章接入首页，并动态更新轮播、滚动头条和热门阅读。
 * 不修改 index.html 的页面结构与样式。
 */
(async function () {
  "use strict";

  const categories = ["tech", "business", "culture", "life"];

  // 保留原首页各分类对应的演示文章，作为空分类时的回退。
  const fallbackFeaturedIds = {
    tech: "ai-creative",
    business: "green-investment",
    culture: "museum-digital",
    life: "urban-cycling"
  };

  function dateValue(value) {
    const timestamp = Date.parse(value || "");
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function isTrue(value) {
    return value === true ||
      String(value || "").trim().toLowerCase() === "true";
  }

  function displayDate(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat(
      currentLang === "zh" ? "zh-CN" : "en-US",
      {
        year: "numeric",
        month: currentLang === "zh" ? "long" : "short",
        day: "numeric"
      }
    ).format(date);
  }

  function makeText(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value || "";
    return element;
  }

  function openLinkedArticle(article) {
    if (!article) return;

    if (article.cms) {
      const url = currentLang === "en"
        ? article.url_en
        : article.url_zh;

      window.location.href = url;
      return;
    }

    openArticle(article.id);
  }

  function bindArticleActivation(element, article) {
    element.tabIndex = 0;
    element.setAttribute("role", "button");
    element.setAttribute(
      "aria-label",
      article.title[currentLang] || ""
    );

    element.addEventListener("click", () => {
      openLinkedArticle(article);
    });

    element.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLinkedArticle(article);
      }
    });
  }

  try {
    const response = await fetch("/api/posts", {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`CMS API 请求失败：${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !Array.isArray(data.posts)) {
      throw new Error("CMS API 返回格式不正确");
    }

    if (!Array.isArray(articles)) {
      throw new Error("没有找到首页 articles 数组");
    }

    // 一、将 CMS 数据转换为首页现有文章格式
    for (const post of data.posts) {
      if (!post.slug) continue;

      const id = `cms-${post.slug}`;
      const titleZh = post.title_zh || post.title || post.slug;
      const titleEn = post.title_en || titleZh;
      const excerptZh = post.excerpt_zh || post.excerpt || "";
      const excerptEn = post.excerpt_en || excerptZh;

      const article = {
        id,
        cms: true,
        slug: post.slug,
        is_hot: isTrue(post.is_hot),

        url_zh: post.url_zh ||
          post.url ||
          `/posts/${encodeURIComponent(post.slug)}`,

        url_en: post.url_en ||
          `/posts/${encodeURIComponent(post.slug)}?lang=en`,

        category: categories.includes(post.category)
          ? post.category
          : "business",

        title: {
          zh: titleZh,
          en: titleEn
        },

        excerpt: {
          zh: excerptZh,
          en: excerptEn
        },

        date: post.date || "",
        read: 3,
        source: post.source_name || "Global View",

        image: post.cover_image ||
          "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80",

        alt: {
          zh: titleZh,
          en: titleEn
        },

        subtitle: {
          zh: excerptZh,
          en: excerptEn
        },

        tags: [],

        body: {
          zh: excerptZh ? [excerptZh] : [],
          en: excerptEn ? [excerptEn] : []
        }
      };

      const existingIndex = articles.findIndex(
        item => item.id === id
      );

      if (existingIndex >= 0) {
        articles[existingIndex] = article;
      } else {
        articles.push(article);
      }
    }

    // 最新文章排在前面，供首页列表和轮播选取。
    articles.sort((a, b) => dateValue(b.date) - dateValue(a.date));

    // 二、保留 CMS 文章独立详情页跳转。
    const originalOpenArticle = openArticle;

    openArticle = function (id) {
      const article = articleById(id);

      if (article && article.cms) {
        const url = currentLang === "en"
          ? article.url_en
          : article.url_zh;

        window.location.href = url;
        return;
      }

      return originalOpenArticle(id);
    };

    // 三、轮播：每个分类优先选最新 CMS 文章。
    // 若某分类没有 CMS 文章，则暂时保留该分类原演示文章。
    renderFeatured = function () {
      const track = $("#featuredTrack");
      const dotsContainer = $("#carouselDots");

      if (!track || !dotsContainer) return;

      const featuredArticles = categories.map(category => {
        const latest = articles.find(
          article => article.cms && article.category === category
        );

        return latest || articleById(fallbackFeaturedIds[category]);
      }).filter(Boolean);

      track.replaceChildren();
      dotsContainer.replaceChildren();

      featuredArticles.forEach((article, index) => {
        const slide = document.createElement("article");
        slide.className = "featured-slide";
        bindArticleActivation(slide, article);

        const img = document.createElement("img");
        img.className = "featured-image";
        img.src = article.image;
        img.alt = article.alt[currentLang] || "";
        img.loading = index === 0 ? "eager" : "lazy";

        const content = document.createElement("div");
        content.className = "featured-content";

        const categoryTag = makeText(
          "span",
          "category-tag",
          categoryName(article.category)
        );

        const title = makeText(
          "h2",
          "",
          article.title[currentLang]
        );

        const excerpt = makeText(
          "p",
          "",
          article.excerpt[currentLang]
        );

        const meta = document.createElement("div");
        meta.className = "featured-meta";

        const dateMeta = makeText(
          "span",
          "",
          displayDate(article.date)
        );

        const separator = makeText("span", "dot", "|");

        const readMeta = makeText(
          "span",
          "",
          readTimeText(article.read)
        );

        const separator2 = makeText("span", "dot", "|");

        const sourceMeta = makeText(
          "span",
          "",
          `${t("sourceLabel")}: ${article.source || "Global View"}`
        );

        meta.append(
          dateMeta,
          separator,
          readMeta,
          separator2,
          sourceMeta
        );

        content.append(categoryTag, title, excerpt, meta);
        slide.append(img, content);
        track.appendChild(slide);

        const dot = document.createElement("button");
        dot.type = "button";
        dot.className =
          "carousel-dot" + (index === 0 ? " active" : "");
        dot.setAttribute("aria-label", `Go to slide ${index + 1}`);
        dot.addEventListener("click", () => goToSlide(index));
        dotsContainer.appendChild(dot);
      });

      // 当前轮播固定为四个分类，兼容原有箭头与自动播放逻辑。
      currentSlide = Math.min(
        currentSlide,
        Math.max(0, featuredArticles.length - 1)
      );

      updateCarouselPosition();
      startCarousel();
    };

    // 四、滚动头条：只显示最新 CMS 文章，不混入演示文章。
    renderTicker = function () {
      const content = $("#tickerContent");
      if (!content) return;

      content.replaceChildren();

      const entries = articles
        .filter(article => article.cms)
        .sort((a, b) => dateValue(b.date) - dateValue(a.date))
        .slice(0, 10);

      // 复制一组用于无缝滚动；只有一篇文章时也会重复显示。
      const duplicatedEntries = [...entries, ...entries];

      duplicatedEntries.forEach((article, index) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "ticker-item";
        item.textContent = article.title[currentLang] || "";

        item.addEventListener("click", () => {
          openLinkedArticle(article);
        });

        if (index >= entries.length) {
          item.setAttribute("aria-hidden", "true");
          item.tabIndex = -1;
        }

        content.appendChild(item);
      });
    };

    // 五、热门阅读：仅显示 CMS 中明确勾选的文章。
    // 不用演示文章伪装成真实热门内容。
    renderTrending = function () {
      const list = $("#trendingList");
      if (!list) return;

      list.replaceChildren();

      const ranking = articles
        .filter(article => article.cms && article.is_hot)
        .sort((a, b) => dateValue(b.date) - dateValue(a.date))
        .slice(0, 5);

      ranking.forEach((article, index) => {
        const li = document.createElement("li");
        li.className = "trending-item";
        bindArticleActivation(li, article);

        const number = makeText(
          "span",
          "trend-number",
          `${index + 1}.`
        );

        const content = document.createElement("div");

        const title = makeText(
          "p",
          "trend-title",
          article.title[currentLang]
        );

        const subtitle = makeText(
          "p",
          "trend-subtitle",
          `${categoryName(article.category)} · ${displayDate(article.date)}`
        );

        const bottom = document.createElement("div");
        bottom.className = "trend-bottom";

        const category = makeText(
          "span",
          "trend-category",
          categoryName(article.category)
        );

        const readTime = makeText(
          "span",
          "trend-time",
          readTimeText(article.read)
        );

        bottom.append(category, readTime);
        content.append(title, subtitle, bottom);
        li.append(number, content);
        list.appendChild(li);
      });
    };

    // 六、刷新首页及当前分类页。
    renderTicker();
    renderFeatured();
    renderArticles();
    renderTrending();

    if (categories.includes(currentPage)) {
      renderCategoryGrid();
    }

    console.info(
      `Global View：已加载 ${data.posts.length} 篇 CMS 文章`
    );
  } catch (error) {
    // 加载失败时保留原有页面，避免阻断网站使用。
    console.error("Global View CMS 接入失败：", error);
  }
})();
