export async function onRequestGet() {
  return Response.json({
    ok: true,
    route: "api/post",
    message: "Post route works"
  });
}
