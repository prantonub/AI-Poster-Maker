// tsc only compiles .ts files — it never copies static assets like our
// .html poster templates into dist/. Without this step, dist/templates/
// simply doesn't exist after `npm run build`, and every poster generation
// fails in production with "Template HTML file not found", even though
// local dev (which runs ts-node-dev directly against src/) never hits it.
const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "..", "src", "templates");
const destDir = path.join(__dirname, "..", "dist", "templates");

fs.mkdirSync(destDir, { recursive: true });

const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(".html"));
for (const file of files) {
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
}

console.log(
  `[copy-templates] copied ${files.length} template(s) to dist/templates/`,
);
