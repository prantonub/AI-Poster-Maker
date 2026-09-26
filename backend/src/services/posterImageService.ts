import { env } from "../config/env";
import { ApiError } from "../middleware/errorHandler";

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

// Internal professional design instruction: tells the model the *kind* of
// artifact to produce (a high-quality Bengali/social-media poster). The
// USER's prompt stays in control of the actual design (occasion, wording,
// colors, mood) — this instruction only sets professional design standards.
const DESIGN_INSTRUCTION = [
  "Professional social-media poster design, flat vector illustration style with clean shapes, soft gradients and a cohesive premium color palette.",
  "Finished, ready-to-post poster layout with strong visual hierarchy: one clear focal point, balanced composition, generous margins, nothing cramped or overflowing.",
  "Use elegant Bengali (Bangla) script for any Bangla wording, keeping the requested wording exactly.",
  "Decorative motifs should suit a Bengali/Bangladeshi audience.",
  "No watermark, no app UI, no placeholder/lorem-ipsum text, no photorealistic photo of a poster.",
].join(" ");

// Applied when a real image-to-image model is configured (HF_IMAGE_EDIT_MODEL).
const EDIT_INSTRUCTION = [
  "Edit the attached poster according to the instruction. Keep everything else — composition, wording, typography and colors not mentioned — as close to the original as possible.",
].join(" ");

const NEGATIVE_PROMPT =
  "blurry, low quality, distorted, jpeg artifacts, watermark, lorem ipsum, cluttered layout, ugly typography, oversaturated";

function buildGeneratePrompt(userPrompt: string): string {
  return `${DESIGN_INSTRUCTION} Design brief from the user: ${userPrompt}`;
}

function buildFallbackEditPrompt(instruction: string): string {
  return `${DESIGN_INSTRUCTION} This is an updated version of a previously generated poster. Update requested: ${instruction}`;
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

// One HTTP call to the HF router. `inputs` is a text prompt (text-to-image)
// or a base64 image (image-to-image); the response is the raw image bytes.
async function callImageModel(
  model: string,
  payload: { inputs: string; parameters: Record<string, unknown> }
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

  return { mimeType: contentType, base64: bytes.toString("base64") };
}

// Generates a brand-new poster image from a natural-language prompt.
export async function generatePosterImage(
  userPrompt: string,
  aspectRatio: AspectRatio
): Promise<GeneratedPosterImage> {
  const { width, height } = IMAGE_SIZES[aspectRatio];
  return callImageModel(env.hfImageModel, {
    inputs: buildGeneratePrompt(userPrompt),
    parameters: { width, height, negative_prompt: NEGATIVE_PROMPT },
  });
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
    return callImageModel(env.hfImageEditModel, {
      inputs: sourceImage,
      parameters: { prompt: `${EDIT_INSTRUCTION} Change: ${instruction}`, width, height },
    });
  }

  return callImageModel(env.hfImageModel, {
    inputs: buildFallbackEditPrompt(instruction),
    parameters: { width, height, negative_prompt: NEGATIVE_PROMPT },
  });
}


