export async function onRequest({ request, url, env }) {
  try {
    const code = url.searchParams.get("code");
    if (!code) {
      return new Response("No code provided", { status: 400 });
    }

    // 环境变量检查（防止 1101）
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
    // 兜底捕获，避免 1101，直接显示真实错误
    return new Response("Function Error: " + (e.stack || e.message || e), { status: 500 });
  }
}
