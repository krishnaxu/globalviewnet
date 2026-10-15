
export async function onRequestGet() {
  const apiUrl =
    "https://api.github.com/repos/krishnaxu/globalviewnet/contents/content/posts?ref=main";

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "globalviewnet-pages"
      }
    });

    if (!response.ok) {
      return Response.json(
        { error: "读取文章列表失败", status: response.status },
        { status: 502 }
      );
    }

    const files = await response.json();

    if (!Array.isArray(files)) {
      return Response.json(
        { error: "文章目录返回的数据格式不正确" },
        { status: 502 }
      );
    }

    const markdownFiles = files.filter(
      file =>
        file.type === "file" &&
        file.name.endsWith(".md")
    );

    const posts = await Promise.all(
      markdownFiles.map(async file => {
        const result = await fetch(file.download_url);

        if (!result.ok) {
          return null;
        }

        const content = await result.text();
        const match = content.match(
          /^---\s*\r?\n([\s\S]*?)\r?\n---/
        );

        const metadata = match ? match[1] : "";
        const titleMatch = metadata.match(/^title:\s*(.*?)\s*$/m);
        const dateMatch = metadata.match(/^date:\s*(.*?)\s*$/m);

        const cleanValue = value =>
          value
            ? value.trim().replace(/^["']|["']$/g, "")
            : "";

        return {
          slug: file.name.replace(/\.md$/, ""),
          title: cleanValue(titleMatch?.[1]) || file.name,
          date: cleanValue(dateMatch?.[1]),
          url: "/posts/" + encodeURIComponent(
            file.name.replace(/\.md$/, "")
          )
        };
      })
    );

    const validPosts = posts
      .filter(Boolean)
      .sort((a, b) =>
        (b.date || "").localeCompare(a.date || "")
      );

    return Response.json(validPosts, {
      headers: {
        "Cache-Control": "public, max-age=60"
      }
    });
  } catch {
    return Response.json(
      { error: "读取文章时发生网络错误" },
      { status: 500 }
    );
  }
}
