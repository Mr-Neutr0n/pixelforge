"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { fetchSprite } from "@/lib/api";
import { extractFramesFromSheet } from "@/lib/frames";
import { Frame, SpriteType } from "@/types";
import dynamic from "next/dynamic";

const PixiSandbox = dynamic(() => import("@/components/PixiSandbox"), {
  ssr: false,
});

function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? "s" : ""} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years !== 1 ? "s" : ""} ago`;
}

interface SpriteData {
  id: string;
  prompt: string;
  characterImageUrl: string;
  spriteSheets: Record<string, { url: string }>;
  createdAt: string;
}

function AnimationPreview({
  imageUrl,
  label,
}: {
  imageUrl: string;
  label: string;
}) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    extractFramesFromSheet(imageUrl, 2, 2).then(setFrames);
  }, [imageUrl]);

  useEffect(() => {
    if (frames.length === 0) return;
    const interval = setInterval(() => {
      setCurrentFrame((f) => (f + 1) % frames.length);
    }, 125); // 8fps
    return () => clearInterval(interval);
  }, [frames]);

  if (frames.length === 0)
    return (
      <div className="aspect-square bg-[var(--bg-secondary)] animate-pulse rounded-lg" />
    );

  return (
    <div className="glass-card p-3 text-center">
      <p
        className="text-xs uppercase tracking-wider mb-2"
        style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}
      >
        {label}
      </p>
      <div className="aspect-square bg-[var(--bg-secondary)] rounded flex items-center justify-center">
        <img
          src={frames[currentFrame].dataUrl}
          alt={label}
          className="pixel-art w-3/4 h-3/4 object-contain"
        />
      </div>
    </div>
  );
}

export default function SpriteDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [sprite, setSprite] = useState<SpriteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Sandbox state
  const [showSandbox, setShowSandbox] = useState(false);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [walkFrames, setWalkFrames] = useState<Frame[]>([]);
  const [jumpFrames, setJumpFrames] = useState<Frame[]>([]);
  const [attackFrames, setAttackFrames] = useState<Frame[]>([]);
  const [idleFrames, setIdleFrames] = useState<Frame[]>([]);

  // Toast state
  const [toast, setToast] = useState<string | null>(null);

  const loadSprite = useCallback(async () => {
    setIsLoading(true);
    setNotFound(false);
    try {
      const data = await fetchSprite(id);
      setSprite(data);
    } catch {
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) loadSprite();
  }, [id, loadSprite]);

  // Copy link handler
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast("Link copied!");
      setTimeout(() => setToast(null), 2000);
    } catch {
      setToast("Failed to copy link");
      setTimeout(() => setToast(null), 2000);
    }
  };

  // Play handler — extract all frames then show sandbox
  const handlePlay = async () => {
    if (!sprite) return;
    setSandboxLoading(true);

    try {
      const types: SpriteType[] = ["walk", "jump", "attack", "idle"];
      const setters = {
        walk: setWalkFrames,
        jump: setJumpFrames,
        attack: setAttackFrames,
        idle: setIdleFrames,
      };

      await Promise.all(
        types.map(async (type) => {
          const sheet = sprite.spriteSheets[type];
          if (sheet?.url) {
            const frames = await extractFramesFromSheet(sheet.url, 2, 2);
            setters[type](frames);
          }
        })
      );

      setShowSandbox(true);
    } catch {
      setToast("Failed to load animations");
      setTimeout(() => setToast(null), 2000);
    } finally {
      setSandboxLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-grid relative overflow-x-hidden">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-20 right-4 left-4 sm:left-auto sm:right-6 z-[100] px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-up"
          style={{ background: "var(--accent)", color: "var(--bg-void)" }}
        >
          <span className="text-sm font-medium">{toast}</span>
          <button
            onClick={() => setToast(null)}
            className="opacity-60 hover:opacity-100"
          >
            x
          </button>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-default)] bg-[var(--bg-void)]/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <a
            href="/"
            className="flex items-center gap-2 sm:gap-3 min-w-0"
            style={{ textDecoration: "none" }}
          >
            <img
              src="/logo.png"
              alt="PixelForge"
              className="w-9 h-9 sm:w-10 sm:h-10 pixel-art flex-shrink-0"
            />
            <span
              className="hidden sm:inline text-sm font-semibold tracking-wide"
              style={{
                color: "var(--text-primary)",
                fontFamily: "var(--font-pixel)",
              }}
            >
              PIXELFORGE
            </span>
          </a>
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/gallery"
              className="text-xs tracking-wider uppercase opacity-60 hover:opacity-100 transition-opacity"
              style={{
                fontFamily: "var(--font-pixel)",
                color: "var(--text-secondary)",
              }}
            >
              Gallery
            </a>
            <a href="/" className="btn-arcade text-xs">
              Create
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Loading State */}
        {isLoading && (
          <div className="animate-fade-up">
            {/* Skeleton: large character image */}
            <div className="max-w-sm mx-auto mb-6">
              <div className="aspect-square bg-[var(--bg-secondary)] rounded-lg animate-pulse" />
            </div>
            {/* Skeleton: text lines */}
            <div className="max-w-md mx-auto space-y-3 mb-8">
              <div className="h-4 bg-[var(--bg-secondary)] rounded animate-pulse w-3/4 mx-auto" />
              <div className="h-3 bg-[var(--bg-secondary)] rounded animate-pulse w-1/2 mx-auto" />
            </div>
            {/* Skeleton: 4 animation previews */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square bg-[var(--bg-secondary)] rounded-lg animate-pulse"
                />
              ))}
            </div>
          </div>
        )}

        {/* 404 State */}
        {!isLoading && notFound && (
          <div className="text-center py-20 animate-fade-up">
            <h2
              className="text-sm sm:text-lg font-bold mb-4"
              style={{
                color: "var(--text-primary)",
                fontFamily: "var(--font-pixel)",
              }}
            >
              Sprite not found
            </h2>
            <p
              className="text-sm mb-6"
              style={{
                color: "var(--text-muted)",
                fontFamily: "var(--font-body)",
              }}
            >
              This sprite may have been removed or the link is invalid.
            </p>
            <a href="/gallery" className="btn-arcade">
              Back to Gallery
            </a>
          </div>
        )}

        {/* Sprite Detail */}
        {!isLoading && sprite && (
          <div className="animate-fade-up">
            {/* Character Image */}
            <div className="max-w-sm mx-auto mb-6 animate-fade-up delay-1">
              <div className="glass-card p-4">
                <div className="aspect-square bg-[var(--bg-secondary)] rounded-lg flex items-center justify-center">
                  <img
                    src={sprite.characterImageUrl}
                    alt={sprite.prompt}
                    className="pixel-art w-3/4 h-3/4 object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Prompt and Date */}
            <div className="text-center mb-8 animate-fade-up delay-2">
              <p
                className="text-sm sm:text-base mb-2"
                style={{
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {sprite.prompt}
              </p>
              <p
                className="text-xs"
                style={{
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {timeAgo(sprite.createdAt)}
              </p>
            </div>

            {/* Animation Previews */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 animate-fade-up delay-3">
              {(["walk", "jump", "attack", "idle"] as SpriteType[]).map(
                (type) => {
                  const sheet = sprite.spriteSheets[type];
                  if (!sheet?.url) return null;
                  return (
                    <AnimationPreview
                      key={type}
                      imageUrl={sheet.url}
                      label={type}
                    />
                  );
                }
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mb-8 animate-fade-up delay-4">
              <button
                onClick={handlePlay}
                disabled={sandboxLoading || showSandbox}
                className="btn-arcade w-full"
              >
                {sandboxLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="spinner w-4 h-4" />
                    Loading...
                  </span>
                ) : showSandbox ? (
                  "Playing Below"
                ) : (
                  "Play This Character"
                )}
              </button>
              <button onClick={handleCopyLink} className="btn-ghost w-full sm:w-auto">
                Copy Link
              </button>
            </div>

            {/* Sandbox Section */}
            {showSandbox && (
              <div className="mb-8 animate-fade-up">
                <div className="glass-card p-4">
                  <div className="text-center mb-4">
                    <p
                      className="text-xs"
                      style={{
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      <span className="hidden sm:inline">
                        <span className="kbd">A</span>{" "}
                        <span className="kbd">D</span> Move
                        <span className="mx-3">·</span>
                        <span className="kbd">W</span> Jump
                        <span className="mx-3">·</span>
                        <span className="kbd">J</span> Attack
                      </span>
                      <span className="sm:hidden">
                        Use the controls below to play
                      </span>
                    </p>
                  </div>
                  <div className="game-preview rounded-lg overflow-hidden">
                    <PixiSandbox
                      walkFrames={walkFrames}
                      jumpFrames={jumpFrames}
                      attackFrames={attackFrames}
                      idleFrames={idleFrames}
                      fps={8}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Back to Gallery */}
            <div className="text-center animate-fade-up delay-5">
              <a
                href="/gallery"
                className="inline-block text-xs uppercase tracking-wider transition-opacity opacity-60 hover:opacity-100"
                style={{
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-body)",
                }}
              >
                ← Back to Gallery
              </a>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--border-default)] mt-12 sm:mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 text-center">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Powered by Gemini 3 Pro · Built with Next.js
          </p>
        </div>
      </footer>
    </div>
  );
}
