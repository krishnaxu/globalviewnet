
(function () {
  const originalFetch = window.fetch;

  async function getArticleInfo(url) {
    const response = await originalFetch(
      "/api/works-metadata?url=" + encodeURIComponent(url)
    );

    if (!response.ok) {
      throw new Error("获取文章信息失败");
    }

    return response.json();
  }

  document.addEventListener("input", async function (event) {
    const input = event.target;

    if (
      !input ||
      input.name !== "original_url" ||
      !input.value.trim()
    ) {
      return;
    }

    const url = input.value.trim();

    if (!/^https?:\/\/(www\.)?people\.com\.cn\//i.test(url)) {
      return;
    }

    if (input.dataset.autofillUrl === url) return;
    input.dataset.autofillUrl = url;

    try {
      const data = await getArticleInfo(url);

      if (!data.success) throw new Error(data.error || "获取失败");

      const fields = {
        title: data.title,
        date: data.date,
        excerpt: data.excerpt
      };

      for (const [name, value] of Object.entries(fields)) {
        if (!value) continue;

        const field = document.querySelector(`[name="${name}"]`);
        if (!field || field.value.trim()) continue;

        field.value = value;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } catch (error) {
      console.error("作品自动填充失败：", error);
      delete input.dataset.autofillUrl;
    }
  });
})();
