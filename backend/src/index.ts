import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { checkDatabase, initDb } from "./lib/db.js";
import { validateOpenAIConfiguration } from "./lib/openai.js";
import {
  createGenerationSession,
  quotaStatus,
  QuotaError,
  requireGenerationSession,
  validateQuotaConfiguration,
} from "./lib/rate-limit.js";
import { validateStorageConfiguration } from "./lib/s3.js";
import { editCharacter } from "./routes/edit-character.js";
import { editSpriteSheet } from "./routes/edit-sprite-sheet.js";
import { gallery } from "./routes/gallery.js";
import { generateCharacter } from "./routes/generate-character.js";
import { generateSpriteSheet } from "./routes/generate-sprite-sheet.js";
import { proxyImage } from "./routes/proxy-image.js";
import { saveSprite } from "./routes/save-sprite.js";
import { getSprite } from "./routes/sprite.js";

const app = express();
const port = Number.parseInt(process.env.PORT || "8104", 10);
const frontendUrl = process.env.FRONTEND_URL?.trim() || "http://localhost:3000";

app.set("trust proxy", "loopback");
app.disable("x-powered-by");
app.use(cors({
  origin: frontendUrl,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Generation-Token"],
  exposedHeaders: ["X-PixelForge-Project-Calls-Remaining"],
}));
app.use(express.json({ limit: "20mb", strict: true }));

app.get("/health", (_req, res) => res.json({ status: "ok", service: "pixelforge-api" }));
app.get("/ready", async (_req, res) => {
  try {
    await checkDatabase();
    validateOpenAIConfiguration();
    validateStorageConfiguration();
    validateQuotaConfiguration();
    res.json({ status: "ready", service: "pixelforge-api" });
  } catch {
    res.status(503).json({ status: "not_ready", service: "pixelforge-api" });
  }
});

app.get("/api/rate-limit", async (req, res, next) => {
  try {
    res.json(await quotaStatus(req));
  } catch (error) {
    next(error);
  }
});
app.post("/api/generation-sessions", async (req, res, next) => {
  try {
    const session = await createGenerationSession(req);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

app.post("/api/generate-character", requireGenerationSession, generateCharacter);
app.post("/api/generate-sprite-sheet", requireGenerationSession, generateSpriteSheet);
app.post("/api/edit-character", requireGenerationSession, editCharacter);
app.post("/api/edit-sprite-sheet", requireGenerationSession, editSpriteSheet);
app.post("/api/save-sprite", saveSprite);
app.get("/api/gallery", gallery);
app.get("/api/sprite/:id", getSprite);
app.get("/api/proxy-image", proxyImage);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof QuotaError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ error: "Request body is invalid" });
    return;
  }
  console.error("Unhandled error:", error);
  res.status(500).json({ error: "Internal server error" });
});

async function start(): Promise<void> {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("PORT is invalid");
  const parsedFrontend = new URL(frontendUrl);
  if (!['http:', 'https:'].includes(parsedFrontend.protocol)) throw new Error("FRONTEND_URL is invalid");
  validateOpenAIConfiguration();
  validateStorageConfiguration();
  validateQuotaConfiguration();
  await initDb();
  app.listen(port, "127.0.0.1", () => {
    console.log(`PixelForge API listening on 127.0.0.1:${port}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start().catch((error) => {
    console.error("PixelForge failed to start:", error);
    process.exitCode = 1;
  });
}

export default app;
