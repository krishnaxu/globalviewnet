
(() => {
  "use strict";

  const API_URL = "/api/pr-portfolio";
  const SECTION_ID = "prPortfolioSection";
  const GRID_ID = "prPortfolioGrid";

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function safeURL(value) {
    try {
      const url = new URL(value, window.location.origin);
      return ["http:", "https:"].includes(url.protocol)
        ? url.href
        : "";
    } catch {
      return "";
    }
  }

  function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat(
      document.documentElement.lang || "en",
      {
        year: "numeric",
        month: "short",
        day: "numeric"
      }
    ).format(date);
  }

  function renderArticle(article, index) {
    const title = escapeHTML(article.title);
    const source = escapeHTML(article.source);
    const date = escapeHTML(formatDate(article.date));
    const body = escapeHTML(article.body || "");
    const excerpt = escapeHTML(article.excerpt || "");
    const sourceURL = safeURL(article.source_url);
    const isChinese = document.documentElement.lang
      .toLowerCase()
      .startsWith("zh");

    const content = body
      ? `<div class="pr-portfolio-body">${body.replace(/\n/g, "<br>")}</div>`
      : `<p class="pr-portfolio-excerpt">${excerpt || (isChinese ? "暂无正文内容。" : "No article content available.")}</p>`;

    const originalLink = sourceURL
      ? `<a class="pr-portfolio-original" href="${escapeHTML(sourceURL)}" target="_blank" rel="noopener noreferrer">${isChinese ? "阅读原文 ↗" : "Read Original ↗"}</a>`
      : "";

    const articleId = `pr-portfolio-detail-${index + 1}`;

    return `
      <article class="pr-portfolio-card">
        <div class="pr-portfolio-list-row">
          <span class="pr-portfolio-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
          <div class="pr-portfolio-card-content">
            <div class="pr-portfolio-meta">
              <span>${source}</span>
              ${date ? `<time>${date}</time>` : ""}
            </div>
            <button
              class="pr-portfolio-title-button"
              type="button"
              aria-expanded="false"
              aria-controls="${articleId}"
            >
              <span>${title}</span>
              <span class="pr-portfolio-toggle-icon" aria-hidden="true">+</span>
            </button>
            <div class="pr-portfolio-detail" id="${articleId}" hidden>
              ${content}
              <div class="pr-portfolio-card-footer">
                ${originalLink}
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  async function init() {
    const section = document.getElementById(SECTION_ID);
    const grid = document.getElementById(GRID_ID);

    if (!section || !grid) return;

    try {
      const response = await fetch(API_URL, {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !Array.isArray(data.entries)) {
        throw new Error(data.error || "Invalid API response");
      }

      const articles = data.entries;

      if (articles.length === 0) {
        grid.innerHTML = '<p class="muted">No portfolio articles yet.</p>';
        return;
      }

      grid.innerHTML = articles
        .map((article, index) => renderArticle(article, index))
        .join("");

      // 点击标题展开或收起正文。
      grid.querySelectorAll(".pr-portfolio-title-button").forEach(button => {
        button.addEventListener("click", () => {
          const expanded = button.getAttribute("aria-expanded") === "true";
          const detailId = button.getAttribute("aria-controls");
          const detail = document.getElementById(detailId);

          button.setAttribute("aria-expanded", String(!expanded));

          if (detail) {
            detail.hidden = expanded;
          }
        });
      });

      // 分类筛选：保留原有筛选功能。
      const tabs = section.querySelectorAll("[data-pr-source]");

      tabs.forEach(tab => {
        tab.addEventListener("click", () => {
          const source = tab.dataset.prSource;

          tabs.forEach(item => {
            const active = item === tab;
            item.classList.toggle("active", active);
            item.setAttribute("aria-pressed", String(active));
          });

          let visibleIndex = 0;

          grid.querySelectorAll(".pr-portfolio-card").forEach(card => {
            const sourceLabel = card.querySelector(
              ".pr-portfolio-meta span"
            )?.textContent || "";

            const visible = source === "all" || sourceLabel === source;
            card.hidden = !visible;

            if (visible) {
              visibleIndex += 1;
              const number = card.querySelector(".pr-portfolio-number");
              if (number) {
                number.textContent = String(visibleIndex).padStart(2, "0");
              }
            }
          });
        });
      });

      tabs.forEach(tab => {
        tab.setAttribute(
          "aria-pressed",
          String(tab.classList.contains("active"))
        );
      });
    } catch (error) {
      console.error("[PR Portfolio]", error);
      grid.innerHTML =
        '<p class="muted">Portfolio is temporarily unavailable.</p>';
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
