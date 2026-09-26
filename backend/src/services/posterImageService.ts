import { env } from "../config/env";
import { ApiError } from "../middleware/errorHandler";
import { getBrowser } from "./browserManager";

// Hugging Face Inference Providers. Raw task endpoint format is:
//   POST https://router.huggingface.co/{provider}/models/{model}
// with { inputs, parameters } and the response is the raw image bytes.
// We use the free serverless "HF Inference" provider, which serves
// stabilityai/stable-diffusion-3-medium-diffusers for text-to-image.
const HF_ROUTER = "https://router.huggingface.co";
const IMAGE_PROVIDER = "hf-inference";
const IMAGE_TIMEOUT_MS = 120_000;

export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

export interface GeneratedPosterImage {
  mimeType: string;
  base64: string;
}

// Pixel dimensions per supported aspect ratio (multiples of 8, verified
// against the live API).
const IMAGE_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "4:5": { width: 1024, height: 1280 },
  "9:16": { width: 720, height: 1280 },
  "16:9": { width: 1280, height: 720 },
};

// Internal professional design instruction: asks the model for the
// ARTWORK of a high-quality Bengali social-media poster. The USER's prompt
// stays in control of the design (occasion, colors, mood).
//
// The model is deliberately asked for a *text-free decorative background*.
// Diffusion models cannot shape Bengali conjuncts (ড্ড, র্ক, ষ্ঠ …) and paint
// garbled fake lettering instead, so all wording is typeset afterwards by
// composeWithBanglaText() with a real Bangla font in Chromium — that text is
// always sharp, correctly shaped and readable.
const DESIGN_INSTRUCTION = [
  "Decorative background artwork for a social media poster: purely ornamental pattern, abstract and symmetrical.",
  "Bengali-inspired festive motifs — floral and geometric arabesque, ornamental border frames, lanterns, crescents, stars and filigree — as suited to the brief.",
  "Flat vector illustration, clean shapes, soft gradients, cohesive premium palette, clean uncluttered empty center.",
  "CRITICAL: artwork only. Absolutely no text, no letters, no script, no numbers, no writing, no symbols that look like writing, no signage, no banner, no watermark.",
].join(" ");

// Applied when a real image-to-image model is configured (HF_IMAGE_EDIT_MODEL).
// The model must not repaint lettering — the wording is typeset afterwards.
const EDIT_INSTRUCTION = [
  "Edit the attached poster artwork according to the instruction. Keep the composition, colors and motifs that are not mentioned as close to the original as possible.",
  "Do not draw or alter any text or lettering: the image must stay free of writing, and keep calm open space in the lower third.",
].join(" ");

// Strongly suppresses the garbled lettering SD3 likes to hallucinate.
const NEGATIVE_PROMPT = [
  "text, words, lettering, letters, typography, writing, handwriting, calligraphy, caption, headline, title, slogan, subtitle, alphabet, script",
  "numbers, digits, signboard, sign, banner, placard, poster with text, logo, label, seal, stamp, watermark, signature",
  "gibberish text, garbled letters, fake calligraphy, mangled script, invented symbols, meaningless characters",
  "blurry, low quality, distorted, jpeg artifacts, cluttered layout, oversaturated, photo of a poster, mockup",
].join(", ");

function buildGeneratePrompt(userPrompt: string): string {
  return [
    DESIGN_INSTRUCTION,
    `Visual direction from the user (describe the artwork only, never render any wording): ${userPrompt}`,
  ].join("\n\n");
}

function buildFallbackEditPrompt(instruction: string): string {
  return [
    DESIGN_INSTRUCTION,
    `This is an updated version of a previously generated poster. Visual change requested: ${instruction}`,
  ].join("\n\n");
}

// Maps Hugging Face HTTP failures onto user-friendly ApiErrors. Also logged
// server-side so the raw provider message isn't lost.
async function toFriendlyError(res: globalThis.Response): Promise<ApiError> {
  const body = await res.text().catch(() => "");
  let detail = "";
  try {
    detail = String((JSON.parse(body) as { error?: string }).error ?? "");
  } catch {
    /* non-JSON body */
  }
  // eslint-disable-next-line no-console
  console.error(`[posterImageService] Hugging Face ${res.status}: ${detail || body.slice(0, 300)}`);

  if (res.status === 401 || res.status === 403) {
    return new ApiError(502, "The Hugging Face API token was rejected. Please check HF_API_KEY on the server (the token needs 'Inference Providers' permission).");
  }
  if (res.status === 402) {
    return new ApiError(402, "Your Hugging Face account has run out of inference credits. Add credits at huggingface.co → Settings → Billing.");
  }
  if (res.status === 429) {
    return new ApiError(429, "Hugging Face rate limit reached. Please wait a moment and try again.");
  }
  if (res.status === 503) {
    return new ApiError(503, "The image model is still warming up on Hugging Face. Please try again in about 15 seconds.");
  }
  if (res.status === 400) {
    return new ApiError(400, `Hugging Face could not process this request${detail ? `: ${detail}` : ""}.`);
  }
  if (res.status >= 500) {
    return new ApiError(502, "Hugging Face inference is temporarily unavailable. Please try again shortly.");
  }
  return new ApiError(502, "Hugging Face returned an unexpected response. Please try again.");
}

// Real Bangla families, in priority order. The Docker image installs
// fonts-beng/fonts-beng-extra (Noto Sans Bengali, Kalpurush, …) and Windows
// ships Kalpurush/Vrinda, so one stack covers both environments.
const BANGLA_FONT_STACK =
  '"Noto Sans Bengali", "Kalpurush", "Vrinda", "Nirmala UI", "SolaimanLipi", "Shonar Bangla", sans-serif';

function escapeHtml(value: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (c) => map[c]);
}

// Headline = the opening clause of the brief, caption = the rest. Any
// "পরিবর্তন:" (edit instruction) tail is dropped so an edited poster keeps
// showing its original brief.
function derivePosterText(prompt: string): { headline: string; caption: string } {
  const brief = prompt.split("পরিবর্তন:")[0] ?? prompt;
  const cleaned = brief.replace(/\s+/g, " ").trim();
  if (!cleaned) return { headline: "", caption: "" };

  // Prefer the first sentence; if that is very short, also try a comma break.
  let headline =
    cleaned.split(/[.!?।—]/).map((s) => s.trim()).filter(Boolean)[0] ?? cleaned;
  if (headline.length < 14) {
    const byComma = headline.split(/,/).map((s) => s.trim()).filter(Boolean)[0] ?? headline;
    if (byComma.length >= 14) headline = byComma;
  }

  headline = headline.slice(0, 60);
  const rest = cleaned.slice(headline.length).replace(/^[.!?।—,\s]+/, "").trim();
  return { headline, caption: rest.slice(0, 200) };
}

// Typesets the Bangla wording over the AI artwork using Chromium + a real
// Bangla font. This is what makes the text perfectly legible — the diffusion
// model never touches the glyphs. Returns a PNG.
async function composeWithBanglaText(
  baseImage: { base64: string; mimeType: string },
  width: number,
  height: number,
  prompt: string
): Promise<GeneratedPosterImage> {
  const { headline, caption } = derivePosterText(prompt);
  const headlinePx = Math.max(26, Math.round(width * 0.062));
  const captionPx = Math.max(15, Math.round(width * 0.03));

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${width}px;height:${height}px;overflow:hidden;background:#000}
    .art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .band{position:absolute;left:0;right:0;bottom:0;text-align:center;
      padding:${Math.round(height * 0.055)}px ${Math.round(width * 0.06)}px ${Math.round(height * 0.035)}px;
      background:linear-gradient(to bottom,rgba(0,0,0,0) 0%,rgba(0,0,0,0.72) 45%,rgba(0,0,0,0.92) 100%)}
    .headline{font-family:${BANGLA_FONT_STACK};font-size:${headlinePx}px;font-weight:800;
      line-height:1.25;color:#ffffff;text-shadow:0 4px 20px rgba(0,0,0,0.7)}
    .caption{font-family:${BANGLA_FONT_STACK};font-size:${captionPx}px;font-weight:500;
      line-height:1.45;color:rgba(255,255,255,0.92);margin-top:${Math.round(height * 0.012)}px;
      text-shadow:0 2px 12px rgba(0,0,0,0.75)}
  </style></head><body>
    <img class="art" src="data:${baseImage.mimeType};base64,${baseImage.base64}" />
    ${
      headline
        ? `<div class="band"><div class="headline">${escapeHtml(headline)}</div>${
            caption ? `<div class="caption">${escapeHtml(caption)}</div>` : ""
          }</div>`
        : ""
    }
  </body></html>`;

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height });
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    // Give the Bangla font a moment to be ready, then let it paint.
    await Promise.race([
      page.evaluate(() => (globalThis as any).document?.fonts?.ready).catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 3000)),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const png = await page.screenshot({ type: "png" });
    return { mimeType: "image/png", base64: Buffer.from(png).toString("base64") };
  } finally {
    await page.close();
  }
}

// One HTTP call to the HF router. `inputs` is a text prompt (text-to-image)
// or a base64 image (image-to-image); the response is the raw image bytes.
async function callImageModel(
  model: string,
  payload: { inputs: string; parameters: Record<string, unknown> },
  poster: { width: number; height: number; prompt: string }
): Promise<GeneratedPosterImage> {
  if (!env.hfApiKey) {
    throw new ApiError(
      503,
      "AI image generation is not configured on the server (HF_API_KEY is missing). Please contact the administrator."
    );
  }

  const url = `${HF_ROUTER}/${IMAGE_PROVIDER}/models/${model}`;
  let res: globalThis.Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.hfApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[posterImageService] Hugging Face request failed:", err);
    throw new ApiError(502, "Could not reach the Hugging Face inference service. Please check the server's connection and try again.");
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.startsWith("image/")) {
    throw await toFriendlyError(res);
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0) {
    throw new ApiError(502, "Hugging Face returned an empty image. Please try again.");
  }

  // Typeset the Bangla wording over the AI artwork with a real font so the
  // text is always sharp and readable.
  return composeWithBanglaText(
    { mimeType: contentType, base64: bytes.toString("base64") },
    poster.width,
    poster.height,
    poster.prompt
  );
}

// Generates a brand-new poster image from a natural-language prompt.
export async function generatePosterImage(
  userPrompt: string,
  aspectRatio: AspectRatio
): Promise<GeneratedPosterImage> {
  const { width, height } = IMAGE_SIZES[aspectRatio];
  return callImageModel(
    env.hfImageModel,
    {
      inputs: buildGeneratePrompt(userPrompt),
      parameters: { width, height, negative_prompt: NEGATIVE_PROMPT },
    },
    { width, height, prompt: userPrompt }
  );
}

const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

// Downloads the current poster (its Cloudinary URL was validated by the
// request schema) so an image-to-image model can edit it.
async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  let res: globalThis.Response;
  try {
    res = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new ApiError(400, "Could not download the current poster image for editing. Please generate again.");
  }

  if (!res.ok) {
    throw new ApiError(400, `Could not download the current poster image for editing (HTTP ${res.status}).`);
  }

  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!contentType.startsWith("image/")) {
    throw new ApiError(400, "The provided image URL does not point to an image.");
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_SOURCE_IMAGE_BYTES) {
    throw new ApiError(400, "The image to edit is too large (max 10 MB).");
  }

  return bytes.toString("base64");
}

// "Edit with Prompt". When HF_IMAGE_EDIT_MODEL is configured this is a true
// image-to-image edit of the existing poster. On the free tier no
// image-to-image model is reachable (FLUX.1-Kontext-dev and friends are
// gated on paid providers), so the edit is instead re-rendered from the
// design brief with the change folded in — the frontend sends the original
// brief plus the requested change as `prompt`.
export async function editPosterImage(
  imageUrl: string,
  instruction: string,
  aspectRatio: AspectRatio
): Promise<GeneratedPosterImage> {
  const { width, height } = IMAGE_SIZES[aspectRatio];

  if (env.hfImageEditModel) {
    const sourceImage = await fetchImageAsBase64(imageUrl);
    return callImageModel(
      env.hfImageEditModel,
      {
        inputs: sourceImage,
        parameters: { prompt: `${EDIT_INSTRUCTION} Change: ${instruction}`, width, height },
      },
      { width, height, prompt: instruction }
    );
  }

  return callImageModel(
    env.hfImageModel,
    {
      inputs: buildFallbackEditPrompt(instruction),
      parameters: { width, height, negative_prompt: NEGATIVE_PROMPT },
    },
    { width, height, prompt: instruction }
  );
}


