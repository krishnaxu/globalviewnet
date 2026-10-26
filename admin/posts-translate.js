
(function () {
  "use strict";

  const MAX_CHARS = 2000;
  const MAX_TRANSLATION_RETRIES = 1;

  function createError(message, code) {
    const error = new Error(message);
    if (code) error.code = code;
    return error;
  }

  function containsChinese(text) {
    return /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(text);
  }

  function splitText(text, maxChars) {
    const chunks = [];
    let rest = text;

    while (rest.length) {
      if (rest.length <= maxChars) {
        chunks.push(rest);
        break;
      }

      let end = maxChars;
      const previousCode = rest.charCodeAt(end - 1);
      const nextCode = rest.charCodeAt(end);

      if (
        previousCode >= 0xD800 &&
        previousCode <= 0xDBFF &&
        nextCode >= 0xDC00 &&
        nextCode <= 0xDFFF
      ) {
        end--;
      }

      let lastSpace = -1;

      for (let i = end - 1; i >= Math.floor(end / 2); i--) {
        if (/\s/.test(rest[i])) {
          lastSpace = i + 1;
          break;
        }
      }

      if (lastSpace > 0) {
        end = lastSpace;
      }

      if (end <= 0) {
        throw new Error("文本拆分失败");
      }

      chunks.push(rest.slice(0, end));
      rest = rest.slice(end);
    }

    return chunks;
  }

  async function requestTranslation(text, retry) {
    const instruction = retry
      ? "Translate the entire text into natural English. Do not leave any Chinese words or characters untranslated. Preserve names, numbers, URLs, punctuation, and the original meaning. Return only the English translation."
      : null;

    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: instruction
          ? instruction + "\n\nText to translate:\n" + text
          : text
      }),
      signal: AbortSignal.timeout(60000)
    });

    let result = {};

    try {
      result = await response.json();
    } catch {
      // 服务端没有返回 JSON 时，使用通用错误提示。
    }

    if (response.status === 401) {
      throw createError(
        "CMS 翻译会话已失效。请重新登录 CMS，再保存文章以重新翻译。",
        "AUTH_REQUIRED"
      );
    }

    if (!response.ok) {
      const detail =
        typeof result.error === "string" && result.error.trim()
          ? result.error.trim()
          : "HTTP " + response.status;

      throw createError("翻译服务请求失败：" + detail);
    }

    if (
      typeof result.translation !== "string" ||
      !result.translation.trim()
    ) {
      throw new Error("翻译服务没有返回有效译文");
    }

    return result.translation.trim();
  }

  async function translateChunk(text) {
    let translated = await requestTranslation(text, false);

    for (let attempt = 0; containsChinese(translated) &&
         attempt < MAX_TRANSLATION_RETRIES; attempt++) {
      translated = await requestTranslation(text, true);
    }

    if (containsChinese(translated)) {
      throw createError(
        "译文仍包含中文，已停止保存不完整的英文译文。请检查对应字段后重新保存。",
        "CHINESE_REMAINS"
      );
    }

    return translated;
  }

  async function translatePlainText(text) {
    const chunks = splitText(text, MAX_CHARS);
    const result = [];

    for (const chunk of chunks) {
      result.push(await translateChunk(chunk));
    }

    return result.join("");
  }

  // 保护行内 Markdown，只翻译标记之间的文本。
  async function translateInline(text) {
    const pattern = new RegExp(
      "!\\[[^\\]]*\\]\\([^)]*\\)|\\[[^\\]]*\\]\\([^)]*\\)|`[^`\\n]*`|<https?:\\/\\/[^>]+>|https?:\\/\\/[^\\s)]+|<[^>]+>|\\*\\*[\\s\\S]+?\\*\\*|__[\\s\\S]+?__|~~[\\s\\S]+?~~|\\*[^*\\n]+\\*|_[^_\\n]+_",
      "g"
    );

    const parts = [];
    let last = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > last) {
        parts.push({
          type: "text",
          value: text.slice(last, match.index)
        });
      }

      const value = match[0];

      if (
        value.startsWith("**") ||
        value.startsWith("__") ||
        value.startsWith("~~") ||
        (value.startsWith("*") && !value.startsWith("**")) ||
        (value.startsWith("_") && !value.startsWith("__"))
      ) {
        const markerLength =
          value.startsWith("**") ||
          value.startsWith("__") ||
          value.startsWith("~~")
            ? 2
            : 1;

        parts.push({
          type: "emphasis",
          marker: value.slice(0, markerLength),
          value: value.slice(markerLength, -markerLength)
        });
      } else {
        parts.push({
          type: "protected",
          value: value
        });
      }

      last = pattern.lastIndex;
    }

    if (last < text.length) {
      parts.push({
        type: "text",
        value: text.slice(last)
      });
    }

    const output = [];

    for (const part of parts) {
      if (part.type === "protected") {
        output.push(part.value);
      } else if (part.type === "emphasis") {
        const translated = await translatePlainText(part.value);
        output.push(part.marker + translated.trim() + part.marker + " ");
      } else {
        output.push(await translatePlainText(part.value));
      }
    }

    return output.join("");
  }

  function splitPrefix(line) {
    const prefixPattern = new RegExp(
      "^(\\s*(?:(?:>\\s*)*)(?:(?:[-+*]|\\d+[.)])\\s+)?(?:#{1,6}\\s+)?)(.*)$"
    );

    const match = line.match(prefixPattern);

    if (!match) {
      return ["", line];
    }

    return [match[1], match[2]];
  }

  async function translateMarkdown(text) {
    const lines = text.split("\n");
    const output = [];
    let inFence = false;
    let fenceChar = "";

    for (const line of lines) {
      const fence = line.match(/^ {0,3}(`{3,}|~{3,})/);

      if (fence) {
        if (!inFence) {
          inFence = true;
          fenceChar = fence[1][0];
        } else if (fence[1][0] === fenceChar) {
          inFence = false;
          fenceChar = "";
        }

        output.push(line);
        continue;
      }

      if (
        inFence ||
        !line.trim() ||
        /^ {4,}/.test(line) ||
        /^\s*(?:[-*_]\s*){3,}$/.test(line)
      ) {
        output.push(line);
        continue;
      }

      const [prefix, content] = splitPrefix(line);

      if (!content.trim()) {
        output.push(line);
        continue;
      }

      try {
        output.push(prefix + await translateInline(content));
      } catch (error) {
        if (error && error.code === "AUTH_REQUIRED") {
          throw error;
        }

        if (error && error.code === "CHINESE_REMAINS") {
          throw createError(
            "正文翻译未完成：某一行重试后仍有中文。为避免生成不完整的英文正文，本次不会写入新的英文正文。请检查后重新保存。",
            "CHINESE_REMAINS"
          );
        }

        throw error;
      }
    }

    return output.join("\n");
  }

  async function translateField(data, zhKey, enKey, isMarkdown) {
    const chinese = data.get(zhKey);
    const english = data.get(enKey);

    // 不覆盖已经填写的英文内容。
    if (typeof english === "string" && english.trim()) {
      return data;
    }

    if (typeof chinese !== "string" || !chinese.trim()) {
      return data;
    }

    const translated = isMarkdown
      ? await translateMarkdown(chinese)
      : await translateInline(chinese);

    if (translated && translated.trim()) {
      return data.set(enKey, translated);
    }

    return data;
  }

  if (
    !window.CMS ||
    typeof window.CMS.registerEventListener !== "function"
  ) {
    console.error("自动翻译初始化失败：未找到 CMS 事件接口");
    return;
  }

  window.CMS.registerEventListener({
    name: "preSave",

    handler: async function ({ entry }) {
      if (entry.get("collection") !== "posts") {
        return;
      }

      let data = entry.get("data");

      try {
        data = await translateField(data, "title_zh", "title_en", false);
        data = await translateField(data, "excerpt_zh", "excerpt_en", false);
        data = await translateField(data, "body_zh", "body_en", true);
      } catch (error) {
        if (error && error.code === "AUTH_REQUIRED") {
          window.alert(
            "自动翻译已停止：CMS 翻译会话已失效。\n\n" +
            "请重新登录 CMS，然后再次保存文章。"
          );
        } else if (error && error.code === "CHINESE_REMAINS") {
          window.alert(
            "自动翻译未完成：译文中仍有中文，或某个字段翻译失败。\n\n" +
            "为避免将不完整译文写入英文栏位，本次停止后续翻译。请检查英文标题、摘要和正文，再重新保存。"
          );
        } else {
          console.warn("翻译流程异常：", error);
          window.alert(
            "自动翻译遇到错误，本次没有完成全部英文翻译。请检查英文栏位后再保存。"
          );
        }
      }

      return data;
    }
  });

  console.log("文章自动翻译脚本已加载（2000 字符分段版，无备用翻译，含中文残留检查）");
})();
