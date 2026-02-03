/**
 * Edit Sprite Sheet Route
 * Takes existing sprite sheet + edit prompt and modifies it via Gemini
 */

import { Request, Response } from 'express';
import { generateImage, base64ToDataUrl, CHROMA_GREEN } from '../lib/gemini.js';
import { removeGreenBackground } from '../lib/background-remover.js';

type SpriteType = "walk" | "jump" | "attack" | "idle";

const SPRITE_DESCRIPTIONS: Record<SpriteType, string> = {
  walk: "a 4-frame walk cycle animation arranged in a 2x2 grid (character walking to the right)",
  jump: "a 4-frame jump animation arranged in a 2x2 grid (crouch, rise, apex, land)",
  attack: "a 4-frame attack animation arranged in a 2x2 grid (wind-up, strike, impact, recovery)",
  idle: "a 4-frame idle/breathing animation arranged in a 2x2 grid (subtle breathing movement)",
};

const EDIT_PROMPT_TEMPLATE = `This is a pixel art sprite sheet containing {spriteDescription}.

Edit this sprite sheet based on the following instructions:

USER REQUEST: {editPrompt}

IMPORTANT RULES:
- Keep the same 32-bit pixel art style throughout all 4 frames
- Maintain the 2x2 grid layout with all 4 animation frames
- Apply the requested changes CONSISTENTLY across all frames
- Preserve the animation flow and timing
- Keep the same character design across all frames

CRITICAL: Place all frames on a SOLID CHROMA GREEN background (${CHROMA_GREEN}).
- Pure RGB(0, 255, 0) everywhere
- NO shadows, gradients, or variation`;

export async function editSpriteSheet(req: Request, res: Response) {
  try {
    const { imageUrl, editPrompt, type = "walk" } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: "Image URL is required" });
    }

    if (!editPrompt) {
      return res.status(400).json({ error: "Edit prompt is required" });
    }

    const spriteType = (type as SpriteType) || "walk";
    const spriteDescription = SPRITE_DESCRIPTIONS[spriteType] || SPRITE_DESCRIPTIONS.walk;

    const fullPrompt = EDIT_PROMPT_TEMPLATE
      .replace("{spriteDescription}", spriteDescription)
      .replace("{editPrompt}", editPrompt);

    const result = await generateImage({
      prompt: fullPrompt,
      referenceImages: [imageUrl],
      aspectRatio: spriteType === "attack" ? "16:9" : "1:1"
    });

    if (!result) {
      return res.status(500).json({ error: "Failed to edit sprite sheet" });
    }

    const transparentBase64 = await removeGreenBackground(result.imageBase64);

    return res.json({
      imageUrl: base64ToDataUrl(transparentBase64),
      rawImageUrl: base64ToDataUrl(result.imageBase64),
      width: 1024,
      height: spriteType === "attack" ? 576 : 1024,
      type: spriteType,
    });
  } catch (error) {
    console.error("Error editing sprite sheet:", error);
    return res.status(500).json({ error: "Failed to edit sprite sheet" });
  }
}
