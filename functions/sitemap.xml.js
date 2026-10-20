
const SITE_URL = "https://globalviewnet.pages.dev";

function escapeXml(value) {
  return String(value || "").replace(/[&<>"']/g, function (char) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;"
    }[char];
  });
}

export async function onRequestGet({ request }) {
  try {
    const apiUrl = new URL("/api/posts", request.url);

    const response = await fetch(apiUrl.toString(), {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("CMS 文章接口请求失败：" + response.status);
    }

    const data = await response.json();

    if (!data.success || !Array.isArray(data.posts)) {
      throw new Error("CMS 文章列表数据格式异常");
    }

    const urls = new Set();

    // 始终包含网站首页
    urls.add(SITE_URL + "/");

    // 只收录 CMS 接口返回的已发布文章
    for (const post of data.posts) {
      if (
        !post ||
        typeof post.slug !== "string" ||
        !post.slug.trim() ||
        post.slug.includes("/") ||
        post.slug.includes("\\") ||
        post.slug.includes("..")
      ) {
        continue;
      }

      const slug = encodeURIComponent(post.slug.trim());

      urls.add(SITE_URL + "/posts/" + slug);
    }

    const entries = Array.from(urls)
      .map(url => "  <url>\n    <loc>" +
        escapeXml(url) +
        "</loc>\n  </url>")
      .join("\n");

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      entries +
      "\n</urlset>";

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300"
      }
    });
  } catch (error) {
    return new Response(
      "站点地图生成失败：" +
        (error instanceof Error ? error.message : String(error)),
      {
        status: 502,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
