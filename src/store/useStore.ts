import { create } from 'zustand';
import { AppState, SpriteType, Frame, GeneratedImage, Step } from '@/types';

const initialSpriteSheets = {
  walk: null,
  jump: null,
  attack: null,
  idle: null,
};

export const useStore = create<AppState>((set) => ({
  // Step navigation
  currentStep: 1,
  setStep: (step: Step) => set({ currentStep: step }),
  
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
  
  // Animation settings
  fps: 8,
  setFps: (fps: number) => set({ fps }),
  
  // Reset
  reset: () => set({
    currentStep: 1,
    characterPrompt: '',
    characterImage: null,
    spriteSheets: { ...initialSpriteSheets },
    walkFrames: [],
    jumpFrames: [],
    attackFrames: [],
    idleFrames: [],
    isLoading: false,
    loadingMessage: '',
    fps: 8,
  }),
}));
