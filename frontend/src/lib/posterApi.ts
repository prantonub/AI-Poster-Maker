import { apiClient } from "./apiClient";
import {
  TemplateDTO,
  PosterDTO,
  PosterFormData,
  PaginatedPosters,
  OccasionType,
} from "./posterTypes";

export async function fetchTemplates(occasion?: OccasionType): Promise<TemplateDTO[]> {
  const { data } = await apiClient.get<TemplateDTO[]>("/templates", {
    params: occasion ? { occasion } : undefined,
  });
  return data;
}

export async function fetchTemplate(id: string): Promise<TemplateDTO> {
  const { data } = await apiClient.get<TemplateDTO>(`/templates/${id}`);
  return data;
}

export async function uploadPhotos(files: File[]): Promise<string[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("photos", file));

  // Let the browser set the multipart boundary itself — override the
  // client's default JSON content-type for this one request.
  const { data } = await apiClient.post<{ urls: string[] }>(
    "/upload",
    formData,
    { headers: { "Content-Type": undefined } }
  );
  return data.urls;
}

export async function createPoster(
  templateId: string,
  formData: PosterFormData,
  uploadedPhotoUrls: string[]
): Promise<{ _id: string; status: string }> {
  const { data } = await apiClient.post("/posters", {
    templateId,
    formData,
    uploadedPhotoUrls,
  });
  return data;
}

export async function fetchPoster(id: string): Promise<PosterDTO> {
  const { data } = await apiClient.get<PosterDTO>(`/posters/${id}`);
  return data;
}

export async function regeneratePoster(id: string): Promise<{ _id: string; status: string; retryCount: number }> {
  const { data } = await apiClient.post(`/posters/${id}/regenerate`);
  return data;
}

export async function fetchPosterHistory(userId: string, page = 1): Promise<PaginatedPosters> {
  const { data } = await apiClient.get<PaginatedPosters>(`/posters/user/${userId}`, {
    params: { page },
  });
  return data;
}

export async function deletePoster(id: string): Promise<void> {
  await apiClient.delete(`/posters/${id}`);
}

export async function generateQuickPreview(formData: {
  name: string;
  designation: string;
  party: string;
  district: string;
  thana: string;
  union: string;
  headlineText: string;
}): Promise<{ templateId: string; title: string; occasionType: string; imageUrl: string }[]> {
  const { data } = await apiClient.post<{ results: { templateId: string; title: string; occasionType: string; imageUrl: string }[] }>(
    "/posters/quick-preview",
    formData
  );
  return data.results;
}
