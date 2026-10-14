export async function onRequest({ request, url, env }) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // 基础校验
  if (!code) {
    return new Response("No code provided", { status: 400 });
  }

  // 可选：state 校验（Decap 会带 state，建议保留）
  // 实际生产可结合 cookie/session，这里仅透传

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

  // Decap CMS 回调：通过 postMessage 通知父窗口
  const html = `<!doctype html>
<html>
<body>
<script>
  window.opener.postMessage(
    "authorization:github:success:" + JSON.stringify({ token: "${access_token}", provider: "github" }),
    "https://globalviewnet.pages.dev"
  );
  window.close();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html" }
  });
}
