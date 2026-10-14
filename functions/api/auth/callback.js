export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  
  // 1. 校验 state（防 CSRF，你之前的代码应有）
  const cookieHeader = request.headers.get("Cookie") || "";
  const storedState = cookieHeader.match(/(?:^|;\s*)oauth_state=([^;]+)/)?.[1];
  if (!state || state !== storedState) {
    return new Response("Invalid state", { status: 403 });
  }

  // 2. 换 Token（确认 env 变量名大小写完全一致）
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const { access_token } = await res.json();

  // 3. 关键：Decap 必须的双向握手 + 反引号模板
  const html = `
    <script>
      // 第一步：通知父窗口授权开始
      window.opener.postMessage("authorizing:github", window.location.origin);
      
      // 第二步：监听父窗口回应，再发 Token（必须反引号）
      window.addEventListener("message", (e) => {
        window.opener.postMessage(
          \`authorization:github:success:\${JSON.stringify({ token: access_token, provider: "github" })}\`,
          window.location.origin
        );
        window.close();
      });
    </script>`;
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
