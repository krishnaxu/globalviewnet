
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

  function renderArticle(article) {
    const title = escapeHTML(article.title);
    const source = escapeHTML(article.source);
    const date = escapeHTML(formatDate(article.date));
    const body = escapeHTML(article.body || "");
    const excerpt = escapeHTML(article.excerpt || "");
    const sourceURL = safeURL(article.source_url);
    const coverURL = safeURL(article.cover_image);

    const image = coverURL
      ? `<img class="pr-portfolio-cover" src="${escapeHTML(coverURL)}" alt="${title}" loading="lazy">`
      : "";

    const content = body
      ? `<div class="pr-portfolio-body">${body.replace(/\n/g, "<br>")}</div>`
      : `<p class="pr-portfolio-excerpt">${excerpt}</p>`;

    const originalLink = sourceURL
      ? `<a class="pr-portfolio-original" href="${escapeHTML(sourceURL)}" target="_blank" rel="noopener noreferrer">${document.documentElement.lang.startsWith("zh") ? "阅读原文 ↗" : "Read Original ↗"}</a>
      : "";

    return `
      <article class="pr-portfolio-card">
        ${image}
        <div class="pr-portfolio-card-content">
          <div class="pr-portfolio-meta">
            <span>${source}</span>
            ${date ? `<time>${date}</time>` : ""}
          </div>
          <h3>${title}</h3>
          ${content}
          <div class="pr-portfolio-card-footer">
            ${originalLink}
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

      grid.innerHTML = articles.map(renderArticle).join("");

      const tabs = section.querySelectorAll("[data-pr-source]");

      tabs.forEach(tab => {
        tab.addEventListener("click", () => {
          const source = tab.dataset.prSource;

          tabs.forEach(item => {
            const active = item === tab;
            item.classList.toggle("active", active);
            item.setAttribute("aria-pressed", String(active));
          });

          grid.querySelectorAll(".pr-portfolio-card").forEach(card => {
            const sourceLabel = card.querySelector(
              ".pr-portfolio-meta span"
            )?.textContent || "";

            card.hidden = source !== "all" && sourceLabel !== source;
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
