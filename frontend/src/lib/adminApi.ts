import { apiClient } from "./apiClient";

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type UserRole = "user" | "admin";
export type PosterStatus = "draft" | "generating" | "completed" | "failed";
export type OccasionType =
  | "victory_day"
  | "tribute"
  | "campaign"
  | "greeting"
  | "eid_festival";

export interface AdminStats {
  userCount: number;
  newUsersToday: number;
  newUsersWeek: number;
  suspendedUsers: number;
  adminCount: number;
  templateCount: number;
  activeTemplateCount: number;
  postersByStatus: Record<string, number>;
  postersByStatusWeek: Record<string, number>;
  totalPosters: number;
  postersThisWeek: number;
  completedThisWeek: number;
  geminiCalls: number;
  geminiSuccessRate: number | null;
  geminiTokens: number;
  geminiAvgLatencyMs: number | null;
  settings: AppSettings;
}

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  loginCount: number;
  posterCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserDetail extends AdminUser {
  postersByStatus: Record<string, number>;
  recentPosters: {
    _id: string;
    formData: { name: string; headlineText: string; occasion: OccasionType };
    status: PosterStatus;
    generatedImageUrl?: string;
    createdAt: string;
  }[];
}

export interface AdminPoster {
  _id: string;
  userId: { _id: string; name: string; email: string; isActive: boolean } | string | null;
  templateId: { _id: string; title: string; occasionType: OccasionType } | string | null;
  formData: {
    name: string;
    headlineText: string;
    occasion: OccasionType;
    designation?: string;
    party?: string;
  };
  uploadedPhotoUrls: string[];
  status: PosterStatus;
  generatedImageUrl?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  generationLogs?: AdminGenerationLog[];
}

/** Payload for creating/updating a template (server fills in layout defaults). */
export interface TemplatePayload {
  title: string;
  occasionType: OccasionType;
  thumbnailUrl: string;
  htmlTemplatePath: string;
  isActive: boolean;
}

export interface AdminTemplate {
  _id: string;
  title: string;
  occasionType: OccasionType;
  thumbnailUrl: string;
  htmlTemplatePath: string;
  isActive: boolean;
  posterCount: number;
  fileExists: boolean;
  createdAt: string;
}

export interface AdminGenerationLog {
  _id: string;
  posterId: string;
  userId: string;
  geminiPromptUsed?: string;
  tokensUsed?: number;
  latencyMs?: number;
  success: boolean;
  errorMessage?: string;
  createdAt: string;
}

export interface GenerationLogSummary {
  total: number;
  success: number;
  failed: number;
  successRate: number | null;
  avgLatencyMs: number | null;
  totalTokens: number;
}

export interface AuditLogEntry {
  _id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  entity: string;
  entityId?: string;
  summary?: string;
  meta?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

export interface TimeseriesPoint {
  date: string;
  newUsers: number;
  posters: number;
  completed: number;
  failed: number;
  generations: number;
  generationSuccess: number;
}

export interface TopUser {
  userId: string;
  name: string;
  email: string;
  isActive: boolean;
  posters: number;
  completed: number;
  lastPosterAt: string;
}

export interface OccasionCount {
  occasion: OccasionType | "unknown";
  count: number;
}

export interface SystemInfo {
  server: {
    uptimeSeconds: number;
    uptimeLabel: string;
    nodeVersion: string;
    platform: string;
    pid: number;
    environment: string;
  };
  memory: {
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    systemFreeBytes: number;
    systemTotalBytes: number;
  };
  database: {
    connected: boolean;
    readyState: number;
    name: string | null;
    host: string | null;
    sizeBytes?: number;
    storageSizeBytes?: number;
    collections?: number;
  };
  collections: {
    userCount: number;
    posterCount: number;
    templateCount: number;
    logCount: number;
    auditCount: number;
    settingCount: number;
  };
  services: { puppeteer: { ready: boolean; error: string | null } };
  configuration: {
    huggingFace: boolean;
    cloudinary: boolean;
    mongodb: boolean;
    jwtSecretSet: boolean;
  };
}

export interface AppSettings {
  maintenanceMode: boolean;
  registrationOpen: boolean;
  generationEnabled: boolean;
  siteNotice: string;
  supportEmail: string;
  dailyPosterLimitPerUser: number;
}

// ---------------------------------------------------------------------------
// Query parameter types
// ---------------------------------------------------------------------------

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole | "";
  status?: "active" | "suspended" | "";
  from?: string;
  to?: string;
  sort?: string;
}

export interface PosterListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: PosterStatus | "";
  occasion?: OccasionType | "";
  userId?: string;
  from?: string;
  to?: string;
  sort?: string;
}

export interface LogListParams {
  page?: number;
  limit?: number;
  success?: "true" | "false" | "";
  userId?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface AuditListParams {
  page?: number;
  limit?: number;
  action?: string;
  entity?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface BulkResult {
  affected: number;
  skipped?: string[];
}


// ---------------------------------------------------------------------------
// Dashboard & analytics
// ---------------------------------------------------------------------------

export async function fetchAdminStats(): Promise<AdminStats> {
  const { data } = await apiClient.get<AdminStats>("/admin/stats");
  return data;
}

export async function fetchAdminTimeseries(days = 30): Promise<TimeseriesPoint[]> {
  const { data } = await apiClient.get<{ series: TimeseriesPoint[] }>("/admin/analytics/timeseries", {
    params: { days },
  });
  return data.series;
}

export async function fetchTopUsers(limit = 8): Promise<TopUser[]> {
  const { data } = await apiClient.get<TopUser[]>("/admin/analytics/top-users", {
    params: { limit },
  });
  return data;
}

export async function fetchOccasionCounts(): Promise<OccasionCount[]> {
  const { data } = await apiClient.get<OccasionCount[]>("/admin/analytics/occasions");
  return data;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function fetchAdminUsers(params: UserListParams = {}): Promise<Paginated<AdminUser>> {
  const { data } = await apiClient.get<Paginated<AdminUser>>("/admin/users", { params });
  return data;
}

export async function fetchAdminUser(id: string): Promise<AdminUserDetail> {
  const { data } = await apiClient.get<AdminUserDetail>(`/admin/users/${id}`);
  return data;
}

export async function updateAdminUser(
  id: string,
  patch: { name?: string; email?: string; phone?: string }
): Promise<AdminUser> {
  const { data } = await apiClient.patch<AdminUser>(`/admin/users/${id}`, patch);
  return data;
}

export async function setAdminUserRole(id: string, role: UserRole): Promise<AdminUser> {
  const { data } = await apiClient.patch<AdminUser>(`/admin/users/${id}/role`, { role });
  return data;
}

export async function setAdminUserStatus(
  id: string,
  isActive: boolean,
  reason?: string
): Promise<AdminUser> {
  const { data } = await apiClient.patch<AdminUser>(`/admin/users/${id}/status`, { isActive, reason });
  return data;
}

export async function resetAdminUserPassword(id: string, password: string): Promise<AdminUser> {
  const { data } = await apiClient.post<AdminUser>(`/admin/users/${id}/password`, { password });
  return data;
}

export async function deleteAdminUser(id: string): Promise<{ deleted: boolean }> {
  const { data } = await apiClient.delete<{ deleted: boolean }>(`/admin/users/${id}`);
  return data;
}

export async function bulkUserAction(
  action: "activate" | "suspend" | "make_admin" | "make_user" | "delete",
  ids: string[],
  reason?: string
): Promise<BulkResult> {
  const { data } = await apiClient.post<BulkResult>("/admin/users/bulk", { action, ids, reason });
  return data;
}

// ---------------------------------------------------------------------------
// Posters
// ---------------------------------------------------------------------------

export async function fetchAdminPosters(
  params: PosterListParams = {}
): Promise<Paginated<AdminPoster>> {
  const { data } = await apiClient.get<Paginated<AdminPoster>>("/admin/posters", { params });
  return data;
}

export async function fetchAdminPoster(id: string): Promise<AdminPoster> {
  const { data } = await apiClient.get<AdminPoster>(`/admin/posters/${id}`);
  return data;
}

export async function setAdminPosterStatus(id: string, status: PosterStatus): Promise<AdminPoster> {
  const { data } = await apiClient.patch<AdminPoster>(`/admin/posters/${id}/status`, { status });
  return data;
}

export async function regenerateAdminPoster(id: string): Promise<void> {
  await apiClient.post(`/admin/posters/${id}/regenerate`);
}

export async function deleteAdminPoster(id: string): Promise<void> {
  await apiClient.delete(`/admin/posters/${id}`);
}

export async function bulkDeleteAdminPosters(ids: string[]): Promise<{ deleted: number }> {
  const { data } = await apiClient.post<{ deleted: number }>("/admin/posters/bulk-delete", { ids });
  return data;
}

/** Downloads the filtered poster list as a CSV file. */
export async function exportAdminPostersCsv(params: PosterListParams = {}): Promise<void> {
  const { data, headers } = await apiClient.get<Blob>("/admin/posters/export.csv", {
    params,
    responseType: "blob",
  });

  const disposition = String(headers["content-disposition"] ?? "");
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] ?? `posters-${Date.now()}.csv`;

  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function fetchAdminTemplates(params: {
  search?: string;
  occasion?: OccasionType | "";
  isActive?: "true" | "false" | "";
} = {}): Promise<AdminTemplate[]> {
  const { data } = await apiClient.get<AdminTemplate[]>("/admin/templates", { params });
  return data;
}

export async function createAdminTemplate(payload: TemplatePayload): Promise<AdminTemplate> {
  const { data } = await apiClient.post<AdminTemplate>("/admin/templates", payload);
  return data;
}

export async function updateAdminTemplate(
  id: string,
  patch: Partial<TemplatePayload>
): Promise<AdminTemplate> {
  const { data } = await apiClient.patch<AdminTemplate>(`/admin/templates/${id}`, patch);
  return data;
}

export async function toggleAdminTemplate(id: string): Promise<AdminTemplate> {
  const { data } = await apiClient.patch<AdminTemplate>(`/admin/templates/${id}/toggle`);
  return data;
}

export async function duplicateAdminTemplate(id: string): Promise<AdminTemplate> {
  const { data } = await apiClient.post<AdminTemplate>(`/admin/templates/${id}/duplicate`);
  return data;
}

export async function deleteAdminTemplate(id: string): Promise<void> {
  await apiClient.delete(`/admin/templates/${id}`);
}

export async function bulkTemplateAction(
  action: "activate" | "deactivate" | "delete",
  ids: string[]
): Promise<BulkResult> {
  const { data } = await apiClient.post<BulkResult>("/admin/templates/bulk", { action, ids });
  return data;
}

// ---------------------------------------------------------------------------
// Logs & audit trail
// ---------------------------------------------------------------------------

export async function fetchGenerationLogs(
  params: LogListParams = {}
): Promise<Paginated<AdminGenerationLog> & { summary: GenerationLogSummary }> {
  const { data } = await apiClient.get<Paginated<AdminGenerationLog> & { summary: GenerationLogSummary }>(
    "/admin/generation-logs",
    { params }
  );
  return data;
}

export async function purgeGenerationLogs(olderThanDays: number): Promise<{ deleted: number }> {
  const { data } = await apiClient.post<{ deleted: number }>("/admin/generation-logs/purge", {
    olderThanDays,
  });
  return data;
}

export async function fetchAuditLogs(params: AuditListParams = {}): Promise<Paginated<AuditLogEntry>> {
  const { data } = await apiClient.get<Paginated<AuditLogEntry>>("/admin/audit-logs", { params });
  return data;
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

export async function fetchSystemInfo(): Promise<SystemInfo> {
  const { data } = await apiClient.get<SystemInfo>("/admin/system");
  return data;
}

export async function resetStuckPosters(
  olderThanMinutes = 15
): Promise<{ reset: number; minutes: number }> {
  const { data } = await apiClient.post<{ reset: number; minutes: number }>(
    "/admin/system/reset-stuck-posters",
    { olderThanMinutes }
  );
  return data;
}

export async function syncIndexes(): Promise<{ results: Record<string, unknown> }> {
  const { data } = await apiClient.post<{ results: Record<string, unknown> }>(
    "/admin/system/sync-indexes"
  );
  return data;
}

// ---------------------------------------------------------------------------
// Platform settings
// ---------------------------------------------------------------------------

export async function fetchAdminSettings(): Promise<{
  settings: AppSettings;
  defaults: AppSettings;
}> {
  const { data } = await apiClient.get<{ settings: AppSettings; defaults: AppSettings }>(
    "/admin/settings"
  );
  return data;
}

export async function updateAdminSettings(
  patch: Partial<AppSettings>
): Promise<{ settings: AppSettings; defaults: AppSettings }> {
  const { data } = await apiClient.patch<{ settings: AppSettings; defaults: AppSettings }>(
    "/admin/settings",
    patch
  );
  return data;
}

