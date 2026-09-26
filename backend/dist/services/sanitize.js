"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeText = sanitizeText;
// Handlebars' default {{}} interpolation already HTML-escapes every value
// (verified in Phase 7 against a literal <script> payload), so this is a
// second, independent layer rather than the only defense: it strips control
// characters and null bytes that could otherwise misbehave inside the
// Puppeteer-rendered page, and collapses excess whitespace.
function sanitizeText(input) {
    return input
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
