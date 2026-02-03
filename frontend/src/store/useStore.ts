import { create } from 'zustand';
import { AppState, SpriteType, Frame, GeneratedImage, Step } from '@/types';

const initialSpriteSheets = {
  walk: null,
  jump: null,
  attack: null,
  idle: null,
};

const initialGeneratingSprites = {
  walk: false,
  jump: false,
  attack: false,
  idle: false,
};

export const useStore = create<AppState>((set, get) => ({
  // Step navigation
  currentStep: 1,
  maxCompletedStep: 0,
  setStep: (step: Step) => set({ currentStep: step }),
  setMaxCompletedStep: (step: number) => set({ maxCompletedStep: step }),
  
  // Character
  characterPrompt: '',
  setCharacterPrompt: (prompt: string) => set({ characterPrompt: prompt }),
  characterImage: null,
  setCharacterImage: (image: GeneratedImage | null) => set({ characterImage: image }),
  
  // Sprite sheets
  spriteSheets: { ...initialSpriteSheets },
  setSpriteSheet: (type: SpriteType, image: GeneratedImage | null) => 
    set((state) => ({
      spriteSheets: { ...state.spriteSheets, [type]: image }
    })),
  
  // Sprite generation status (for parallel generation)
  generatingSprites: { ...initialGeneratingSprites },
  setGeneratingSprite: (type: SpriteType, generating: boolean) =>
    set((state) => ({
      generatingSprites: { ...state.generatingSprites, [type]: generating }
    })),
  
  // Extracted frames
  walkFrames: [],
  jumpFrames: [],
  attackFrames: [],
  idleFrames: [],
  setFrames: (type: SpriteType, frames: Frame[]) => 
    set({ [`${type}Frames`]: frames }),
  
  // Loading states
  isLoading: false,
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  loadingMessage: '',
  setLoadingMessage: (msg: string) => set({ loadingMessage: msg }),
  
  // Error handling
  error: null,
  setError: (error: string | null) => set({ error }),
  clearError: () => set({ error: null }),
  
  // Toast notifications
  toast: null,
  showToast: (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 4000);
  },
  clearToast: () => set({ toast: null }),
  
  // View mode (raw vs transparent)
  showRawImages: false,
  setShowRawImages: (show: boolean) => set({ showRawImages: show }),
  
  // Animation settings
  fps: 8,
  setFps: (fps: number) => set({ fps }),
  
  // Reset
  reset: () => set({
    currentStep: 1,
    maxCompletedStep: 0,
    characterPrompt: '',
    characterImage: null,
    spriteSheets: { ...initialSpriteSheets },
    generatingSprites: { ...initialGeneratingSprites },
    walkFrames: [],
    jumpFrames: [],
    attackFrames: [],
    idleFrames: [],
    isLoading: false,
    loadingMessage: '',
    error: null,
    toast: null,
    showRawImages: false,
    fps: 8,
  }),
}));
