export async function onRequestGet() {
  return Response.json({
    ok: true,
    message: "Cloudflare API route works"
  });
}
