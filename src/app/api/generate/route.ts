import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

const SYSTEM_PROMPT = `You are PixelForge, an AI that generates retro pixel games using KAPLAY (the successor to Kaboom.js).

IMPORTANT RULES:
1. Generate ONLY valid JavaScript code that uses KAPLAY
2. Do NOT include any markdown, explanations, or comments outside the code
3. The code must be self-contained and runnable
4. Use simple pixel art style - no external assets, use kaplay's built-in shapes
5. Keep games simple but fun - under 150 lines of code
6. Always include basic controls (arrow keys, space)
7. Include a simple scoring system when appropriate
8. Add a restart mechanism (press R to restart or auto-restart on game over)

KAPLAY BASICS:
- Initialize with: kaplay({ background: "#0d0d12", width: 640, height: 480, scale: 1, crisp: true })
- Create sprites with rect(), circle(), or polygon()
- Use add() to create game objects with components
- Common components: pos(), sprite(), area(), body(), anchor()
- For physics: body() for gravity, area() for collisions
- Controls: onKeyDown(), onKeyPress(), isKeyDown()
- Scenes: scene("name", () => {}), go("name")

EXAMPLE STRUCTURE:
\`\`\`javascript
kaplay({
  background: "#1a1a2e",
  width: 640,
  height: 480,
  crisp: true,
});

// Load sprites using shapes
loadSprite("player", "data:image/png;base64,..."); // Or use rect/circle

scene("game", () => {
  // Game logic here
  const player = add([
    rect(32, 32),
    pos(center()),
    area(),
    body(),
    anchor("center"),
    color(0, 255, 245),
    "player"
  ]);
  
  // Controls
  onKeyDown("left", () => player.move(-200, 0));
  onKeyDown("right", () => player.move(200, 0));
  
  // Collision handling
  player.onCollide("enemy", () => {
    go("gameover");
  });
});

scene("gameover", () => {
  add([
    text("Game Over\\nPress R to restart", { size: 24 }),
    pos(center()),
    anchor("center"),
  ]);
  onKeyPress("r", () => go("game"));
});

go("game");
\`\`\`

Generate creative, fun games based on user descriptions. Output ONLY the JavaScript code, nothing else.`;

export async function POST(request: NextRequest) {
  try {
    const { prompt, genre } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const userPrompt = genre 
      ? `Create a ${genre} game: ${prompt}`
      : `Create a game: ${prompt}`;

    // Use Gemini 3 Flash Preview for fast code generation
    const { text } = await generateText({
      model: google('gemini-3-flash-preview'),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 4096,
      temperature: 0.7,
    });

    // Clean up the response - remove markdown code blocks if present
    let code = text.trim();
    if (code.startsWith('```')) {
      code = code.replace(/^```(?:javascript|js)?\n?/, '').replace(/\n?```$/, '');
    }

    return NextResponse.json({
      success: true,
      code,
      explanation: '🎮 Your game is ready! Use arrow keys to move and space to jump/action. Press R to restart if there\'s a game over.',
    });

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate game' 
      },
      { status: 500 }
    );
  }
}

