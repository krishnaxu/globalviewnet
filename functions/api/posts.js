
function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(
    binary,
    (char) => char.charCodeAt(0)
  );
  return new TextDecoder().decode(bytes);
}

function parseFrontmatter(content, key) {
  const match = content.match(
    /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/
  );

  if (!match) return "";

  const result = match[1].match(
    new RegExp("^" + key + ":\\s*(.*?)\\s*$", "m")
  );

  return result
    ? result[1].trim().replace(/^["']|["']$/g, "")
    : "";
}

export async function onRequestGet({ env }) {
  const token = env.GITHUB_CONTENT_TOKEN;

  if (!token) {
    return Response.json(
      {
        error: "缺少 GITHUB_CONTENT_TOKEN 环境变量"
      },
      { status: 500 }
    );
  }

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: "Bearer " + token,
    "X-GitHub-Api-Version": "2022-11-28"
  };

  const apiUrl =
    "https://api.github.com/repos/krishnaxu/globalviewnet/contents/content/posts?ref=main";

  try {
    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
      const detail = await response.text();

      return Response.json(
        {
          error: "读取文章列表失败",
          status: response.status,
          detail: detail.slice(0, 1500)
        },
        { status: 502 }
      );
    }

    const files = await response.json();

    if (!Array.isArray(files)) {
      return Response.json(
        {
          error: "文章目录返回格式异常",
          detail: JSON.stringify(files).slice(0, 1500)
        },
        { status: 502 }
      );
    }

    const markdownFiles = files.filter(
      (file) =>
        file.type === "file" &&
        file.name.toLowerCase().endsWith(".md")
    );

    const posts = await Promise.all(
      markdownFiles.map(async (file) => {
        const contentUrl =
          "https://api.github.com/repos/krishnaxu/globalviewnet/contents/" +
          file.path
            .split("/")
            .map(encodeURIComponent)
            .join("/") +
          "?ref=main";

        const contentResponse = await fetch(contentUrl, {
          headers
        });

        if (!contentResponse.ok) {
          const detail = await contentResponse.text();

          throw new Error(
            "读取文章文件失败：" +
            file.name +
            "；状态码：" +
            contentResponse.status +
            "；详情：" +
            detail.slice(0, 1000)
          );
        }

        const data = await contentResponse.json();

        if (!data.content) {
          throw new Error("文章内容为空：" + file.name);
        }

        const content = decodeBase64Utf8(data.content);
        const slug = file.name.replace(/\.md$/i, "");

        return {
          slug,
          title: parseFrontmatter(content, "title") || slug,
          date: parseFrontmatter(content, "date"),
          url: "/posts/" + encodeURIComponent(slug)
        };
      })
    );

    posts.sort((a, b) => {
      const dateA = Date.parse(a.date) || 0;
      const dateB = Date.parse(b.date) || 0;
      return dateB - dateA;
    });

    return Response.json(posts, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return Response.json(
      {
        error: "读取文章列表时发生错误",
        detail:
          error instanceof Error
            ? error.message
            : "未知错误"
      },
      { status: 502 }
    );
  }
}
