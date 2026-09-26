"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_LIMIT = exports.DEFAULT_LIMIT = void 0;
exports.paginationParams = paginationParams;
exports.str = str;
exports.escapeRegex = escapeRegex;
exports.dateRange = dateRange;
exports.paginated = paginated;
exports.sortFrom = sortFrom;
exports.toCsv = toCsv;
exports.DEFAULT_LIMIT = 20;
exports.MAX_LIMIT = 200;
/** Standard ?page/?limit parsing, clamped to sane bounds. */
function paginationParams(query, defaultLimit = exports.DEFAULT_LIMIT, maxLimit = exports.MAX_LIMIT) {
    const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(String(query.limit ?? String(defaultLimit)), 10) || defaultLimit));
    return { page, limit, skip: (page - 1) * limit };
}
/** Reads a query param as a trimmed, non-empty string (or undefined). */
function str(value) {
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
/** Escapes user input before it is embedded in a $regex. */
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/** Builds a { $gte, $lte } clause for `?from=&to=` (ISO date strings). */
function dateRange(query, field = "createdAt") {
    const from = str(query.from);
    const to = str(query.to);
    if (!from && !to)
        return null;
    const range = {};
    if (from) {
        const d = new Date(from);
        if (Number.isNaN(d.getTime()))
            return null;
        range.$gte = d;
    }
    if (to) {
        const d = new Date(to);
        if (Number.isNaN(d.getTime()))
            return null;
        // Treat a bare date as inclusive of the whole day.
        if (to.length === 10)
            d.setHours(23, 59, 59, 999);
        range.$lte = d;
    }
    return { [field]: range };
}
/** Wraps a page of results in the envelope every admin list endpoint returns. */
function paginated(items, page, limit, total) {
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
/**
 * Builds a Mongo sort object from `?sort=` while only allowing fields the
 * caller explicitly allowlists (prevents sorting on unindexed/unexpected keys).
 */
function sortFrom(query, allowed, fallback) {
    const raw = str(query.sort);
    if (!raw)
        return fallback;
    const [field, direction] = raw.split(":");
    if (!(field in allowed))
        return fallback;
    return { [field]: direction === "asc" ? 1 : -1 };
}
function csvCell(value) {
    if (value === undefined || value === null)
        return "";
    const text = value instanceof Date ? value.toISOString() : String(value);
    // Neutralise spreadsheet formula injection before quoting.
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
}
/**
 * Renders an RFC-4180 CSV. A UTF-8 BOM is prepended so Excel renders Bengali
 * text correctly when an operator opens the export.
 */
function toCsv(headers, rows) {
    const lines = [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
    return `\uFEFF${lines.join("\r\n")}`;
}
