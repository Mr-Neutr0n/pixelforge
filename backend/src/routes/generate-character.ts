/**
 * Generate Character Route
 * Uses Gemini 3 Pro Image with green screen + our background remover
 */

import { Request, Response } from 'express';
import { generateImage, base64ToDataUrl, CHROMA_GREEN } from '../lib/gemini.js';
import { removeGreenBackground } from '../lib/background-remover.js';

const CHARACTER_STYLE_PROMPT = `Generate a single character only, centered in the frame.
The character should be rendered in detailed 32-bit pixel art style (like PlayStation 1 / SNES era games).
Include proper shading, highlights, and anti-aliased edges for a polished look.
The character should have well-defined features, expressive details, and rich colors.
Show in a front-facing or 3/4 view pose, standing idle, suitable for sprite sheet animation.

CRITICAL: Place the character on a SOLID CHROMA GREEN background (${CHROMA_GREEN}).
- The background must be PURE, FLAT green - RGB(0, 255, 0) exactly
- NO shadows, gradients, or any variation in the green
- Character should NOT use green as a color (to avoid removal issues)`;

const IMAGE_TO_PIXEL_PROMPT = `Transform this character into detailed 32-bit pixel art style (like PlayStation 1 / SNES era games).
IMPORTANT: Must be a FULL BODY shot showing the entire character from head to feet.
Keep the character centered in the frame.
Include proper shading, highlights, and anti-aliased edges for a polished look.
Show in a front-facing or 3/4 view pose, standing idle, suitable for sprite sheet animation.

CRITICAL: Place the character on a SOLID CHROMA GREEN background (${CHROMA_GREEN}).
- The background must be PURE, FLAT green - RGB(0, 255, 0) exactly
- NO shadows, gradients, or any variation in the green`;

export async function generateCharacter(req: Request, res: Response) {
  try {
    const { prompt, imageUrl } = req.body;

    // Image-to-image mode
    if (imageUrl) {
      const fullPrompt = prompt
        ? `${prompt}. ${IMAGE_TO_PIXEL_PROMPT}`
        : IMAGE_TO_PIXEL_PROMPT;

      const result = await generateImage({
        prompt: fullPrompt,
        referenceImages: [imageUrl],
        aspectRatio: "1:1"
      });

      if (!result) {
        return res.status(500).json({ error: "No image generated" });
      }

      const transparentBase64 = await removeGreenBackground(result.imageBase64);

      return res.json({
        imageUrl: base64ToDataUrl(transparentBase64),
        rawImageUrl: base64ToDataUrl(result.imageBase64),
        width: 1024,
        height: 1024,
      });
    }

    // Text-to-image mode
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const fullPrompt = `${prompt}. ${CHARACTER_STYLE_PROMPT}`;

    const result = await generateImage({
      prompt: fullPrompt,
      aspectRatio: "1:1"
    });

    if (!result) {
      return res.status(500).json({ error: "No image generated" });
    }

    const transparentBase64 = await removeGreenBackground(result.imageBase64);

    return res.json({
      imageUrl: base64ToDataUrl(transparentBase64),
      rawImageUrl: base64ToDataUrl(result.imageBase64),
      width: 1024,
      height: 1024,
    });
  } catch (error) {
    console.error("Error generating character:", error);
    return res.status(500).json({ error: "Failed to generate character" });
  }
}
