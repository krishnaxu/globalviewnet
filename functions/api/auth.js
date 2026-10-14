export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // 如果已经有 code（GitHub 回调），不做处理，让 callback.js 接管
  const code = url.searchParams.get("code");
  if (code) {
    // 直接重定向到 callback 处理
    return Response.redirect("https://globalviewnet.pages.dev/api/auth/callback?" + url.searchParams.toString(), 302);
  }
  
  // 没有 code → 发起 GitHub OAuth 授权
  const client_id = env.GITHUB_CLIENT_ID;
  if (!client_id) {
    return new Response("Error: GITHUB_CLIENT_ID undefined", { status: 500 });
  }
  
  const redirect_uri = "https://globalviewnet.pages.dev/api/auth/callback";
  const githubAuthUrl = "https://github.com/login/oauth/authorize" +
    "?client_id=" + client_id +
    "&redirect_uri=" + encodeURIComponent(redirect_uri) +
    "&scope=repo";
  
  return Response.redirect(githubAuthUrl, 302);
}
