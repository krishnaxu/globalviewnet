export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const clientId = env.GITHUB_CLIENT_ID;
  const redirectUri = "https://globalviewnet.pages.dev/api/auth/callback";
  const scope = "repo,user";
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${url.pathname}`;
  
  return Response.redirect(githubAuthUrl, 302);
}
