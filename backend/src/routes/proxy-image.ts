import { Request, Response } from "express";
import { imageObject, objectKeyFromSignedUrl } from "../lib/s3.js";

export async function proxyImage(req: Request, res: Response) {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl || imageUrl.length > 4_096) {
      return res.status(400).json({ error: "A valid image URL is required" });
    }
    const key = objectKeyFromSignedUrl(imageUrl);
    const image = await imageObject(key);
    res.setHeader("Content-Type", image.contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(Buffer.from(image.body));
  } catch (error) {
    console.error("Image proxy error:", error);
    return res.status(403).json({ error: "Image URL is not allowed" });
  }
}
