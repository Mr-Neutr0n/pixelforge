/**
 * API Client for PixelForge Backend
 * All AI operations happen on the backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8104';
const GENERATION_TOKEN_KEY = 'pixelforge-generation-token';
let generationTokenPromise: Promise<string> | null = null;

async function generationToken(): Promise<string> {
  const stored = typeof window !== 'undefined' ? sessionStorage.getItem(GENERATION_TOKEN_KEY) : null;
  if (stored) return stored;
  generationTokenPromise ||= apiFetch<{ token: string }>(`${API_URL}/api/generation-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }).then(({ token }) => {
    sessionStorage.setItem(GENERATION_TOKEN_KEY, token);
    return token;
  }).finally(() => {
    generationTokenPromise = null;
  });
  return generationTokenPromise;
}

async function generationHeaders(): Promise<Record<string, string>> {
  return {
    'Content-Type': 'application/json',
    'X-Generation-Token': await generationToken(),
  };
}

export function resetGenerationProject(): void {
  if (typeof window !== 'undefined') sessionStorage.removeItem(GENERATION_TOKEN_KEY);
  generationTokenPromise = null;
}

/**
 * Convert a private S3 signed URL to a same-origin API proxy URL.
 * Needed for canvas pixel access (CORS).
 */
export function proxyUrl(url: string): string {
  if (!url || url.startsWith('data:')) return url;
  return `${API_URL}/api/proxy-image?url=${encodeURIComponent(url)}`;
}

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
    if (response.status === 401) resetGenerationProject();
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
    headers: await generationHeaders(),
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
    headers: await generationHeaders(),
    body: JSON.stringify({ characterImageUrl, type }),
  });
}

/**
 * Edit an existing character
 */
export async function editCharacter(imageUrl: string, editPrompt: string): Promise<GeneratedImage> {
  return apiFetch<GeneratedImage>(`${API_URL}/api/edit-character`, {
    method: 'POST',
    headers: await generationHeaders(),
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
    headers: await generationHeaders(),
    body: JSON.stringify({ imageUrl, editPrompt, type }),
  });
}

/**
 * Save a sprite to the gallery
 */
export async function saveSprite(
  prompt: string,
  characterImage: string,
  spriteSheets: Record<string, string>
): Promise<{ id: string; shareUrl: string }> {
  return apiFetch<{ id: string; shareUrl: string }>(`${API_URL}/api/save-sprite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, characterImage, spriteSheets }),
  });
}

/**
 * Fetch gallery sprites (public, paginated)
 */
export async function fetchGallery(page: number = 1, limit: number = 20) {
  return apiFetch<{
    sprites: Array<{ id: string; prompt: string; characterImageUrl: string; createdAt: string }>;
    total: number;
    page: number;
    totalPages: number;
  }>(`${API_URL}/api/gallery?page=${page}&limit=${limit}`, { method: 'GET' });
}

/**
 * Fetch a single sprite by ID (public)
 */
export async function fetchSprite(id: string) {
  return apiFetch<{
    id: string;
    prompt: string;
    characterImageUrl: string;
    spriteSheets: Record<string, { url: string }>;
    createdAt: string;
  }>(`${API_URL}/api/sprite/${id}`, { method: 'GET' });
}
