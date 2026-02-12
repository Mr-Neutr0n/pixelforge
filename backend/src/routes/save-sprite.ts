import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { uploadImage } from "../lib/gcs.js";
import { saveSpriteToDb } from "../lib/db.js";

export async function saveSprite(req: Request, res: Response) {
  try {
    const { prompt, characterImage, spriteSheets } = req.body;

    if (!prompt || !characterImage || !spriteSheets) {
      return res.status(400).json({ error: "prompt, characterImage, and spriteSheets are required" });
    }

    const types = ["walk", "jump", "attack", "idle"] as const;
    for (const type of types) {
      if (!spriteSheets[type]) {
        return res.status(400).json({ error: `Missing sprite sheet: ${type}` });
      }
    }

    const spriteId = uuidv4();

    // Upload all images in parallel
    const [characterUrl, ...sheetUrls] = await Promise.all([
      uploadImage(spriteId, "character.png", characterImage),
      ...types.map((type) => uploadImage(spriteId, `${type}.png`, spriteSheets[type])),
    ]);

    // Build sprite sheets JSON
    const spriteSheetsJson: Record<string, { url: string }> = {};
    types.forEach((type, i) => {
      spriteSheetsJson[type] = { url: sheetUrls[i] };
    });

    // Save to database
    await saveSpriteToDb(spriteId, prompt, characterUrl, spriteSheetsJson);

    return res.json({
      id: spriteId,
      shareUrl: `/sprite/${spriteId}`,
    });
  } catch (error) {
    console.error("Failed to save sprite:", error);
    return res.status(500).json({ error: "Failed to save sprite" });
  }
}
