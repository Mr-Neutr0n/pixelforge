import { Request, Response } from "express";
import { validate as isUuid } from "uuid";
import { getSpriteById } from "../lib/db.js";
import { signedImageUrl } from "../lib/s3.js";

export async function getSprite(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    if (!id || !isUuid(id)) return res.status(400).json({ error: "Sprite ID is invalid" });
    const sprite = await getSpriteById(id);
    if (!sprite) return res.status(404).json({ error: "Sprite not found" });

    const spriteSheets: Record<string, { url: string }> = {};
    await Promise.all(Object.entries(sprite.spriteSheets).map(async ([type, value]) => {
      spriteSheets[type] = { url: await signedImageUrl(value.key) };
    }));
    return res.json({
      id: sprite.id,
      prompt: sprite.prompt,
      characterImageUrl: await signedImageUrl(sprite.characterImageKey),
      spriteSheets,
      createdAt: sprite.createdAt,
    });
  } catch (error) {
    console.error("Failed to fetch sprite:", error);
    return res.status(500).json({ error: "Failed to fetch sprite" });
  }
}
