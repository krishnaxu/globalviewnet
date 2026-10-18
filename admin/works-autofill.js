
(function () {
  const originalFetch = window.fetch.bind(window);

  function findField(labelText) {
    const labels = [...document.querySelectorAll("label")];
    const label = labels.find(el =>
      el.innerText.trim().includes(labelText)
    );

    if (!label) return null;

    const root = label.closest("[class]")?.parentElement ||
      label.parentElement;

    return (
      label.control ||
      root?.querySelector("input, textarea") ||
      label.parentElement?.querySelector("input, textarea")
    );
  }

  let timer;

  document.addEventListener("input", function (event) {
    const urlField = findField("人民网原文链接");
    if (!urlField || event.target !== urlField) return;

    clearTimeout(timer);

    timer = setTimeout(async () => {
      const url = urlField.value.trim();

      if (!/^https?:\/\/([\w-]+\.)*people\.com\.cn\//i.test(url)) {
        return;
      }

      try {
        const response = await originalFetch(
          "/api/works-metadata?url=" + encodeURIComponent(url)
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "获取文章信息失败");
        }

        const fields = [
          ["作品标题", data.title],
          ["发布日期", data.date ? data.date.slice(0, 10) + "T00:00" : ""],
          ["作品简介", data.excerpt]
        ];

        for (const [labelText, value] of fields) {
          if (!value) continue;

         const field = labelText === "发布日期"
  ? document.querySelector('#date-field-5, input[data-testid^="date-field-"]')
  : findField(labelText);
          if (!field || field.value.trim()) continue;

          const setter = Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(field),
            "value"
          )?.set;

          const finalValue = labelText === "发布日期"
  ? value.slice(0, 10) + "T00:00"
  : value;

if (setter) setter.call(field, finalValue);
else field.value = finalValue;

          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } catch (error) {
        console.error("作品自动填充失败：", error);
      }
    }, 600);
  });
})();
