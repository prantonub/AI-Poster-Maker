/**
 * Seeds the 5 starter templates:
 *   বিজয় দিবস (victory day), শোক/স্মরণ (tribute), নির্বাচনী প্রচার (campaign),
 *   উৎসব শুভেচ্ছা (greeting), ঈদ/উৎসব (eid_festival)
 *
 * Idempotent: upserts by title, so re-running is safe.
 *
 * Usage: npm run seed:templates   (from /backend, or via the root workspace script)
 */
import { connectDB } from "../config/db";
import { Template, LayoutConfig } from "../models/Template";
import { readTemplateHtml, templateFilePath } from "../services/templateFileService";
import mongoose from "mongoose";

interface SeedTemplate {
  title: string;
  occasionType: "victory_day" | "tribute" | "campaign" | "greeting" | "eid_festival";
  htmlFile: string;
  layoutConfig: LayoutConfig;
}

const seedTemplates: SeedTemplate[] = [
  {
    title: "বিজয় দিবস",
    occasionType: "victory_day",
    htmlFile: "victory-day.html",
    layoutConfig: {
      photoSlots: [
        { x: 240, y: 70, width: 220, height: 220, shape: "circle" },
        { x: 490, y: 70, width: 220, height: 220, shape: "circle" },
        { x: 740, y: 70, width: 220, height: 220, shape: "circle" },
      ],
      textSlots: [
        { id: "headlineText", x: 60, y: 340, fontSize: 84, fontFamily: "Noto Sans Bengali", color: "#006A4E", align: "center", maxLength: 60 },
        { id: "name", x: 0, y: 1420, fontSize: 40, fontFamily: "Noto Sans Bengali", color: "#ffffff", align: "center", maxLength: 60 },
        { id: "designation", x: 0, y: 1470, fontSize: 26, fontFamily: "Noto Sans Bengali", color: "#ffffff", align: "center", maxLength: 60 },
      ],
      colorScheme: { primary: "#006A4E", secondary: "#F42A41", accent: "#F4C430", background: "#F4F9F6" },
      decorativeElements: [
        { asset: "rice-paddy-bg", opacity: 0.5 },
        { asset: "flag", opacity: 1 },
        { asset: "doves", opacity: 0.85 },
      ],
    },
  },
  {
    title: "শোক/স্মরণ",
    occasionType: "tribute",
    htmlFile: "tribute.html",
    layoutConfig: {
      photoSlots: [{ x: 440, y: 100, width: 320, height: 320, shape: "circle" }],
      textSlots: [
        { id: "headlineText", x: 60, y: 470, fontSize: 78, fontFamily: "Noto Sans Bengali", color: "#3B3B3B", align: "center", maxLength: 60 },
        { id: "name", x: 0, y: 1440, fontSize: 40, fontFamily: "Noto Sans Bengali", color: "#ffffff", align: "center", maxLength: 60 },
        { id: "designation", x: 0, y: 1490, fontSize: 26, fontFamily: "Noto Sans Bengali", color: "#ffffff", align: "center", maxLength: 60 },
      ],
      colorScheme: { primary: "#3B3B3B", secondary: "#8C8C8C", accent: "#C9A24B", background: "#F5F5F3" },
      decorativeElements: [{ asset: "floral-border", opacity: 1 }],
    },
  },
  {
    title: "নির্বাচনী প্রচার",
    occasionType: "campaign",
    htmlFile: "campaign.html",
    layoutConfig: {
      photoSlots: [
        { x: 375, y: 90, width: 210, height: 210, shape: "rect" },
        { x: 615, y: 90, width: 210, height: 210, shape: "rect" },
      ],
      textSlots: [
        { id: "headlineText", x: 50, y: 360, fontSize: 90, fontFamily: "Noto Sans Bengali", color: "#006A4E", align: "center", maxLength: 60 },
        { id: "party", x: 0, y: 650, fontSize: 42, fontFamily: "Noto Sans Bengali", color: "#ffffff", align: "center", maxLength: 40 },
        { id: "name", x: 0, y: 1420, fontSize: 40, fontFamily: "Noto Sans Bengali", color: "#ffffff", align: "center", maxLength: 60 },
      ],
      colorScheme: { primary: "#006A4E", secondary: "#F42A41", accent: "#1A5FB4", background: "#FFFFFF" },
      decorativeElements: [{ asset: "flag", opacity: 1 }],
    },
  },
  {
    title: "উৎসব শুভেচ্ছা",
    occasionType: "greeting",
    htmlFile: "greeting.html",
    layoutConfig: {
      photoSlots: [{ x: 390, y: 160, width: 420, height: 420, shape: "circle" }],
      textSlots: [
        { id: "headlineText", x: 60, y: 680, fontSize: 88, fontFamily: "Noto Sans Bengali", color: "#ffffff", align: "center", maxLength: 60 },
        { id: "party", x: 0, y: 1010, fontSize: 34, fontFamily: "Noto Sans Bengali", color: "#8B4513", align: "center", maxLength: 40 },
        { id: "name", x: 0, y: 1370, fontSize: 42, fontFamily: "Noto Sans Bengali", color: "#ffffff", align: "center", maxLength: 60 },
      ],
      colorScheme: { primary: "#8B4513", secondary: "#D2691E", accent: "#FFD700", background: "#FFF8E7" },
      decorativeElements: [{ asset: "floral-border", opacity: 0.8 }],
    },
  },
  {
    title: "ঈদ/উৎসব",
    occasionType: "eid_festival",
    htmlFile: "eid-festival.html",
    layoutConfig: {
      photoSlots: [],
      textSlots: [
        { id: "headlineText", x: 60, y: 900, fontSize: 82, fontFamily: "Noto Sans Bengali", color: "#e8c874", align: "center", maxLength: 60 },
        { id: "party", x: 0, y: 1100, fontSize: 30, fontFamily: "Noto Sans Bengali", color: "#0b4d3c", align: "center", maxLength: 40 },
        { id: "name", x: 0, y: 1350, fontSize: 42, fontFamily: "Noto Sans Bengali", color: "#ffffff", align: "center", maxLength: 60 },
      ],
      colorScheme: { primary: "#0b4d3c", secondary: "#0b2b28", accent: "#e8c874", background: "#0b2b28" },
      decorativeElements: [{ asset: "doves", opacity: 0.9 }],
    },
  },
];

async function seed() {
  await connectDB();

  for (const t of seedTemplates) {
    // Fail loudly and early if the HTML file is missing, rather than
    // creating a Template doc that points at nothing.
    readTemplateHtml(t.htmlFile);

    const result = await Template.findOneAndUpdate(
      { title: t.title },
      {
        title: t.title,
        occasionType: t.occasionType,
        thumbnailUrl: `/templates/thumbnails/${t.occasionType}.png`, // placeholder; real thumbnails come with admin tooling post-MVP
        htmlTemplatePath: t.htmlFile,
        layoutConfig: t.layoutConfig,
        isActive: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // eslint-disable-next-line no-console
    console.log(`[seed] upserted "${t.title}" -> ${result?._id} (${templateFilePath(t.htmlFile)})`);
  }

  await mongoose.disconnect();
  // eslint-disable-next-line no-console
  console.log("[seed] done");
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[seed] failed:", err);
  process.exit(1);
});
