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

export type SpriteType = "walk" | "jump" | "attack" | "idle";

export type Step = 1 | 2 | 3 | 4 | 5 | 6;

export interface AppState {
  // Step navigation
  currentStep: Step;
  setStep: (step: Step) => void;
  
  // Character
  characterPrompt: string;
  setCharacterPrompt: (prompt: string) => void;
  characterImage: GeneratedImage | null;
  setCharacterImage: (image: GeneratedImage | null) => void;
  
  // Sprite sheets
  spriteSheets: SpriteSheetData;
  setSpriteSheet: (type: SpriteType, image: GeneratedImage | null) => void;
  
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
  
  // Animation settings
  fps: number;
  setFps: (fps: number) => void;
  
  // Reset
  reset: () => void;
}
