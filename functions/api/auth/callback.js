export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("Cookie") || "";
  const stored = cookie.match(/(?:^|;\s*)oauth_state=([^;]+)/)?.[1];

  if (!state || state !== stored) {
    return new Response("state 错误", { status: 403 });
  }

  const r = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code
    })
  });
  const { access_token } = await r.json();

  const html = `<!doctype html><html><body><script>
    window.opener.postMessage("authorizing:github", location.origin);
    window.addEventListener("message", () => {
      window.opener.postMessage(
        "authorization:github:success:" + JSON.stringify({ token: "${access_token}", provider: "github" }),
        location.origin
      );
      window.close();
    });
  </script></body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
