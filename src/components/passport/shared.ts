import type { DocumentLabel } from "@/domain/types";

export type IntakeDocument = {
  id: string;
  name: string;
  label: DocumentLabel;
  kind: "pdf" | "text";
  file?: File;
  text?: string;
  state: "ready" | "extracting" | "done" | "error";
  error?: string | undefined;
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const MAX_DOCUMENTS = 3;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function fileBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
