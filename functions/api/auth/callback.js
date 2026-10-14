export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  const redirectUri = "https://globalviewnet.pages.dev/api/auth/callback";

  if (!code) {
    return new Response("No code provided", { status: 400 });
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri })
  });
  
  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    return new Response(tokenData.error_description, { status: 400 });
  }

  return new Response(
    `<script>window.opener.postMessage({token:"${tokenData.access_token}",provider:"github"},"https://globalviewnet.pages.dev");window.close();</script>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
