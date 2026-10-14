  // 第 16-24 行：必须写死，与 GitHub OAuth 后台、Decap 预期完全一致
  const redirectUri = "https://globalviewnet.pages.dev/api/auth/callback"; 
  
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri // 这里不再用 url.origin 拼接
    })
  });

  const tokenJson = await tokenRes.json();
  const access_token = tokenJson.access_token;

  if (!access_token) return new Response("Token failed: " + JSON.stringify(tokenJson), { status: 500 });

  // 回传 Decap（保持你原有的逻辑，origin 也建议写死更稳）
  const html = `<!doctype html>
<html>
<body>
<script>
  window.opener.postMessage(
    'authorization:github:success:' + JSON.stringify({ token: "${access_token}", provider: "github" }),
    "https://globalviewnet.pages.dev" // 写死父窗口源，避免跨域丢失
  );
  window.close();
</script>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html" } });
