
(() => {
  "use strict";

  const API_URL = "/api/pr-portfolio";
  const SECTION_ID = "prPortfolioSection";
  const GRID_ID = "prPortfolioGrid";
  const PAGE_SIZE = 25;
  const COMPANY = "GenScript Official Website";
  const INDUSTRY = "Industry News";

  const isChinese = () =>
    document.documentElement.lang.toLowerCase().startsWith("zh");

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
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
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
      { year: "numeric", month: "short", day: "numeric" }
    ).format(date);
  }

  function sourceLabel(source) {
    if (source === COMPANY) return isChinese() ? "公司新闻" : "Company News";
    if (source === INDUSTRY) return isChinese() ? "行业新闻" : "Industry News";
    return source || "";
  }

  function renderArticle(article, index) {
    const title = escapeHTML(article.title);
    const source = escapeHTML(sourceLabel(article.source));
    const date = escapeHTML(formatDate(article.date));
    const body = escapeHTML(article.body || "");
    const excerpt = escapeHTML(article.excerpt || "");
    const sourceURL = safeURL(article.source_url);
    const detailId = `pr-portfolio-detail-${index}`;

    const content = body
      ? `<div class="pr-portfolio-body">${body.replace(/\n/g, "<br>")}</div>`
      : `<p class="pr-portfolio-excerpt">${excerpt || (isChinese() ? "暂无正文内容。" : "No article content available.")}</p>`;

    const originalLink = sourceURL
      ? `<a class="pr-portfolio-original" href="${escapeHTML(sourceURL)}" target="_blank" rel="noopener noreferrer">${isChinese() ? "阅读原文 ↗" : "Read Original ↗"}</a>`
      : "";

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
              aria-controls="${detailId}"
            >
              <span>${title}</span>
              <span class="pr-portfolio-toggle-icon" aria-hidden="true">+</span>
            </button>
            <div class="pr-portfolio-detail" id="${detailId}" hidden>
              ${content}
              <div class="pr-portfolio-card-footer">${originalLink}</div>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function bindExpandButtons(grid) {
    grid.querySelectorAll(".pr-portfolio-title-button").forEach(button => {
      button.addEventListener("click", () => {
        const expanded = button.getAttribute("aria-expanded") === "true";
        const detail = document.getElementById(
          button.getAttribute("aria-controls")
        );

        button.setAttribute("aria-expanded", String(!expanded));
        if (detail) detail.hidden = expanded;
      });
    });
  }

  function renderPagination(container, totalPages, currentPage, onPageChange) {
    container.innerHTML = "";

    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "pr-page-button";
    previous.textContent = isChinese() ? "上一页" : "Previous";
    previous.disabled = currentPage <= 1;
    previous.addEventListener("click", () => {
      if (currentPage > 1) onPageChange(currentPage - 1);
    });

    const status = document.createElement("span");
    status.className = "pr-page-status";
    status.textContent = isChinese()
      ? `第 ${currentPage} / ${totalPages} 页`
      : `Page ${currentPage} / ${totalPages}`;

    const next = document.createElement("button");
    next.type = "button";
    next.className = "pr-page-button";
    next.textContent = isChinese() ? "下一页" : "Next";
    next.disabled = currentPage >= totalPages;
    next.addEventListener("click", () => {
      if (currentPage < totalPages) onPageChange(currentPage + 1);
    });

    const jumpLabel = document.createElement("label");
    jumpLabel.className = "pr-page-jump-label";
    jumpLabel.htmlFor = "prPortfolioJumpInput";
    jumpLabel.textContent = isChinese() ? "跳转至" : "Go to";

    const jumpInput = document.createElement("input");
    jumpInput.id = "prPortfolioJumpInput";
    jumpInput.className = "pr-page-jump-input";
    jumpInput.type = "number";
    jumpInput.min = "1";
    jumpInput.max = String(totalPages);
    jumpInput.step = "1";
    jumpInput.value = String(currentPage);
    jumpInput.setAttribute("aria-label", isChinese() ? "跳转至页码" : "Page number");

    const jumpButton = document.createElement("button");
    jumpButton.type = "button";
    jumpButton.className = "pr-page-button";
    jumpButton.textContent = isChinese() ? "跳转" : "Go";

    const jump = () => {
      const page = Number.parseInt(jumpInput.value, 10);

      if (!Number.isInteger(page) || page < 1 || page > totalPages) {
        jumpInput.value = String(currentPage);
        return;
      }

      onPageChange(page);
    };

    jumpButton.addEventListener("click", jump);
    jumpInput.addEventListener("keydown", event => {
      if (event.key === "Enter") jump();
    });

    container.append(previous, status, next, jumpLabel, jumpInput, jumpButton);
  }

  function renderMoreLinks(section, companyCount, industryCount) {
    let container = section.querySelector(".pr-portfolio-more-links");

    if (!container) {
      container = document.createElement("div");
      container.className = "pr-portfolio-more-links";
      section.insertAdjacentElement("afterend", container);
    }

    const companyLabel = isChinese() ? "查看全部公司新闻" : "All Company News";
    const industryLabel = isChinese() ? "查看全部行业新闻" : "All Industry News";

    container.innerHTML = `
      <a href="pr-portfolio-list.html?source=${encodeURIComponent(COMPANY)}">${companyLabel} (${companyCount}) →</a>
      <a href="pr-portfolio-list.html?source=${encodeURIComponent(INDUSTRY)}">${industryLabel} (${industryCount}) →</a>
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

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      if (!data.success || !Array.isArray(data.entries)) {
        throw new Error(data.error || "Invalid API response");
      }

      const articles = data.entries;
      const isListPage = section.dataset.pageMode === "list";
      const params = new URLSearchParams(window.location.search);

      if (isListPage) {
        const requestedSource = params.get("source");
        const selectedSource = requestedSource === INDUSTRY ? INDUSTRY : COMPANY;
        const filtered = articles.filter(item => item.source === selectedSource);
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        const requestedPage = Number.parseInt(params.get("page") || "1", 10);
        const currentPage = Math.min(
          totalPages,
          Math.max(1, Number.isInteger(requestedPage) ? requestedPage : 1)
        );
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageArticles = filtered.slice(start, start + PAGE_SIZE);

        const heading = document.getElementById("prPortfolioListTitle");
        if (heading) heading.textContent = sourceLabel(selectedSource);

        grid.innerHTML = pageArticles.length
          ? pageArticles.map((article, index) => renderArticle(article, start + index)).join("")
          : `<p class="muted">${isChinese() ? "该分类暂时没有文章。" : "No articles in this category yet."}</p>`;

        bindExpandButtons(grid);

        const count = document.getElementById("prPortfolioCount");
        if (count) {
          count.textContent = isChinese()
            ? `共 ${filtered.length} 篇文章`
            : `${filtered.length} articles`;
        }

        const pagination = document.getElementById("prPortfolioPagination");
        if (pagination) {
          renderPagination(pagination, totalPages, currentPage, nextPage => {
            const url = new URL(window.location.href);
            url.searchParams.set("source", selectedSource);
            url.searchParams.set("page", String(nextPage));
            window.location.href = url.href;
          });
        }

        return;
      }

      const companyArticles = articles.filter(item => item.source === COMPANY);
      const industryArticles = articles.filter(item => item.source === INDUSTRY);
      const tabs = section.querySelectorAll("[data-pr-source]");

      function renderHome(source) {
        let selected;

        if (source === "all") {
          selected = [
            ...companyArticles.slice(0, 3),
            ...industryArticles.slice(0, 3)
          ];
        } else if (source === COMPANY) {
          selected = companyArticles.slice(0, 3);
        } else if (source === INDUSTRY) {
          selected = industryArticles.slice(0, 3);
        } else {
          selected = articles.slice(0, 3);
        }

        grid.innerHTML = selected.length
          ? selected.map((article, index) => renderArticle(article, index)).join("")
          : `<p class="muted">${isChinese() ? "该分类暂时没有文章。" : "No articles in this category yet."}</p>`;

        bindExpandButtons(grid);
        renderMoreLinks(section, companyArticles.length, industryArticles.length);
      }

      tabs.forEach(tab => {
        tab.addEventListener("click", () => {
          tabs.forEach(item => {
            const active = item === tab;
            item.classList.toggle("active", active);
            item.setAttribute("aria-pressed", String(active));
          });

          renderHome(tab.dataset.prSource || "all");
        });

        tab.setAttribute(
          "aria-pressed",
          String(tab.classList.contains("active"))
        );
      });

      const activeTab = section.querySelector("[data-pr-source].active");
      renderHome(activeTab?.dataset.prSource || "all");
    } catch (error) {
      console.error("[PR Portfolio]", error);
      grid.innerHTML = `<p class="muted">${isChinese() ? "作品集暂时无法加载，请稍后重试。" : "Portfolio is temporarily unavailable."}</p>`;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
