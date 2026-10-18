
/**
 * Global View CMS Integration
 * CMS文章接入首页，并动态更新轮播、滚动头条和热门阅读。
 * 不修改 index.html 的页面结构与样式。
 */
(async function () {
  "use strict";

  const categories = ["tech", "business", "culture", "life"];

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
      throw new Error("CMS API 请求失败：" + response.status);
    }

    const data = await response.json();

    if (!data.success || !Array.isArray(data.posts)) {
      throw new Error("CMS API 返回格式不正确");
    }

    if (!Array.isArray(articles)) {
      throw new Error("没有找到首页 articles 数组");
    }

    // 一、将 CMS 数据转换为首页现有文章格式。
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
    
    // 加载“我的作品”
    try {
      const worksResponse = await fetch("/api/works", {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });

      if (!worksResponse.ok) {
        throw new Error("作品 API 请求失败：" + worksResponse.status);
      }

      const worksData = await worksResponse.json();
      const worksList = document.getElementById("worksList");

      if (
        worksList &&
        worksData.success &&
        Array.isArray(worksData.works)
      ) {
        worksList.replaceChildren();

        if (worksData.works.length === 0) {
          const empty = document.createElement("p");
          empty.className = "works-empty";
          empty.textContent = "暂无作品";
          worksList.appendChild(empty);
        } else {
          for (const work of worksData.works) {
            const link = document.createElement("a");
            link.className = "work-item";
            link.href = work.original_url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = work.title;
            link.title = work.title;
            worksList.appendChild(link);
          }
        }
      }
    } catch (error) {
      console.error("加载我的作品失败：", error);
    }


    // 按文章日期排序，供其他依赖该顺序的现有功能使用。
        // 首页统一使用 CMS 文章，不再保留建站演示文章。
    
for (let i = articles.length - 1; i >= 0; i--) {
  const article = articles[i];
  const isAutoNews = String(article.id || "").startsWith("auto-");

  if (!article.cms && !isAutoNews) {
    articles.splice(i, 1);
  }
}


    // 按文章日期排序。
    articles.sort(
      (a, b) => dateValue(b.date) - dateValue(a.date)
    );

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

       
    // 三、轮播：按更新时间展示最新的 CMS 文章，最多 5 篇。
    renderFeatured = function () {
      const track = $("#featuredTrack");
      const dotsContainer = $("#carouselDots");

      if (!track || !dotsContainer) return;

      const featuredArticles = articles
        .filter(article => article.cms)
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
        window.globalViewSetArticleImage(img, article);
        img.alt = article.alt?.[currentLang] || "";
        img.loading = index === 0 ? "eager" : "lazy";

        const content = document.createElement("div");
        content.className = "featured-content";

        const categoryTag = makeText(
          "span", "category-tag", categoryName(article.category)
        );
        const title = makeText(
          "h2", "", article.title?.[currentLang] || article.title?.zh || ""
        );
        const excerpt = makeText(
          "p", "", article.excerpt?.[currentLang] || article.excerpt?.zh || ""
        );

        const meta = document.createElement("div");
        meta.className = "featured-meta";

        meta.append(
          makeText("span", "", displayDate(article.date)),
          makeText("span", "dot", "|"),
          makeText("span", "", readTimeText(article.read)),
          makeText("span", "dot", "|"),
          makeText(
            "span",
            "",
            `${t("sourceLabel")}: ${article.source || "Global View"}`
          )
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

      currentSlide = 0;
      updateCarouselPosition();
      startCarousel();
    };

    // 四、滚动头条：只显示最新 CMS 文章。
    renderTicker = function () {
      const content = $("#tickerContent");
      if (!content) return;

      content.replaceChildren();

      const entries = articles
        .filter(article => article.cms)
        .slice()
        .sort((a, b) => dateValue(b.date) - dateValue(a.date))
        .slice(0, 10);

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

    
    // 五、我的专栏：展示未进入首页轮播的较早 CMS 文章。
    renderTrending = function () {
      const list = $("#trendingList");
      if (!list) return;

      list.replaceChildren();

      const carouselIds = window.globalViewCarouselIds || new Set();

     
      const ranking = articles
        .filter(article =>
          article.cms &&
          article.show_in_column === true &&
          !carouselIds.has(article.id)
        )

        .slice()
        .sort((a, b) =>
          dateValue(b.updatedAt || b.date) -
          dateValue(a.updatedAt || a.date)
        )
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
          article.title[currentLang] || article.title.zh || ""
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
    
    document.documentElement.classList.remove("cms-loading");
    
    console.info(
      `Global View：已加载 ${data.posts.length} 篇 CMS 文章`
    );
    
} catch (error) {
  console.error("Global View CMS 接入失败：", error);

  // CMS 加载失败时，恢复页面显示，避免主体一直隐藏。
  document.documentElement.classList.remove("cms-loading");
}
})();

