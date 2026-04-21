export interface UploadRecord {
  fileName: string;
  filePath: string;
  url: string;
}

export async function uploadReferenceFile(file: File): Promise<UploadRecord> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/uploads", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to upload file");
  }

  return response.json() as Promise<UploadRecord>;
}