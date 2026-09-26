import { apiClient } from "./apiClient";

export interface AdminStats {
  userCount: number;
  templateCount: number;
  activeTemplateCount: number;
  postersByStatus: Record<string, number>;
  totalPosters: number;
  geminiCalls: number;
  geminiSuccessRate: number | null;
}

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: "user" | "admin";
  createdAt: string;
}

export interface AdminPoster {
  _id: string;
  userId: { _id: string; name: string; email: string } | string;
  templateId: { _id: string; title: string; occasionType: string } | string;
  status: string;
  generatedImageUrl?: string;
  createdAt: string;
}

export interface AdminTemplate {
  _id: string;
  title: string;
  occasionType: string;
  isActive: boolean;
  createdAt: string;
}

export interface AdminGenerationLog {
  _id: string;
  posterId: string;
  userId: string;
  tokensUsed?: number;
  latencyMs?: number;
  success: boolean;
  errorMessage?: string;
  createdAt: string;
}

interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const { data } = await apiClient.get<AdminStats>("/admin/stats");
  return data;
}

export async function fetchAdminUsers(page = 1): Promise<Paginated<AdminUser>> {
  const { data } = await apiClient.get<Paginated<AdminUser>>("/admin/users", { params: { page } });
  return data;
}

export async function fetchAdminPosters(page = 1, status?: string): Promise<Paginated<AdminPoster>> {
  const { data } = await apiClient.get<Paginated<AdminPoster>>("/admin/posters", {
    params: { page, status: status || undefined },
  });
  return data;
}

export async function fetchAdminTemplates(): Promise<AdminTemplate[]> {
  const { data } = await apiClient.get<AdminTemplate[]>("/admin/templates");
  return data;
}

export async function toggleAdminTemplate(id: string): Promise<AdminTemplate> {
  const { data } = await apiClient.patch<AdminTemplate>(`/admin/templates/${id}/toggle`);
  return data;
}

export async function fetchAdminGenerationLogs(page = 1): Promise<Paginated<AdminGenerationLog>> {
  const { data } = await apiClient.get<Paginated<AdminGenerationLog>>("/admin/generation-logs", {
    params: { page },
  });
  return data;
}
