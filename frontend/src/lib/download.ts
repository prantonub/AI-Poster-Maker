// The HTML `download` attribute on an <a> tag is silently ignored by most
// browsers for cross-origin URLs (like our Cloudinary-hosted posters) — it
// just navigates/opens the image instead of saving it. Fetching the bytes
// ourselves and downloading from a same-origin blob: URL works everywhere.
export async function forceDownload(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image for download (${response.status})`);
  }
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(blobUrl);
}
