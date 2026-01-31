"use client";

import { useEffect, useRef, useCallback } from "react";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Frame {
  dataUrl: string;
  width: number;
  height: number;
  contentBounds: BoundingBox;
}

interface PixiSandboxProps {
  walkFrames: Frame[];
  jumpFrames: Frame[];
  attackFrames: Frame[];
  idleFrames: Frame[];
  fps: number;
}

// Default parallax layers
const DEFAULT_PARALLAX_LAYERS = [
  { url: "https://raw.githubusercontent.com/meiliizzsuju/game-parallax-backgrounds/main/assets/layer-1.png", speed: 0 },
  { url: "https://raw.githubusercontent.com/meiliizzsuju/game-parallax-backgrounds/main/assets/layer-2.png", speed: 0.1 },
  { url: "https://raw.githubusercontent.com/meiliizzsuju/game-parallax-backgrounds/main/assets/layer-3.png", speed: 0.3 },
  { url: "https://raw.githubusercontent.com/meiliizzsuju/game-parallax-backgrounds/main/assets/layer-4.png", speed: 0.5 },
  { url: "https://raw.githubusercontent.com/meiliizzsuju/game-parallax-backgrounds/main/assets/layer-5.png", speed: 0.7 },
];

const JUMP_VELOCITY = -12;
const GRAVITY = 0.6;
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 400;
const GROUND_Y = 340;
const MOVE_SPEED = 3;

export default function PixiSandbox({ walkFrames, jumpFrames, attackFrames, idleFrames, fps }: PixiSandboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const characterState = useRef({
    x: 400,
    y: 0,
    velocityY: 0,
    direction: "right" as "left" | "right",
    isWalking: false,
    isJumping: false,
    isAttacking: false,
    walkFrameIndex: 0,
    jumpFrameIndex: 0,
    attackFrameIndex: 0,
    idleFrameIndex: 0,
    frameTime: 0,
    jumpFrameTime: 0,
    attackFrameTime: 0,
    idleFrameTime: 0,
  });
  const keysPressed = useRef<Set<string>>(new Set());
  const animationRef = useRef<number>(0);
  const walkImagesRef = useRef<HTMLImageElement[]>([]);
  const jumpImagesRef = useRef<HTMLImageElement[]>([]);
  const attackImagesRef = useRef<HTMLImageElement[]>([]);
  const idleImagesRef = useRef<HTMLImageElement[]>([]);
  const walkFrameDataRef = useRef<Frame[]>([]);
  const jumpFrameDataRef = useRef<Frame[]>([]);
  const attackFrameDataRef = useRef<Frame[]>([]);
  const idleFrameDataRef = useRef<Frame[]>([]);
  const bgLayersRef = useRef<HTMLImageElement[]>([]);
  const bgLoadedRef = useRef(false);
  const cameraX = useRef(0);
  const timeRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const fpsRef = useRef(fps);

  fpsRef.current = fps;

  // Load background layers
  useEffect(() => {
    const loadLayers = async () => {
      const layers: HTMLImageElement[] = [];
      for (const layer of DEFAULT_PARALLAX_LAYERS) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = layer.url;
        });
        layers.push(img);
      }
      bgLayersRef.current = layers;
      bgLoadedRef.current = layers.length === DEFAULT_PARALLAX_LAYERS.length;
    };
    loadLayers();
  }, []);

  // Load sprite frames
  useEffect(() => {
    const loadImages = async (frames: Frame[], imagesRef: React.MutableRefObject<HTMLImageElement[]>, dataRef: React.MutableRefObject<Frame[]>) => {
      const images: HTMLImageElement[] = [];
      for (const frame of frames) {
        const img = new Image();
        img.src = frame.dataUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        images.push(img);
      }
      imagesRef.current = images;
      dataRef.current = frames;
    };

    if (walkFrames.length > 0) loadImages(walkFrames, walkImagesRef, walkFrameDataRef);
    if (jumpFrames.length > 0) loadImages(jumpFrames, jumpImagesRef, jumpFrameDataRef);
    if (attackFrames.length > 0) loadImages(attackFrames, attackImagesRef, attackFrameDataRef);
    if (idleFrames.length > 0) loadImages(idleFrames, idleImagesRef, idleFrameDataRef);
  }, [walkFrames, jumpFrames, attackFrames, idleFrames]);

  // Game loop
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTimeRef.current) / 1000;
    lastTimeRef.current = currentTime;

    const state = characterState.current;
    const walkImages = walkImagesRef.current;
    const jumpImages = jumpImagesRef.current;
    const attackImages = attackImagesRef.current;
    const idleImages = idleImagesRef.current;
    const bgLayers = bgLayersRef.current;
    
    timeRef.current += deltaTime;

    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const movingHorizontally = keysPressed.current.has("right") || keysPressed.current.has("left");
    state.isWalking = movingHorizontally && !state.isJumping && !state.isAttacking;

    const canMove = !state.isAttacking || state.isJumping;
    const moveAmount = MOVE_SPEED * deltaTime * 60;
    if (canMove) {
      if (keysPressed.current.has("right")) {
        state.direction = "right";
        state.x += moveAmount;
        cameraX.current += moveAmount;
      }
      if (keysPressed.current.has("left")) {
        state.direction = "left";
        state.x -= moveAmount;
        cameraX.current -= moveAmount;
      }
    }

    state.x = Math.max(50, Math.min(WORLD_WIDTH - 50, state.x));

    if (state.isJumping) {
      const physicsScale = deltaTime * 60;
      state.velocityY += GRAVITY * physicsScale;
      state.y += state.velocityY * physicsScale;

      if (state.y >= 0) {
        state.y = 0;
        state.velocityY = 0;
        state.isJumping = false;
        state.jumpFrameIndex = 0;
      }
    }

    // Draw background
    if (bgLoadedRef.current && bgLayers.length > 0) {
      bgLayers.forEach((layer, index) => {
        if (layer.complete && layer.naturalWidth > 0) {
          const speed = DEFAULT_PARALLAX_LAYERS[index].speed;
          const layerOffset = (cameraX.current * speed) % layer.naturalWidth;
          const scale = WORLD_HEIGHT / layer.naturalHeight;
          const scaledWidth = layer.naturalWidth * scale;
          let startX = -((layerOffset * scale) % scaledWidth);
          if (startX > 0) startX -= scaledWidth;
          for (let x = startX; x < WORLD_WIDTH; x += scaledWidth) {
            ctx.drawImage(layer, x, 0, scaledWidth, WORLD_HEIGHT);
          }
        }
      });
    } else {
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    }

    const currentFps = fpsRef.current;

    // Animation states
    if (state.isWalking && walkImages.length > 0) {
      state.frameTime += deltaTime;
      if (state.frameTime >= 1 / currentFps) {
        state.frameTime -= 1 / currentFps;
        state.walkFrameIndex = (state.walkFrameIndex + 1) % walkImages.length;
      }
    }

    if (!state.isWalking && !state.isJumping && !state.isAttacking && idleImages.length > 0) {
      state.idleFrameTime += deltaTime;
      if (state.idleFrameTime >= 1 / (currentFps * 0.5)) {
        state.idleFrameTime -= 1 / (currentFps * 0.5);
        state.idleFrameIndex = (state.idleFrameIndex + 1) % idleImages.length;
      }
    }

    if (state.isJumping && jumpImages.length > 0 && !state.isAttacking) {
      state.jumpFrameTime += deltaTime;
      if (state.jumpFrameTime >= 1 / (currentFps * 0.8)) {
        state.jumpFrameTime -= 1 / (currentFps * 0.8);
        if (state.jumpFrameIndex < jumpImages.length - 1) {
          state.jumpFrameIndex++;
        }
      }
    }

    if (state.isAttacking && attackImages.length > 0) {
      state.attackFrameTime += deltaTime;
      if (state.attackFrameTime >= 1 / (currentFps * 1.2)) {
        state.attackFrameTime -= 1 / (currentFps * 1.2);
        state.attackFrameIndex++;
        if (state.attackFrameIndex >= attackImages.length) {
          state.isAttacking = false;
          state.attackFrameIndex = 0;
        }
      }
    }

    // Get current sprite
    let currentImg: HTMLImageElement | null = null;
    let currentFrameData: Frame | null = null;
    
    if (state.isAttacking && attackImages.length > 0) {
      const idx = Math.min(state.attackFrameIndex, attackImages.length - 1);
      currentImg = attackImages[idx];
      currentFrameData = attackFrameDataRef.current[idx] || null;
    } else if (state.isJumping && jumpImages.length > 0) {
      currentImg = jumpImages[state.jumpFrameIndex];
      currentFrameData = jumpFrameDataRef.current[state.jumpFrameIndex] || null;
    } else if (state.isWalking && walkImages.length > 0) {
      currentImg = walkImages[state.walkFrameIndex];
      currentFrameData = walkFrameDataRef.current[state.walkFrameIndex] || null;
    } else if (idleImages.length > 0) {
      currentImg = idleImages[state.idleFrameIndex];
      currentFrameData = idleFrameDataRef.current[state.idleFrameIndex] || null;
    } else if (walkImages.length > 0) {
      currentImg = walkImages[0];
      currentFrameData = walkFrameDataRef.current[0] || null;
    }

    // Draw character
    if (currentImg && currentFrameData) {
      const targetContentHeight = 80;
      const referenceFrameData = walkFrameDataRef.current.length > 0 ? walkFrameDataRef.current[0] : currentFrameData;
      const referenceContentHeight = referenceFrameData.contentBounds.height;
      const baseScale = targetContentHeight / referenceContentHeight;
      const isAttackFrame = state.isAttacking && attackImages.length > 0;
      const scale = baseScale * (isAttackFrame ? 1.35 : 1.0);
      
      const drawWidth = currentImg.width * scale;
      const drawHeight = currentImg.height * scale;
      const contentBounds = currentFrameData.contentBounds;
      const feetY = (contentBounds.y + contentBounds.height) * scale;
      const bob = state.isWalking && !state.isJumping && !state.isAttacking ? Math.sin(timeRef.current * 18) * 2 : 0;
      const drawY = GROUND_Y - feetY + bob + state.y;
      const contentCenterX = (contentBounds.x + contentBounds.width / 2) * scale;
      const drawX = state.x - contentCenterX;

      // Shadow
      const shadowScale = Math.max(0.3, 1 + state.y / 100);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * shadowScale})`;
      ctx.beginPath();
      ctx.ellipse(state.x, GROUND_Y + 2, (contentBounds.width * scale / 3) * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      if (state.direction === "left") {
        ctx.translate(state.x * 2, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(currentImg, state.x - contentCenterX, drawY, drawWidth, drawHeight);
      } else {
        ctx.drawImage(currentImg, drawX, drawY, drawWidth, drawHeight);
      }
      ctx.restore();
    }

    // Vignette
    const vignette = ctx.createRadialGradient(
      WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_HEIGHT * 0.4,
      WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_HEIGHT
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.35)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    animationRef.current = requestAnimationFrame(gameLoop);
  }, []);

  // Initialize
  useEffect(() => {
    if (!containerRef.current || walkFrames.length === 0) return;

    containerRef.current.innerHTML = "";
    
    const canvas = document.createElement("canvas");
    canvas.width = WORLD_WIDTH;
    canvas.height = WORLD_HEIGHT;
    canvas.style.display = "block";
    canvas.style.borderRadius = "8px";
    containerRef.current.appendChild(canvas);
    canvasRef.current = canvas;

    characterState.current.x = WORLD_WIDTH / 2;
    characterState.current.y = 0;
    cameraX.current = 0;
    lastTimeRef.current = performance.now();

    animationRef.current = requestAnimationFrame(gameLoop);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        keysPressed.current.add("right");
      }
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        keysPressed.current.add("left");
      }
      if ((e.key === "w" || e.key === "W" || e.key === "ArrowUp") && !characterState.current.isJumping && !characterState.current.isAttacking) {
        characterState.current.isJumping = true;
        characterState.current.velocityY = JUMP_VELOCITY;
        characterState.current.jumpFrameIndex = 0;
      }
      if ((e.key === "j" || e.key === "J") && !characterState.current.isAttacking) {
        characterState.current.isAttacking = true;
        characterState.current.attackFrameIndex = 0;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        keysPressed.current.delete("right");
      }
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        keysPressed.current.delete("left");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(animationRef.current);
    };
  }, [walkFrames, gameLoop]);

  return (
    <div className="pixi-sandbox-container">
      <div ref={containerRef} className="pixi-canvas-wrapper" />
    </div>
  );
}
