'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Maximize2, Volume2, VolumeX } from 'lucide-react';
import { useStore } from '@/store/useStore';

export function GamePreview() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { gameCode, isGenerating } = useStore();

  // Generate the HTML that will run the game
  const generateGameHTML = (code: string) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PixelForge Game</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      background: #0d0d12; 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      min-height: 100vh;
      overflow: hidden;
    }
    canvas { 
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      max-width: 100%;
      max-height: 100vh;
    }
  </style>
  <script src="https://unpkg.com/kaplay@3001/dist/kaplay.js"></script>
</head>
<body>
  <script>
    try {
      ${code}
    } catch (e) {
      document.body.innerHTML = '<div style="color: #ff6b35; padding: 20px; font-family: monospace;">' + 
        '<h2>Game Error</h2><pre>' + e.message + '</pre></div>';
      console.error(e);
    }
  </script>
</body>
</html>`;
  };

  const handleRestart = () => {
    if (iframeRef.current && gameCode) {
      const html = generateGameHTML(gameCode);
      iframeRef.current.srcdoc = html;
      setIsPlaying(true);
    }
  };

  const handleFullscreen = () => {
    if (iframeRef.current) {
      if (!isFullscreen) {
        iframeRef.current.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
      setIsFullscreen(!isFullscreen);
    }
  };

  useEffect(() => {
    if (gameCode && iframeRef.current) {
      const html = generateGameHTML(gameCode);
      iframeRef.current.srcdoc = html;
      setIsPlaying(true);
    }
  }, [gameCode]);

  // Placeholder when no game
  if (!gameCode) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#0d0d12] text-center p-8">
        {isGenerating ? (
          <div className="space-y-4">
            <div className="w-16 h-16 border-4 border-[#00fff5]/30 border-t-[#00fff5] rounded-full animate-spin mx-auto" />
            <p className="text-[#a0a0b0] text-sm">Generating your game...</p>
            <div className="flex items-center justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-[#00fff5] rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pixel art placeholder */}
            <div className="relative">
              <div className="w-32 h-32 mx-auto grid grid-cols-8 gap-0.5 opacity-30">
                {Array.from({ length: 64 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square bg-[#00fff5]"
                    style={{
                      opacity: Math.random() > 0.6 ? 0.8 : 0.2,
                    }}
                  />
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Play className="w-12 h-12 text-[#606070]" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-pixel text-xs text-[#606070]">NO GAME LOADED</h3>
              <p className="text-[#606070] text-sm max-w-xs">
                Describe your game idea in the chat to generate a playable pixel game
              </p>
            </div>

            {/* Retro decorative elements */}
            <div className="flex items-center justify-center gap-4 text-[#2a2a3e]">
              <span className="font-pixel text-[8px]">INSERT COIN</span>
              <span className="w-1 h-1 bg-[#2a2a3e] rounded-full animate-pulse" />
              <span className="font-pixel text-[8px]">PRESS START</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0d0d12]">
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a3e] bg-[#12121a]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-[#39ff14] rounded-full animate-pulse" />
          <span className="text-xs text-[#a0a0b0]">Game Running</span>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={handleRestart}
            className="p-2 hover:bg-[#1a1a2e] rounded-lg transition-colors text-[#a0a0b0] hover:text-[#00fff5]"
            title="Restart"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 hover:bg-[#1a1a2e] rounded-lg transition-colors text-[#a0a0b0] hover:text-[#00fff5]"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={handleFullscreen}
            className="p-2 hover:bg-[#1a1a2e] rounded-lg transition-colors text-[#a0a0b0] hover:text-[#00fff5]"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Game Canvas */}
      <div className="flex-1 relative">
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin"
          title="Game Preview"
        />
        
        {/* Scanlines overlay */}
        <div className="absolute inset-0 pointer-events-none scanlines opacity-20" />
      </div>

      {/* Instructions */}
      <div className="px-4 py-2 border-t border-[#2a2a3e] bg-[#12121a]">
        <p className="text-[10px] text-[#606070] text-center font-pixel">
          ARROW KEYS TO MOVE • SPACE TO JUMP/ACTION
        </p>
      </div>
    </div>
  );
}

