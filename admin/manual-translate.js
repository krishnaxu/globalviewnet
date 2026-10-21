
(function () {
  "use strict";

  const BUTTON_ID = "manual-translate-button";

  async function translateText(text) {
    const chunks = [];
    let remaining = text;

    // 接口限制为 2000 字符，每段留出余量
    while (remaining.length > 1800) {
      let cut = remaining.lastIndexOf("\n", 1800);

      if (cut < 900) {
        cut = remaining.lastIndexOf("。", 1800);
      }

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
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: chunk }),
        signal: AbortSignal.timeout(60000)
      });

      if (!response.ok) {
        throw new Error("翻译接口请求失败，状态码：" + response.status);
      }

      const result = await response.json();

      if (
        typeof result.translation !== "string" ||
        !result.translation.trim()
      ) {
        throw new Error("接口没有返回有效译文");
      }

      results.push(result.translation.trim());
    }

    return results.join("\n");
  }

  function findField(labelText) {
    const labels = Array.from(document.querySelectorAll("label"));
    const label = labels.find(function (item) {
      return item.innerText.trim().includes(labelText);
    });

    if (!label) return null;

    if (label.htmlFor) {
      const control = document.getElementById(label.htmlFor);
      if (control) return control;
    }

    let parent = label.parentElement;

    for (let i = 0; parent && i < 8; i++) {
      const control = parent.querySelector(
        'input:not([type="checkbox"]):not([type="radio"]), textarea'
      );

      if (control) return control;

      parent = parent.parentElement;
    }

    return null;
  }

  function setFieldValue(field, value) {
    if (!field) return false;

    // 使用原生 setter，通知 CMS 更新受控输入框
    const prototype = field.tagName === "TEXTAREA"
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;

    const setter = Object.getOwnPropertyDescriptor(
      prototype,
      "value"
    );

    if (setter && setter.set) {
      setter.set.call(field, value);
    } else {
      field.value = value;
    }

    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  }

  async function translateFields(button) {
    const fields = [
      { zh: "中文标题", en: "English Title", name: "标题" },
      { zh: "中文摘要", en: "English Summary", name: "摘要" },
      { zh: "中文正文", en: "English Body", name: "正文" }
    ];

    const jobs = [];

    for (const item of fields) {
      const zhField = findField(item.zh);
      const enField = findField(item.en);

      if (!zhField || !enField) {
        alert(
          "找不到“" + item.zh + "”或对应英文输入框。\n" +
          "请确认文章编辑页已经打开，并且正文使用 Raw（原始文本）模式。"
        );
        return;
      }

      const chinese = zhField.value || "";
      const english = enField.value || "";

      if (!chinese.trim()) continue;

      if (english.trim()) {
        const overwrite = confirm(
          item.name + "的英文栏已有内容，是否重新翻译并覆盖？"
        );

        if (!overwrite) continue;
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
    button.textContent = "正在翻译，请稍候…";

    try {
      for (const job of jobs) {
        button.textContent = "正在翻译" + job.name + "…";

        const translated = await translateText(job.text);

        if (!setFieldValue(job.field, translated)) {
          throw new Error("无法填入英文" + job.name);
        }
      }

      alert(
        "翻译完成！请检查英文标题、摘要和正文。\n" +
        "本操作不会主动发布文章。"
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

    // 只在文章编辑页显示
    const labels = Array.from(document.querySelectorAll("label"));
    const hasChineseTitle = labels.some(function (label) {
      return label.innerText.trim().includes("中文标题");
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
