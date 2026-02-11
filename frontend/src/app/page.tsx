"use client";

import { useState, useRef, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { Frame, SpriteType, BoundingBox } from "@/types";
import dynamic from "next/dynamic";
import JSZip from "jszip";
import * as api from "@/lib/api";

const PixiSandbox = dynamic(() => import("@/components/PixiSandbox"), { ssr: false });

// Frame extraction utility
function extractFramesFromSheet(
  imageUrl: string,
  rows: number,
  cols: number
): Promise<Frame[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const frameWidth = Math.floor(img.width / cols);
      const frameHeight = Math.floor(img.height / rows);
      const frames: Frame[] = [];
      
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const canvas = document.createElement("canvas");
          canvas.width = frameWidth;
          canvas.height = frameHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(
            img,
            col * frameWidth,
            row * frameHeight,
            frameWidth,
            frameHeight,
            0,
            0,
            frameWidth,
            frameHeight
          );
          
          const imageData = ctx.getImageData(0, 0, frameWidth, frameHeight);
          const data = imageData.data;
          let minX = frameWidth, minY = frameHeight, maxX = 0, maxY = 0;
          
          for (let y = 0; y < frameHeight; y++) {
            for (let x = 0; x < frameWidth; x++) {
              const idx = (y * frameWidth + x) * 4;
              if (data[idx + 3] > 10) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
              }
            }
          }
          
          const contentBounds: BoundingBox = minX <= maxX && minY <= maxY
            ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
            : { x: 0, y: 0, width: frameWidth, height: frameHeight };
          
          frames.push({
            dataUrl: canvas.toDataURL("image/png"),
            width: frameWidth,
            height: frameHeight,
            contentBounds,
          });
        }
      }
      resolve(frames);
    };
    img.onerror = () => resolve([]);
    img.src = imageUrl;
  });
}

// Toast component
function Toast() {
  const { toast, clearToast } = useStore();
  
  if (!toast) return null;
  
  const bgColor = {
    success: 'bg-[#63c74d]',
    error: 'bg-[#e43b44]',
    info: 'bg-[#feae34]'
  }[toast.type];

  return (
    <div className={`fixed top-20 right-4 left-4 sm:left-auto sm:right-6 z-[100] ${bgColor} text-[#181425] px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-up`}>
      <span className="text-sm font-medium">{toast.message}</span>
      <button onClick={clearToast} className="opacity-60 hover:opacity-100">✕</button>
    </div>
  );
}

// Clickable step indicator
function StepIndicator({ currentStep, maxCompletedStep, onStepClick }: { 
  currentStep: number; 
  maxCompletedStep: number;
  onStepClick: (step: number) => void;
}) {
  const steps = ["Character", "Sprites", "Preview", "Play"];
  
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 mb-8 sm:mb-12">
      {steps.map((label, idx) => {
        const stepNum = idx + 1;
        const isActive = currentStep === stepNum;
        const isCompleted = stepNum <= maxCompletedStep;
        const isClickable = isCompleted || stepNum <= maxCompletedStep + 1;

        return (
          <div key={stepNum} className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => isClickable && onStepClick(stepNum)}
              disabled={!isClickable}
              className={`flex flex-col items-center gap-1.5 sm:gap-2 transition-all ${
                isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed opacity-50'
              }`}
            >
              <div
                className={`pixel-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              />
              <span className={`text-[8px] sm:text-[10px] uppercase tracking-wider ${
                isActive ? 'text-accent' : isCompleted ? 'text-[#63c74d]' : 'text-[#5a6988]'
              }`}>
                {label}
              </span>
            </button>
            {idx < steps.length - 1 && (
              <div className={`w-4 sm:w-8 h-[2px] ${
                isCompleted && idx < maxCompletedStep ? 'bg-[#63c74d]' : 'bg-[#3a4466]'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Edit Modal component
function EditModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  title,
  isLoading 
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => void;
  title: string;
  isLoading: boolean;
}) {
  const [editPrompt, setEditPrompt] = useState("");
  
  if (!isOpen) return null;
  
  // If loading, show loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#181425]/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="glass-card p-8 w-full max-w-md animate-fade-up text-center">
          <div className="spinner mx-auto mb-4" />
          <h3 className="text-lg font-bold text-accent mb-2">Applying Edit...</h3>
          <p className="text-[#8b9bb4] text-sm">Gemini is processing your changes</p>
          <p className="text-[#5a6988] text-xs mt-2">This may take 15-30 seconds</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 bg-[#181425]/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card p-6 w-full max-w-md animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-accent">{title}</h3>
          <button onClick={onClose} className="text-[#8b9bb4] hover:text-[#ead4aa]">✕</button>
        </div>
        <textarea
          value={editPrompt}
          onChange={(e) => setEditPrompt(e.target.value)}
          placeholder="Describe the changes you want... (e.g., 'Add a helmet', 'Change to red armor', 'Make it look angrier')"
          className="input-arcade h-28 resize-none mb-4"
          autoFocus
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button 
            onClick={() => { onSubmit(editPrompt); setEditPrompt(""); }}
            disabled={!editPrompt.trim()}
            className="btn-arcade flex-1"
          >
            Apply Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// Sprite card with regenerate and edit buttons
function SpriteCard({ type, isGenerating, onRegenerate, onEdit }: {
  type: SpriteType;
  isGenerating: boolean;
  onRegenerate: () => void;
  onEdit: () => void;
}) {
  const { spriteSheets, showRawImages } = useStore();
  const sheet = spriteSheets[type];
  
  return (
    <div className="glass-card p-4 relative group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-[#5a6988]">{type}</span>
        {sheet && !isGenerating && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
            <button
              onClick={onEdit}
              className="text-[10px] text-[#8b9bb4] hover:text-accent"
              title="Edit this sprite"
            >
              ✎
            </button>
            <button
              onClick={onRegenerate}
              className="text-[10px] text-[#8b9bb4] hover:text-accent"
              title="Regenerate this sprite"
            >
              ↻
            </button>
          </div>
        )}
      </div>
      
      {isGenerating ? (
        <div className="aspect-square bg-[#1a1a2e] rounded-lg flex flex-col items-center justify-center gap-2">
          <div className="spinner w-6 h-6" />
          <span className="text-[10px] text-accent">Generating...</span>
        </div>
      ) : sheet ? (
        <div className="bg-[#1a1a2e] rounded-lg overflow-hidden relative">
          <img
            src={showRawImages && sheet.rawImageUrl ? sheet.rawImageUrl : sheet.imageUrl}
            alt={type}
            className="w-full pixel-art"
          />
        </div>
      ) : (
        <div className="aspect-square bg-[#1a1a2e] rounded-lg flex items-center justify-center">
          <span className="text-[#5a6988] text-xs">Pending</span>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const store = useStore();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewType, setPreviewType] = useState<SpriteType>("walk");
  const [previewFrame, setPreviewFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isEditingCharacter, setIsEditingCharacter] = useState(false);
  const [editingSpriteType, setEditingSpriteType] = useState<SpriteType | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  // Animation preview
  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) clearInterval(animationRef.current);
      return;
    }
    
    const frames = store[`${previewType}Frames`] as Frame[];
    if (frames.length === 0) return;
    
    animationRef.current = setInterval(() => {
      setPreviewFrame((prev) => (prev + 1) % frames.length);
    }, 1000 / store.fps);
    
    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
    };
  }, [isPlaying, previewType, store.fps, store]);

  // Auto-start animation on Step 4 (live preview in Adjust Settings)
  useEffect(() => {
    if (store.currentStep === 4) {
      setIsPlaying(true);
    }
  }, [store.currentStep]);

  // Generate character
  const generateCharacter = async () => {
    store.setLoading(true);
    store.setLoadingMessage("Generating character...");
    store.clearError();
    
    try {
      const data = await api.generateCharacter(store.characterPrompt || undefined, uploadedImage || undefined);
      
      store.setCharacterImage({
        imageUrl: data.imageUrl,
        rawImageUrl: data.rawImageUrl,
        width: data.width,
        height: data.height,
      });
      store.setMaxCompletedStep(1);
      store.setStep(2);
      store.showToast("Character generated!", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate character";
      store.setError(message);
      store.showToast(message, "error");
    } finally {
      store.setLoading(false);
      store.setLoadingMessage("");
    }
  };

  // Edit character with prompt
  const editCharacterHandler = async (editPrompt: string) => {
    if (!store.characterImage) return;
    
    setIsEditLoading(true);
    
    try {
      const data = await api.editCharacter(store.characterImage.imageUrl, editPrompt);
      
      store.setCharacterImage({
        imageUrl: data.imageUrl,
        rawImageUrl: data.rawImageUrl,
        width: data.width,
        height: data.height,
      });
      store.showToast("Character updated!", "success");
      setIsEditingCharacter(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to edit character";
      store.showToast(message, "error");
    } finally {
      setIsEditLoading(false);
    }
  };

  // Edit sprite sheet with prompt
  const editSpriteSheetHandler = async (type: SpriteType, editPrompt: string) => {
    const sheet = store.spriteSheets[type];
    if (!sheet) return;
    
    setIsEditLoading(true);
    store.setGeneratingSprite(type, true);
    
    try {
      const data = await api.editSpriteSheet(sheet.imageUrl, editPrompt, type);
      
      store.setSpriteSheet(type, {
        imageUrl: data.imageUrl,
        rawImageUrl: data.rawImageUrl,
        width: data.width,
        height: data.height,
      });
      
      // Re-extract frames for this specific sprite type
      const frames = await extractFramesFromSheet(data.imageUrl, 2, 2);
      store.setFrames(type, frames);
      
      store.showToast(`${type} sprite updated!`, "success");
      setEditingSpriteType(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to edit ${type}`;
      store.showToast(message, "error");
    } finally {
      setIsEditLoading(false);
      store.setGeneratingSprite(type, false);
    }
  };

  // Generate single sprite sheet (for individual regeneration)
  const generateSingleSprite = async (type: SpriteType) => {
    if (!store.characterImage) return;
    
    store.setGeneratingSprite(type, true);
    
    try {
      const data = await api.generateSpriteSheet(store.characterImage.imageUrl, type);
      
      store.setSpriteSheet(type, {
        imageUrl: data.imageUrl,
        rawImageUrl: data.rawImageUrl,
        width: data.width,
        height: data.height,
      });
      
      // Re-extract frames for this specific sprite type
      const frames = await extractFramesFromSheet(data.imageUrl, 2, 2);
      store.setFrames(type, frames);
      
      store.showToast(`${type} sprite generated!`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to generate ${type}`;
      store.showToast(message, "error");
    } finally {
      store.setGeneratingSprite(type, false);
    }
  };

  // Generate all sprite sheets in PARALLEL
  const generateAllSprites = async () => {
    if (!store.characterImage) return;
    
    store.setLoading(true);
    store.setLoadingMessage("Generating all animations in parallel...");
    
    const types: SpriteType[] = ["walk", "jump", "attack", "idle"];
    
    // Set all as generating
    types.forEach(type => store.setGeneratingSprite(type, true));
    
    // Run all in parallel
    const results = await Promise.allSettled(
      types.map(async (type) => {
        try {
          const data = await api.generateSpriteSheet(store.characterImage!.imageUrl, type);
          
          store.setSpriteSheet(type, {
            imageUrl: data.imageUrl,
            rawImageUrl: data.rawImageUrl,
            width: data.width,
            height: data.height,
          });
          
          return { type, success: true };
        } catch (error) {
          return { type, success: false, error };
        } finally {
          store.setGeneratingSprite(type, false);
        }
      })
    );
    
    const failures = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));
    
    if (failures.length === 0 || failures.length < 4) {
      // Auto-extract frames from generated sprites
      store.setLoadingMessage("Extracting animation frames...");
      
      for (const type of types) {
        const sheet = store.spriteSheets[type];
        if (sheet) {
          const frames = await extractFramesFromSheet(sheet.imageUrl, 2, 2);
          store.setFrames(type, frames);
        }
      }
      
      store.setMaxCompletedStep(2);
      // Stay on Step 2 so user can review and edit sprites before proceeding
      
      if (failures.length === 0) {
        store.showToast("All sprites generated! Click Next to continue.", "success");
      } else {
        store.showToast(`${4 - failures.length}/4 sprites generated. You can regenerate failed ones.`, "info");
      }
    } else {
      store.showToast("Failed to generate sprites. Please retry.", "error");
    }
    
    store.setLoading(false);
    store.setLoadingMessage("");
  };

  // Extract frames
  // Export all assets as ZIP
  const exportAssets = async () => {
    setIsExporting(true);
    
    try {
      const zip = new JSZip();
      
      // Add character
      if (store.characterImage) {
        const charData = store.characterImage.imageUrl.split(',')[1];
        zip.file("character.png", charData, { base64: true });
      }
      
      // Add sprite sheets
      const types: SpriteType[] = ["walk", "jump", "attack", "idle"];
      for (const type of types) {
        const sheet = store.spriteSheets[type];
        if (sheet) {
          const sheetData = sheet.imageUrl.split(',')[1];
          zip.file(`spritesheet_${type}.png`, sheetData, { base64: true });
        }
        
        // Add individual frames
        const frames = store[`${type}Frames`] as Frame[];
        frames.forEach((frame, idx) => {
          const frameData = frame.dataUrl.split(',')[1];
          zip.file(`frames/${type}/${type}_${idx + 1}.png`, frameData, { base64: true });
        });
      }
      
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pixelforge_sprites.zip";
      a.click();
      URL.revokeObjectURL(url);
      
      store.showToast("Assets exported!", "success");
    } catch (error) {
      store.showToast("Failed to export assets", "error");
    } finally {
      setIsExporting(false);
    }
  };

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getCurrentFrames = (): Frame[] => {
    switch (previewType) {
      case "walk": return store.walkFrames;
      case "jump": return store.jumpFrames;
      case "attack": return store.attackFrames;
      case "idle": return store.idleFrames;
      default: return [];
    }
  };

  const handleStepClick = (step: number) => {
    if (step <= store.maxCompletedStep + 1) {
      store.setStep(step as 1 | 2 | 3 | 4);
    }
  };

  const anyGenerating = Object.values(store.generatingSprites).some(v => v);
  const allSpritesExist = Object.values(store.spriteSheets).every(v => v !== null);

  // Proceed to preview - ALWAYS re-extract frames to ensure they match current sprites
  const proceedToPreview = async () => {
    store.setLoading(true);
    store.setLoadingMessage("Preparing preview...");
    
    // Always re-extract frames from current sprite sheets
    // This ensures frames are never stale after regeneration
    const types: SpriteType[] = ["walk", "jump", "attack", "idle"];
    for (const type of types) {
      const sheet = store.spriteSheets[type];
      if (sheet) {
        const frames = await extractFramesFromSheet(sheet.imageUrl, 2, 2);
        store.setFrames(type, frames);
      }
    }
    
    store.setLoading(false);
    store.setLoadingMessage("");
    store.setMaxCompletedStep(2);
    store.setStep(3);
  };

  return (
    <div className="min-h-screen bg-grid relative">
      <Toast />
      
      {/* Edit Character Modal */}
      <EditModal
        isOpen={isEditingCharacter}
        onClose={() => setIsEditingCharacter(false)}
        onSubmit={editCharacterHandler}
        title="Edit Character"
        isLoading={isEditLoading}
      />
      
      {/* Edit Sprite Sheet Modal */}
      <EditModal
        isOpen={editingSpriteType !== null}
        onClose={() => setEditingSpriteType(null)}
        onSubmit={(prompt) => editingSpriteType && editSpriteSheetHandler(editingSpriteType, prompt)}
        title={`Edit ${editingSpriteType} Sprite Sheet`}
        isLoading={isEditLoading}
      />
      
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#3a4466] bg-[#181425]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src="/logo.png" alt="PixelForge" className="w-7 h-7 sm:w-8 sm:h-8 pixel-art flex-shrink-0" />
            <span className="text-xs sm:text-sm font-semibold tracking-wide">PIXELFORGE</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {store.maxCompletedStep >= 2 && (
              <button
                onClick={exportAssets}
                disabled={isExporting}
                className="btn-ghost text-[10px] sm:text-xs flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3"
              >
                {isExporting ? (
                  <>
                    <span className="spinner w-3 h-3" />
                    <span className="hidden sm:inline">Exporting...</span>
                  </>
                ) : (
                  <>↓ <span className="hidden sm:inline">Export ZIP</span></>
                )}
              </button>
            )}
            <button onClick={store.reset} className="btn-ghost text-[10px] sm:text-xs px-2 sm:px-4 py-2 sm:py-3">
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
        <StepIndicator 
          currentStep={store.currentStep} 
          maxCompletedStep={store.maxCompletedStep}
          onStepClick={handleStepClick}
        />

        {/* Loading Overlay */}
        {store.isLoading && (
          <div className="fixed inset-0 bg-[#181425]/90 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="glass-card p-10 text-center animate-fade-up">
              <div className="spinner mx-auto mb-6" />
              <p className="text-accent font-medium mb-2">{store.loadingMessage}</p>
              <p className="text-[#5a6988] text-xs">This may take up to 30 seconds</p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {store.error && (
          <div className="max-w-xl mx-auto mb-8 glass-card p-4 border-[#e43b44]/30 bg-[#e43b44]/5">
            <div className="flex items-center gap-3">
              <span className="text-[#e43b44]">⚠</span>
              <p className="text-sm text-[#e43b44] flex-1">{store.error}</p>
              <button onClick={store.clearError} className="text-[#e43b44]/60 hover:text-[#e43b44]">✕</button>
            </div>
          </div>
        )}

        {/* Step 1: Generate Character */}
        {store.currentStep === 1 && (
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-6 sm:mb-10 animate-fade-up">
              <span className="badge mb-4">Step 1</span>
              <h2 className="text-lg sm:text-2xl font-bold text-glow mb-3">
                Create Your Character
              </h2>
              <p className="text-[#8b9bb4] text-xs sm:text-sm">
                Describe your pixel hero or attach a reference
              </p>
            </div>

            <div className="space-y-6">
              {/* Textarea with attachment button */}
              <div className="animate-fade-up delay-1">
                <div className="relative">
                  <textarea
                    value={store.characterPrompt}
                    onChange={(e) => store.setCharacterPrompt(e.target.value)}
                    placeholder="A brave robot warrior with silver armor..."
                    className="input-arcade h-32 resize-none pr-16"
                  />
                  {/* Attachment button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`absolute right-3 top-3 w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                      uploadedImage
                        ? 'bg-[#feae34] text-[#181425]'
                        : 'bg-[#2d2d44] text-[#8b9bb4] hover:text-accent hover:bg-[#3a4466]'
                    }`}
                    title={uploadedImage ? "Image attached - click to change" : "Attach reference image"}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                
                {/* Show attached image preview */}
                {uploadedImage && (
                  <div className="mt-3 flex items-center gap-3 p-3 bg-[#2d2d44] rounded-lg border border-[#3a4466]">
                    <img src={uploadedImage} alt="Attached" className="w-16 h-16 object-cover rounded-lg pixel-art" />
                    <div className="flex-1">
                      <p className="text-sm text-[#ead4aa]">Reference image attached</p>
                      <p className="text-xs text-[#5a6988]">Will be converted to pixel art</p>
                    </div>
                    <button
                      onClick={() => setUploadedImage(null)}
                      className="text-[#8b9bb4] hover:text-[#e43b44] p-2 transition-colors"
                      title="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="animate-fade-up delay-2 pt-2">
                <button
                  onClick={generateCharacter}
                  disabled={!store.characterPrompt && !uploadedImage}
                  className="btn-arcade w-full"
                >
                  Generate Character
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Generate Sprite Sheets */}
        {store.currentStep === 2 && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-6 sm:mb-10 animate-fade-up">
              <span className="badge mb-4">Step 2</span>
              <h2 className="text-lg sm:text-2xl font-bold text-glow mb-3">
                Generate Animations
              </h2>
              <p className="text-[#8b9bb4] text-xs sm:text-sm">
                Create walk, jump, attack, and idle sprites
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
              {/* Character preview */}
              <div className="glass-card p-6 animate-fade-up delay-1 group">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#feae34]" />
                    <span className="text-xs uppercase tracking-wider text-[#8b9bb4]">Your Character</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {store.characterImage && (
                      <button
                        onClick={() => setIsEditingCharacter(true)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] px-2 py-1 rounded bg-[#2d2d44] text-[#8b9bb4] hover:text-accent"
                      >
                        ✎ Edit
                      </button>
                    )}
                    {store.characterImage?.rawImageUrl && (
                      <button
                        onClick={() => store.setShowRawImages(!store.showRawImages)}
                        className={`text-[10px] px-2 py-1 rounded ${
                          store.showRawImages
                            ? 'bg-[#feae34] text-[#181425]'
                            : 'bg-[#2d2d44] text-[#8b9bb4]'
                        }`}
                      >
                        {store.showRawImages ? 'Raw' : 'Clean'}
                      </button>
                    )}
                  </div>
                </div>
                {store.characterImage && (
                  <div className="bg-[#1a1a2e] rounded-lg p-4 flex items-center justify-center">
                    <img
                      src={store.showRawImages && store.characterImage.rawImageUrl 
                        ? store.characterImage.rawImageUrl 
                        : store.characterImage.imageUrl}
                      alt="Character"
                      className="max-h-64 pixel-art"
                    />
                  </div>
                )}
              </div>

              {/* Sprite sheet grid */}
              <div className="grid grid-cols-2 gap-3 animate-fade-up delay-2">
                {(["walk", "jump", "attack", "idle"] as SpriteType[]).map((type) => (
                  <SpriteCard
                    key={type}
                    type={type}
                    isGenerating={store.generatingSprites[type]}
                    onRegenerate={() => generateSingleSprite(type)}
                    onEdit={() => setEditingSpriteType(type)}
                  />
                ))}
              </div>
            </div>

            {/* Progress indicator */}
            {anyGenerating && (
              <div className="glass-card p-4 mb-6 animate-fade-up">
                <div className="flex items-center gap-4">
                  <div className="spinner w-5 h-5" />
                  <div className="flex-1">
                    <div className="flex gap-2">
                      {(["walk", "jump", "attack", "idle"] as SpriteType[]).map((type) => (
                        <span
                          key={type}
                          className={`text-xs px-2 py-1 rounded ${
                            store.generatingSprites[type]
                              ? 'bg-[#feae34]/20 text-accent animate-pulse'
                              : store.spriteSheets[type]
                              ? 'bg-[#63c74d]/20 text-[#63c74d]'
                              : 'bg-[#2d2d44] text-[#5a6988]'
                          }`}
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 sm:gap-4 animate-fade-up delay-3">
              <button onClick={() => store.setStep(1)} className="btn-ghost text-xs sm:text-sm">
                ← Back
              </button>

              {/* Show Generate button - smaller if sprites exist */}
              <button
                onClick={generateAllSprites}
                disabled={anyGenerating}
                className={`text-xs sm:text-sm ${allSpritesExist ? "btn-ghost" : "btn-arcade flex-1"}`}
              >
                {anyGenerating ? 'Generating...' : allSpritesExist ? '↻ Regenerate All' : 'Generate All Sprites'}
              </button>

              {/* Show Next button only if all sprites exist */}
              {allSpritesExist && !anyGenerating && (
                <button
                  onClick={proceedToPreview}
                  className="btn-arcade flex-1 text-xs sm:text-sm"
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Preview & Adjust (Merged) */}
        {store.currentStep === 3 && (
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-6 sm:mb-10 animate-fade-up">
              <span className="badge mb-4">Step 3</span>
              <h2 className="text-lg sm:text-2xl font-bold text-glow mb-3">
                Preview & Adjust
              </h2>
              <p className="text-[#8b9bb4] text-xs sm:text-sm">
                Test animations and fine-tune settings
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
              {/* Animation preview - main focus */}
              <div className="lg:col-span-2 glass-card p-4 sm:p-6 animate-fade-up delay-1">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                    {(["walk", "jump", "attack", "idle"] as SpriteType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => { setPreviewType(type); setPreviewFrame(0); setIsPlaying(true); }}
                        className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs uppercase tracking-wider rounded transition-all ${
                          previewType === type
                            ? "bg-[#feae34] text-[#181425] font-semibold"
                            : "bg-[#2d2d44] text-[#8b9bb4] hover:text-[#ead4aa]"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`px-3 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded ${
                      isPlaying
                        ? 'bg-[#e43b44] text-white'
                        : 'bg-[#feae34] text-[#181425]'
                    }`}
                  >
                    {isPlaying ? "■ Stop" : "▶ Play"}
                  </button>
                </div>

                <div className="game-preview aspect-video flex items-center justify-center">
                  {getCurrentFrames()[previewFrame] && (
                    <img
                      src={getCurrentFrames()[previewFrame].dataUrl}
                      alt="Preview"
                      className="max-h-[80%] max-w-[80%] object-contain pixel-art"
                    />
                  )}
                </div>

                {/* Frame scrubber */}
                <div className="flex items-center gap-3 mt-4">
                  <div className="flex gap-1 flex-1">
                    {getCurrentFrames().map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setPreviewFrame(idx); setIsPlaying(false); }}
                        className={`flex-1 h-2 rounded-sm transition-all ${
                          previewFrame === idx
                            ? 'bg-[#feae34]'
                            : 'bg-[#3a4466] hover:bg-[#4a5580]'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[#5a6988] text-xs whitespace-nowrap">
                    {previewFrame + 1}/{getCurrentFrames().length}
                  </span>
                </div>
              </div>

              {/* Settings panel */}
              <div className="glass-card p-6 animate-fade-up delay-2">
                {/* FPS control */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs uppercase tracking-wider text-[#8b9bb4]">Speed</span>
                    <span className="text-accent font-bold text-lg">{store.fps} FPS</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="24"
                    value={store.fps}
                    onChange={(e) => store.setFps(parseInt(e.target.value))}
                    className="w-full h-2 bg-[#2d2d44] rounded-full appearance-none cursor-pointer accent-[#feae34]"
                  />
                  <div className="flex justify-between text-[10px] text-[#5a6988] mt-2">
                    <span>Slow</span>
                    <span>Fast</span>
                  </div>
                </div>

                {/* Frame counts */}
                <div className="pt-6 border-t border-[#3a4466] mb-6">
                  <span className="text-xs uppercase tracking-wider text-[#8b9bb4] block mb-4">Frames</span>
                  <div className="grid grid-cols-2 gap-3">
                    {(["walk", "jump", "attack", "idle"] as SpriteType[]).map((type) => {
                      const frames = store[`${type}Frames`] as Frame[];
                      return (
                        <div 
                          key={type} 
                          onClick={() => { setPreviewType(type); setPreviewFrame(0); setIsPlaying(true); }}
                          className={`p-3 rounded cursor-pointer transition-all ${
                            previewType === type
                              ? 'bg-[#feae34]/10 border border-[#feae34]/30'
                              : 'bg-[#2d2d44] hover:bg-[#3a4466]'
                          }`}
                        >
                          <span className="text-[10px] uppercase tracking-wider text-[#5a6988] block">{type}</span>
                          <span className="text-xl font-bold text-accent">{frames.length}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick tip */}
                <div className="text-[10px] text-[#5a6988] bg-[#2d2d44] rounded p-3">
                  <strong className="text-[#8b9bb4]">Tip:</strong> Click frame bars below the preview to scrub through animation
                </div>
              </div>
            </div>

            <div className="flex gap-3 sm:gap-4 animate-fade-up delay-3">
              <button onClick={() => store.setStep(2)} className="btn-ghost text-xs sm:text-sm">
                ← Sprites
              </button>
              <button
                onClick={() => { store.setMaxCompletedStep(3); store.setStep(4); }}
                className="btn-arcade flex-1 text-xs sm:text-sm"
              >
                Launch Sandbox
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Sandbox */}
        {store.currentStep === 4 && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-6 sm:mb-8 animate-fade-up">
              <span className="badge mb-4">Step 4</span>
              <h2 className="text-lg sm:text-2xl font-bold text-glow mb-3">
                Play Your Character
              </h2>
              <p className="text-[#8b9bb4] text-xs sm:text-sm">
                <span className="kbd">A</span> <span className="kbd">D</span> Move
                <span className="mx-1.5 sm:mx-3">·</span>
                <span className="kbd">W</span> Jump
                <span className="mx-1.5 sm:mx-3">·</span>
                <span className="kbd">J</span> Attack
              </p>
            </div>

            <div className="glass-card p-4 mb-8 animate-fade-up delay-1">
              <div className="game-preview rounded-lg overflow-hidden">
                <PixiSandbox
                  walkFrames={store.walkFrames}
                  jumpFrames={store.jumpFrames}
                  attackFrames={store.attackFrames}
                  idleFrames={store.idleFrames}
                  fps={store.fps}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 sm:gap-4 animate-fade-up delay-2">
              <button onClick={() => store.setStep(3)} className="btn-ghost text-xs sm:text-sm">
                ← Preview
              </button>
              <button
                onClick={exportAssets}
                disabled={isExporting}
                className="btn-ghost flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
              >
                {isExporting ? <span className="spinner w-3 h-3" /> : '↓'}
                Export
              </button>
              <button onClick={store.reset} className="btn-arcade flex-1 text-xs sm:text-sm">
                New Character
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#3a4466] mt-12 sm:mt-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 text-center">
          <p className="text-[#5a6988] text-xs">
            Powered by Gemini 3 Pro · Built with Next.js
          </p>
        </div>
      </footer>
    </div>
  );
}
