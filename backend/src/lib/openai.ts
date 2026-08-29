import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const DEFAULT_TIMEOUT_MS = 180_000;
const MAX_REFERENCE_BYTES = 12 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export const CHROMA_GREEN = "#00FF00";

interface GenerateImageOptions {
  prompt: string;
  referenceImages?: string[];
  aspectRatio?: string;
}

interface GenerateImageResult {
  imageBase64: string;
  mimeType: string;
}

function endpoint(): string {
  const raw = process.env.AZURE_OPENAI_ENDPOINT?.trim().replace(/\/+$/, "");
  if (!raw) throw new Error("AZURE_OPENAI_ENDPOINT is required");
  const url = new URL(raw);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".openai.azure.com")) {
    throw new Error("AZURE_OPENAI_ENDPOINT must be an HTTPS Azure OpenAI resource");
  }
  return raw.endsWith("/openai/v1") ? raw : `${raw}/openai/v1`;
}

function apiKey(): string {
  const value = process.env.AZURE_OPENAI_API_KEY?.trim();
  if (!value) throw new Error("AZURE_OPENAI_API_KEY is required");
  return value;
}

function model(): string {
  return process.env.AZURE_MODEL_IMAGE?.trim() || "gpt-image-2";
}

function imageSize(aspectRatio?: string): string {
  return aspectRatio === "16:9" ? "1536x1024" : "1024x1024";
}

function isPrivateAddress(address: string): boolean {
  if (address === "::1" || address === "0.0.0.0") return true;
  if (address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
}

function allowedImageHosts(): Set<string> {
  return new Set(
    (process.env.ALLOWED_IMAGE_HOSTS || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function assertSafeRemoteUrl(url: URL): Promise<void> {
  if (url.protocol !== "https:") throw new Error("Reference image URL must use HTTPS");
  const allowed = allowedImageHosts();
  if (!allowed.has(url.hostname.toLowerCase())) throw new Error("Reference image host is not allowed");
  if (isIP(url.hostname) && isPrivateAddress(url.hostname)) throw new Error("Private reference image addresses are blocked");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Reference image resolved to a private address");
  }
}

async function remoteImage(urlValue: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const url = new URL(urlValue);
  await assertSafeRemoteUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "error" });
    if (!response.ok) throw new Error(`Reference image returned HTTP ${response.status}`);
    const mimeType = (response.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) throw new Error("Reference image type is not allowed");
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_REFERENCE_BYTES) throw new Error("Reference image is too large");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_REFERENCE_BYTES) throw new Error("Reference image is too large");
    return { bytes, mimeType };
  } finally {
    clearTimeout(timeout);
  }
}

function dataImage(value: string): { bytes: Uint8Array; mimeType: string } {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new Error("Reference image data URL is invalid");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_REFERENCE_BYTES) throw new Error("Reference image is too large");
  return { bytes, mimeType: match[1] };
}

async function referenceImage(value: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  return value.startsWith("data:") ? dataImage(value) : remoteImage(value);
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30_000);
  return Math.min(1000 * 2 ** attempt, 8_000) + Math.floor(Math.random() * 250);
}

async function post(url: string, initFactory: () => Promise<RequestInit>): Promise<Response> {
  for (let attempt = 0; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...(await initFactory()), signal: controller.signal });
      if (response.ok) return response;
      const detail = (await response.text()).slice(0, 500);
      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === 3) {
        throw new Error(`Azure OpenAI returned HTTP ${response.status}: ${detail}`);
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
    } catch (error) {
      if (attempt === 3 || !(error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError"))) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("Azure OpenAI request failed");
}

export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResult | null> {
  const references = options.referenceImages || [];
  const url = references.length
    ? `${endpoint()}/images/edits?api-version=preview`
    : `${endpoint()}/images/generations?api-version=preview`;

  const response = await post(url, async (): Promise<RequestInit> => {
    if (!references.length) {
      return {
        method: "POST",
        headers: { "api-key": apiKey(), "content-type": "application/json" },
        body: JSON.stringify({
          model: model(),
          prompt: options.prompt,
          n: 1,
          size: imageSize(options.aspectRatio),
          quality: process.env.AZURE_IMAGE_QUALITY || "medium",
          output_format: "png",
        }),
      };
    }

    const form = new FormData();
    form.set("model", model());
    form.set("prompt", options.prompt);
    form.set("n", "1");
    form.set("size", imageSize(options.aspectRatio));
    form.set("quality", process.env.AZURE_IMAGE_QUALITY || "medium");
    for (const [index, value] of references.entries()) {
      const image = await referenceImage(value);
      const bytes = image.bytes.buffer.slice(
        image.bytes.byteOffset,
        image.bytes.byteOffset + image.bytes.byteLength,
      ) as ArrayBuffer;
      form.append("image", new Blob([bytes], { type: image.mimeType }), `reference-${index}.png`);
    }
    return { method: "POST", headers: { "api-key": apiKey() }, body: form };
  });

  const payload = await response.json() as { data?: Array<{ b64_json?: string }> };
  const imageBase64 = payload.data?.[0]?.b64_json;
  return imageBase64 ? { imageBase64, mimeType: "image/png" } : null;
}

export function base64ToDataUrl(base64: string, mimeType = "image/png"): string {
  return `data:${mimeType};base64,${base64}`;
}

export function validateOpenAIConfiguration(): void {
  endpoint();
  apiKey();
  model();
}
