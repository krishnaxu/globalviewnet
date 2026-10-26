
const ALLOWED_ORIGIN = "https://globalviewnet.pages.dev";
const SESSION_COOKIE = "gv_translate_session";
const MAX_TEXT_LENGTH = 700;
const TRANSLATION_TIMEOUT = 90000;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin"
    }
  });
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";

  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");

    if (separator < 0) continue;

    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();

    if (key === name) return value;
  }

  return "";
}

function base64UrlToBytes(value) {
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
  try {
    const secret = env.GITHUB_CLIENT_SECRET;

    if (!secret) {
      console.error("Missing GITHUB_CLIENT_SECRET");
      return false;
    }

    const token = getCookie(request, SESSION_COOKIE);
    if (!token) return false;

    const parts = token.split(".");
    if (parts.length !== 2) return false;

    const [payload, signature] = parts;
    if (!payload || !signature) return false;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      ["verify"]
    );

    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signature),
      new TextEncoder().encode(payload)
    );

    if (!validSignature) return false;

    const session = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payload))
    );

    if (
      !session ||
      typeof session.exp !== "number" ||
      session.exp <= Math.floor(Date.now() / 1000)
    ) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Session verification failed:", error);
    return false;
  }
}

export async function onRequestOptions({ request }) {
  const origin = request.headers.get("Origin");

  if (origin && origin !== ALLOWED_ORIGIN) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    }
  });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");

  if (origin && origin !== ALLOWED_ORIGIN) {
    return jsonResponse({ error: "Forbidden origin" }, 403);
  }

  if (!(await verifySession(request, env))) {
    return jsonResponse(
      { error: "Unauthorized. Please log in again." },
      401
    );
  }

  if (!env.SILICONFLOW_API_KEY) {
    console.error("Missing SILICONFLOW_API_KEY");
    return jsonResponse(
      { error: "Translation service is not configured" },
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

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    TRANSLATION_TIMEOUT
  );

  try {
    const response = await fetch(
      "https://api.siliconflow.cn/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + env.SILICONFLOW_API_KEY,
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
        signal: controller.signal
      }
    );

    if (!response.ok) {
      let providerMessage = "";

      try {
        providerMessage = await response.text();
      } catch {
        providerMessage = "Unable to read provider response";
      }

      console.error(
        "Translation provider returned:",
        response.status,
        providerMessage.slice(0, 1000)
      );

      if (response.status === 429) {
        return jsonResponse(
          { error: "Translation service is busy. Please try again shortly." },
          503
        );
      }

      return jsonResponse(
        {
          error: "Translation provider failed",
          providerStatus: response.status
        },
        502
      );
    }

    let result;

    try {
      result = await response.json();
    } catch (error) {
      console.error("Invalid provider JSON response:", error);

      return jsonResponse(
        { error: "Invalid response from translation provider" },
        502
      );
    }

    const translation =
      result?.choices?.[0]?.message?.content?.trim();

    if (typeof translation !== "string" || !translation) {
      console.error(
        "Empty translation response:",
        JSON.stringify({
          finishReason: result?.choices?.[0]?.finish_reason,
          providerError: result?.error
        })
      );

      return jsonResponse(
        { error: "Translation provider returned empty content" },
        502
      );
    }

    return jsonResponse({ translation });
  } catch (error) {
    const timedOut =
      error?.name === "AbortError" ||
      error?.name === "TimeoutError";

    console.error(
      "Translation request failed:",
      error?.name,
      error?.message
    );

    if (timedOut) {
      return jsonResponse(
        { error: "Translation request timed out. Please try again." },
        504
      );
    }

    return jsonResponse(
      { error: "Translation request failed" },
      502
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
