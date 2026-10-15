function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  if (
    !slug ||
    slug.includes("/") ||
    slug.includes("\\") ||
    slug.includes("..") ||
    slug.toLowerCase().endsWith(".md")
  ) {
    return Response.json(
      { error: "缺少有效的文章标识 slug" },
      { status: 400 }
    );
  }

  const token = env.GITHUB_CONTENT_TOKEN;

  if (!token) {
    return Response.json(
      { error: "缺少 GITHUB_CONTENT_TOKEN 环境变量" },
      { status: 500 }
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
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });

    if (!response.ok) {
      return Response.json(
        {
          error: "读取文章失败",
          status: response.status
        },
        { status: 502 }
      );
    }

    const file = await response.json();

    if (!file.content) {
      return Response.json(
        { error: "未获取到文章正文内容" },
        { status: 502 }
      );
    }

    const content = decodeBase64Utf8(file.content);

    const match = content.match(
      /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/
    );

    const metadata = match ? match[1] : "";
    const body = match ? content.slice(match[0].length) : content;

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
        detail: error instanceof Error ? error.message : "未知错误"
      },
      { status: 502 }
    );
  }
}
