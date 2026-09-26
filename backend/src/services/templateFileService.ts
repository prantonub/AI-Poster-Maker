import path from "path";
import fs from "fs";

const TEMPLATES_DIR = path.join(__dirname, "..", "..", "templates");

export function templateFilePath(fileName: string): string {
  return path.join(TEMPLATES_DIR, fileName);
}

export function readTemplateHtml(fileName: string): string {
  const filePath = templateFilePath(fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Template HTML file not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf-8");
}