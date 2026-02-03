/**
 * Edit Character Route
 * Takes existing character + edit prompt and modifies it via Gemini
 */

import { Request, Response } from 'express';
import { generateImage, base64ToDataUrl, CHROMA_GREEN } from '../lib/gemini.js';
import { removeGreenBackground } from '../lib/background-remover.js';

const EDIT_PROMPT_TEMPLATE = `Edit this pixel art character based on the following instructions:

USER REQUEST: {editPrompt}

IMPORTANT RULES:
- Keep the same 32-bit pixel art style
- Maintain character proportions and general design
- Apply ONLY the requested changes
- Character should remain centered and full-body
- Keep the character suitable for sprite sheet animation

CRITICAL: Place the edited character on a SOLID CHROMA GREEN background (${CHROMA_GREEN}).
- The background must be PURE, FLAT green - RGB(0, 255, 0) exactly
- NO shadows, gradients, or any variation in the green
- Character should NOT use green as a color`;

export async function editCharacter(req: Request, res: Response) {
  try {
    const { imageUrl, editPrompt } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: "Image URL is required" });
    }

    if (!editPrompt) {
      return res.status(400).json({ error: "Edit prompt is required" });
    }

    const fullPrompt = EDIT_PROMPT_TEMPLATE.replace("{editPrompt}", editPrompt);

    const result = await generateImage({
      prompt: fullPrompt,
      referenceImages: [imageUrl],
      aspectRatio: "1:1"
    });

    if (!result) {
      return res.status(500).json({ error: "Failed to edit character" });
    }

    const transparentBase64 = await removeGreenBackground(result.imageBase64);

    return res.json({
      imageUrl: base64ToDataUrl(transparentBase64),
      rawImageUrl: base64ToDataUrl(result.imageBase64),
      width: 1024,
      height: 1024,
    });
  } catch (error) {
    console.error("Error editing character:", error);
    return res.status(500).json({ error: "Failed to edit character" });
  }
}
