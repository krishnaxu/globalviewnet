
(function () {
  "use strict";

  const API = "https://api.mymemory.translated.net/get";
  const MAX_BYTES = 450;

  function byteLength(text) {
    return new TextEncoder().encode(text).length;
  }

  // 按 UTF-8 字节数分段，尽量在空格处断开
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

      if (!part) throw new Error("无法拆分翻译文本");

      if (lastSpace > 0 && lastSpace > part.length * 0.5) {
        part = part.slice(0, lastSpace);
      }

      chunks.push(part);
      remaining = remaining.slice(part.length);
    }

    return chunks;
  }

  // 暂时保护 Markdown 图片、链接、代码和 HTML 标签
  function protectMarkdown(text) {
    const tokens = [];

    const protectedText = text.replace(
      /!\[[^\]]*\]\([^)]*\)|\[[^\]]*\]\([^)]*\)|`[^`\n]*`|```[\s\S]*?```|<[^>]+>/g,
      (match) => {
        const token = "ZXQKEEP" + tokens.length + "QXZ";
        tokens.push([token, match]);
        return token;
      }
    );

    return { text: protectedText, tokens };
  }

  function restoreMarkdown(text, tokens) {
    for (const [token, original] of tokens) {
      text = text.replaceAll(token, original);
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

    if (!response.ok) throw new Error("翻译服务请求失败");

    const result = await response.json();

    if (
      result.responseStatus !== 200 ||
      !result.responseData ||
      !result.responseData.translatedText
    ) {
      throw new Error("翻译服务未返回有效译文");
    }

    // MyMemory 可能返回 HTML 转义字符
    const textarea = document.createElement("textarea");
    textarea.innerHTML = result.responseData.translatedText;
    return textarea.value;
  }

  async function translateText(original) {
    if (!original || !original.trim()) return "";

    const protectedData = protectMarkdown(original);
    const chunks = splitText(protectedData.text, MAX_BYTES);
    const translated = [];

    for (const chunk of chunks) {
      translated.push(await translateChunk(chunk));
    }

    return restoreMarkdown(translated.join(""), protectedData.tokens);
  }

  async function translateField(data, zhKey, enKey) {
    const chinese = data.get(zhKey);
    const english = data.get(enKey);

    // 已有英文内容时不覆盖
    if (
      typeof english === "string" &&
      english.trim()
    ) {
      return data;
    }

    if (typeof chinese !== "string" || !chinese.trim()) {
      return data;
    }

    try {
      const result = await translateText(chinese);
      if (result && result.trim()) {
        return data.set(enKey, result);
      }
    } catch (error) {
      console.warn(
        "自动翻译失败，保留中文内容：" + zhKey,
        error
      );
    }

    return data;
  }

  if (
    !window.CMS ||
    typeof window.CMS.registerEventListener !== "function"
  ) {
    console.error("自动翻译初始化失败：未找到 Decap CMS 事件接口");
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
        // 兜底：翻译异常不能阻断中文文章保存
        console.warn("自动翻译流程异常，继续保存文章：", error);
      }

      return data;
    }
  });

  console.log("文章中译英保存钩子已注册");
})();
