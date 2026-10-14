export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("Cookie") || "";
  const storedState = cookie.match(/(?:^|;\s*)oauth_state=([^;]+)/)?.[1];

  // 验证 state（防 CSRF）
  if (!state || state !== storedState) {
    return new Response("授权失败：state 不匹配，请重试。", { status: 403 });
  }

  // 用 code 换 access_token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code: code
    })
  });

  const tokenData = await tokenRes.json();
  const access_token = tokenData.access_token;

  if (!access_token) {
    return new Response("获取 Token 失败：" + JSON.stringify(tokenData), { status: 400 });
  }

  // Decap CMS 握手协议（必须严格按这个格式）
  const html = `<!doctype html>
<html>
<body>
<script>
  window.opener.postMessage("authorizing:github", location.origin);
  window.addEventListener("message", function() {
    window.opener.postMessage(
      "authorization:github:success:" + JSON.stringify({
        token: "${access_token}",
        provider: "github"
      }),
      location.origin
    );
    window.close();
  });
</script>
<p>授权成功，正在跳转...</p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": "oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    }
  });
}
