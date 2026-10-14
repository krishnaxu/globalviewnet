export async function onRequest({ request, env }) {
  const state = crypto.randomUUID();

  const githubAuthUrl = new URL("https://github.com/login/oauth/authorize");
  githubAuthUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set("scope", "repo");
  githubAuthUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: githubAuthUrl.toString(),
      "Set-Cookie": `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`
    }
  });
}
