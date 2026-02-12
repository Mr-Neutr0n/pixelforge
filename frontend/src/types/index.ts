export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface GameGenerationResponse {
  success: boolean;
  code?: string;
  explanation?: string;
  error?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Frame {
  dataUrl: string;
  width: number;
  height: number;
  contentBounds: BoundingBox;
}

export interface GeneratedImage {
  imageUrl: string;
  rawImageUrl?: string;
  width: number;
  height: number;
}

export interface SpriteSheetData {
  walk: GeneratedImage | null;
  jump: GeneratedImage | null;
  attack: GeneratedImage | null;
  idle: GeneratedImage | null;
}

export interface GeneratingSpritesData {
  walk: boolean;
  jump: boolean;
  attack: boolean;
  idle: boolean;
}

export interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
}

export type SpriteType = "walk" | "jump" | "attack" | "idle";

export type Step = 1 | 2 | 3 | 4;

export interface AppState {
  // Step navigation
  currentStep: Step;
  maxCompletedStep: number;
  setStep: (step: Step) => void;
  setMaxCompletedStep: (step: number) => void;
  
  // Character
  characterPrompt: string;
  setCharacterPrompt: (prompt: string) => void;
  characterImage: GeneratedImage | null;
  setCharacterImage: (image: GeneratedImage | null) => void;
  
  // Sprite sheets
  spriteSheets: SpriteSheetData;
  setSpriteSheet: (type: SpriteType, image: GeneratedImage | null) => void;
  
  // Sprite generation status
  generatingSprites: GeneratingSpritesData;
  setGeneratingSprite: (type: SpriteType, generating: boolean) => void;
  
  // Extracted frames
  walkFrames: Frame[];
  jumpFrames: Frame[];
  attackFrames: Frame[];
  idleFrames: Frame[];
  setFrames: (type: SpriteType, frames: Frame[]) => void;
  
  // Loading states
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (msg: string) => void;
  
  // Error handling
  error: string | null;
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Toast notifications
  toast: Toast | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
  
  // Gallery
  spriteId: string | null;
  setSpriteId: (id: string | null) => void;
  isLocked: boolean;

  // View mode
  showRawImages: boolean;
  setShowRawImages: (show: boolean) => void;
  
  // Animation settings
  fps: number;
  setFps: (fps: number) => void;
  
  // Reset
  reset: () => void;
}

export interface GallerySprite {
  id: string;
  prompt: string;
  characterImageUrl: string;
  createdAt: string;
}

export interface SpriteDetail {
  id: string;
  prompt: string;
  characterImageUrl: string;
  spriteSheets: Record<SpriteType, { url: string }>;
  createdAt: string;
}
