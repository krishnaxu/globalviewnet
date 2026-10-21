
(function () {
  "use strict";

  const API = "https://api.mymemory.translated.net/get";
  const MAX_BYTES = 450;

  function byteLength(text) {
    return new TextEncoder().encode(text).length;
  }

  function splitText(text, maxBytes) {
    const chunks = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (byteLength(remaining) <= maxBytes) {
        chunks.push(remaining);
        break;
      }

      let end = 0;
      let lastSpace = -1;
      let size = 0;

      for (const char of remaining) {
        const charSize = byteLength(char);

        if (size + charSize > maxBytes) break;

        size += charSize;
        end += char.length;

        if (/\s/.test(char)) lastSpace = end;
      }

      if (end === 0) {
        throw new Error("文本拆分失败");
      }

      if (lastSpace > 0 && lastSpace > end * 0.5) {
        end = lastSpace;
      }

      chunks.push(remaining.slice(0, end));
      remaining = remaining.slice(end);
    }

    return chunks;
  }

  function protectMarkdown(text) {
    const tokens = [];

    const protectedText = text.replace(
      /```[\s\S]*?```|~~~[\s\S]*?~~~|!\[[^\]]*\]\([^)]*\)|\[[^\]]*\]\([^)]*\)|<https?:\/\/[^>]+>|<[^>]+>|`[^`\n]*`|^ {0,3}#{1,6}(?=\s)|^ {0,3}(?:[-+*]|\d+[.)])(?=\s)|^ {0,3}>\s?|\*\*|__|~~|(?<!\*)\*(?!\*)|(?<!_)_(?!_)|\\[*_~`#[\]()>-]/gm,
      function (match) {
        const token = "ZXQKEEP" + tokens.length + "QXZ";
        tokens.push([token, match]);
        return token;
      }
    );

    return { text: protectedText, tokens: tokens };
  }

  function restoreMarkdown(text, tokens) {
    for (const [token, original] of tokens) {
      text = text.split(token).join(original);
    }

    return text;
  }

  async function translateChunk(text) {
    const url = new URL(API);
    url.searchParams.set("q", text);
    url.searchParams.set("langpair", "zh-CN|en");

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error("翻译请求失败：" + response.status);
    }

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
    if (!text || !text.trim()) return text;

    const protectedData = protectMarkdown(text);
    const chunks = splitText(protectedData.text, MAX_BYTES);
    const translated = [];

    for (const chunk of chunks) {
      translated.push(await translateChunk(chunk));
    }

    return restoreMarkdown(
      translated.join(""),
      protectedData.tokens
    );
  }

  async function translateMarkdown(text) {
    const lines = text.split("\n");
    const output = [];
    let inCodeBlock = false;
    let codeFence = "";

    for (const line of lines) {
      const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);

      if (fenceMatch) {
        const fence = fenceMatch[1];

        if (!inCodeBlock) {
          inCodeBlock = true;
          codeFence = fence[0];
        } else if (fence[0] === codeFence) {
          inCodeBlock = false;
          codeFence = "";
        }

        output.push(line);
        continue;
      }

      if (inCodeBlock || !line.trim()) {
        output.push(line);
        continue;
      }

      try {
        output.push(await translatePlainText(line));
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

    if (typeof english === "string" && english.trim()) {
      return data;
    }

    if (typeof chinese !== "string" || !chinese.trim()) {
      return data;
    }

    try {
      const translated = isMarkdown
        ? await translateMarkdown(chinese)
        : await translatePlainText(chinese);

      if (translated && translated.trim()) {
        return data.set(enKey, translated);
      }
    } catch (error) {
      console.warn(
        "自动翻译失败，保留中文并继续保存：" + zhKey,
        error
      );
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
        console.warn("翻译流程异常，继续保存：", error);
      }

      return data;
    }
  });

  console.log("文章自动翻译脚本已加载（Markdown 保留版）");
})();
