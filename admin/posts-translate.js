(function () {
  "use strict";

  const MAX_CHARS = 2000;

  function createError(message, code) {
    const error = new Error(message);
    if (code) error.code = code;
    return error;
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

      // 避免在 UTF-16 代理对中间切分字符。
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

      // 尽量在空白处切分，减少单词被截断的情况。
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

  async function translateChunk(text) {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(100000)
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

        const marker = value.slice(0, markerLength);
        const inner = value.slice(markerLength, -markerLength);

        parts.push({
          type: "emphasis",
          marker: marker,
          value: inner
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
    // 保留标题、引用和列表前缀。
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

      try {
        const [prefix, content] = splitPrefix(line);

        if (!content.trim()) {
          output.push(line);
          continue;
        }

        output.push(prefix + await translateInline(content));
      } catch (error) {
        if (error && error.code === "AUTH_REQUIRED") {
          throw error;
        }

        console.warn("该行翻译失败，保留原文：", error);
        output.push(line);
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

    try {
      const translated = isMarkdown
        ? await translateMarkdown(chinese)
        : await translateInline(chinese);

      if (translated && translated.trim()) {
        return data.set(enKey, translated);
      }
    } catch (error) {
      if (error && error.code === "AUTH_REQUIRED") {
        throw error;
      }

      console.warn("自动翻译失败，保留中文并继续：" + zhKey, error);
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
            "请重新登录 CMS，然后再次保存文章。\n" +
            "本次不会使用 MyMemory 备用翻译。"
          );
        } else {
          console.warn("翻译流程异常，保留现有内容并继续保存：", error);
        }
      }

      return data;
    }
  });

  console.log("文章自动翻译脚本已加载（2000 字符分段版，无备用翻译）");
})();
