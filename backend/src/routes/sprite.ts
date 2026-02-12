import { Request, Response } from "express";
import { getSpriteById } from "../lib/db.js";

export async function getSprite(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    if (!id) {
      return res.status(400).json({ error: "Sprite ID is required" });
    }

    const sprite = await getSpriteById(id);

    if (!sprite) {
      return res.status(404).json({ error: "Sprite not found" });
    }

    return res.json(sprite);
  } catch (error) {
    console.error("Failed to fetch sprite:", error);
    return res.status(500).json({ error: "Failed to fetch sprite" });
  }
}
