```javascript
(function () {
  "use strict";

  const BUTTON_ID = "manual-translate-button";

  async function translateText(text) {
    const chunks = [];
    let remaining = text;

    while (remaining.length > 1800) {
      let cut = remaining.lastIndexOf("\n", 1800);

      if (cut < 900) cut = remaining.lastIndexOf("。", 1800);

      if (cut < 900) {
        cut = 1800;
      } else {
        cut += 1;
      }

      chunks.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut);
    }

    if (remaining) chunks.push(remaining);

    const results = [];

    for (const chunk of chunks) {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunk }),
        signal: AbortSignal.timeout(60000)
      });

      if (!response.ok) {
        throw new Error("翻译接口请求失败，状态码：" + response.status);
      }

      const result = await response.json();

      if (!result.translation || typeof result.translation !== "string") {
        throw new Error("接口没有返回有效译文");
      }

      results.push(result.translation.trim());
    }

    return results.join("\n");
  }

  function normalize(text) {
    return (text || "")
      .replace(/\(OPTIONAL\)/gi, "")
      .replace(/[：:（）()]/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function findField(labelText) {
    const wanted = normalize(labelText);
    const labels = Array.from(document.querySelectorAll("label"));

    const label = labels.find(function (item) {
      return normalize(item.innerText).startsWith(wanted);
    });

    if (!label) return null;

    if (label.htmlFor) {
      const control = document.getElementById(label.htmlFor);
      if (control) return control;
    }

    let parent = label.parentElement;
    let bestMatch = null;

    for (let i = 0; parent && i < 8; i++) {
      const controls = Array.from(parent.querySelectorAll(
        'input:not([type="checkbox"]):not([type="radio"]), textarea'
      ));

      if (controls.length === 1) {
        bestMatch = controls[0];
        break;
      }

      parent = parent.parentElement;
    }

    return bestMatch;
  }

  function setFieldValue(field, value) {
    if (!field) return false;

    const prototype = field.tagName === "TEXTAREA"
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;

    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (descriptor && descriptor.set) {
      descriptor.set.call(field, value);
    } else {
      field.value = value;
    }

    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  }

  async function translateFields(button) {
    const fields = [
      {
        zh: "中文标题",
        en: "ENGLISH TITLE",
        name: "标题"
      },
      {
        zh: "中文摘要",
        en: "ENGLISH SUMMARY",
        name: "摘要"
      },
      {
        zh: "中文正文",
        en: "ENGLISH BODY",
        name: "正文"
      }
    ];

    const jobs = [];

    for (const item of fields) {
      const zhField = findField(item.zh);
      const enField = findField(item.en);

      if (!zhField || !enField) {
        alert(
          "仍未能找到“" + item.zh + "”或对应英文输入框。\n" +
          "请保持文章编辑页打开，并将中文正文和英文正文切换到 Raw（原始文本）模式。"
        );
        return;
      }

      const chinese = zhField.value || "";
      const english = enField.value || "";

      if (!chinese.trim()) continue;

      if (english.trim()) {
        if (!confirm(item.name + "的英文栏已有内容，是否重新翻译并覆盖？")) {
          continue;
        }
      }

      jobs.push({
        field: enField,
        text: chinese,
        name: item.name
      });
    }

    if (!jobs.length) {
      alert("没有需要翻译的中文内容。");
      return;
    }

    button.disabled = true;

    try {
      for (const job of jobs) {
        button.textContent = "正在翻译" + job.name + "…";

        const translated = await translateText(job.text);
        setFieldValue(job.field, translated);
      }

      alert(
        "翻译请求已完成，请检查英文标题、摘要和正文。\n" +
        "本按钮不会主动发布文章。请检查内容后再决定是否保存。"
      );
    } catch (error) {
      console.error("手动翻译失败：", error);
      alert("翻译失败：" + error.message);
    } finally {
      button.disabled = false;
      button.textContent = "手动翻译英文";
    }
  }

  function addButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const labels = Array.from(document.querySelectorAll("label"));
    const hasChineseTitle = labels.some(function (label) {
      return normalize(label.innerText).startsWith(normalize("中文标题"));
    });

    if (!hasChineseTitle) return;

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "手动翻译英文";

    button.style.cssText = [
      "position:fixed",
      "right:24px",
      "bottom:24px",
      "z-index:99999",
      "padding:12px 20px",
      "border:0",
      "border-radius:8px",
      "background:#2563eb",
      "color:white",
      "font-size:15px",
      "font-weight:600",
      "cursor:pointer",
      "box-shadow:0 2px 8px rgba(0,0,0,.2)"
    ].join(";");

    button.addEventListener("click", function () {
      translateFields(button);
    });

    document.body.appendChild(button);
  }

  const observer = new MutationObserver(addButton);

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  addButton();

  console.log("手动翻译按钮脚本已加载");
})();
```
