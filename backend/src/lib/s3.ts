import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const PREFIX = "pixelforge/assets";
const SIGNED_URL_SECONDS = 60 * 60;
let client: S3Client | undefined;

function bucket(): string {
  const value = process.env.S3_BUCKET?.trim();
  if (!value) throw new Error("S3_BUCKET is required");
  return value;
}

function region(): string {
  return process.env.AWS_REGION?.trim() || "ap-south-1";
}

function s3(): S3Client {
  client ||= new S3Client({ region: region() });
  return client;
}

function imageBuffer(base64Data: string): Buffer {
  const raw = base64Data.includes(",") ? base64Data.slice(base64Data.indexOf(",") + 1) : base64Data;
  const value = Buffer.from(raw, "base64");
  if (!value.length || value.length > 12 * 1024 * 1024) throw new Error("Image payload is invalid or too large");
  return value;
}

export async function uploadImage(spriteId: string, filename: string, base64Data: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(spriteId) || !/^[a-z0-9-]+\.png$/i.test(filename)) {
    throw new Error("Invalid sprite object path");
  }
  const key = `${PREFIX}/${spriteId}/${filename}`;
  await s3().send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: imageBuffer(base64Data),
    ContentType: "image/png",
    CacheControl: "public, max-age=31536000, immutable",
    ServerSideEncryption: "AES256",
  }));
  return key;
}

export async function signedImageUrl(key: string): Promise<string> {
  assertImageKey(key);
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: SIGNED_URL_SECONDS,
  });
}

export async function imageObject(key: string): Promise<{ body: Uint8Array; contentType: string }> {
  assertImageKey(key);
  const result = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!result.Body) throw new Error("Image object had no body");
  const body = await result.Body.transformToByteArray();
  if (body.length > 12 * 1024 * 1024) throw new Error("Image object is too large");
  return { body, contentType: result.ContentType || "image/png" };
}

export function objectKeyFromSignedUrl(value: string): string {
  const url = new URL(value);
  const expectedHosts = new Set([
    `${bucket()}.s3.${region()}.amazonaws.com`,
    `${bucket()}.s3.amazonaws.com`,
  ]);
  if (url.protocol !== "https:" || !expectedHosts.has(url.hostname)) throw new Error("Image URL is not from the PixelForge bucket");
  const key = decodeURIComponent(url.pathname.replace(/^\//, ""));
  assertImageKey(key);
  return key;
}

export function assertImageKey(key: string): void {
  if (!key.startsWith(`${PREFIX}/`) || key.includes("..") || !/^[a-zA-Z0-9/_.-]+$/.test(key)) {
    throw new Error("Invalid PixelForge image key");
  }
}

export function validateStorageConfiguration(): void {
  bucket();
  region();
}
