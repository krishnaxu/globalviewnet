
export async function onRequest({ request, env }) {
  const clientId = env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return new Response("GitHub OAuth is not configured", {
      status: 500,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const redirectUri =
    "https://globalviewnet.pages.dev/api/auth/callback";

  // Generate a fresh, unpredictable OAuth state value.
  const randomBytes = crypto.getRandomValues(
    new Uint8Array(32)
  );

  const state = Array.from(randomBytes, byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");

  const authUrl = new URL(
    "https://github.com/login/oauth/authorize"
  );

  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "repo,user");
  authUrl.searchParams.set("state", state);

  const cookie =
    `gv_oauth_state=${state}; Max-Age=600; Path=/api/auth/callback; HttpOnly; Secure; SameSite=Lax`;

  return new Response(null, {
    status: 302,
    headers: {
      "Location": authUrl.toString(),
      "Set-Cookie": cookie,
      "Cache-Control": "no-store"
    }
  });
}
