
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  const siteOrigin = "https://globalviewnet.pages.dev";
  const redirectUri =
    "https://globalviewnet.pages.dev/api/auth/callback";

  const stateCookieName = "gv_oauth_state";
  const sessionCookieName = "gv_translate_session";
  const sessionLifetime = 60 * 60;
  const repoName = "krishnaxu/globalviewnet";

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

  function base64Url(bytes) {
    let binary = "";

    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  async function createSignedSession(login) {
    const payload = {
      sub: login,
      exp: Math.floor(Date.now() / 1000) + sessionLifetime
    };

    const payloadBytes = new TextEncoder().encode(
      JSON.stringify(payload)
    );

    const encodedPayload = base64Url(payloadBytes);

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.GITHUB_CLIENT_SECRET),
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(encodedPayload)
    );

    return (
      encodedPayload +
      "." +
      base64Url(new Uint8Array(signature))
    );
  }

  function clearCookie(name, path) {
    return (
      `${name}=; Max-Age=0; Path=${path}; ` +
      "HttpOnly; Secure; SameSite=Lax"
    );
  }

  function errorResponse(message, status) {
    const headers = new Headers({
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    });

    headers.append(
      "Set-Cookie",
      clearCookie(stateCookieName, "/api/auth/callback")
    );

    headers.append(
      "Set-Cookie",
      clearCookie(sessionCookieName, "/api/translate")
    );

    return new Response(message, { status, headers });
  }

  const savedState = getCookie(stateCookieName);

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
        }),
        signal: AbortSignal.timeout(15000)
      }
    );

    const tokenData = await tokenRes.json();

    if (
      !tokenRes.ok ||
      tokenData.error ||
      !tokenData.access_token
    ) {
      return errorResponse(
        "GitHub token exchange failed. Please restart CMS login.",
        502
      );
    }

    const githubHeaders = {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "GlobalViewNet-CMS"
    };

    // Verify the actual GitHub account.
    const userRes = await fetch(
      "https://api.github.com/user",
      {
        headers: githubHeaders,
        signal: AbortSignal.timeout(15000)
      }
    );

    if (!userRes.ok) {
      return errorResponse(
        "Unable to verify GitHub account.",
        502
      );
    }

    const userData = await userRes.json();

    if (
      !userData.login ||
      typeof userData.login !== "string"
    ) {
      return errorResponse(
        "Invalid GitHub account information.",
        403
      );
    }

    // Verify write access to the specific repository.
    const repoRes = await fetch(
      `https://api.github.com/repos/${repoName}`,
      {
        headers: githubHeaders,
        signal: AbortSignal.timeout(15000)
      }
    );

    if (!repoRes.ok) {
      return errorResponse(
        "Unable to verify repository permissions.",
        502
      );
    }

    const repoData = await repoRes.json();

    if (repoData.permissions?.push !== true) {
      return errorResponse(
        "This GitHub account cannot write to the CMS repository.",
        403
      );
    }

    // Create a signed, short-lived translation session.
    const signedSession = await createSignedSession(
      userData.login
    );

    const tokenLiteral = JSON.stringify(
      tokenData.access_token
    ).replace(/</g, "\\u003c");

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="referrer" content="no-referrer">
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

    const headers = new Headers({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer"
    });

    headers.append(
      "Set-Cookie",
      clearCookie(stateCookieName, "/api/auth/callback")
    );

    headers.append(
      "Set-Cookie",
      `${sessionCookieName}=${signedSession}; ` +
        `Max-Age=${sessionLifetime}; ` +
        "Path=/api/translate; HttpOnly; Secure; SameSite=Lax"
    );

    return new Response(html, { headers });
  } catch (error) {
    console.error("GitHub OAuth callback failed:", error);

    return errorResponse(
      "GitHub authorization failed. Please try again.",
      502
    );
  }
}
