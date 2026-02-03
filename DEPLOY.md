# PixelForge Deployment Guide

This project is split into two deployable components:

```
pixelforge/
├── backend/    → Deploy to Railway
├── frontend/   → Deploy to Vercel
```

---

## 1. Deploy Backend to Railway

### Step 1: Create Railway Project
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repo and set **Root Directory** to `backend`

### Step 2: Add Environment Variables
In Railway dashboard → Variables:

```
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
FRONTEND_URL=https://your-frontend.vercel.app
PORT=3001
```

### Step 3: Deploy
Railway will auto-deploy using the Dockerfile. Note your backend URL:
```
https://your-app-name.railway.app
```

---

## 2. Deploy Frontend to Vercel

### Step 1: Import to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project" → Import from GitHub
3. Select your repo
4. Set **Root Directory** to `frontend`

### Step 2: Add Environment Variables
In Vercel dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

### Step 3: Deploy
Vercel will auto-build and deploy. Your frontend URL:
```
https://your-app-name.vercel.app
```

---

## 3. Update CORS

After both are deployed, update Railway with the Vercel URL:

```
FRONTEND_URL=https://your-app-name.vercel.app
```

---

## Local Development

### Backend
```bash
cd backend
npm install
cp env.example .env
# Add your GOOGLE_GENERATIVE_AI_API_KEY to .env
npm run dev
```
Backend runs at http://localhost:3001

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at http://localhost:3000
It will automatically use http://localhost:3001 as the API URL in dev.

---

## Architecture

```
┌─────────────────┐     HTTPS      ┌─────────────────┐
│                 │───────────────▶│                 │
│   Vercel        │                │   Railway       │
│   (Frontend)    │                │   (Backend)     │
│                 │◀───────────────│                 │
│   Next.js       │     JSON       │   Express       │
│   React         │                │   Gemini API    │
│   Tailwind      │                │   Jimp          │
│                 │                │                 │
└─────────────────┘                └─────────────────┘
        │                                  │
        │                                  │
        ▼                                  ▼
   Static Assets              Gemini 3 Pro Image API
   (no secrets)                    (with API key)
```

## Security

- **API Key** is only on Railway (backend), never exposed to browser
- **CORS** restricts backend access to your Vercel domain
- **No secrets** in frontend code or environment
