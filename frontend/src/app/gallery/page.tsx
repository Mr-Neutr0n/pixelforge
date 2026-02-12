"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchGallery } from "@/lib/api";
import { GallerySprite } from "@/types";

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

export default function GalleryPage() {
  const [sprites, setSprites] = useState<GallerySprite[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSprites = useCallback(async (pageNum: number, append: boolean = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await fetchGallery(pageNum, 20);
      if (append) {
        setSprites((prev) => [...prev, ...data.sprites]);
      } else {
        setSprites(data.sprites);
      }
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load gallery";
      setError(message);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadSprites(1);
  }, [loadSprites]);

  const handleLoadMore = () => {
    if (page < totalPages && !isLoadingMore) {
      loadSprites(page + 1, true);
    }
  };

  return (
    <div className="min-h-screen bg-grid relative overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-default)] bg-[var(--bg-void)]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
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
              className="text-sm font-semibold tracking-wide"
              style={{ color: "var(--text-primary)", fontFamily: "var(--font-pixel)" }}
            >
              PIXELFORGE
            </span>
          </a>
          <a
            href="/"
            className="btn-arcade text-xs"
          >
            Create
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Subtitle */}
        <div className="text-center mb-8 sm:mb-12 animate-fade-up">
          <h1
            className="text-sm sm:text-2xl font-bold text-glow mb-3"
          >
            Community Gallery
          </h1>
          <p
            className="text-xs sm:text-sm"
            style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
          >
            Explore pixel characters created by the community
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="max-w-xl mx-auto mb-8 glass-card p-4 border-[var(--error)]/30 bg-[var(--error)]/5">
            <div className="flex items-center gap-3">
              <span style={{ color: "var(--error)" }}>!</span>
              <p className="text-sm flex-1" style={{ color: "var(--error)" }}>
                {error}
              </p>
              <button
                onClick={() => loadSprites(1)}
                className="btn-ghost text-xs"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 animate-fade-up">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass-card overflow-hidden">
                <div className="aspect-square bg-[var(--bg-secondary)] animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-[var(--bg-secondary)] rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-[var(--bg-secondary)] rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && sprites.length === 0 && (
          <div className="text-center py-20 animate-fade-up">
            <p
              className="text-sm mb-6"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}
            >
              No sprites yet. Be the first!
            </p>
            <a href="/" className="btn-arcade">
              Create Character
            </a>
          </div>
        )}

        {/* Gallery Grid */}
        {!isLoading && sprites.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 animate-fade-up">
              {sprites.map((sprite) => (
                <a
                  key={sprite.id}
                  href={`/sprite/${sprite.id}`}
                  className="glass-card block overflow-hidden group cursor-pointer transition-all hover:border-[var(--accent)]"
                >
                  <div className="aspect-square relative bg-[var(--bg-secondary)] flex items-center justify-center">
                    <img
                      src={sprite.characterImageUrl}
                      alt={sprite.prompt}
                      className="pixel-art w-3/4 h-3/4 object-contain"
                    />
                  </div>
                  <div className="p-3">
                    <p
                      className="text-xs truncate"
                      style={{
                        color: "var(--text-primary)",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {sprite.prompt}
                    </p>
                    <p
                      className="text-xs mt-1"
                      style={{
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {timeAgo(sprite.createdAt)}
                    </p>
                  </div>
                </a>
              ))}
            </div>

            {/* Load More */}
            {page < totalPages && (
              <div className="text-center mt-8 sm:mt-12 animate-fade-up">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="btn-arcade"
                >
                  {isLoadingMore ? (
                    <span className="flex items-center gap-2">
                      <span className="spinner w-4 h-4" />
                      Loading...
                    </span>
                  ) : (
                    "Load More"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--border-default)] mt-12 sm:mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 text-center">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Powered by Gemini 3 Pro · Built with Next.js
          </p>
        </div>
      </footer>
    </div>
  );
}
