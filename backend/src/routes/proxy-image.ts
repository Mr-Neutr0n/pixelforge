import { Request, Response } from "express";

export async function proxyImage(req: Request, res: Response) {
  try {
    const imageUrl = req.query.url as string;

    if (!imageUrl) {
      return res.status(400).json({ error: "url query parameter is required" });
    }

    // Only allow proxying from our GCS bucket
    if (!imageUrl.includes("storage.googleapis.com")) {
      return res.status(403).json({ error: "Only GCS URLs are allowed" });
    }

    const response = await fetch(imageUrl);

    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to fetch image" });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/png";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(buffer);
  } catch (error) {
    console.error("Image proxy error:", error);
    return res.status(500).json({ error: "Failed to proxy image" });
  }
}
