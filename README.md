# 🎮 PixelForge

> **AI-Powered Retro Game Creator** - Describe your game idea, watch it come to life.

![PixelForge](https://img.shields.io/badge/PixelForge-v0.1.0-00fff5?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge)
![KAPLAY](https://img.shields.io/badge/KAPLAY-3001-ff00ff?style=for-the-badge)

## ✨ What is PixelForge?

PixelForge is a web platform where you can talk to an AI agent and create retro pixel-based games through natural conversation. Think **"Lovable for Gaming"** - describe your game idea, and the AI generates playable code instantly.

### Features

- 🤖 **AI-Powered Generation** - Describe your game in plain English
- 🕹️ **Instant Preview** - Play your game immediately in the browser
- 📝 **Code Export** - Download the generated JavaScript code
- 🎨 **Retro Aesthetic** - Beautiful cyberpunk UI with CRT effects
- ⚡ **KAPLAY Engine** - Modern successor to Kaboom.js

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Azure OpenAI resource with a `gpt-image-2` deployment

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/pixelforge.git
cd pixelforge

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your GEMINI_API_KEY

# Run the development server
npm run dev
```

### Environment Variables

Create a `.env.local` file:

```env
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your_api_key_here
AZURE_MODEL_IMAGE=gpt-image-2
```

Keep the Azure API key in the backend environment only. The production setup also requires PostgreSQL and private S3 storage as described in `DEPLOY.md`.

## 🎮 How to Use

1. **Open the app** at `http://localhost:3000`
2. **Describe your game** in the chat (e.g., "Create a platformer where a cat collects fish")
3. **Watch it generate** - The AI creates the game code
4. **Play instantly** - Your game appears in the preview panel
5. **Iterate** - Ask the AI to modify or improve the game

### Example Prompts

- "Make a space shooter where you dodge asteroids"
- "Create a snake game with neon colors"
- "Build a platformer with double jump"
- "Make a breakout clone with power-ups"

## 🏗️ Project Structure

```
pixelforge/
├── src/
│   ├── app/
│   │   ├── api/generate/    # AI generation endpoint
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Main page
│   │   └── globals.css      # Global styles
│   ├── components/
│   │   ├── Header.tsx       # Navigation header
│   │   ├── ChatPanel.tsx    # AI chat interface
│   │   ├── GamePreview.tsx  # Game canvas
│   │   └── CodeEditor.tsx   # Code viewer
│   ├── store/
│   │   └── useStore.ts      # Zustand state management
│   ├── types/
│   │   └── index.ts         # TypeScript types
│   └── lib/                 # Utilities
├── public/
│   ├── sprites/             # Pixel art assets
│   └── sounds/              # Game sounds
└── ...
```

## 🎨 Asset Pipeline (Coming Soon)

PixelForge will integrate with **Nano Banana** for AI-generated pixel art assets:

- Character sprites
- Environment tilesets
- Animation frames
- Consistent art style across all assets

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 15** | React framework with App Router |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Styling |
| **KAPLAY** | 2D game engine (Kaboom.js successor) |
| **Zustand** | State management |
| **Azure OpenAI GPT Image** | Character and sprite generation |
| **Vercel AI SDK** | AI integration |

## 📝 Roadmap

- [x] Basic chat interface
- [x] AI game generation
- [x] Live game preview
- [x] Code export
- [ ] Nano Banana asset integration
- [ ] Game templates
- [ ] Save & share games
- [ ] Multiplayer support
- [ ] Custom sprite upload
- [ ] Sound effects generation

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines first.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Made with 💜 by the PixelForge team</strong><br>
  <sub>Forge your dreams into pixels</sub>
</p>
