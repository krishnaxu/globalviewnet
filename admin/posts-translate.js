
(function () {
  "use strict";

  const API = "https://api.mymemory.translated.net/get";
  const MAX_BYTES = 450;

  function byteLength(text) {
    return new TextEncoder().encode(text).length;
  }

  function splitText(text, maxBytes) {
    const chunks = [];
    let rest = text;

    while (rest.length) {
      if (byteLength(rest) <= maxBytes) {
        chunks.push(rest);
        break;
      }

      let end = 0;
      let lastSpace = -1;
      let size = 0;

      for (const char of rest) {
        const n = byteLength(char);
        if (size + n > maxBytes) break;

        size += n;
        end += char.length;

        if (/\s/.test(char)) lastSpace = end;
      }

      if (!end) throw new Error("文本拆分失败");

      if (lastSpace > end * 0.5) end = lastSpace;

      chunks.push(rest.slice(0, end));
      rest = rest.slice(end);
    }

    return chunks;
  }

  async function translateChunk(text) {
    const url = new URL(API);
    url.searchParams.set("q", text);
    url.searchParams.set("langpair", "zh-CN|en");

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) throw new Error("翻译请求失败");

    const result = await response.json();

    if (
      result.responseStatus !== 200 ||
      !result.responseData ||
      typeof result.responseData.translatedText !== "string"
    ) {
      throw new Error("没有获得有效译文");
    }

    const textarea = document.createElement("textarea");
    textarea.innerHTML = result.responseData.translatedText;
    return textarea.value;
  }

  async function translatePlainText(text) {
    const chunks = splitText(text, MAX_BYTES);
    const result = [];

    for (const chunk of chunks) {
      result.push(await translateChunk(chunk));
    }

    return result.join("");
  }

  // Protect inline Markdown, translate only the text between markers.

  async function translateInline(text) {
    const pattern =
      /!\[[^\]]*\]\([^)]*\)|\[[^\]]*\]\([^)]*\)|`[^`\n]*`|<https?:\/\/[^>]+>|https?:\/\/[^\s)]+|<[^>]+>|\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|\*[^*\n]+\*|_[^_\n]+_/g;

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
          value.startsWith("~~") ? 2 : 1;

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
    // Keep heading, blockquote and list prefixes exactly as written.
    const match = line.match(
      /^(\s*(?:(?:>\s*)*)(?:(?:[-+*]|\d+[.)])\s+)?(?:#{1,6}\s+)?)(.*)$/
    );

    if (!match) return ["", line];

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
        console.warn("该行翻译失败，保留原文：", error);
        output.push(line);
      }
    }

    return output.join("\n");
  }

  async function translateField(data, zhKey, enKey, isMarkdown) {
    const chinese = data.get(zhKey);
    const english = data.get(enKey);

    // Never overwrite existing English content.
    if (typeof english === "string" && english.trim()) return data;
    if (typeof chinese !== "string" || !chinese.trim()) return data;

    try {
      const translated = isMarkdown
        ? await translateMarkdown(chinese)
        : await translateInline(chinese);

      if (translated && translated.trim()) {
        return data.set(enKey, translated);
      }
    } catch (error) {
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
      if (entry.get("collection") !== "posts") return;

      let data = entry.get("data");

      try {
        data = await translateField(data, "title_zh", "title_en", false);
        data = await translateField(data, "excerpt_zh", "excerpt_en", false);
        data = await translateField(data, "body_zh", "body_en", true);
      } catch (error) {
        console.warn("翻译流程异常，继续保存：", error);
      }

      return data;
    }
  });

  console.log("文章自动翻译脚本已加载（Markdown 结构保护版）");
})();
