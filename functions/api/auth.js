export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // GitHub OAuth 配置（从环境变量读，安全）
  const CLIENT_ID = env.GITHUB_CLIENT_ID;
  const CLIENT_SECRET = env.GITHUB_CLIENT_SECRET;
  const REDIRECT_URI = "https://globalviewnet.pages.dev/admin/";

  // 1. 发起登录：跳转 GitHub 授权
  if (url.pathname === "/api/auth" && request.method === "GET") {
    const githubAuthUrl = "https://github.com/login/oauth/authorize"
      + `?client_id=${CLIENT_ID}`
      + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
      + `&scope=repo`;
    return Response.redirect(githubAuthUrl, 302);
  }

  // 2. 回调：拿 code 换 token
  if (url.pathname === "/api/auth/callback" && request.method === "GET") {
    const code = url.searchParams.get("code");
    if (!code) return new Response("No code", { status: 400 });

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI
      })
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 简单存储 token（实际生产建议加密/存 session）
    // Decap 期望 /api/auth 返回用户信息，这里重定向回 admin 并带 token（简化版）
    return Response.redirect(REDIRECT_URI + "?token=" + accessToken, 302);
  }

  // 3. Decap 调用 /api/auth 获取用户（POST）
  if (url.pathname === "/api/auth" && request.method === "POST") {
    // 这里简化：实际应解析 token 并返回 GitHub 用户
    // 为跑通流程，返回固定结构（后续可完善）
    return new Response(JSON.stringify({ name: "admin", login: "admin" }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response("Not Found", { status: 404 });
}
