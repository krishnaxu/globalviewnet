(function () {
  "use strict";

  const BUTTON_ID = "manual-translate-button";
  const REQUEST_TIMEOUT = 90000;
  const MAX_CHUNK_LENGTH = 700;

  const FIELD_SELECTOR = [
    "input:not([type='checkbox']):not([type='radio'])",
    "textarea",
    "[contenteditable='true']",
    "[role='textbox']",
    ".CodeMirror"
  ].join(",");

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
    return normalize(label.innerText || label.textContent).startsWith(
      normalize(wanted)
    );
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

  function isVisible(field) {
    if (!field || !field.isConnected) return false;

    const style = window.getComputedStyle(field);

    return style.display !== "none" &&
      style.visibility !== "hidden" &&
      field.getAttribute("aria-hidden") !== "true";
  }

  function getControls(container) {
    if (!container) return [];

    return Array.from(container.querySelectorAll(FIELD_SELECTOR))
      .filter(isVisible);
  }

  function chooseControl(controls, labelText) {
    if (!controls.length) return null;

    const isBody = /正文|body/i.test(labelText);
    const isSummary = /摘要|summary/i.test(labelText);

    if (isBody) {
      return (
        controls.find(el => el.matches(".CodeMirror")) ||
        controls.find(el => !!getCodeMirror(el)) ||
        controls.find(el => el.matches("textarea")) ||
        controls.find(el => el.matches('[contenteditable="true"]')) ||
        controls.find(el => el.getAttribute("role") === "textbox") ||
        null
      );
    }

    if (isSummary) {
      return (
        controls.find(el => el.matches("textarea")) ||
        controls.find(el => el.matches('[contenteditable="true"]')) ||
        controls.find(el => el.matches("input")) ||
        null
      );
    }

    return (
      controls.find(el => el.matches("input")) ||
      controls.find(el => el.matches("textarea")) ||
      controls.find(el => el.matches('[contenteditable="true"]')) ||
      null
    );
  }

  function findField(labelText) {
    const labels = getLabels();
    const label = labels.find(item => labelMatches(item, labelText));

    if (!label) return null;

    // 优先使用 label 的 for 属性精确定位。
    const targetId = label.getAttribute("for");

    if (targetId) {
      const target = document.getElementById(targetId);

      if (target && isVisible(target)) {
        const editor = getCodeMirror(target);
        if (editor) return target;
        if (target.matches(FIELD_SELECTOR)) return target;
      }
    }

    // 从最靠近当前标签的容器向外查找，
    // 优先选只包含当前字段标签的容器，避免误选其他字段。
    let parent = label.parentElement;

    for (let i = 0; parent && i < 10; i++) {
      const containerLabels = Array.from(
        parent.querySelectorAll("label")
      );

      const matchingLabels = containerLabels.filter(
        item => labelMatches(item, labelText)
      );

      if (matchingLabels.length === 1 &&
          containerLabels.length <= 1) {
        const controls = getControls(parent);
        const chosen = chooseControl(controls, labelText);

        if (chosen) return chosen;
      }

      parent = parent.parentElement;
    }

    // 兜底：在明确的字段容器内查找。
    const container = label.closest(
      '[class*="ControlContainer"], [class*="Field"], fieldset'
    );

    if (container) {
      const controls = getControls(container);
      const chosen = chooseControl(controls, labelText);

      if (chosen) return chosen;
    }

    return null;
  }

  function getFieldValue(field) {
    if (!field) return "";

    const editor = getCodeMirror(field);

    if (editor) {
      return editor.getValue() || "";
    }

    if ("value" in field && typeof field.value === "string") {
      return field.value;
    }

    return field.innerText || field.textContent || "";
  }

  function dispatchEditorEvents(field) {
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setFieldValue(field, value) {
    if (!field || !field.isConnected) return false;

    // CodeMirror：使用编辑器 API 更新真实编辑器状态。
    const editor = getCodeMirror(field);

    if (editor) {
      editor.setValue(value);
      editor.refresh();

      return editor.getValue() === value;
    }

    // 原生 input / textarea：使用原生 value setter，
    // 然后触发事件通知 React / Decap CMS。
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

      dispatchEditorEvents(field);

      return field.value === value;
    }

    // 富文本编辑器：尝试通过编辑命令更新正文。
    if (
      field.isContentEditable ||
      field.getAttribute("role") === "textbox"
    ) {
      field.focus();

      const selection = window.getSelection();
      const range = document.createRange();

      range.selectNodeContents(field);
      selection.removeAllRanges();
      selection.addRange(range);

      const success = document.execCommand(
        "insertText",
        false,
        value
      );

      if (success) {
        dispatchEditorEvents(field);
      }

      return success &&
        getFieldValue(field) === value;
    }

    return false;
  }

  function splitText(text) {
    const chunks = [];
    let remaining = text.trim();

    while (remaining.length > MAX_CHUNK_LENGTH) {
      let cut = remaining.lastIndexOf(
        "\n",
        MAX_CHUNK_LENGTH
      );

      if (cut < Math.floor(MAX_CHUNK_LENGTH / 2)) {
        cut = remaining.lastIndexOf(
          "。",
          MAX_CHUNK_LENGTH
        );
      }

      if (cut < Math.floor(MAX_CHUNK_LENGTH / 2)) {
        cut = remaining.lastIndexOf(
          ". ",
          MAX_CHUNK_LENGTH
        );
      }

      if (cut < Math.floor(MAX_CHUNK_LENGTH / 2)) {
        cut = MAX_CHUNK_LENGTH;
      } else if (remaining[cut] === ".") {
        cut += 1;
      } else {
        cut += 1;
      }

      chunks.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }

    if (remaining) chunks.push(remaining);

    return chunks;
  }

  async function requestTranslation(chunk) {
    let lastError;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          REQUEST_TIMEOUT
        );

        let response;

        try {
          response = await fetch("/api/translate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ text: chunk }),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }

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
          throw new Error("翻译接口没有返回有效译文");
        }

        // 防止接口把提示性错误文字当成译文返回。
        if (
          /the user has not provided the chinese text/i.test(
            translation
          )
        ) {
          throw new Error(
            "接口提示没有收到中文原文，请检查字段识别是否正确"
          );
        }

        return translation.trim();
      } catch (error) {
        lastError = error;

        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (lastError && lastError.name === "AbortError") {
      throw new Error(
        "请求超过 90 秒仍未完成，重试后依然失败。"
      );
    }

    throw lastError || new Error("翻译请求失败");
  }

  async function translateText(text, onProgress) {
    const chunks = splitText(text);
    const results = [];

    for (let i = 0; i < chunks.length; i++) {
      onProgress(i + 1, chunks.length);

      const translated = await requestTranslation(chunks[i]);

      results.push(translated);
    }

    return results.join("\n\n");
  }

  async function translateFields(button) {
    const fields = [
      {
        zh: "中文标题",
        en: "English Title",
        name: "标题"
      },
      {
        zh: "中文摘要",
        en: "English Summary",
        name: "摘要"
      },
      {
        zh: "中文正文",
        en: "English Body",
        name: "正文"
      }
    ];

    const jobs = [];

    // 每次点击时重新查找字段，避免使用模式切换前的旧元素。
    for (const item of fields) {
      const zhField = findField(item.zh);
      const enField = findField(item.en);

      if (!zhField || !enField) {
        alert(
          "找不到“" + item.zh + "”或对应的英文编辑器。\n\n" +
          "请确认文章编辑页已打开，并且字段标签当前可见。\n\n" +
          "本次尚未开始翻译。"
        );
        return;
      }

      const chinese = getFieldValue(zhField).trim();
      const english = getFieldValue(enField).trim();

      if (!chinese) {
        continue;
      }

      if (english) {
        const overwrite = confirm(
          item.name +
          "的英文栏已有内容，是否重新翻译并覆盖？"
        );

        if (!overwrite) continue;
      }

      jobs.push({
        item,
        text: chinese
      });
    }

    if (!jobs.length) {
      alert("没有找到需要翻译的中文内容。请检查中文字段是否有内容。");
      return;
    }

    button.disabled = true;

    try {
      for (const job of jobs) {
        const item = job.item;

        button.textContent = "正在翻译" + item.name + "…";

        const translated = await translateText(
          job.text,
          function (current, total) {
            button.textContent =
              "正在翻译" + item.name +
              "（" + current + "/" + total + "）…";
          }
        );

        // 翻译期间 CMS 可能重新渲染，所以再次定位目标字段。
        const target = findField(item.en);

        if (!target) {
          throw new Error(
            item.name +
            "的译文已生成，但重新定位英文编辑器失败。请勿保存文章。"
          );
        }

        if (!setFieldValue(target, translated)) {
          throw new Error(
            item.name +
            "的译文已生成，但无法写入编辑器。请勿保存文章。"
          );
        }

        // 给 CMS 一次处理输入事件的机会，再检查内容是否保留。
        await new Promise(resolve => setTimeout(resolve, 300));

        const refreshedTarget = findField(item.en);
        const currentValue = getFieldValue(refreshedTarget);

        if (currentValue !== translated) {
          throw new Error(
            item.name +
            "的译文写入后没有保留，说明编辑器状态未同步。请勿保存文章。"
          );
        }
      }

      alert(
        "翻译和回填已完成。\n\n" +
        "请检查英文标题、摘要、正文及右侧预览。\n" +
        "本按钮不会主动保存或发布文章。"
      );
    } catch (error) {
      console.error("手动翻译失败：", error);

      alert(
        "翻译未能全部完成：\n" +
        error.message +
        "\n\n请检查已完成的字段，不要保存或发布测试文章。"
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
