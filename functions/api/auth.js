export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!url.searchParams.get("code")) {
    const state = crypto.randomUUID();
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=repo&state=${state}`;
    return new Response(null, {
      status: 302,
      headers: {
        Location: authUrl,
        "Set-Cookie": `oauth_state=${state}; Path=/; HttpOnly; Secure`
      }
    });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("Cookie") || "";
  const savedState = cookie.match(/oauth_state=([^;]+)/)?.[1];
  if (state !== savedState) return new Response("State invalid", { status: 403 });

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code
    })
  });
  const { access_token } = await res.json();

  const html = `<script>
    window.opener.postMessage('authorization:github:success:' + JSON.stringify({ token: ${JSON.stringify(access_token)}, provider: "github" }), window.location.origin);
    window.close();
  </script>`;

  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
