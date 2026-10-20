// Optional face and detail repair with Google's Gemini image model. Unlike the in-browser enhancer the photo is sent to
// Google, and the model redraws the picture rather than restoring it, so it is an opt-in button with a notice.
//
//   GEMINI_API_KEY          switches the feature on (a free Google AI Studio key works)
//   GEMINI_IMAGE_MODEL      model id (defaults to gemini-2.5-flash-image)
//   GEMINI_MONTHLY_LIMIT    runs per account per calendar month (default 30)
//   GEMINI_API_BASE         only for local tests against a fake server
const env = process.env;

const DEFAULT_MODEL = "gemini-2.5-flash-image";
const REQUEST_TIMEOUT_MS = 55_000;

export const geminiConfigured = () => Boolean(env.GEMINI_API_KEY);
export const monthlyGeminiLimit = () => Math.max(0, Number(env.GEMINI_MONTHLY_LIMIT ?? 30) || 0);

const PROMPT =
  "Restore this photograph. Make it sharp and in focus, remove blur, noise and compression damage, and rebuild fine " +
  "detail, especially in faces, eyes, skin and hair. Keep every person's identity, expression, pose, clothing, " +
  "colours, lighting and the composition exactly as they are. Do not add, remove or change anything in the scene, " +
  "and do not add text. Return only the restored photograph.";

// Google gives its image models no free requests, so without billing on the key's project every call ends here.
export class GeminiQuotaError extends Error {
  constructor() {
    super("Gemini quota used up or not available on the free tier");
  }
}

type Part = { text?: string; inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } };

// The repaired picture as image bytes, or null when the model answered without one (for example, it declined).
export async function repairWithGemini(jpeg: Uint8Array): Promise<Uint8Array | null> {
  const base = env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com";
  const response = await fetch(`${base}/v1beta/models/${encodeURIComponent(env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": env.GEMINI_API_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: "image/jpeg", data: Buffer.from(jpeg).toString("base64") } }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (response.status === 429) throw new GeminiQuotaError();
  if (!response.ok) throw new Error(`Gemini answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const body = (await response.json()) as { candidates?: { content?: { parts?: Part[] } }[] };
  for (const part of body.candidates?.[0]?.content?.parts ?? []) {
    const data = part.inlineData?.data ?? part.inline_data?.data;
    if (data) return new Uint8Array(Buffer.from(data, "base64"));
  }
  return null;
}
