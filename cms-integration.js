
/**
 * Global View CMS Integration
 * 从 /api/posts 获取已发布文章，接入现有首页。
 * 不修改原有页面结构、样式和演示文章。
 */
(async function () {
  "use strict";

  try {
    const response = await fetch("/api/posts", {
      headers: { Accept: "application/json" }
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

    // 把 CMS 数据转换成首页现有的文章格式
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
        url_zh: post.url_zh || post.url || `/posts/${post.slug}`,
        url_en: post.url_en || `/posts/${post.slug}?lang=en`,

        category: ["tech", "business", "culture", "life"].includes(post.category)
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

    // 按发布日期倒序排列，使最新文章优先参与首页分类展示
    articles.sort((a, b) => {
      const dateA = Date.parse(a.date) || 0;
      const dateB = Date.parse(b.date) || 0;
      return dateB - dateA;
    });

    // 保留原有演示文章弹窗，仅将 CMS 文章改为独立详情页
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

    // 使用原有渲染函数刷新首页
    renderArticles();

    if (
      ["tech", "business", "culture", "life"].includes(currentPage)
    ) {
      renderCategoryGrid();
    }

    console.info(`Global View：已加载 ${data.posts.length} 篇 CMS 文章`);
  } catch (error) {
    // 加载失败时保留原有首页，不阻断网站使用
    console.error("Global View CMS 接入失败：", error);
  }
})();
