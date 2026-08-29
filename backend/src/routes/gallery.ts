import { Request, Response } from "express";
import { getSprites } from "../lib/db.js";
import { signedImageUrl } from "../lib/s3.js";

export async function gallery(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit as string) || 20));
    const result = await getSprites(page, limit);
    const sprites = await Promise.all(result.sprites.map(async (sprite) => ({
      id: sprite.id,
      prompt: sprite.prompt,
      characterImageUrl: await signedImageUrl(sprite.characterImageKey),
      createdAt: sprite.createdAt,
    })));
    return res.json({ ...result, sprites });
  } catch (error) {
    console.error("Failed to fetch gallery:", error);
    return res.status(500).json({ error: "Failed to fetch gallery" });
  }
}
