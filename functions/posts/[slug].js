export async function onRequestGet({ params }) {
  let slug = params?.slug || "";

  try {
    slug = decodeURIComponent(slug);
  } catch {
    return new Response("文章地址无效", { status: 400 });
  }

  if (
    !slug ||
    slug.includes("/") ||
    slug.includes("\\") ||
    slug.includes("..") ||
    slug.toLowerCase().endsWith(".md")
  ) {
    return new Response("文章地址无效", { status: 400 });
  }

  const safeSlug = JSON.stringify(slug).replace(/</g, "\\u003c");

  const html = String.raw`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>文章 - GlobalViewNet</title>
  <style>
    * { box-sizing: border-box; }

    body {
      margin: 0;
      color: #252525;
      background: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
        "PingFang SC", "Microsoft YaHei", sans-serif;
      line-height: 1.8;
    }

    .page {
      width: min(800px, calc(100% - 36px));
      margin: 0 auto;
      padding: 32px 0 64px;
    }

    .back {
      display: inline-block;
      margin-bottom: 28px;
      color: #555;
      text-decoration: none;
    }

    .back:hover { color: #111; }

    h1 {
      margin: 0 0 12px;
      font-size: clamp(28px, 5vw, 40px);
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .date {
      margin-bottom: 32px;
      color: #888;
      font-size: 14px;
    }

    #content {
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    #content h2,
    #content h3,
    #content h4 {
      margin-top: 1.8em;
      line-height: 1.45;
    }

    #content p { margin: 1em 0; }

    #content ul,
    #content ol {
      padding-left: 1.8em;
      margin: 1em 0;
    }

    #content li { margin: 0.35em 0; }

    #content img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 22px auto;
      border-radius: 4px;
    }

    #content a {
      color: #1769aa;
      overflow-wrap: anywhere;
    }

    #content blockquote {
      margin: 20px 0;
      padding: 4px 18px;
      border-left: 4px solid #ddd;
      color: #666;
    }

    #content pre {
      padding: 16px;
      overflow-x: auto;
      background: #f5f5f5;
      border-radius: 6px
