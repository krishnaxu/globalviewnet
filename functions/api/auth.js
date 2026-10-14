export async function onRequest({ request, env }) {
  const clientId = env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return new Response("Missing GITHUB_CLIENT_ID env var", { status: 500 });
  }

  const redirectUri = "https://globalviewnet.pages.dev/api/auth/callback";
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user`;

  return Response.redirect(githubAuthUrl, 302);
}
