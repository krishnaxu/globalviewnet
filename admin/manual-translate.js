
(function () {
  "use strict";

  const BUTTON_ID = "manual-translate-button";
  const BRIDGE_KEY = "__GVN_RICHTEXT_FIELDS__";
  const REQUEST_TIMEOUT = 300000;
  const MAX_CHUNK_LENGTH = 2000;

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

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      el.getAttribute("aria-hidden") !== "true"
    );
  }

  function getCodeMirror(field) {
    if (!field) return null;

    if (
      field.CodeMirror &&
      typeof field.CodeMirror.getValue === "function"
    ) {
      return field.CodeMirror;
    }

    const textarea = field.matches("textarea")
      ? field
      : field.querySelector("textarea");

    if (
      textarea &&
      textarea.CodeMirror &&
      typeof textarea.CodeMirror.getValue === "function"
    ) {
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
    const isSummary = /摘要|summary/i.test(labelText);

    const codeMirrorControl = controls.find(
      el => getCodeMirror(el)
    );

    if (codeMirrorControl) return codeMirrorControl;

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

  function getRichTextFieldName(labelText) {
    const normalized = normalize(labelText);

    if (normalized.startsWith(normalize("中文正文"))) {
      return "body_zh";
    }

    if (normalized.startsWith(normalize("English Body"))) {
      return "body_en";
    }

    return null;
  }

  function getRichTextDescriptor(fieldName) {
    const bridge = window[BRIDGE_KEY];
    const field = bridge && bridge[fieldName];

    if (
      !field ||
      typeof field.getValue !== "function" ||
      typeof field.setValue !== "function"
    ) {
      return null;
    }

    return {
      __gvnRichText: true,
      fieldName: fieldName
    };
  }

  function findField(labelText) {
    const richTextName = getRichTextFieldName(labelText);

    if (richTextName) {
      return getRichTextDescriptor(richTextName);
    }

    const label = getLabels().find(
      item => labelMatches(item, labelText)
    );

    if (!label) return null;

    const targetId = label.getAttribute("for");

    if (targetId) {
      const target = document.getElementById(targetId);

      if (target && isVisible(target)) {
        if (getCodeMirror(target)) return target;

        if (target.matches("textarea, input")) {
          return target;
        }
      }
    }

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

  function getBridgeEntry(field) {
    if (!field || !field.__gvnRichText) return null;

    const bridge = window[BRIDGE_KEY];
    const entry = bridge && bridge[field.fieldName];

    if (
      !entry ||
      typeof entry.getValue !== "function" ||
      typeof entry.setValue !== "function"
    ) {
      return null;
    }

    return entry;
  }

  function getFieldValue(field) {
    if (!field) return "";

    if (field.__gvnRichText) {
      const entry = getBridgeEntry(field);
      if (!entry) return "";

      const value = entry.getValue();
      return value == null ? "" : String(value);
    }

    const editor = getCodeMirror(field);

    if (editor) return editor.getValue() || "";

    if (field.matches("textarea, input")) {
      return field.value || "";
    }

    return "";
  }

  function setFieldValue(field, value) {
    if (!field) return false;

    value = value == null ? "" : String(value);

    if (field.__gvnRichText) {
      const entry = getBridgeEntry(field);
      if (!entry) return false;

      try {
        entry.setValue(value);
        return true;
      } catch (error) {
        console.error(
          "[GVN Translate] 富文本写入失败：",
          field.fieldName,
          error
        );
        return false;
      }
    }

    if (!field.isConnected) return false;

    const editor = getCodeMirror(field);

    if (editor) {
      editor.setValue(value);
      return editor.getValue() === value;
    }

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

    return false;
  }

  // 长文本优先按段落和句子切分。
  function splitLongBlock(text) {
    const chunks = [];
    let remaining = text.trim();

    while (remaining.length > MAX_CHUNK_LENGTH) {
      let cut = remaining.lastIndexOf(
        "\n",
        MAX_CHUNK_LENGTH
      );

      if (cut < MAX_CHUNK_LENGTH / 2) {
        cut = remaining.lastIndexOf(
          "。",
          MAX_CHUNK_LENGTH
        );
      }

      if (cut < MAX_CHUNK_LENGTH / 2) {
        cut = remaining.lastIndexOf(
          ". ",
          MAX_CHUNK_LENGTH
        );

        if (cut >= 0) cut += 1;
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

  // 每个原文段落对应一个或多个翻译分块。
  function splitText(text) {
    const normalizedText = String(text || "")
      .replace(/\r\n?/g, "\n")
      .trim();

    if (!normalizedText) return [];

    const blocks = normalizedText.split(/\n[ \t]*\n+/);
    const paragraphs = [];

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      const chunks =
        trimmed.length <= MAX_CHUNK_LENGTH
          ? [trimmed]
          : splitLongBlock(trimmed);

      paragraphs.push(chunks);
    }

    return paragraphs;
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
          headers: {
            "Content-Type": "application/json"
          },
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

        if (result.finishReason === "length") {
          const error = new Error(
            "模型输出触及 Token 上限，当前分块的译文可能不完整。" +
            "系统已停止接受该段译文，请缩小分块或调整输出上限后重试。"
          );

          error.code = "TRANSLATION_OUTPUT_TRUNCATED";
          throw error;
        }

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
            "接口没有收到预期的中文原文，请检查字段读取"
          );
        }

        return translation.trim();
      } catch (error) {
        lastError = error;

        if (
          error &&
          error.code === "TRANSLATION_OUTPUT_TRUNCATED"
        ) {
          throw error;
        }

        if (attempt < 2) {
          await new Promise(
            resolve => setTimeout(resolve, 1000)
          );
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (lastError && lastError.name === "AbortError") {
      throw new Error(
        "翻译请求超过 5 分钟，重试后仍然失败"
      );
    }

    throw lastError || new Error("翻译请求失败");
  }

  async function translateText(text, progress) {
    const source = String(text || "").replace(/\r\n?/g, "\n");
    const protectedItems = [];
    let completed = 0;

    function protect(value, type) {
      const token =
        "GVNKEEP" +
        type +
        String(protectedItems.length).padStart(5, "0") +
        "END";

      protectedItems.push({ token, value, type });
      return token;
    }

// 保护完整图片语法，确保图片地址绝不被翻译。
let prepared = source.replace(
  /!\[[^\]]*\]\([^)\n]*\)/g,
  match => protect(match, "IMAGE")
);

    // 只保护普通 Markdown 链接的目标地址，显示文字仍可翻译。
    prepared = prepared.replace(
      /(?<!!)\[([^\]\n]*)\]\(([^)\n]*)\)/g,
      (match, label, target) =>
        "[" + label + "](" + protect(target, "URL") + ")"
    );

    // 保护标记必须从待翻译文本中剥离，不能交给翻译模型处理。
    const tokenPattern = protectedItems.length
      ? new RegExp(
          "(" +
          protectedItems
            .map(item => item.token)
            .join("|") +
          ")",
          "g"
        )
      : null;

    function splitSafely(value) {
      const chunks = [];
      let remaining = value;

      while (remaining.length > MAX_CHUNK_LENGTH) {
        let cut = -1;
        const limit = MAX_CHUNK_LENGTH;
        const minimum = Math.floor(limit / 2);

        const candidates = [
          remaining.lastIndexOf("\n", limit),
          remaining.lastIndexOf("。", limit),
          remaining.lastIndexOf("！", limit),
          remaining.lastIndexOf("？", limit),
          remaining.lastIndexOf(". ", limit) + 1,
          remaining.lastIndexOf("! ", limit) + 1,
          remaining.lastIndexOf("? ", limit) + 1,
          remaining.lastIndexOf(" ", limit)
        ];

        for (const candidate of candidates) {
          if (candidate >= minimum && candidate <= limit) {
            cut = Math.max(cut, candidate);
          }
        }

        if (cut < minimum) cut = limit;

        // 不允许在保护标记中间切开。
        for (const item of protectedItems) {
          const start = remaining.indexOf(item.token);
          if (start < 0) continue;

          const end = start + item.token.length;

          if (cut > start && cut < end) {
            cut = start > 0 ? start : end;
          }
        }

        if (cut <= 0) cut = limit;

        chunks.push(remaining.slice(0, cut));
        remaining = remaining.slice(cut);
      }

      if (remaining) chunks.push(remaining);
      return chunks;
    }

    async function translateChunk(raw) {
      const leading = (raw.match(/^\s*/) || [""])[0];
      const trailing = (raw.match(/\s*$/) || [""])[0];
      const end = raw.length - trailing.length;
      const core = raw.slice(leading.length, end);

      if (!core) return raw;

      const result = await requestTranslation(core);

      completed++;
      if (typeof progress === "function") {
      progress(completed, completed)
      }

      return leading + result + trailing;
    }

    async function translatePlainText(value) {
      // 先按保护标记切分；标记原样保留，绝不发送给模型。
      const pieces = tokenPattern
        ? value.split(tokenPattern)
        : [value];

      const output = [];

      for (const piece of pieces) {
        const protectedItem = protectedItems.find(
          item => item.token === piece
        );

        if (protectedItem) {
          output.push(piece);
          continue;
        }

        // 保留段落之间的空行。
        const paragraphs = piece.split(/(\n[ \t]*\n+)/);

        for (const paragraph of paragraphs) {
          if (!paragraph.trim()) {
            output.push(paragraph);
            continue;
          }

          const chunks = splitSafely(paragraph);

          for (const chunk of chunks) {
            output.push(await translateChunk(chunk));
          }
        }
      }

      return output.join("");
    }

    // 标题行单独处理，保留原始 # 数量、空格和换行。
    const headingPattern =
      /^([ \t]{0,3})(#{1,6})([ \t]+)([^\n]*?)(\n?)$/;

    const segments = prepared.split(
      /(^[ \t]{0,3}#{1,6}[ \t]+[^\n]*(?:\n|$))/gm
    );

    const output = [];

    for (const segment of segments) {
      const match = segment.match(headingPattern);

      if (!match) {
        output.push(await translatePlainText(segment));
        continue;
      }

      const [, indent, marker, spacing, headingText, newline] = match;
      const translatedHeading = headingText.trim()
        ? await translatePlainText(headingText)
        : headingText;

      output.push(
        indent +
        marker +
        spacing +
        translatedHeading +
        newline
      );
    }

    let translated = output.join("");

    // 每个保护标记必须恰好出现一次。
    for (const item of protectedItems) {
      const count = translated.split(item.token).length - 1;

      if (count !== 1) {
        throw new Error(
        (item.type === "IMAGE" ? "图片" : "链接或图片地址") +
        "保护标记校验失败，已停止回填。请勿保存或发布文章。"
        );
      }
    }

    // 恢复原始图片语法和链接目标地址。
    for (const item of protectedItems) {
      translated = translated.replace(item.token, item.value);
    }

    if (/GVNKEEP(?:IMAGE|URL)\d{5}END/.test(translated)) {
      throw new Error(
        "发现未恢复的 Markdown 保护标记，已停止回填。请勿保存或发布文章。"
      );
    }

    return translated;
  }
  
  // 提取 Markdown 结构。图片替代文字和链接显示文字允许翻译.
  function getMarkdownStructure(text) {
    const source = String(text || "");

const images = Array.from(
  source.matchAll(/!\[[^\]]*\]\(([^)\n]*)\)/g),
  match => match[1].trim()
);

    const linkTargets = Array.from(
      source.matchAll(/(?<!!)\[[^\]]*\]\(([^)\n]*)\)/g),
      match => match[1].trim()
    );

    return {
      headingLevels: Array.from(
        source.matchAll(/^ {0,3}(#{1,6})[ \t]+/gm),
        match => match[1].length
      ),

      listMarkers: Array.from(
        source.matchAll(/^(\s{0,3})([-+*]|\d+[.)])[ \t]+/gm),
        match => ({
          indent: match[1].length,
          type: /^\d/.test(match[2])
            ? (match[2].endsWith(")") ? "ordered-paren" : "ordered-dot")
            : "unordered"
        })
      ),

      quoteLines: Array.from(
        source.matchAll(/^ {0,3}(>+)/gm),
        match => match[1].length
      ),

      images,
      linkTargets,

      codeFences: Array.from(
        source.matchAll(/^ {0,3}(`{3,}|~{3,})/gm),
        match => match[1][0] + match[1].length
      )
    };
  }

  function validateMarkdownStructure(original, translated) {
    const originalStructure = getMarkdownStructure(original);
    const translatedStructure = getMarkdownStructure(translated);

    const labels = {
      headingLevels: "标题层级",
      listMarkers: "列表格式",
      quoteLines: "引用格式",
      images: "图片地址",
      linkTargets: "链接地址",
      codeFences: "代码块格式"
    };

    const mismatches = Object.keys(labels).filter(key =>
      JSON.stringify(originalStructure[key]) !==
      JSON.stringify(translatedStructure[key])
    );

    if (mismatches.length > 0) {
      console.warn(
        "[GVN Translate] Markdown结构差异：\n" +
        JSON.stringify(
          mismatches.map(key => ({
            项目: labels[key],
            原文: originalStructure[key],
            译文: translatedStructure[key]
          })),
          null,
          2
        )
      );
    }

const criticalMismatches = [
  "headingLevels",
  "listMarkers",
  "quoteLines",
  "images",
  "linkTargets",
  "codeFences"
].filter(
  key =>
    JSON.stringify(originalStructure[key]) !==
    JSON.stringify(translatedStructure[key])
);
    if (criticalMismatches.length > 0) {
      throw new Error(
      "正文 Markdown 结构校验失败：" +
criticalMismatches.map(key => labels[key]).join("、") +
"。系统已停止回填，请检查原文和译文后再继续。"
      );
    }

    return mismatches;
  }

  function cleanEnglishTitle(title) {
    return String(title || "")
      .trim()
      .replace(/[.。]+$/u, "")
      .trim();
  }

  async function waitForValue(field, expectedValue) {
    for (let i = 0; i < 40; i++) {
      await new Promise(
        resolve => setTimeout(resolve, 150)
      );

      const currentField = field.__gvnRichText
        ? getRichTextDescriptor(field.fieldName)
        : field;

      if (
        currentField &&
        getFieldValue(currentField) === expectedValue
      ) {
        return true;
      }
    }

    return false;
  }

  async function translateFields(button) {
    const definitions = [
      {
        zh: "中文标题",
        en: "English Title",
        name: "标题",
        type: "title"
      },
      {
        zh: "中文摘要",
        en: "English Summary",
        name: "摘要",
        type: "summary"
      },
      {
        zh: "中文正文",
        en: "English Body",
        name: "正文",
        type: "body"
      }
    ];

    const jobs = [];

    for (const item of definitions) {
      const zhField = findField(item.zh);
      const enField = findField(item.en);

      if (!zhField || !enField) {
        const missing = [];

        if (!zhField) missing.push(item.zh);
        if (!enField) missing.push(item.en);

        alert(
          "找不到以下字段：\n" +
          missing.join("、") +
          "\n\n请确认对应字段可见，并确认富文本桥接组件已加载。"
        );

        return;
      }

      const chinese = getFieldValue(zhField).trim();
      const english = getFieldValue(enField).trim();

      if (!chinese) continue;

      if (
        english &&
        !confirm(
          item.name +
          "的英文栏已有内容，是否重新翻译并覆盖？"
        )
      ) {
        continue;
      }

      jobs.push({
        item: item,
        text: chinese
      });
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

        let translated = await translateText(
          job.text,
          (current, total) => {
            button.textContent =
              "正在翻译" + item.name +
              "（" + current + "/" + total + "）…";
          }
        );

        if (item.type === "title") {
          translated = cleanEnglishTitle(translated);
        }

        if (item.type === "body") {
          validateMarkdownStructure(job.text, translated);
        }

        const target = findField(item.en);

        if (!target) {
          throw new Error(
            "无法定位" + item.name +
            "的英文编辑器。请勿保存文章。"
          );
        }

        if (!setFieldValue(target, translated)) {
          throw new Error(
            item.name +
            "的译文已生成，但写入失败。请勿保存文章。"
          );
        }

        const verified = await waitForValue(
          target,
          translated
        );

        if (!verified) {
          throw new Error(
            item.name +
            "的译文未能在 CMS 状态中得到确认。" +
            "请检查编辑器，暂勿保存或发布。"
          );
        }

        if (item.type === "body") {
          const refreshedTarget =
            getRichTextDescriptor("body_en");

          if (
            !refreshedTarget ||
            getFieldValue(refreshedTarget) !== translated
          ) {
            throw new Error(
              "英文正文已尝试回填，但正文桥接状态校验失败。" +
              "请检查编辑器，暂勿保存或发布。"
            );
          }
        }
      }

      alert(
        "翻译和回填已完成。\n\n" +
        "请检查英文标题、摘要、正文及右侧预览。\n" +
        "本按钮不会主动保存或发布文章。"
      );
    } catch (error) {
      console.error(
        "[GVN Translate] 手动翻译失败：",
        error
      );

      alert(
        "翻译未能全部完成：\n" +
        (error && error.message
          ? error.message
          : String(error)) +
        "\n\n请检查各字段；确认内容正确前，请勿保存或发布文章。"
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

  console.log(
    "[GVN Translate] 手动翻译按钮已加载（富文本桥接模式）。"
  );
})();
