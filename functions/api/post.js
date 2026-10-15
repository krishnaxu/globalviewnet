
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  if (
    !slug ||
    slug.includes("/") ||
    slug.includes("\\") ||
    slug.includes("..")
  ) {
    return Response.json(
      { error: "缺少有效的文章标识 slug" },
      { status: 400 }
    );
  }

  const apiUrl =
    "https://api.github.com/repos/krishnaxu/globalviewnet/contents/content/posts/" +
    encodeURIComponent(slug) +
    ".md?ref=main";

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "globalviewnet-pages"
      }
    });

    if (!response.ok) {
      const detail = await response.text();

      return Response.json(
        {
          error: "读取文章失败",
          status: response.status,
          detail: detail.slice(0, 1000)
        },
        { status: 502 }
      );
    }

    const file = await response.json();

    if (!file.download_url) {
      return Response.json(
        { error: "未找到文章正文下载地址" },
        { status: 502 }
      );
    }

    const contentResponse = await fetch(file.download_url);

    if (!contentResponse.ok) {
      const detail = await contentResponse.text();

      return Response.json(
        {
          error: "获取文章正文失败",
          status: contentResponse.status,
          detail: detail.slice(0, 1000)
        },
        { status: 502 }
      );
    }

    const content = await contentResponse.text();

    const match = content.match(
      /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/
    );

    const metadata = match ? match[1] : "";
    const body = match
      ? content.slice(match[0].length)
      : content;

    const getValue = (key) => {
      const result = metadata.match(
        new RegExp("^" + key + ":\\s*(.*?)\\s*$", "m")
      );

      return result
        ? result[1].trim().replace(/^["']|["']$/g, "")
        : "";
    };

    return Response.json(
      {
        slug,
        title: getValue("title") || slug,
        date: getValue("date"),
        body
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60"
        }
      }
    );
  } catch (error) {
    return Response.json(
      {
        error: "读取文章时发生网络错误",
        detail: error instanceof Error
          ? error.message
          : "未知错误"
      },
      { status: 500 }
    );
  }
}
