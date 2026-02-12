/**
 * PixelForge Backend API Server
 * Express server with Gemini-powered sprite generation
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { generateCharacter } from './routes/generate-character.js';
import { generateSpriteSheet } from './routes/generate-sprite-sheet.js';
import { editCharacter } from './routes/edit-character.js';
import { editSpriteSheet } from './routes/edit-sprite-sheet.js';
import { saveSprite } from './routes/save-sprite.js';
import { gallery } from './routes/gallery.js';
import { getSprite } from './routes/sprite.js';
import { proxyImage } from './routes/proxy-image.js';
import { initDb } from './lib/db.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// Rate Limiting - 200 generations per day
// ============================================
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || '200', 10);

interface RateLimitState {
  count: number;
  resetAt: number;
}

let rateLimitState: RateLimitState = {
  count: 0,
  resetAt: getNextMidnight()
};

function getNextMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(24, 0, 0, 0);
  return tomorrow.getTime();
}

function checkAndResetLimit(): void {
  const now = Date.now();
  if (now >= rateLimitState.resetAt) {
    console.log(`[RateLimit] Resetting daily counter. Previous count: ${rateLimitState.count}`);
    rateLimitState = {
      count: 0,
      resetAt: getNextMidnight()
    };
  }
}

function rateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  checkAndResetLimit();
  
  if (rateLimitState.count >= DAILY_LIMIT) {
    const hoursUntilReset = Math.ceil((rateLimitState.resetAt - Date.now()) / (1000 * 60 * 60));
    console.log(`[RateLimit] BLOCKED - Daily limit reached (${rateLimitState.count}/${DAILY_LIMIT})`);
    return res.status(429).json({ 
      error: `Daily generation limit reached (${DAILY_LIMIT}/day). Resets in ~${hoursUntilReset} hours.`,
      limit: DAILY_LIMIT,
      remaining: 0,
      resetsIn: hoursUntilReset
    });
  }
  
  // Increment count BEFORE processing (so parallel requests are counted)
  rateLimitState.count++;
  console.log(`[RateLimit] Generation ${rateLimitState.count}/${DAILY_LIMIT}`);
  
  next();
}

// ============================================
// Middleware
// ============================================
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// Health check (no rate limit)
app.get('/health', (req, res) => {
  checkAndResetLimit();
  res.json({ 
    status: 'ok', 
    service: 'pixelforge-api',
    rateLimit: {
      used: rateLimitState.count,
      limit: DAILY_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - rateLimitState.count)
    }
  });
});

// Rate limit status endpoint
app.get('/api/rate-limit', (req, res) => {
  checkAndResetLimit();
  const hoursUntilReset = Math.ceil((rateLimitState.resetAt - Date.now()) / (1000 * 60 * 60));
  res.json({
    used: rateLimitState.count,
    limit: DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - rateLimitState.count),
    resetsInHours: hoursUntilReset
  });
});

// API Routes (with rate limiting)
app.post('/api/generate-character', rateLimitMiddleware, generateCharacter);
app.post('/api/generate-sprite-sheet', rateLimitMiddleware, generateSpriteSheet);
app.post('/api/edit-character', rateLimitMiddleware, editCharacter);
app.post('/api/edit-sprite-sheet', rateLimitMiddleware, editSpriteSheet);

// Gallery routes (save is rate limited, read is public)
app.post('/api/save-sprite', rateLimitMiddleware, saveSprite);
app.get('/api/gallery', gallery);
app.get('/api/sprite/:id', getSprite);
app.get('/api/proxy-image', proxyImage);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🎮 PixelForge API running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Rate limit: ${DAILY_LIMIT} generations/day`);

  // Initialize database
  if (process.env.DATABASE_URL) {
    try {
      await initDb();
    } catch (err) {
      console.error("Failed to initialize database:", err);
    }
  }
});

export default app;
