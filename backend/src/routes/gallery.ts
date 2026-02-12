import { Request, Response } from "express";
import { getSprites } from "../lib/db.js";

export async function gallery(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    const result = await getSprites(page, limit);
    return res.json(result);
  } catch (error) {
    console.error("Failed to fetch gallery:", error);
    return res.status(500).json({ error: "Failed to fetch gallery" });
  }
}
