import assert from "node:assert/strict";
import test from "node:test";
import { generateImage } from "./openai.js";

function imageResponse(): Response {
  return new Response(JSON.stringify({ data: [{ b64_json: "aW1hZ2U=" }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("text generation uses the Azure gpt-image-2 generation route", async () => {
  process.env.AZURE_OPENAI_ENDPOINT = "https://example.openai.azure.com";
  process.env.AZURE_OPENAI_API_KEY = "secret";
  process.env.AZURE_MODEL_IMAGE = "gpt-image-2";
  let requestUrl = "";
  let request: RequestInit | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    request = init;
    return imageResponse();
  };
  try {
    const result = await generateImage({ prompt: "pixel hero", aspectRatio: "1:1" });
    assert.equal(result?.imageBase64, "aW1hZ2U=");
    assert.equal(requestUrl, "https://example.openai.azure.com/openai/v1/images/generations?api-version=preview");
    assert.equal(new Headers(request?.headers).get("api-key"), "secret");
    const payload = JSON.parse(String(request?.body));
    assert.equal(payload.model, "gpt-image-2");
    assert.equal(payload.size, "1024x1024");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reference generation uses multipart image edits", async () => {
  process.env.AZURE_OPENAI_ENDPOINT = "https://example.openai.azure.com/openai/v1";
  process.env.AZURE_OPENAI_API_KEY = "secret";
  let requestUrl = "";
  let request: RequestInit | undefined;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    request = init;
    return imageResponse();
  };
  try {
    await generateImage({
      prompt: "edit hero",
      referenceImages: ["data:image/png;base64,aW1hZ2U="],
      aspectRatio: "16:9",
    });
    assert.equal(requestUrl, "https://example.openai.azure.com/openai/v1/images/edits?api-version=preview");
    assert.ok(request?.body instanceof FormData);
    const form = request.body as FormData;
    assert.equal(form.get("model"), "gpt-image-2");
    assert.equal(form.get("size"), "1536x1024");
    assert.ok(form.get("image") instanceof Blob);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
