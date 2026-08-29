import assert from "node:assert/strict";
import test from "node:test";
import { objectKeyFromSignedUrl } from "./s3.js";

test("accepts only the configured bucket and PixelForge prefix", () => {
  process.env.S3_BUCKET = "sideprojects-test";
  process.env.AWS_REGION = "ap-south-1";
  assert.equal(
    objectKeyFromSignedUrl("https://sideprojects-test.s3.ap-south-1.amazonaws.com/pixelforge/assets/id/character.png?signature=x"),
    "pixelforge/assets/id/character.png",
  );
  assert.throws(
    () => objectKeyFromSignedUrl("https://example.com/pixelforge/assets/id/character.png"),
    /PixelForge bucket/,
  );
  assert.throws(
    () => objectKeyFromSignedUrl("https://sideprojects-test.s3.ap-south-1.amazonaws.com/backups/database.dump"),
    /Invalid PixelForge image key/,
  );
});
