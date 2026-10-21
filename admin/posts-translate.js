
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

      let part = "";
      let lastSpace = -1;

      for (const char of remaining) {
        if (byteLength(part + char) > maxBytes) break;
        part += char;
        if (/\s/.test(char)) lastSpace = part.length;
      }

      if (!part) throw new Error("文本拆分失败");

      if (lastSpace > 0 && lastSpace > part.length * 0.5) {
        part = part.slice(0, lastSpace);
      }

      chunks.push(part);
      remaining = remaining.slice(part.length);
    }

    return chunks;
  }

  function protectMarkdown(text) {
    const tokens = [];
    const protectedText = text.replace(
      /```[\s\S]*?```|!\[[^\]]*\]\([^)]*\)|\[[^\]]*\]\([^)]*\)|`[^`\n]*`|<[^>]+>/g,
      function (match) {
        const token = "ZXQKEEP" + tokens.length + "QXZ";
        tokens.push([token, match]);
        return token;
      }
    );

    return { text: protectedText, tokens: tokens };
  }

  function restoreMarkdown(text, tokens) {
    for (const item of tokens) {
      text = text.replaceAll(item[0], item[1]);
    }
    return text;
  }

  async function translateChunk(text) {
    const url = new URL(API);
    url.searchParams.set("q", text);
    url.searchParams.set("langpair", "zh-CN|en");

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      throw new Error("翻译请求失败");
    }

    const result = await response.json();

    if (
      result.responseStatus !== 200 ||
      !result.responseData ||
      !result.responseData.translatedText
    ) {
      throw new Error("没有获得有效译文");
    }

    const textarea = document.createElement("textarea");
    textarea.innerHTML = result.responseData.translatedText;
    return textarea.value;
  }

  async function translateText(text) {
    if (!text || !text.trim()) return "";

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

  async function translateField(data, zhKey, enKey) {
    const chinese = data.get(zhKey);
    const english = data.get(enKey);

    if (typeof english === "string" && english.trim()) {
      return data;
    }

    if (typeof chinese !== "string" || !chinese.trim()) {
      return data;
    }

    try {
      const translated = await translateText(chinese);

      if (translated && translated.trim()) {
        return data.set(enKey, translated);
      }
    } catch (error) {
      console.warn(
        "自动翻译失败，保留中文并继续：" + zhKey,
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
        data = await translateField(data, "title_zh", "title_en");
        data = await translateField(data, "excerpt_zh", "excerpt_en");
        data = await translateField(data, "body_zh", "body_en");
      } catch (error) {
        console.warn("翻译流程异常，继续保存：", error);
      }

      return data;
    }
  });

  console.log("文章自动翻译脚本已加载");
})();
