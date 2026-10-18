
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  });
}

export async function onRequestGet({ request }) {
  const requestUrl = new URL(request.url);
  const articleUrl = requestUrl.searchParams.get("url") || "";

  let parsedUrl;

  try {
    parsedUrl = new URL(articleUrl);
  } catch {
    return json({ success: false, error: "人民网链接无效" }, 400);
  }

  if (
    parsedUrl.protocol !== "https:" &&
    parsedUrl.protocol !== "http:"
  ) {
    return json({ success: false, error: "链接协议无效" }, 400);
  }

  const host = parsedUrl.hostname.toLowerCase();

  if (
    host !== "people.com.cn" &&
    !host.endsWith(".people.com.cn")
  ) {
    return json({ success: false, error: "仅支持人民网链接" }, 400);
  }

  try {
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GlobalViewBot/1.0)",
        "Accept": "text/html"
      },
      redirect: "follow"
    });

    if (!response.ok) {
      return json({
        success: false,
        error: `人民网页面请求失败：${response.status}`
      }, 502);
    }

    
const buffer = await response.arrayBuffer();
const contentType = response.headers.get("content-type") || "";
const charset = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1];

let html;

if (charset) {
  html = new TextDecoder(charset).decode(buffer);
} else {
  html = new TextDecoder("gbk").decode(buffer);
}


    function extract(pattern) {
      const match = html.match(pattern);
      if (!match) return "";

      return match[1]
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&#x27;/gi, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/<[^>]*>/g, "")
        .trim();
    }

    const title =
      extract(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)/i) ||
      extract(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title/i) ||
      extract(/<title[^>]*>([\s\S]*?)<\/title>/i);

    const date =
      extract(/<meta[^>]+(?:property|name)=["']article:published_time["'][^>]+content=["']([^"']*)/i) ||
      extract(/<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']article:published_time/i) ||
      extract(/<meta[^>]+name=["']publishdate["'][^>]+content=["']([^"']*)/i) ||
      extract(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']publishdate/i);

    const excerpt =
      extract(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) ||
      extract(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description/i) ||
      extract(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)/i);

    if (!title) {
      return json({
        success: false,
        error: "未能从人民网页面读取标题，可能需要手动填写"
      }, 422);
    }

    return json({
      success: true,
      title: title.replace(/\s*[-_|]\s*人民网.*$/, "").trim(),
      date,
      excerpt
    });
  } catch {
    return json({
      success: false,
      error: "暂时无法读取人民网页面，请稍后重试或手动填写"
    }, 502);
  }
}
