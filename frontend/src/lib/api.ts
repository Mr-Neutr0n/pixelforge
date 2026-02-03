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
 * Helper to handle API errors consistently
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Wrapper for fetch that handles network errors
 */
async function apiFetch<T>(url: string, options: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, options);
    return handleResponse<T>(response);
  } catch (error) {
    if (error instanceof TypeError) {
      // Network error (CORS, offline, etc.)
      throw new Error('Cannot connect to server. Please check your connection and try again.');
    }
    throw error;
  }
}

/**
 * Generate a character from text or image
 */
export async function generateCharacter(prompt?: string, imageUrl?: string): Promise<GeneratedImage> {
  return apiFetch<GeneratedImage>(`${API_URL}/api/generate-character`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, imageUrl }),
  });
}

/**
 * Generate a sprite sheet for a given animation type
 */
export async function generateSpriteSheet(
  characterImageUrl: string,
  type: 'walk' | 'jump' | 'attack' | 'idle'
): Promise<SpriteSheetResponse> {
  return apiFetch<SpriteSheetResponse>(`${API_URL}/api/generate-sprite-sheet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterImageUrl, type }),
  });
}

/**
 * Edit an existing character
 */
export async function editCharacter(imageUrl: string, editPrompt: string): Promise<GeneratedImage> {
  return apiFetch<GeneratedImage>(`${API_URL}/api/edit-character`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl, editPrompt }),
  });
}

/**
 * Edit an existing sprite sheet
 */
export async function editSpriteSheet(
  imageUrl: string,
  editPrompt: string,
  type: 'walk' | 'jump' | 'attack' | 'idle'
): Promise<SpriteSheetResponse> {
  return apiFetch<SpriteSheetResponse>(`${API_URL}/api/edit-sprite-sheet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl, editPrompt, type }),
  });
}
