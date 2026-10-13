export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookie = request.headers.get("Cookie") || "";
  const savedState = cookie.match(/oauth_state=([^;]+)/)?.[1];

  if (!code || state !== savedState) {
    return new Response("OAuth state 校验失败", { status: 403 });
  }

  // 1. 用 code 换 access_token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: url.origin + "/api/auth/callback"
    })
  });

  const tokenJson = await tokenRes.json();
  const access_token = tokenJson.access_token;

  if (!access_token) {
    return new Response("换 token 失败：" + JSON.stringify(tokenJson), { status: 500 });
  }

  // 2. 把 token 回传给 Decap CMS 的 /admin 页面
  const html = `
  <!doctype html>
  <html>
    <body>
      <script>
        window.opener.postMessage(
          'authorization:github:success:' + JSON.stringify({
            token: ${JSON.stringify(access_token)},
            provider: "github"
          }),
          window.location.origin
        );
        window.close();
      </script>
    </body>
  </html>
  `;

  return new Response(html, {
    headers: { "Content-Type": "text/html" }
  });
}
