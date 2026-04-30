import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import net from "node:net";

import { saveUploadedFile } from "../lib/storage.js";
import type { UploadRecord } from "../types/domain.js";

const execFile = promisify(execFileCallback);

type RemoteAssetKind = "image" | "video" | "audio";

export interface RemoteAssetInput {
  kind?: string | null;
  url?: string | null;
  candidateUrls?: string[] | null;
  sourcePageUrl?: string | null;
  pageUrl?: string | null;
  pageTitle?: string | null;
  label?: string | null;
  mimeHint?: string | null;
  platform?: string | null;
  platformAssetId?: string | null;
  platformAuthorHandle?: string | null;
  needsResolver?: boolean | null;
}

class RemoteAssetError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

const maxRemoteAssetBytes = Number(process.env.REMOTE_ASSET_MAX_BYTES || 512 * 1024 * 1024);
const remoteAssetTimeoutMs = Number(process.env.REMOTE_ASSET_TIMEOUT_MS || 120000);
const resolverBinary = process.env.REMOTE_ASSET_RESOLVER_BIN || process.env.YTDLP_BIN || "yt-dlp";
const userAgent =
  process.env.REMOTE_ASSET_USER_AGENT ||
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function normalizeKind(value: unknown): RemoteAssetKind {
  return value === "video" || value === "audio" ? value : "image";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim())));
}

function decodeEscapedText(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\//g, "/");
}

function parseLongId(value: unknown): string {
  return String(value || "").match(/\b(\d{16,22})\b/)?.[1] || "";
}

function normalizeTikTokHandle(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/^@/, "")
    .match(/^[A-Za-z0-9._-]{2,32}$/)?.[0] || "";
}

function parseTikTokHandleFromUrl(value: unknown): string {
  try {
    const url = new URL(String(value || ""));
    return normalizeTikTokHandle(url.pathname.match(/^\/@([^/?#]+)/)?.[1]);
  } catch {
    return normalizeTikTokHandle(String(value || "").match(/\/@([^/?#]+)/)?.[1]);
  }
}

function buildTikTokWatchUrl(id: string, handle: string): string {
  return `https://www.tiktok.com/@${handle}/video/${id}`;
}

function isPrivateIpAddress(ip: string): boolean {
  if (net.isIP(ip) === 4) {
    const [a = 0, b = 0] = ip.split(".").map((part) => Number(part));
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a === 169 && b === 254 ||
      a === 172 && b >= 16 && b <= 31 ||
      a === 192 && b === 168 ||
      a === 100 && b >= 64 && b <= 127 ||
      a >= 224
    );
  }

  if (net.isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80") || lower === "::";
  }

  return false;
}

async function assertPublicHttpUrl(rawUrl: string, baseUrl?: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl, baseUrl);
  } catch {
    throw new RemoteAssetError("Remote asset URL is invalid");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new RemoteAssetError("Remote asset URL must use http or https");
  }

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal") {
    throw new RemoteAssetError("Remote asset URL points to a blocked host");
  }

  if (net.isIP(host)) {
    if (isPrivateIpAddress(host)) {
      throw new RemoteAssetError("Remote asset URL points to a private address");
    }
    return url.href;
  }

  try {
    const addresses = await lookup(host, { all: true });
    if (addresses.some((entry) => isPrivateIpAddress(entry.address))) {
      throw new RemoteAssetError("Remote asset URL resolved to a private address");
    }
  } catch (error) {
    if (error instanceof RemoteAssetError) {
      throw error;
    }
  }

  return url.href;
}

function looksLikeStreamFragmentUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return /(\.m3u8|\.m4s|\.ts)(\?|#|$)|mpegurl|\/hls\/|\/dash\/|segment|fragment|init\.mp4|range=|bytestart=|byteend=/.test(lower);
}

function looksLikeVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (!/^https?:/.test(lower) || looksLikeStreamFragmentUrl(lower) || /\.(js|css|json|html?|svg|png|jpe?g|webp|avif|gif)(\?|#|$)/.test(lower)) {
    return false;
  }

  return /\.(m4v|mov|mp4|webm)(\?|#|$)|\/video\/|\/video\/tos\/|video_|video_mp4|mime_type=video|playaddr|downloadaddr|bytevid|videoplayback/.test(lower);
}

function isTikTokWatchPageUrl(value: string, targetId = ""): boolean {
  try {
    const url = new URL(value);
    if (!/(^|\.)tiktok\.com$/i.test(url.hostname)) {
      return false;
    }

    const id = url.pathname.match(/\/video\/(\d{16,22})/)?.[1] || url.searchParams.get("item_id") || parseLongId(url.href);
    return Boolean(id && (!targetId || id === targetId));
  } catch {
    return false;
  }
}

function isTikTokUrl(value: string): boolean {
  try {
    return /(^|\.)tiktok\.com$/i.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

function collectTikTokVideoUrls(value: unknown, urls: string[] = [], depth = 0, keyHint = ""): string[] {
  if (depth > 10 || value == null) {
    return urls;
  }

  if (typeof value === "string") {
    const decoded = decodeEscapedText(value);
    if ((keyHint || /video|play|download|url/i.test(decoded)) && /https?:\/\//.test(decoded)) {
      for (const match of decoded.matchAll(/https?:\/\/[^"'<>{}\s\\]+/g)) {
        try {
          const url = new URL(decodeEscapedText(match[0]), "https://www.tiktok.com/").href;
          if (looksLikeVideoUrl(url)) {
            urls.push(url);
          }
        } catch {
          // Ignore malformed embedded media URLs.
        }
      }
    }
    return urls;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectTikTokVideoUrls(entry, urls, depth + 1, keyHint));
    return urls;
  }

  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      const mediaKey = /playAddr|downloadAddr|playApi|urlList|UrlList|bitrateInfo|PlayAddr|download|mainUrl|backupUrl|url/i.test(key);
      collectTikTokVideoUrls(entry, urls, depth + 1, mediaKey ? key : keyHint);
    }
  }

  return urls;
}

interface TikTokEntry {
  id: string;
  urls: string[];
  authorHandle?: string;
}

function mergeTikTokEntries(entries: TikTokEntry[]): TikTokEntry[] {
  const byId = new Map<string, TikTokEntry>();
  for (const entry of entries) {
    if (!entry.id || !entry.urls.length) {
      continue;
    }

    const existing = byId.get(entry.id) || { id: entry.id, urls: [] };
    existing.urls = Array.from(new Set([...existing.urls, ...entry.urls]));
    existing.authorHandle = existing.authorHandle || entry.authorHandle;
    byId.set(entry.id, existing);
  }

  return Array.from(byId.values());
}

function extractTikTokEntriesFromJson(data: unknown): TikTokEntry[] {
  const entries: TikTokEntry[] = [];

  const addEntry = (item: Record<string, unknown>, videoData: Record<string, unknown>) => {
    const id = parseLongId(item.id) || parseLongId(item.itemId) || parseLongId(item.awemeId) || parseLongId(videoData.id);
    const urls = Array.from(new Set(collectTikTokVideoUrls(videoData)));
    if (id && urls.length) {
      const author = item.author && typeof item.author === "object" ? item.author as Record<string, unknown> : {};
      const authorInfo = item.authorInfo && typeof item.authorInfo === "object" ? item.authorInfo as Record<string, unknown> : {};
      entries.push({
        id,
        urls,
        authorHandle: normalizeTikTokHandle(author.uniqueId) || normalizeTikTokHandle(authorInfo.uniqueId) || normalizeTikTokHandle(author.unique_id),
      });
    }
  };

  const walk = (value: unknown, depth = 0) => {
    if (!value || depth > 12) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => walk(entry, depth + 1));
      return;
    }

    if (typeof value === "object") {
      const objectValue = value as Record<string, unknown>;
      if (objectValue.video && typeof objectValue.video === "object") {
        addEntry(objectValue, objectValue.video as Record<string, unknown>);
      }

      const itemStruct = objectValue.itemStruct;
      if (itemStruct && typeof itemStruct === "object" && "video" in itemStruct && typeof itemStruct.video === "object") {
        addEntry(itemStruct as Record<string, unknown>, itemStruct.video as Record<string, unknown>);
      }

      for (const entry of Object.values(objectValue)) {
        walk(entry, depth + 1);
      }
    }
  };

  walk(data);
  return mergeTikTokEntries(entries);
}

function extractTikTokEntriesFromHtml(html: string): TikTokEntry[] {
  const entries: TikTokEntry[] = [];
  const scriptMatcher = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptMatcher)) {
    const text = decodeEscapedText(match[1] || "").trim();
    if (!text || !/playAddr|downloadAddr|bitrateInfo|PlayAddrStruct|UrlList|mime_type=video|video_mp4/i.test(text)) {
      continue;
    }

    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        entries.push(...extractTikTokEntriesFromJson(JSON.parse(text)));
      } catch {
        // Non-JSON TikTok scripts are intentionally skipped here.
      }
    }
  }

  return mergeTikTokEntries(entries);
}

function blobSignature(buffer: Buffer) {
  const text = buffer.subarray(0, 128).toString("latin1");
  return {
    hasFtyp: text.includes("ftyp"),
    hasFragmentBox: text.includes("moof") || text.includes("styp"),
    isWebm: buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3,
    isOgg: text.startsWith("OggS"),
    isMpegTsSegment: buffer[0] === 0x47 && buffer[188] === 0x47,
    isJpeg: buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    isPng: buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47,
    isGif: text.startsWith("GIF87a") || text.startsWith("GIF89a"),
    isRiff: text.startsWith("RIFF"),
    isMp3: text.startsWith("ID3") || buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0,
    textPrefix: text.slice(0, 24).trim(),
  };
}

function isValidDownloadedAsset(kind: RemoteAssetKind, buffer: Buffer, contentType: string): boolean {
  const mime = contentType.toLowerCase();
  const signature = blobSignature(buffer);

  if (
    mime.includes("application/json") ||
    mime.includes("text/html") ||
    mime.includes("javascript") ||
    mime.includes("text/css") ||
    signature.textPrefix.startsWith("<") ||
    signature.textPrefix.startsWith("{") ||
    signature.textPrefix.startsWith("#EXTM3U")
  ) {
    return false;
  }

  if (kind === "image") {
    return mime.startsWith("image/") && !mime.includes("svg") || signature.isJpeg || signature.isPng || signature.isGif || signature.isRiff;
  }

  if (kind === "audio") {
    return mime.startsWith("audio/") || signature.isMp3 || signature.isOgg || signature.isRiff || signature.hasFtyp;
  }

  if (signature.hasFragmentBox && !signature.hasFtyp || signature.isMpegTsSegment || mime.includes("mpegurl")) {
    return false;
  }

  return mime.startsWith("video/") && (signature.hasFtyp || signature.isWebm || signature.isOgg) || signature.hasFtyp || signature.isWebm || signature.isOgg;
}

async function readResponseBuffer(response: Response): Promise<Buffer> {
  const contentLength = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > maxRemoteAssetBytes) {
    throw new RemoteAssetError("Remote asset is too large to capture", 413);
  }

  if (!response.body) {
    return Buffer.from(await response.arrayBuffer());
  }

  const chunks: Buffer[] = [];
  let total = 0;
  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const chunk = Buffer.from(value);
    total += chunk.length;
    if (total > maxRemoteAssetBytes) {
      throw new RemoteAssetError("Remote asset is too large to capture", 413);
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function safeFetch(rawUrl: string, init: RequestInit = {}, redirects = 5): Promise<Response> {
  let currentUrl = await assertPublicHttpUrl(rawUrl);
  for (let attempt = 0; attempt <= redirects; attempt += 1) {
    const response = await fetch(currentUrl, {
      ...init,
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return response;
      }
      currentUrl = await assertPublicHttpUrl(location, currentUrl);
      continue;
    }

    return response;
  }

  throw new RemoteAssetError("Remote asset redirected too many times");
}

function extensionForContentType(contentType: string, fallback = ".bin"): string {
  const mime = contentType.split(";")[0]?.trim().toLowerCase() || "";
  const extensions: Record<string, string> = {
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
    "audio/ogg": ".ogg",
    "audio/webm": ".webm",
  };
  return extensions[mime] || fallback;
}

function filenameFromRemoteAsset(asset: RemoteAssetInput, sourceUrl: string, contentType: string): string {
  const label = asString(asset.label) || asString(asset.pageTitle) || asset.kind || "remote-asset";
  const cleanLabel = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const urlExtension = (() => {
    try {
      return path.extname(new URL(sourceUrl).pathname);
    } catch {
      return "";
    }
  })();
  const extension = urlExtension && urlExtension.length <= 8 ? urlExtension : extensionForContentType(contentType);
  return `${cleanLabel || "remote-asset"}${extension}`;
}

async function downloadViaFetch(asset: RemoteAssetInput, sourceUrl: string): Promise<UploadRecord> {
  const kind = normalizeKind(asset.kind);
  const referer = asString(asset.sourcePageUrl) || asString(asset.pageUrl) || undefined;
  const response = await safeFetch(sourceUrl, {
    headers: {
      accept: kind === "video" ? "video/*,*/*;q=0.8" : kind === "audio" ? "audio/*,*/*;q=0.8" : "image/*,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": userAgent,
      ...(referer ? { referer } : {}),
    },
    signal: AbortSignal.timeout(remoteAssetTimeoutMs),
  });

  if (!response.ok) {
    throw new RemoteAssetError(`Remote asset download failed with ${response.status}`, response.status);
  }

  const buffer = await readResponseBuffer(response);
  const contentType = response.headers.get("content-type") || asString(asset.mimeHint) || "";
  if (!buffer.length || !isValidDownloadedAsset(kind, buffer, contentType)) {
    throw new RemoteAssetError("Remote URL did not return a playable asset file");
  }

  return saveUploadedFile(filenameFromRemoteAsset(asset, response.url || sourceUrl, contentType), buffer);
}

async function resolveTikTokCandidates(asset: RemoteAssetInput, targetId: string): Promise<string[]> {
  const pageUrls = uniqueStrings([asset.sourcePageUrl, asset.url, asset.pageUrl]).filter((url) => isTikTokWatchPageUrl(url, targetId));
  const resolvedUrls: string[] = [];

  for (const pageUrl of pageUrls) {
    try {
      const response = await safeFetch(pageUrl, {
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          "user-agent": userAgent,
        },
        signal: AbortSignal.timeout(remoteAssetTimeoutMs),
      });

      if (!response.ok) {
        continue;
      }

      const html = await response.text();
      const entries = extractTikTokEntriesFromHtml(html);
      const exactEntry = entries.find((entry) => entry.id === targetId);
      resolvedUrls.push(...(exactEntry?.urls || []));
    } catch {
      // Try any remaining page URLs and then fall back to the external resolver.
    }
  }

  return Array.from(new Set(resolvedUrls.filter(looksLikeVideoUrl)));
}

async function downloadWithExternalResolver(asset: RemoteAssetInput, pageUrl: string): Promise<UploadRecord> {
  await assertPublicHttpUrl(pageUrl);

  const kind = normalizeKind(asset.kind);
  const prefix = `autoscale-remote-${randomUUID()}`;
  const outputTemplate = path.join(tmpdir(), `${prefix}.%(ext)s`);
  const args = [
    "--no-playlist",
    "--no-warnings",
    "--quiet",
    "--restrict-filenames",
    "--no-mtime",
    "--max-filesize",
    String(maxRemoteAssetBytes),
    "--user-agent",
    userAgent,
    "-o",
    outputTemplate,
  ];

  if (kind === "video") {
    args.push("-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best", "--merge-output-format", "mp4");
  } else if (kind === "audio") {
    args.push("-x", "--audio-format", "mp3");
  }

  args.push(pageUrl);

  try {
    await execFile(resolverBinary, args, {
      timeout: remoteAssetTimeoutMs,
      maxBuffer: 1024 * 1024,
    });

    const files = await fs.readdir(tmpdir());
    const matches = await Promise.all(
      files
        .filter((file) => file.startsWith(prefix))
        .map(async (file) => {
          const absolutePath = path.join(tmpdir(), file);
          const stat = await fs.stat(absolutePath);
          return { absolutePath, file, size: stat.size };
        }),
    );
    const output = matches.sort((left, right) => right.size - left.size)[0];
    if (!output) {
      throw new Error("External resolver did not produce a file");
    }

    const buffer = await fs.readFile(output.absolutePath);
    if (!isValidDownloadedAsset(kind, buffer, "")) {
      throw new Error("External resolver output was not a valid media file");
    }

    const saved = await saveUploadedFile(output.file, buffer);
    await Promise.allSettled(matches.map((match) => fs.rm(match.absolutePath, { force: true })));
    return saved;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new RemoteAssetError(`Server resolver "${resolverBinary}" is not installed`, 501);
    }
    const resolverMessage = [String((error as { stderr?: unknown }).stderr || ""), error instanceof Error ? error.message : ""]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 260);
    throw new RemoteAssetError(resolverMessage ? `Server resolver could not download this asset: ${resolverMessage}` : "Server resolver could not download this asset", 422);
  }
}

function normalizeAssetInput(input: RemoteAssetInput | null | undefined): RemoteAssetInput {
  if (!input || typeof input !== "object") {
    throw new RemoteAssetError("Missing remote asset payload");
  }

  return {
    ...input,
    kind: normalizeKind(input.kind),
    url: asString(input.url),
    sourcePageUrl: asString(input.sourcePageUrl),
    pageUrl: asString(input.pageUrl),
    pageTitle: asString(input.pageTitle),
    label: asString(input.label),
    mimeHint: asString(input.mimeHint),
    platform: asString(input.platform),
    platformAssetId: asString(input.platformAssetId),
    platformAuthorHandle: normalizeTikTokHandle(input.platformAuthorHandle),
    candidateUrls: Array.isArray(input.candidateUrls) ? uniqueStrings(input.candidateUrls) : [],
    needsResolver: Boolean(input.needsResolver),
  };
}

export async function saveRemoteAsset(input: RemoteAssetInput | null | undefined): Promise<UploadRecord> {
  const asset = normalizeAssetInput(input);
  const kind = normalizeKind(asset.kind);
  const targetId = parseLongId(asset.platformAssetId) || parseLongId(asset.sourcePageUrl) || parseLongId(asset.pageUrl) || parseLongId(asset.url);
  const rawCandidates = uniqueStrings([asset.url, ...(asset.candidateUrls || [])]);
  const directCandidates = rawCandidates.filter((url) => !isTikTokWatchPageUrl(url, targetId));
  const authorHandle =
    normalizeTikTokHandle(asset.platformAuthorHandle) ||
    parseTikTokHandleFromUrl(asset.sourcePageUrl) ||
    parseTikTokHandleFromUrl(asset.url) ||
    parseTikTokHandleFromUrl(asset.pageUrl);
  const synthesizedTikTokPageUrl = kind === "video" && targetId && authorHandle ? buildTikTokWatchUrl(targetId, authorHandle) : "";
  const pageCandidates = uniqueStrings([synthesizedTikTokPageUrl, asset.sourcePageUrl, asset.pageUrl, asset.url]).filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  });

  if (kind === "video" && targetId) {
    const tikTokCandidates = await resolveTikTokCandidates(asset, targetId);
    directCandidates.unshift(...tikTokCandidates);
  }

  let lastError: unknown = null;
  for (const candidate of Array.from(new Set(directCandidates))) {
    try {
      return await downloadViaFetch(asset, candidate);
    } catch (error) {
      lastError = error;
    }
  }

  if (kind === "video" || kind === "audio" || asset.needsResolver) {
    const resolverCandidates = pageCandidates.filter((url) => {
      if (targetId && isTikTokUrl(url)) {
        return isTikTokWatchPageUrl(url, targetId);
      }
      return true;
    });

    for (const pageUrl of resolverCandidates) {
      try {
        return await downloadWithExternalResolver(asset, pageUrl);
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (lastError instanceof RemoteAssetError) {
    throw lastError;
  }

  if (kind === "video" && targetId && !authorHandle) {
    throw new RemoteAssetError("Server found the TikTok video id but not the author handle needed to resolve it. Scroll back slightly, let the creator link render, then try again.");
  }

  throw new RemoteAssetError("Server could not resolve a downloadable asset from the selected page");
}

export function remoteAssetStatus(error: unknown): number {
  return error instanceof RemoteAssetError ? error.status : 500;
}
