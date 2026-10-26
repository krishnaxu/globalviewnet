
const ALLOWED_ORIGIN = "https://globalviewnet.pages.dev";
const SESSION_COOKIE = "gv_translate_session";
const MAX_TEXT_LENGTH = 2000;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Vary": "Origin"
    }
  });
}

function getCookie(request, name) {
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

function decodeBase64Url(value) {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function verifySession(request, env) {
  if (!env.GITHUB_CLIENT_SECRET) {
    throw new Error("Session signing secret is not configured");
  }

  const cookie = getCookie(request, SESSION_COOKIE);

  if (!cookie) return false;

  const parts = cookie.split(".");
  if (parts.length !== 2) return false;

  const [encodedPayload, encodedSignature] = parts;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.GITHUB_CLIENT_SECRET),
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      ["verify"]
    );

    const signature = decodeBase64Url(encodedSignature);
    const signedData = new TextEncoder().encode(encodedPayload);

    const signatureValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      signedData
    );

    if (!signatureValid) return false;

    const payloadBytes = decodeBase64Url(encodedPayload);
    const payloadText = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadText);

    if (
      typeof payload.sub !== "string" ||
      !payload.sub ||
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function onRequestPost({ request, env }) {
  if (request.headers.get("Origin") !== ALLOWED_ORIGIN) {
    return jsonResponse({ error: "Origin not allowed" }, 403);
  }

  if (!env.GITHUB_CLIENT_SECRET) {
    return jsonResponse(
      { error: "Translation authentication is not configured" },
      500
    );
  }

  let authenticated;

  try {
    authenticated = await verifySession(request, env);
  } catch (error) {
    console.error("Translation session verification failed:", error);
    return jsonResponse({ error: "Authentication unavailable" }, 500);
  }

  if (!authenticated) {
    return jsonResponse(
      { error: "Please sign in to CMS again before translating" },
      401
    );
  }

  if (!env.SILICONFLOW_API_KEY) {
    return jsonResponse(
      { error: "Translation service not configured" },
      500
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const text = body?.text;

  if (
    typeof text !== "string" ||
    !text.trim() ||
    text.length > MAX_TEXT_LENGTH
  ) {
    return jsonResponse({ error: "Invalid text" }, 400);
  }

  try {
    const response = await fetch(
      "https://api.siliconflow.cn/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.SILICONFLOW_API_KEY}`,
          "Content-Type": "application/json"
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
        signal: AbortSignal.timeout(60000)
      }
    );

    if (!response.ok) {
      console.error("Translation provider returned:", response.status);
      return jsonResponse(
        { error: "Translation provider failed" },
        502
      );
    }

    const result = await response.json();
    const choice = result.choices?.[0];
    const translation = choice?.message?.content?.trim();
    const finishReason = choice?.finish_reason || null;

    if (!translation) {
      return jsonResponse({ error: "Empty translation" }, 502);
    }

    return jsonResponse({ translation, finishReason });
  } catch (error) {
    console.error("Translation request failed:", error);

    return jsonResponse(
      { error: "Translation request failed" },
      502
    );
  }
}

export async function onRequestOptions({ request }) {
  const origin = request.headers.get("Origin");

  if (origin !== ALLOWED_ORIGIN) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    }
  });
}
