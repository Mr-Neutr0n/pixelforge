import { Storage } from "@google-cloud/storage";

const BUCKET_NAME = process.env.GCS_BUCKET || "makeacard-storage";
const PREFIX = "pixelforge";
const URL_EXPIRY_MS = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years

let storage: Storage;

function getStorage(): Storage {
  if (storage) return storage;

  const credsJson = process.env.GCS_CREDENTIALS;
  if (credsJson) {
    const credentials = JSON.parse(credsJson);
    storage = new Storage({
      credentials,
      projectId: credentials.project_id,
    });
  } else {
    // Fall back to default credentials (local dev with gcloud auth)
    storage = new Storage();
  }
  return storage;
}

export async function uploadImage(
  spriteId: string,
  filename: string,
  base64Data: string
): Promise<string> {
  // Strip data URL prefix if present
  const raw = base64Data.includes(",")
    ? base64Data.split(",")[1]
    : base64Data;

  const buffer = Buffer.from(raw, "base64");
  const blobPath = `${PREFIX}/${spriteId}/${filename}`;
  const bucket = getStorage().bucket(BUCKET_NAME);
  const file = bucket.file(blobPath);

  await file.save(buffer, {
    contentType: "image/png",
    metadata: { cacheControl: "public, max-age=31536000" },
  });

  // Generate signed URL (2-year expiry)
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + URL_EXPIRY_MS,
  });

  return url;
}
