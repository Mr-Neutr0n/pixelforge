/**
 * Generate Sprite Sheet API Route
 * Creates walk/jump/attack/idle animations using Gemini 3 Pro Image
 */

import { NextRequest, NextResponse } from "next/server";
import { generateImage, base64ToDataUrl, CHROMA_GREEN } from "@/lib/gemini";
import { removeGreenBackground } from "@/lib/background-remover";

const WALK_SPRITE_PROMPT = `Create a 4-frame pixel art walk cycle sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid. The character is walking to the right.

Top row (frames 1-2):
Frame 1 (top-left): Right leg forward, left leg back - stride position
Frame 2 (top-right): Legs close together, passing/crossing - transition

Bottom row (frames 3-4):
Frame 3 (bottom-left): Left leg forward, right leg back - opposite stride
Frame 4 (bottom-right): Legs close together, passing/crossing - transition back

Use detailed 32-bit pixel art style. Same character design in all frames. Character facing right.

CRITICAL: Place all frames on a SOLID CHROMA GREEN background (${CHROMA_GREEN}).
- Pure RGB(0, 255, 0) everywhere
- NO shadows, gradients, or variation`;

const JUMP_SPRITE_PROMPT = `Create a 4-frame pixel art jump animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid. The character is jumping.

Top row:
Frame 1 (top-left): Crouch/anticipation - knees bent, preparing to jump
Frame 2 (top-right): Rising - in air, legs tucked up, ascending

Bottom row:
Frame 3 (bottom-left): Apex - at highest point of jump
Frame 4 (bottom-right): Landing - slight crouch to absorb impact

Use detailed 32-bit pixel art style. Same character design in all frames. Character facing right.

CRITICAL: Place all frames on a SOLID CHROMA GREEN background (${CHROMA_GREEN}).`;

const ATTACK_SPRITE_PROMPT = `Create a 4-frame pixel art attack animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid. The character is attacking (sword slash, punch, or magic - whatever fits).

Top row:
Frame 1 (top-left): Wind-up - preparing to attack
Frame 2 (top-right): Strike in motion

Bottom row:
Frame 3 (bottom-left): Impact - maximum extension
Frame 4 (bottom-right): Recovery - returning to stance

Use detailed 32-bit pixel art style. Same character design. Make it dynamic and exciting.

CRITICAL: Place all frames on a SOLID CHROMA GREEN background (${CHROMA_GREEN}).`;

const IDLE_SPRITE_PROMPT = `Create a 4-frame pixel art idle/breathing animation sprite sheet of this character.

Arrange the 4 frames in a 2x2 grid. Subtle breathing animation.

Top row:
Frame 1 (top-left): Neutral standing pose
Frame 2 (top-right): Slight inhale - chest rises subtly

Bottom row:
Frame 3 (bottom-left): Full breath - slight upward posture
Frame 4 (bottom-right): Exhale - returning to neutral

Keep movements SUBTLE. Character should look alive but relaxed.

CRITICAL: Place all frames on a SOLID CHROMA GREEN background (${CHROMA_GREEN}).`;

type SpriteType = "walk" | "jump" | "attack" | "idle";

const PROMPTS: Record<SpriteType, string> = {
  walk: WALK_SPRITE_PROMPT,
  jump: JUMP_SPRITE_PROMPT,
  attack: ATTACK_SPRITE_PROMPT,
  idle: IDLE_SPRITE_PROMPT,
};

const ASPECT_RATIOS: Record<SpriteType, string> = {
  walk: "1:1",
  jump: "1:1",
  attack: "16:9",
  idle: "1:1",
};

export async function POST(request: NextRequest) {
  try {
    const { characterImageUrl, type = "walk" } = await request.json();

    if (!characterImageUrl) {
      return NextResponse.json({ error: "Character image URL is required" }, { status: 400 });
    }

    const spriteType = (type as SpriteType) || "walk";
    const prompt = PROMPTS[spriteType] || PROMPTS.walk;
    const aspectRatio = ASPECT_RATIOS[spriteType] || "1:1";

    const result = await generateImage({
      prompt,
      referenceImages: [characterImageUrl],
      aspectRatio
    });

    if (!result) {
      return NextResponse.json({ error: "No sprite sheet generated" }, { status: 500 });
    }

    const transparentBase64 = await removeGreenBackground(result.imageBase64);

    return NextResponse.json({
      imageUrl: base64ToDataUrl(transparentBase64),
      rawImageUrl: base64ToDataUrl(result.imageBase64),
      width: 1024,
      height: spriteType === "attack" ? 576 : 1024,
      type: spriteType,
    });
  } catch (error) {
    console.error("Error generating sprite sheet:", error);
    return NextResponse.json({ error: "Failed to generate sprite sheet" }, { status: 500 });
  }
}
