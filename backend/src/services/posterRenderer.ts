import Handlebars from "handlebars";
import { Types } from "mongoose";
import type { Page } from "puppeteer";
import { Poster } from "../models/Poster";
import { Template, ITemplate, OccasionType } from "../models/Template";
import { GenerationLog } from "../models/GenerationLog";
import { getBrowser } from "./browserManager";
import { readTemplateHtml } from "./templateFileService";
import { resolveStyleSuggestion, toCachedSuggestion } from "./styleSuggestionService";
import { buildRenderContext } from "./renderContext";
import { uploadBufferToCloudinary } from "./uploadService";

const PRINT_WIDTH = 1200;
const PRINT_HEIGHT = 1600;

export async function renderPosterHtml(
  template: ITemplate,
  context: ReturnType<typeof buildRenderContext>
): Promise<string> {
  const rawHtml = readTemplateHtml(template.htmlTemplatePath);
  const compiled = Handlebars.compile(rawHtml);
  return compiled(context);
}

// The backend tsconfig compiles for Node (no DOM lib), but the callback below
// executes inside Chromium — declaring the one browser global we use lets it
// type-check while still emitting a plain `document` identifier.
declare const document: any;

// Hard cap on waiting for images/fonts after the DOM is ready. A slow or
// unreachable image CDN must never fail poster creation — after this wait we
// screenshot whatever has rendered.
const ASSET_WAIT_TIMEOUT_MS = 15_000;

async function waitForPageAssets(page: Page): Promise<void> {
  // The trailing .catch swallows a late rejection (e.g. page closed while
  // image requests are still in flight) so it can't surface as an unhandled
  // rejection after we've stopped waiting.
  const assetsReady = page
    .evaluate(async () => {
      const images: any[] = Array.from(document.images);
      await Promise.all(
        images.map((img) =>
          img.complete
            ? undefined
            : new Promise<void>((resolve) => {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
              })
        )
      );
      if (document.fonts && document.fonts.status !== "loaded") {
        await document.fonts.ready;
      }
    })
    .catch(() => undefined);

  await Promise.race([
    assetsReady,
    new Promise<void>((resolve) => setTimeout(resolve, ASSET_WAIT_TIMEOUT_MS)),
  ]);
}

export async function screenshotHtml(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: PRINT_WIDTH, height: PRINT_HEIGHT });
    // Wait for the DOM only — NOT for network idle. With `networkidle0` a
    // single hanging image request kept the connection count above zero and
    // tripped Puppeteer's 30s navigation timeout ("Navigation timeout of
    // 30000 ms exceeded"), failing the whole poster. Images and fonts are
    // awaited separately by waitForPageAssets with a hard cap instead, so a
    // slow CDN can delay the screenshot but can never fail it.
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await waitForPageAssets(page);
    // Give the compositor a beat to paint before capturing, since we no
    // longer get the implicit ~500ms that networkidle0 used to add.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const buffer = await page.screenshot({ type: "png" });
    return Buffer.from(buffer);
  } finally {
    // Always close the page, never the shared browser instance.
    await page.close();
  }
}

interface QuickRenderFormData {
  name: string;
  designation: string;
  party: string;
  district: string;
  thana: string;
  union: string;
  headlineText: string;
}

// Shared by generatePoster (full pipeline, saved to a Poster doc) and the
// quick-preview endpoint (ephemeral, not saved): given a template and form
// data, resolves Gemini styling, renders, screenshots, and uploads — but
// leaves cache persistence and GenerationLog writing to the caller, since
// those decisions differ (quick-preview intentionally skips both — see
// its route handler for why).
export async function renderTemplateToImageUrl(
  template: ITemplate,
  formData: QuickRenderFormData,
  photoUrls: string[],
  occasionType: OccasionType
): Promise<{
  imageUrl: string;
  resolved: Awaited<ReturnType<typeof resolveStyleSuggestion>>;
}> {
  const resolved = await resolveStyleSuggestion(template, {
    occasionType,
    headlineText: formData.headlineText,
    numPhotos: photoUrls.length,
  });

  const context = buildRenderContext(
    { ...formData, occasion: occasionType },
    photoUrls,
    resolved.suggestion,
    template.layoutConfig.colorScheme.background
  );

  const html = await renderPosterHtml(template, context);
  const pngBuffer = await screenshotHtml(html);
  const uploaded = await uploadBufferToCloudinary(pngBuffer, "poster-maker/posters");

  return { imageUrl: uploaded.url, resolved };
}

async function logGeminiAttempt(
  posterId: Types.ObjectId,
  userId: Types.ObjectId,
  attempt: NonNullable<Awaited<ReturnType<typeof resolveStyleSuggestion>>["geminiAttempt"]>
) {
  try {
    await GenerationLog.create({
      posterId,
      userId,
      geminiPromptUsed: attempt.promptUsed,
      tokensUsed: attempt.tokensUsed,
      latencyMs: attempt.latencyMs,
      success: attempt.success,
      errorMessage: attempt.errorMessage,
    });
  } catch (logErr) {
    // Logging must never block or fail the actual generation pipeline.
    // eslint-disable-next-line no-console
    console.error("[posterRenderer] failed to write GenerationLog:", logErr);
  }
}

// The full pipeline for one poster. Never throws to the caller — any
// failure is captured onto the Poster document itself (status: 'failed',
// errorMessage) so the frontend's polling UI can show it.
export async function generatePoster(posterId: string): Promise<void> {
  const poster = await Poster.findById(posterId);
  if (!poster) {
    // eslint-disable-next-line no-console
    console.error(`[posterRenderer] poster ${posterId} not found`);
    return;
  }

  try {
    const template = await Template.findById(poster.templateId);
    if (!template) {
      throw new Error(`Template ${poster.templateId} not found`);
    }

    const resolved = await resolveStyleSuggestion(template, {
      occasionType: poster.formData.occasion,
      headlineText: poster.formData.headlineText,
      numPhotos: poster.uploadedPhotoUrls.length,
    });

    if (resolved.geminiAttempt) {
      await logGeminiAttempt(poster._id, poster.userId, resolved.geminiAttempt);
    }

    // Only a genuinely fresh Gemini result should refresh the template's cache.
    if (resolved.source === "gemini") {
      template.lastGeminiSuggestion = toCachedSuggestion(resolved.suggestion);
      await template.save();
    }

    const context = buildRenderContext(
      poster.formData,
      poster.uploadedPhotoUrls,
      resolved.suggestion,
      template.layoutConfig.colorScheme.background
    );

    const html = await renderPosterHtml(template, context);
    const pngBuffer = await screenshotHtml(html);
    const uploaded = await uploadBufferToCloudinary(pngBuffer, "poster-maker/posters");

    poster.generatedImageUrl = uploaded.url;
    poster.status = "completed";
    poster.errorMessage = undefined;
    await poster.save();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown generation error";
    // eslint-disable-next-line no-console
    console.error(`[posterRenderer] generation failed for poster ${posterId}:`, err);
    poster.status = "failed";
    poster.errorMessage = message;
    await poster.save();
  }
}
