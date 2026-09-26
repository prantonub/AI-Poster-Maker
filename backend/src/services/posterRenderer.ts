import Handlebars from "handlebars";
import { Types } from "mongoose";
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

export async function screenshotHtml(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: PRINT_WIDTH, height: PRINT_HEIGHT });
    await page.setContent(html, { waitUntil: "networkidle0" });
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
