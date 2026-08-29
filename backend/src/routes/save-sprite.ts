import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { saveSpriteToDb } from "../lib/db.js";
import { uploadImage } from "../lib/s3.js";

export async function saveSprite(req: Request, res: Response) {
  try {
    const { prompt, characterImage, spriteSheets } = req.body;
    if (typeof prompt !== "string" || !prompt.trim() || typeof characterImage !== "string" || !spriteSheets) {
      return res.status(400).json({ error: "prompt, characterImage, and spriteSheets are required" });
    }

    const types = ["walk", "jump", "attack", "idle"] as const;
    for (const type of types) {
      if (typeof spriteSheets[type] !== "string") {
        return res.status(400).json({ error: `Missing sprite sheet: ${type}` });
      }
    }

    const spriteId = uuidv4();
    const [characterKey, ...sheetKeys] = await Promise.all([
      uploadImage(spriteId, "character.png", characterImage),
      ...types.map((type) => uploadImage(spriteId, `${type}.png`, spriteSheets[type])),
    ]);
    const storedSheets: Record<string, { key: string }> = {};
    types.forEach((type, index) => {
      storedSheets[type] = { key: sheetKeys[index] };
    });
    await saveSpriteToDb(spriteId, prompt.trim(), characterKey, storedSheets);
    return res.json({ id: spriteId, shareUrl: `/sprite/${spriteId}` });
  } catch (error) {
    console.error("Failed to save sprite:", error);
    return res.status(500).json({ error: "Failed to save sprite" });
  }
}
