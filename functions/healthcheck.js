
export function onRequestGet() {
  return new Response(
    JSON.stringify({
      success: true,
      message: "Pages Functions is working",
      route: "/healthcheck"
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}
