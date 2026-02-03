/**
 * API Client for PixelForge Backend
 * All Gemini/AI operations happen on the backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface GeneratedImage {
  imageUrl: string;
  rawImageUrl?: string;
  width: number;
  height: number;
}

interface SpriteSheetResponse extends GeneratedImage {
  type: string;
}

/**
 * Generate a character from text or image
 */
export async function generateCharacter(prompt?: string, imageUrl?: string): Promise<GeneratedImage> {
  const response = await fetch(`${API_URL}/api/generate-character`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, imageUrl }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate character');
  }

  return response.json();
}

/**
 * Generate a sprite sheet for a given animation type
 */
export async function generateSpriteSheet(
  characterImageUrl: string,
  type: 'walk' | 'jump' | 'attack' | 'idle'
): Promise<SpriteSheetResponse> {
  const response = await fetch(`${API_URL}/api/generate-sprite-sheet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterImageUrl, type }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate sprite sheet');
  }

  return response.json();
}

/**
 * Edit an existing character
 */
export async function editCharacter(imageUrl: string, editPrompt: string): Promise<GeneratedImage> {
  const response = await fetch(`${API_URL}/api/edit-character`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl, editPrompt }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to edit character');
  }

  return response.json();
}

/**
 * Edit an existing sprite sheet
 */
export async function editSpriteSheet(
  imageUrl: string,
  editPrompt: string,
  type: 'walk' | 'jump' | 'attack' | 'idle'
): Promise<SpriteSheetResponse> {
  const response = await fetch(`${API_URL}/api/edit-sprite-sheet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl, editPrompt, type }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to edit sprite sheet');
  }

  return response.json();
}
