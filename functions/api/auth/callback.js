export async function onRequest(context) {
  // 超强容错：防止根路径/中间件导致 context 异常
  if (!context || !context.request) {
    return new Response("Bad Request: No context", { status: 400 });
  }

  const { request, env } = context;

  try {
    // 必须自己 new URL，不能直接用 context.url
    const reqUrl = new URL(request.url);
    const code = reqUrl.searchParams.get("code");

    // 如果访问根域名（无 code），正常提示，不报错
    if (!code) {
      return new Response("No code provided (Auth Callback OK)", { status: 400 });
    }

    // 环境变量检查
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      return new Response("Server misconfigured: missing GitHub env vars", { status: 500 });
    }

    const redirectUri = "https://globalviewnet.pages.dev/api/auth/callback";

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri
      })
    });

    const tokenJson = await tokenRes.json();
    const access_token = tokenJson.access_token;

    if (!access_token) {
      return new Response("Token failed: " + JSON.stringify(tokenJson), { status: 500 });
    }

    // Decap CMS 回调
    const html = `<!doctype html><html><body><script>
      window.opener.postMessage(
        "authorization:github:success:" + JSON.stringify({ token: "${access_token}", provider: "github" }),
        "https://globalviewnet.pages.dev"
      );
      window.close();
    </script></body></html>`;

    return new Response(html, { headers: { "Content-Type": "text/html" } });
  } catch (e) {
    // 兜底：绝不再抛 1101
    return new Response("Function Error: " + (e.stack || e.message || e), { status: 500 });
  }
}
