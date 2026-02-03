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

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'pixelforge-api' });
});

// API Routes
app.post('/api/generate-character', generateCharacter);
app.post('/api/generate-sprite-sheet', generateSpriteSheet);
app.post('/api/edit-character', editCharacter);
app.post('/api/edit-sprite-sheet', editSpriteSheet);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎮 PixelForge API running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});

export default app;
