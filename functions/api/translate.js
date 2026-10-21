
export async function onRequestPost({ request, env }) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "https://globalviewnet.pages.dev",
  };

  try {
    const origin = request.headers.get("Origin");

    if (origin && origin !== "https://globalviewnet.pages.dev") {
      return new Response(
        JSON.stringify({ error: "Origin not allowed" }),
        { status: 403, headers }
      );
    }

    if (!env.SILICONFLOW_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Translation service not configured" }),
        { status: 500, headers }
      );
    }

    const body = await request.json();
    const text = body.text;

    if (
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 2000
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid text" }),
        { status: 400, headers }
      );
    }

    const response = await fetch(
      "https://api.siliconflow.cn/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.SILICONFLOW_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "Qwen/Qwen3-8B",
          messages: [
            {
              role: "system",
              content:
                "You are a professional Chinese-to-English news translator. Translate the user's Chinese text into accurate, natural English. Preserve all facts, numbers, names, URLs, and meaning. Do not add information. Output only the English translation."
            },
            {
              role: "user",
              content: text
            }
          ],
          stream: false,
          max_tokens: 1200,
          temperature: 0.2
        }),
        signal: AbortSignal.timeout(25000),
      }
    );

    if (!response.ok) {
      console.error("Translation provider returned:", response.status);

      return new Response(
        JSON.stringify({ error: "Translation provider failed" }),
        { status: 502, headers }
      );
    }

    const result = await response.json();
    const translation = result.choices?.[0]?.message?.content?.trim();

    if (!translation) {
      return new Response(
        JSON.stringify({ error: "Empty translation" }),
        { status: 502, headers }
      );
    }

    return new Response(
      JSON.stringify({ translation }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Translation request failed:", error);

    return new Response(
      JSON.stringify({ error: "Translation request failed" }),
      { status: 502, headers }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://globalviewnet.pages.dev",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
