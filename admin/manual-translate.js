(function () {
  "use strict";

  const BUTTON_ID = "manual-translate-button";
  const REQUEST_TIMEOUT = 90000;
  const MAX_CHUNK_LENGTH = 700;

  // 禁止直接操作 contenteditable / Slate DOM。
  const FIELD_SELECTOR =
    ".CodeMirror, textarea, input:not([type='checkbox']):not([type='radio'])";

  function normalize(text) {
    return (text || "")
      .replace(/\(OPTIONAL\)/gi, "")
      .replace(/[：:（）()]/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function getLabels() {
    return Array.from(document.querySelectorAll("label"));
  }

  function labelMatches(label, wanted) {
    return normalize(label.innerText || label.textContent)
      .startsWith(normalize(wanted));
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;

    const style = window.getComputedStyle(el);

    return style.display !== "none" &&
      style.visibility !== "hidden" &&
      el.getAttribute("aria-hidden") !== "true";
  }

  function getCodeMirror(field) {
    if (!field) return null;

    if (field.CodeMirror &&
        typeof field.CodeMirror.getValue === "function") {
      return field.CodeMirror;
    }

    const textarea = field.matches("textarea")
      ? field
      : field.querySelector("textarea");

    if (textarea &&
        textarea.CodeMirror &&
        typeof textarea.CodeMirror.getValue === "function") {
      return textarea.CodeMirror;
    }

    return null;
  }

  function getControls(container) {
    if (!container) return [];

    return Array.from(container.querySelectorAll(FIELD_SELECTOR))
      .filter(isVisible);
  }

  function chooseControl(controls, labelText) {
    const isBody = /正文|body/i.test(labelText);
    const isSummary = /摘要|summary/i.test(labelText);

    if (isBody) {
      // 优先选择 Markdown 编辑器。
      return (
        controls.find(el => el.matches(".CodeMirror")) ||
        controls.find(el => !!getCodeMirror(el)) ||
        controls.find(el => el.matches("textarea")) ||
        null
      );
    }

    if (isSummary) {
      return (
        controls.find(el => el.matches("textarea")) ||
        controls.find(el => el.matches("input")) ||
        null
      );
    }

    return (
      controls.find(el => el.matches("input")) ||
      controls.find(el => el.matches("textarea")) ||
      null
    );
  }

  function findField(labelText) {
    const label = getLabels().find(
      item => labelMatches(item, labelText)
    );

    if (!label) return null;

    // 如果 label 明确关联输入框，优先使用该输入框。
    const targetId = label.getAttribute("for");

    if (targetId) {
      const target = document.getElementById(targetId);

      if (target && isVisible(target)) {
        const editor = getCodeMirror(target);

        if (editor) return target;

        if (target.matches("textarea, input")) {
          return target;
        }
      }
    }

    // 从字段专属容器开始查找，避免跨字段误选。
    const container = label.closest(
      '[class*="ControlContainer"], [class*="Field"], fieldset'
    );

    if (container) {
      const found = chooseControl(
        getControls(container),
        labelText
      );

      if (found) return found;
    }

    // 逐层向上查找；遇到其他字段标签时停止。
    let parent = label.parentElement;

    for (let i = 0; parent && i < 8; i++) {
      const otherLabels = Array.from(
        parent.querySelectorAll("label")
      ).filter(item => item !== label);

      if (otherLabels.length > 0) break;

      const found = chooseControl(
        getControls(parent),
        labelText
      );

      if (found) return found;

      parent = parent.parentElement;
    }

    return null;
  }

  function getFieldValue(field) {
    if (!field) return "";

    const editor = getCodeMirror(field);

    if (editor) return editor.getValue() || "";

    if (field.matches("textarea, input")) {
      return field.value || "";
    }

    return "";
  }

  function setFieldValue(field, value) {
    if (!field || !field.isConnected) return false;

    const editor = getCodeMirror(field);

    // 通过 CodeMirror 自身 API 更新编辑器状态。
    if (editor) {
      editor.setValue(value);

      return editor.getValue() === value;
    }

    // 通过原生输入框 setter 更新受控输入值。
    if (field.matches("textarea, input")) {
      const prototype = field.matches("textarea")
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;

      const descriptor = Object.getOwnPropertyDescriptor(
        prototype,
        "value"
      );

      if (descriptor && descriptor.set) {
        descriptor.set.call(field, value);
      } else {
        field.value = value;
      }

      field.dispatchEvent(
        new Event("input", { bubbles: true })
      );

      field.dispatchEvent(
        new Event("change", { bubbles: true })
      );

      return field.value === value;
    }

    // 绝不使用 execCommand 或修改 Slate 的 contenteditable DOM。
    return false;
  }

  function splitText(text) {
    const chunks = [];
    let remaining = text.trim();

    while (remaining.length > MAX_CHUNK_LENGTH) {
      let cut = remaining.lastIndexOf("\n", MAX_CHUNK_LENGTH);

      if (cut < MAX_CHUNK_LENGTH / 2) {
        cut = remaining.lastIndexOf("。", MAX_CHUNK_LENGTH);
      }

      if (cut < MAX_CHUNK_LENGTH / 2) {
        cut = remaining.lastIndexOf(". ", MAX_CHUNK_LENGTH);
      }

      if (cut < MAX_CHUNK_LENGTH / 2) {
        cut = MAX_CHUNK_LENGTH;
      }

      chunks.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }

    if (remaining) chunks.push(remaining);

    return chunks;
  }

  async function requestTranslation(text) {
    let lastError;

    for (let attempt = 1; attempt <= 2; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT
      );

      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(
            "翻译接口请求失败，状态码：" + response.status
          );
        }

        const result = await response.json();
        const translation = result.translation;

        if (
          typeof translation !== "string" ||
          !translation.trim()
        ) {
          throw new Error("接口没有返回有效译文");
        }

        if (
          /the user has not provided the chinese text/i.test(
            translation
          )
        ) {
          throw new Error(
            "接口没有收到预期的中文原文，请检查字段识别"
          );
        }

        return translation.trim();
      } catch (error) {
        lastError = error;

        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (lastError && lastError.name === "AbortError") {
      throw new Error("正文请求超过 90 秒，重试后仍然失败");
    }

    throw lastError || new Error("翻译请求失败");
  }

  async function translateText(text, progress) {
    const chunks = splitText(text);
    const results = [];

    for (let i = 0; i < chunks.length; i++) {
      progress(i + 1, chunks.length);

      results.push(await requestTranslation(chunks[i]));
    }

    return results.join("\n\n");
  }

  async function translateFields(button) {
    const definitions = [
      { zh: "中文标题", en: "English Title", name: "标题" },
      { zh: "中文摘要", en: "English Summary", name: "摘要" },
      { zh: "中文正文", en: "English Body", name: "正文" }
    ];

    const jobs = [];

    for (const item of definitions) {
      const zhField = findField(item.zh);
      const enField = findField(item.en);

      if (!zhField || !enField) {
        alert(
          "找不到“" + item.zh + "”或对应的英文编辑器。\n\n" +
          "请确认对应字段已显示，并将英文正文切换到 Markdown 模式。"
        );
        return;
      }

      const chinese = getFieldValue(zhField).trim();
      const english = getFieldValue(enField).trim();

      if (!chinese) continue;

      if (english && !confirm(
        item.name + "的英文栏已有内容，是否重新翻译并覆盖？"
      )) {
        continue;
      }

      jobs.push({ item, text: chinese });
    }

    if (!jobs.length) {
      alert("没有找到需要翻译的中文内容。");
      return;
    }

    button.disabled = true;

    try {
      for (const job of jobs) {
        const item = job.item;

        button.textContent = "正在翻译" + item.name + "…";

        const translated = await translateText(
          job.text,
          (current, total) => {
            button.textContent =
              "正在翻译" + item.name +
              "（" + current + "/" + total + "）…";
          }
        );

        // 翻译完成后重新查找字段，避免使用旧 DOM。
        const target = findField(item.en);

        if (!target) {
          throw new Error(
            item.name + "的英文编辑器已无法定位。请勿保存文章。"
          );
        }

        if (!setFieldValue(target, translated)) {
          throw new Error(
            item.name +
            "的译文已生成，但当前编辑器不是受支持的 Markdown 输入框。" +
            "为避免再次破坏 Slate 编辑器，本次已停止写入。请勿保存文章。"
          );
        }

        await new Promise(resolve => setTimeout(resolve, 300));

        const updatedTarget = findField(item.en);

        if (getFieldValue(updatedTarget) !== translated) {
          throw new Error(
            item.name +
            "的译文写入后没有保留，说明 CMS 状态未同步。请勿保存文章。"
          );
        }
      }

      alert(
        "翻译和回填已完成。\n\n" +
        "请检查英文标题、摘要、正文和右侧预览。\n" +
        "本按钮不会主动保存或发布文章。"
      );
    } catch (error) {
      console.error("手动翻译失败：", error);

      alert(
        "翻译未能全部完成：\n" +
        error.message +
        "\n\n请勿保存或发布文章。"
      );
    } finally {
      button.disabled = false;
      button.textContent = "手动翻译英文";
    }
  }

  function addButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const hasChineseTitle = getLabels().some(
      label => labelMatches(label, "中文标题")
    );

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

    button.addEventListener("click", () => {
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

  console.log("手动翻译按钮脚本已加载（安全写入模式）");
})();
