
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;

  const siteOrigin = "https://globalviewnet.pages.dev";
  const redirectUri =
    "https://globalviewnet.pages.dev/api/auth/callback";

  if (!code) {
    return new Response("No code provided", { status: 400 });
  }

  if (!clientId || !clientSecret) {
    return new Response(
      "GitHub OAuth environment variables are missing",
      { status: 500 }
    );
  }

  const tokenRes = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      })
    }
  );

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
    return new Response(
      tokenData.error_description ||
        tokenData.error ||
        "GitHub token exchange failed",
      { status: 400 }
    );
  }

  // Safely encode the token as a JavaScript string.
  const tokenLiteral = JSON.stringify(
    tokenData.access_token
  ).replace(/</g, "\\u003c");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Authorizing Decap CMS</title>
</head>
<body>
  <p>Authorizing Decap CMS...</p>
  <script>
    const token = ${tokenLiteral};
    const targetOrigin = ${JSON.stringify(siteOrigin)};

    function receiveMessage(event) {
      if (event.source !== window.opener) return;
      if (event.origin !== targetOrigin) return;

      window.removeEventListener(
        "message",
        receiveMessage,
        false
      );

      window.opener.postMessage(
        "authorization:github:success:" +
          JSON.stringify({ token: token }),
        targetOrigin
      );
    }

    if (window.opener) {
      window.addEventListener(
        "message",
        receiveMessage,
        false
      );

      window.opener.postMessage(
        "authorizing:github",
        targetOrigin
      );
    } else {
      document.body.textContent =
        "Please return to the Decap CMS login window.";
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
