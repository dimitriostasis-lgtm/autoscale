import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { env } from "../config/env.js";
import type { UploadRecord } from "../types/domain.js";

const uploadsDir = path.join(env.storageRoot, "uploads");
const generatedDir = path.join(env.storageRoot, "generated");

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export async function ensureStorageDirectories(): Promise<void> {
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.mkdir(generatedDir, { recursive: true });
}

export function getStorageRoot(): string {
  return env.storageRoot;
}

export function toPublicFileUrl(relativePath: string): string {
  return `/files/${relativePath.replace(/\\/g, "/")}`;
}

export function toAbsoluteStoragePath(relativePath: string): string {
  return path.join(env.storageRoot, relativePath);
}

export async function saveUploadedFile(originalName: string, buffer: Buffer): Promise<UploadRecord> {
  await ensureStorageDirectories();
  const extension = path.extname(originalName) || ".bin";
  const safeBase = sanitizeName(path.basename(originalName, extension)) || "reference";
  const fileName = `${safeBase}-${randomUUID()}${extension}`;
  const relativePath = path.join("uploads", fileName);
  const absolutePath = toAbsoluteStoragePath(relativePath);

  await fs.writeFile(absolutePath, buffer);

  return {
    fileName,
    filePath: relativePath,
    url: toPublicFileUrl(relativePath),
  };
}

export async function saveGeneratedFile(fileName: string, buffer: Buffer): Promise<UploadRecord> {
  await ensureStorageDirectories();
  const extension = path.extname(fileName) || ".webp";
  const safeBase = sanitizeName(path.basename(fileName, extension)) || "generated";
  const finalName = `${safeBase}-${randomUUID()}${extension}`;
  const relativePath = path.join("generated", finalName);
  const absolutePath = toAbsoluteStoragePath(relativePath);

  await fs.writeFile(absolutePath, buffer);

  return {
    fileName: finalName,
    filePath: relativePath,
    url: toPublicFileUrl(relativePath),
  };
}