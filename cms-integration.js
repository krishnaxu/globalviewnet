
/**
 * Global View CMS Integration
 * 统一处理中英文 CMS 文章、首页轮播、滚动头条、我的专栏和作品列表。
 * 固定导航、首页静态标题和页脚仍由 index.html 负责。
 */
(async function () {
  "use strict";

  const categories = ["tech", "business", "culture", "life"];
  const isEnglish = () => currentLang === "en";

  function dateValue(value) {
    const timestamp = Date.parse(value || "");
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function isTrue(value) {
    return value === true ||
      String(value || "").trim().toLowerCase() === "true";
  }

  function hasChinese(value) {
    return /[\u3400-\u9FFF]/.test(String(value || ""));
  }

  function hasLanguage(article, lang = currentLang) {
    if (!article) return false;

    if (article.cms) {
      return lang === "en"
        ? article.has_en === true
        : article.has_zh === true;
    }

    const title = article.title;
    const text = typeof title === "object"
      ? title?.[lang]
      : title;

    if (!String(text || "").trim()) return false;

    // 英文页面不显示只有中文标题的自动新闻。
    if (lang === "en" && hasChinese(text)) return false;

    return true;
  }

  function localizedText(value, lang = currentLang) {
    if (value == null) return "";

    if (typeof value === "object") {
      return String(value[lang] || "").trim();
    }

    const text = String(value).trim();

    // 英文界面不使用中文文本作为英文回退。
    if (lang === "en" && hasChinese(text)) return "";

    return text;
  }

  function displayDate(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat(
      isEnglish() ? "en-US" : "zh-CN",
      {
        year: "numeric",
        month: isEnglish() ? "short" : "long",
        day: "numeric"
      }
    ).format(date);
  }

  function formatWorkDate(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat(
      isEnglish() ? "en-US" : "zh-CN",
      {
        year: "numeric",
        month: isEnglish() ? "short" : "numeric",
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

  function sourceText(article) {
    const label = isEnglish() ? "Source" : "来源";
    const source = article.source || "Global View";
    return `${label}: ${source}`;
  }

  function articleTitle(article) {
    return localizedText(article?.title);
  }

  function articleExcerpt(article) {
    return localizedText(article?.excerpt);
  }

  function openLinkedArticle(article) {
    if (!article) return;

    if (article.cms) {
      if (!hasLanguage(article)) return;

      const url = isEnglish()
        ? article.url_en
        : article.url_zh;

      if (url) window.location.href = url;
      return;
    }

    if (typeof openArticle === "function") {
      openArticle(article.id);
    }
  }

  function bindArticleActivation(element, article) {
    element.tabIndex = 0;
    element.setAttribute("role", "link");
    element.setAttribute("aria-label", articleTitle(article));

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
      throw new Error("CMS API request failed: " + response.status);
    }

    const data = await response.json();

    if (!data.success || !Array.isArray(data.posts)) {
      throw new Error("Invalid CMS API response");
    }

    if (!Array.isArray(articles)) {
      throw new Error("Homepage articles array was not found");
    }

    // 1. 将 CMS 数据转换为首页文章格式。
    for (const post of data.posts) {
      if (!post.slug) continue;

      const id = `cms-${post.slug}`;
      const hasZh = post.has_zh === true;
      const hasEn = post.has_en === true;

      const titleZh = hasZh
        ? String(post.title_zh || post.title || "").trim()
        : "";

      const titleEn = hasEn
        ? String(post.title_en || "").trim()
        : "";

      const excerptZh = hasZh
        ? String(post.excerpt_zh || post.excerpt || "").trim()
        : "";

      const excerptEn = hasEn
        ? String(post.excerpt_en || "").trim()
        : "";

      const article = {
        id,
        cms: true,
        has_zh: hasZh,
        has_en: hasEn,
        slug: post.slug,
        is_hot: isTrue(post.is_hot),
        show_in_column: isTrue(post.show_in_column),

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
        updatedAt: post.updated_at ||
          post.updatedAt ||
          post.date ||
          "",

        read: 3,
        source: post.source_name || "Global View",
        origin: "cms",

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

    // 2. 移除旧的演示文章，保留 CMS 和自动新闻。
    for (let i = articles.length - 1; i >= 0; i--) {
      const article = articles[i];
      const isAutoNews = String(article.id || "").startsWith("auto-");

      if (!article.cms && !isAutoNews) {
        articles.splice(i, 1);
      }
    }

    articles.sort(
      (a, b) => dateValue(b.date) - dateValue(a.date)
    );

    // 3. CMS 文章使用独立详情页。
    const originalOpenArticle = openArticle;

    openArticle = function (id) {
      const article = articleById(id);

      if (article && article.cms) {
        openLinkedArticle(article);
        return;
      }

      return originalOpenArticle(id);
    };

    // 4. 首页轮播：仅展示当前语言可读的文章。
    // 保留现有页面结构，每次最多展示 5 篇。
    renderFeatured = function () {
      const track = $("#featuredTrack");
      const dotsContainer = $("#carouselDots");

      if (!track || !dotsContainer) return;

const featuredArticles = articles
  .filter(article =>
    article.cms === true &&
    hasLanguage(article) &&
    article.show_in_column === true
  )
  .slice()
  .sort((a, b) =>
    dateValue(b.updatedAt || b.date) -
    dateValue(a.updatedAt || a.date)
  )
  .slice(0, 5);

      window.globalViewCarouselIds = new Set(
        featuredArticles.map(article => article.id)
      );

      track.replaceChildren();
      dotsContainer.replaceChildren();

      featuredArticles.forEach((article, index) => {
        const slide = document.createElement("article");
        slide.className = "featured-slide";
        bindArticleActivation(slide, article);

        const img = document.createElement("img");
        img.className = "featured-image";

        if (typeof window.globalViewSetArticleImage === "function") {
          window.globalViewSetArticleImage(img, article);
        } else {
          img.src = article.image || "";
        }

        img.alt = localizedText(article.alt) || articleTitle(article);
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
          articleTitle(article)
        );

        const excerpt = makeText(
          "p",
          "",
          articleExcerpt(article)
        );

        const meta = document.createElement("div");
        meta.className = "featured-meta";

        const readTime = typeof t === "function"
          ? readTimeText(article.read)
          : (isEnglish() ? `${article.read || 1} min read` : `${article.read || 1} 分钟阅读`);

        meta.append(
          makeText("span", "", displayDate(article.date)),
          makeText("span", "dot", "|"),
          makeText("span", "", readTime),
          makeText("span", "dot", "|"),
          makeText("span", "", sourceText(article))
        );

        content.append(categoryTag, title, excerpt, meta);
        slide.append(img, content);
        track.appendChild(slide);

        const dot = document.createElement("button");
        dot.type = "button";
        dot.className =
          "carousel-dot" + (index === 0 ? " active" : "");

        dot.setAttribute(
          "aria-label",
          isEnglish() ? `Go to slide ${index + 1}` : `转到第 ${index + 1} 张`
        );

        dot.addEventListener("click", () => goToSlide(index));
        dotsContainer.appendChild(dot);
      });

      currentSlide = 0;
      updateCarouselPosition();
      startCarousel();
    };

    // 5. 滚动头条：过滤掉当前语言没有版本的文章。
    renderTicker = function () {
      const content = $("#tickerContent");
      if (!content) return;

      content.replaceChildren();

      const entries = articles
        .filter(article =>
          hasLanguage(article) &&
          (article.cms ||
            String(article.id || "").startsWith("auto-"))
        )
        .slice()
        .sort((a, b) => dateValue(b.date) - dateValue(a.date))
        .slice(0, 10);

      [...entries, ...entries].forEach((article, index) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "ticker-item";
        item.textContent = articleTitle(article);

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

    // 6. 我的专栏：仅展示当前语言有版本的 CMS 文章。
    renderTrending = function () {
      const list = $("#trendingList");
      if (!list) return;

      list.replaceChildren();

      const ranking = articles
        .filter(article =>
          article.cms &&
          article.show_in_column === true &&
          hasLanguage(article)
        )
        .slice()
        .sort((a, b) =>
          dateValue(b.updatedAt || b.date) -
          dateValue(a.updatedAt || a.date)
        )
        .slice(0, 3);

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
          articleTitle(article)
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
          typeof t === "function"
            ? readTimeText(article.read)
            : (isEnglish() ? `${article.read || 1} min read` : `${article.read || 1} 分钟阅读`)
        );

        bottom.append(category, readTime);
        content.append(title, subtitle, bottom);
        li.append(number, content);
        list.appendChild(li);
      });
    };

    // 7. 我的作品：统一动态按钮、日期和阅读时长的界面语言。
    const worksList = document.getElementById("worksList");

    if (worksList) {
      worksList.replaceChildren();

      let worksPage = 0;
      let worksHasMore = true;
      let worksLoading = false;
      const visibleCount = 3;
      const allWorks = [];

      const loadMoreButton = document.createElement("button");
      loadMoreButton.type = "button";
      loadMoreButton.className = "works-more-button";

      const setWorksButtonText = state => {
        const labels = isEnglish()
          ? {
              more: "View All Works",
              loading: "Loading…",
              error: "Failed to load. Try again",
              retry: "Retry"
            }
          : {
              more: "查看更多作品",
              loading: "正在加载…",
              error: "加载失败，点击重试",
              retry: "重试"
            };

        loadMoreButton.textContent = labels[state] || labels.more;
      };

      async function fetchNextWorksPage() {
        if (worksLoading || !worksHasMore) return;

        worksLoading = true;
        loadMoreButton.disabled = true;
        setWorksButtonText("loading");

        try {
          const nextPage = worksPage + 1;
          const worksResponse = await fetch(
            `/api/works?page=${nextPage}`,
            {
              headers: { Accept: "application/json" },
              cache: "no-store"
            }
          );

          if (!worksResponse.ok) {
            throw new Error("Works API request failed: " + worksResponse.status);
          }

          const worksData = await worksResponse.json();

          if (!worksData.success || !Array.isArray(worksData.works)) {
            throw new Error("Invalid works API response");
          }

          allWorks.push(...worksData.works);
          worksPage = worksData.page || nextPage;
          worksHasMore = Boolean(worksData.has_more);
        } catch (error) {
          setWorksButtonText("error");
          throw error;
        } finally {
          worksLoading = false;
          loadMoreButton.disabled = false;
        }
      }

      function renderWorks() {
        worksList.replaceChildren();

        allWorks.slice(0, visibleCount).forEach((work, index) => {
          const link = document.createElement("a");
          link.className = "work-item";
          link.href = `/work?slug=${encodeURIComponent(work.slug)}`;
          link.title = work.title || "";

          const number = makeText(
            "span",
            "work-number",
            `${index + 1}.`
          );

          const content = document.createElement("div");
          content.className = "work-content";

          const title = makeText(
            "span",
            "work-title",
            work.title || (isEnglish() ? "Untitled work" : "未命名作品")
          );

          content.appendChild(title);

          const metaItems = [];

          if (work.platform) {
            metaItems.push(work.platform);
          }

          const formattedDate = formatWorkDate(work.date);

          if (formattedDate) {
            metaItems.push(formattedDate);
          }

          if (metaItems.length) {
            const meta = makeText(
              "p",
              "work-meta",
              metaItems.join(" · ")
            );
            content.appendChild(meta);
          }

          if (work.excerpt) {
            const excerpt = makeText(
              "p",
              "work-excerpt",
              work.excerpt
            );
            content.appendChild(excerpt);
          }

          const footer = document.createElement("div");
          footer.className = "work-footer";

          const readTime = makeText(
            "span",
            "work-read-time",
            isEnglish()
              ? "1 min read"
              : "约 1 分钟阅读"
          );

          footer.appendChild(readTime);
          content.appendChild(footer);
          link.append(number, content);
          worksList.appendChild(link);
        });

        if (allWorks.length === 0 && !worksHasMore) {
          const empty = makeText(
            "p",
            "works-empty",
            isEnglish() ? "No works yet" : "暂无作品"
          );
          worksList.appendChild(empty);
        }

        if (worksHasMore) {
          setWorksButtonText("more");
          worksList.appendChild(loadMoreButton);
        }
      }

      loadMoreButton.addEventListener("click", () => {
        window.location.href = "/works.html";
      });

      try {
        await fetchNextWorksPage();
        renderWorks();
      } catch (error) {
        console.error("Failed to load works:", error);
      }
    }

    // 8. 刷新首页和当前分类页。
    renderTicker();
    renderFeatured();
    renderArticles();
    renderTrending();

    if (categories.includes(currentPage)) {
      renderCategoryGrid();
    }

    document.documentElement.classList.remove("cms-loading");

    console.info(
      `Global View: loaded ${data.posts.length} CMS posts`
    );
  } catch (error) {
    console.error("Global View CMS integration failed:", error);

    // CMS 加载失败时恢复页面，避免主体一直隐藏。
    document.documentElement.classList.remove("cms-loading");
  }
})();
