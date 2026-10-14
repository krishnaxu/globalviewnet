export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return new Response("No code", { status: 400 });

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code: code,
      redirect_uri: "https://globalviewnet.pages.dev/api/auth/callback"
    })
  });

  const tokenJson = await tokenRes.json();
  const access_token = tokenJson.access_token;
  if (!access_token) return new Response("Token failed: " + JSON.stringify(tokenJson), { status: 500 });

  const html = `<!doctype html>
<html>
<body>
<script>
  window.opener.postMessage(
    'authorization:github:success:' + JSON.stringify({ token: "${access_token}", provider: "github" }),
    window.location.origin
  );
  window.close();
</script>
</body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
