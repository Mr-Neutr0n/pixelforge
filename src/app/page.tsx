"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { Frame, SpriteType, BoundingBox } from "@/types";
import dynamic from "next/dynamic";

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
          
          // Calculate content bounds
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

// Step indicator component
function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    "Character",
    "Sprite Sheets",
    "Extract Frames",
    "Preview",
    "Adjust",
    "Sandbox"
  ];
  
  return (
    <div className="flex items-center justify-center mb-8 gap-2 flex-wrap">
      {steps.map((label, idx) => {
        const stepNum = idx + 1;
        const isActive = currentStep === stepNum;
        const isCompleted = currentStep > stepNum;
        
        return (
          <div key={stepNum} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isActive
                  ? "bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black"
                  : isCompleted
                  ? "bg-emerald-500 text-black"
                  : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {isCompleted ? "✓" : stepNum}
            </div>
            <span className={`text-xs ${isActive ? "text-cyan-400" : "text-zinc-500"}`}>
              {label}
            </span>
            {idx < steps.length - 1 && (
              <div className={`w-6 h-0.5 ${isCompleted ? "bg-emerald-500" : "bg-zinc-700"}`} />
            )}
          </div>
        );
      })}
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

  // Generate character
  const generateCharacter = async () => {
    store.setLoading(true);
    store.setLoadingMessage("Generating character with Gemini 3 Pro...");
    
    try {
      const response = await fetch("/api/generate-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: store.characterPrompt,
          imageUrl: uploadedImage,
        }),
      });
      
      const data = await response.json();
      
      if (data.imageUrl) {
        store.setCharacterImage({
          imageUrl: data.imageUrl,
          rawImageUrl: data.rawImageUrl,
          width: data.width,
          height: data.height,
        });
        store.setStep(2);
      }
    } catch (error) {
      console.error("Failed to generate character:", error);
    } finally {
      store.setLoading(false);
      store.setLoadingMessage("");
    }
  };

  // Generate sprite sheet
  const generateSpriteSheet = async (type: SpriteType) => {
    if (!store.characterImage) return;
    
    store.setLoading(true);
    store.setLoadingMessage(`Generating ${type} animation...`);
    
    try {
      const response = await fetch("/api/generate-sprite-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterImageUrl: store.characterImage.imageUrl,
          type,
        }),
      });
      
      const data = await response.json();
      
      if (data.imageUrl) {
        store.setSpriteSheet(type, {
          imageUrl: data.imageUrl,
          rawImageUrl: data.rawImageUrl,
          width: data.width,
          height: data.height,
        });
      }
    } catch (error) {
      console.error(`Failed to generate ${type} sprite:`, error);
    } finally {
      store.setLoading(false);
      store.setLoadingMessage("");
    }
  };

  // Generate all sprite sheets
  const generateAllSprites = async () => {
    const types: SpriteType[] = ["walk", "jump", "attack", "idle"];
    for (const type of types) {
      await generateSpriteSheet(type);
    }
    store.setStep(3);
  };

  // Extract frames
  const extractAllFrames = async () => {
    store.setLoading(true);
    store.setLoadingMessage("Extracting animation frames...");
    
    try {
      const types: SpriteType[] = ["walk", "jump", "attack", "idle"];
      for (const type of types) {
        const sheet = store.spriteSheets[type];
        if (sheet) {
          const frames = await extractFramesFromSheet(sheet.imageUrl, 2, 2);
          store.setFrames(type, frames);
        }
      }
      store.setStep(4);
    } catch (error) {
      console.error("Failed to extract frames:", error);
    } finally {
      store.setLoading(false);
      store.setLoadingMessage("");
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

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-[#0d0d14]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-fuchsia-500 to-cyan-400 flex items-center justify-center">
              <span className="text-xl">⚡</span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              PixelForge
          </h1>
          </div>
          <button
            onClick={store.reset}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
          >
            Start Over
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <StepIndicator currentStep={store.currentStep} />

        {/* Loading Overlay */}
        {store.isLoading && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-lg font-medium text-cyan-400">{store.loadingMessage}</p>
              <p className="text-sm text-zinc-500 mt-2">This may take up to 30 seconds...</p>
            </div>
          </div>
        )}

        {/* Step 1: Generate Character */}
        {store.currentStep === 1 && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              Create Your Character
            </h2>
            <p className="text-zinc-500 text-center mb-8">
              Describe your character or upload an image to pixelate
            </p>

            <div className="space-y-6">
              <textarea
                value={store.characterPrompt}
                onChange={(e) => store.setCharacterPrompt(e.target.value)}
                placeholder="A brave robot warrior with glowing blue eyes and silver armor..."
                className="w-full h-32 bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-white placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none resize-none"
              />

              <div className="text-center text-zinc-500">- or -</div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center cursor-pointer hover:border-cyan-500 transition-colors"
              >
                {uploadedImage ? (
                  <img src={uploadedImage} alt="Uploaded" className="max-h-48 mx-auto rounded-lg" />
                ) : (
                  <>
                    <div className="text-4xl mb-2">📁</div>
                    <p className="text-zinc-400">Click to upload an image</p>
                    <p className="text-xs text-zinc-600">PNG, JPG up to 5MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                onClick={generateCharacter}
                disabled={!store.characterPrompt && !uploadedImage}
                className="w-full py-4 bg-gradient-to-r from-fuchsia-600 to-cyan-500 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-fuchsia-500 hover:to-cyan-400 transition-all"
              >
                Generate Character ⚡
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Generate Sprite Sheets */}
        {store.currentStep === 2 && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              Generate Animations
            </h2>

            <div className="grid grid-cols-2 gap-8 mb-8">
              {/* Character preview */}
              <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4 text-cyan-400">Your Character</h3>
                {store.characterImage && (
                  <img
                    src={store.characterImage.imageUrl}
                    alt="Character"
                    className="w-full rounded-lg"
                    style={{ imageRendering: "pixelated" }}
                  />
                )}
              </div>

              {/* Sprite sheet grid */}
              <div className="grid grid-cols-2 gap-4">
                {(["walk", "jump", "attack", "idle"] as SpriteType[]).map((type) => (
                  <div
                    key={type}
                    className="bg-zinc-900 border border-zinc-700 rounded-xl p-4"
                  >
                    <h4 className="text-sm font-bold mb-2 capitalize text-zinc-300">{type}</h4>
                    {store.spriteSheets[type] ? (
                      <img
                        src={store.spriteSheets[type]!.imageUrl}
                        alt={type}
                        className="w-full rounded-lg"
                        style={{ imageRendering: "pixelated" }}
                      />
                    ) : (
                      <div className="aspect-square bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-600">
                        Pending
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => store.setStep(1)}
                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={generateAllSprites}
                className="flex-1 py-3 bg-gradient-to-r from-fuchsia-600 to-cyan-500 rounded-xl font-bold hover:from-fuchsia-500 hover:to-cyan-400 transition-all"
              >
                Generate All Animations ⚡
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Extract Frames */}
        {store.currentStep === 3 && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              Extract Animation Frames
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {(["walk", "jump", "attack", "idle"] as SpriteType[]).map((type) => (
                <div key={type} className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
                  <h4 className="text-sm font-bold mb-2 capitalize text-cyan-400">{type}</h4>
                  {store.spriteSheets[type] ? (
                    <img
                      src={store.spriteSheets[type]!.imageUrl}
                      alt={type}
                      className="w-full rounded-lg"
                      style={{ imageRendering: "pixelated" }}
                    />
                  ) : (
                    <div className="aspect-square bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-600">
                      Not generated
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => store.setStep(2)}
                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={extractAllFrames}
                className="flex-1 py-3 bg-gradient-to-r from-fuchsia-600 to-cyan-500 rounded-xl font-bold hover:from-fuchsia-500 hover:to-cyan-400 transition-all"
              >
                Extract Frames (2×2 Grid) ✂️
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Preview Animation */}
        {store.currentStep === 4 && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              Preview Animation
            </h2>

            <div className="grid grid-cols-2 gap-8 mb-8">
              {/* Animation preview */}
              <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
                <div className="flex gap-2 mb-4">
                  {(["walk", "jump", "attack", "idle"] as SpriteType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => { setPreviewType(type); setPreviewFrame(0); }}
                      className={`px-3 py-1 rounded-lg text-sm capitalize ${
                        previewType === type
                          ? "bg-cyan-500 text-black"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="aspect-square bg-[#1a1a2e] rounded-lg flex items-center justify-center relative overflow-hidden">
                  {getCurrentFrames()[previewFrame] && (
                    <img
                      src={getCurrentFrames()[previewFrame].dataUrl}
                      alt="Preview"
                      className="max-h-[80%] max-w-[80%] object-contain"
                      style={{ imageRendering: "pixelated" }}
                    />
                  )}
                </div>

                <div className="flex items-center gap-4 mt-4">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-4 py-2 bg-cyan-500 text-black rounded-lg font-bold"
                  >
                    {isPlaying ? "⏸ Pause" : "▶ Play"}
                  </button>
                  <span className="text-zinc-400">
                    Frame {previewFrame + 1} / {getCurrentFrames().length}
                  </span>
                </div>
              </div>

              {/* Frame grid */}
              <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4 text-cyan-400 capitalize">{previewType} Frames</h3>
                <div className="grid grid-cols-2 gap-4">
                  {getCurrentFrames().map((frame, idx) => (
                    <div
                      key={idx}
                      onClick={() => { setPreviewFrame(idx); setIsPlaying(false); }}
                      className={`aspect-square bg-[#1a1a2e] rounded-lg flex items-center justify-center cursor-pointer border-2 ${
                        previewFrame === idx ? "border-cyan-500" : "border-transparent"
                      }`}
                    >
                      <img
                        src={frame.dataUrl}
                        alt={`Frame ${idx + 1}`}
                        className="max-h-[80%] max-w-[80%] object-contain"
                        style={{ imageRendering: "pixelated" }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => store.setStep(3)}
                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => store.setStep(5)}
                className="flex-1 py-3 bg-gradient-to-r from-fuchsia-600 to-cyan-500 rounded-xl font-bold hover:from-fuchsia-500 hover:to-cyan-400 transition-all"
              >
                Adjust Settings →
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Adjust Settings */}
        {store.currentStep === 5 && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              Animation Settings
            </h2>

            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 mb-8">
              <div className="mb-6">
                <label className="block text-sm font-bold text-cyan-400 mb-2">
                  Animation Speed (FPS)
                </label>
                <input
                  type="range"
                  min="2"
                  max="24"
                  value={store.fps}
                  onChange={(e) => store.setFps(parseInt(e.target.value))}
                  className="w-full accent-cyan-500"
                />
                <div className="flex justify-between text-sm text-zinc-500 mt-1">
                  <span>Slow (2)</span>
                  <span className="text-cyan-400 font-bold">{store.fps} FPS</span>
                  <span>Fast (24)</span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {(["walk", "jump", "attack", "idle"] as SpriteType[]).map((type) => {
                  const frames = store[`${type}Frames`] as Frame[];
                  return (
                    <div key={type} className="text-center">
                      <p className="text-xs text-zinc-500 capitalize mb-1">{type}</p>
                      <p className="text-lg font-bold text-cyan-400">{frames.length}</p>
                      <p className="text-xs text-zinc-600">frames</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => store.setStep(4)}
                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => store.setStep(6)}
                className="flex-1 py-3 bg-gradient-to-r from-fuchsia-600 to-cyan-500 rounded-xl font-bold hover:from-fuchsia-500 hover:to-cyan-400 transition-all"
              >
                Launch Sandbox 🎮
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Sandbox */}
        {store.currentStep === 6 && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-4 bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              Play Your Character!
            </h2>
            <p className="text-center text-zinc-500 mb-8">
              Use <span className="text-cyan-400 font-mono">A/D</span> or <span className="text-cyan-400 font-mono">←/→</span> to move, 
              <span className="text-cyan-400 font-mono"> W/↑</span> to jump, 
              <span className="text-cyan-400 font-mono"> J</span> to attack
            </p>

            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 mb-8">
              <PixiSandbox
                walkFrames={store.walkFrames}
                jumpFrames={store.jumpFrames}
                attackFrames={store.attackFrames}
                idleFrames={store.idleFrames}
                fps={store.fps}
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => store.setStep(5)}
                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={store.reset}
                className="flex-1 py-3 bg-gradient-to-r from-fuchsia-600 to-cyan-500 rounded-xl font-bold hover:from-fuchsia-500 hover:to-cyan-400 transition-all"
              >
                Create Another Character ✨
              </button>
            </div>
        </div>
        )}
      </main>
    </div>
  );
}
