import { Request } from "express";

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 200;

/** Standard ?page/?limit parsing, clamped to sane bounds. */
export function paginationParams(
  query: Request["query"],
  defaultLimit = DEFAULT_LIMIT,
  maxLimit = MAX_LIMIT
): Pagination {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(String(query.limit ?? String(defaultLimit)), 10) || defaultLimit)
  );
  return { page, limit, skip: (page - 1) * limit };
}

/** Reads a query param as a trimmed, non-empty string (or undefined). */
export function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Escapes user input before it is embedded in a $regex. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Builds a { $gte, $lte } clause for `?from=&to=` (ISO date strings). */
export function dateRange(
  query: Request["query"],
  field = "createdAt"
): Record<string, unknown> | null {
  const from = str(query.from);
  const to = str(query.to);

  if (!from && !to) return null;

  const range: Record<string, Date> = {};
  if (from) {
    const d = new Date(from);
    if (Number.isNaN(d.getTime())) return null;
    range.$gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (Number.isNaN(d.getTime())) return null;
    // Treat a bare date as inclusive of the whole day.
    if (to.length === 10) d.setHours(23, 59, 59, 999);
    range.$lte = d;
  }

  return { [field]: range };
}

/** Wraps a page of results in the envelope every admin list endpoint returns. */
export function paginated<T>(items: T[], page: number, limit: number, total: number) {
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/**
 * Builds a Mongo sort object from `?sort=` while only allowing fields the
 * caller explicitly allowlists (prevents sorting on unindexed/unexpected keys).
 */
export function sortFrom(
  query: Request["query"],
  allowed: Record<string, 1 | -1>,
  fallback: Record<string, 1 | -1>
): Record<string, 1 | -1> {
  const raw = str(query.sort);
  if (!raw) return fallback;

  const [field, direction] = raw.split(":");
  if (!(field in allowed)) return fallback;

  return { [field]: direction === "asc" ? 1 : -1 };
}

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  // Neutralise spreadsheet formula injection before quoting.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * Renders an RFC-4180 CSV. A UTF-8 BOM is prepended so Excel renders Bengali
 * text correctly when an operator opens the export.
 */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  return `\uFEFF${lines.join("\r\n")}`;
}