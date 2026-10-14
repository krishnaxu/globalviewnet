export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response("No code provided (Auth Callback OK)", { status: 400 });
  }

  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response("Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET env vars", { status: 500 });
  }

  // 用 code 换 access_token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: "https://globalviewnet.pages.dev/api/auth/callback",
    }),
  });

  const tokenJson = await tokenRes.json();
  const access_token = tokenJson.access_token;

  if (!access_token) {
    return new Response(
      "Token exchange failed: " + JSON.stringify(tokenJson),
      { status: 400 }
    );
  }

  // 成功拿到 token，写进 cookie 并跳回 /admin/
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Authorizing...</title>
  <script>
    document.cookie = "access_token=${access_token}; path=/; max-age=3600; SameSite=Lax";
    window.location.replace("/admin/");
  </script>
</head>
<body>
  <p>Login successful! Redirecting to <a href="/admin/">/admin/</a>...</p>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
