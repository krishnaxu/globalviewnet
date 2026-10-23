
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  const siteOrigin = "https://globalviewnet.pages.dev";
  const redirectUri =
    "https://globalviewnet.pages.dev/api/auth/callback";

  const cookieName = "gv_oauth_state";

  function getCookie(name) {
    const cookieHeader = request.headers.get("Cookie") || "";

    for (const item of cookieHeader.split(";")) {
      const parts = item.trim().split("=");
      const key = parts.shift();

      if (key === name) {
        return parts.join("=");
      }
    }

    return null;
  }

  function errorResponse(message, status) {
    return new Response(message, {
      status,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Set-Cookie":
          `${cookieName}=; Max-Age=0; Path=/api/auth/callback; HttpOnly; Secure; SameSite=Lax`
      }
    });
  }

  const savedState = getCookie(cookieName);

  // Validate OAuth state before exchanging the authorization code.
  if (
    !returnedState ||
    !savedState ||
    returnedState.length !== savedState.length ||
    returnedState !== savedState
  ) {
    return errorResponse(
      "OAuth state validation failed. Please restart CMS login.",
      403
    );
  }

  if (!code) {
    return errorResponse("No code provided", 400);
  }

  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return errorResponse(
      "GitHub OAuth environment variables are missing",
      500
    );
  }

  try {
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

    if (
      !tokenRes.ok ||
      tokenData.error ||
      !tokenData.access_token
    ) {
      return errorResponse(
        tokenData.error_description ||
          tokenData.error ||
          "GitHub token exchange failed",
        400
      );
    }

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
        "Cache-Control": "no-store",
        "Set-Cookie":
          `${cookieName}=; Max-Age=0; Path=/api/auth/callback; HttpOnly; Secure; SameSite=Lax`
      }
    });
  } catch {
    return errorResponse(
      "GitHub OAuth request failed. Please try again.",
      502
    );
  }
}
