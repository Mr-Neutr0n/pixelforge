"""
PixelForge Sprite Pipeline - Nano Banana Test Workflow

Two-stage pipeline:
1. Generate character reference (on chroma green background)
2. Generate sprite sheet from character reference (on chroma green)
3. Post-process: Remove green background

Uses Gemini 3 Pro Image (gemini-3-pro-image-preview) for generation.
"""

import os
import io
import base64
import httpx
import asyncio
from pathlib import Path
from datetime import datetime
from PIL import Image
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
API_KEY = os.getenv("GEMINI_API_KEY")
API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
MODEL = "gemini-3-pro-image-preview"  # Nano Banana Pro

# Chroma green for background removal
CHROMA_GREEN = (0, 255, 0)  # #00FF00
CHROMA_GREEN_HEX = "#00FF00"

# Output directory
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


def color_distance(c1: tuple, c2: tuple) -> float:
    """Calculate Euclidean distance between two RGB colors."""
    return ((c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2) ** 0.5


def remove_green_background(image: Image.Image, tolerance: int = 80) -> Image.Image:
    """
    Remove chroma green background using color distance.
    
    Args:
        image: PIL Image with green background
        tolerance: Color distance threshold (0-441, higher = more aggressive)
    
    Returns:
        PIL Image with transparent background
    """
    if image.mode != "RGBA":
        image = image.convert("RGBA")
    
    pixels = image.load()
    width, height = image.size
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            
            # Calculate distance from pure chroma green
            dist = color_distance((r, g, b), CHROMA_GREEN)
            
            if dist < tolerance:
                pixels[x, y] = (0, 0, 0, 0)
    
    return image


def remove_green_background_advanced(image: Image.Image) -> Image.Image:
    """
    Advanced multi-pass green screen removal.
    
    Pass 1: Remove pure green pixels (tight tolerance)
    Pass 2: Remove near-green pixels (medium tolerance)  
    Pass 3: Flood fill from corners to catch any remaining background
    Pass 4: Remove semi-transparent green edge pixels (despill)
    
    Returns:
        PIL Image with clean transparent background
    """
    import colorsys
    from collections import deque
    
    if image.mode != "RGBA":
        image = image.convert("RGBA")
    
    pixels = image.load()
    width, height = image.size
    
    # ===== PASS 1: Remove pure chroma green (tight) =====
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            
            # Pure green check - very close to #00FF00
            dist = color_distance((r, g, b), CHROMA_GREEN)
            if dist < 50:  # Tight tolerance
                pixels[x, y] = (0, 0, 0, 0)
    
    # ===== PASS 2: Remove near-green variations =====
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            
            # Check for any green-ish color
            # Conditions: high green, low red and blue, green dominant
            if g > 180 and r < 100 and b < 100 and g > r + 80 and g > b + 80:
                pixels[x, y] = (0, 0, 0, 0)
    
    # ===== PASS 3: Flood fill from corners =====
    # This catches any remaining background that's connected to edges
    def is_background_color(r, g, b, a):
        """Check if pixel looks like background (greenish or transparent)."""
        if a == 0:
            return True
        # Greenish detection with wide tolerance
        if g > 150 and g > r and g > b:
            return True
        # Very light/washed out colors (often compression artifacts)
        if r > 200 and g > 200 and b > 200:
            return True
        return False
    
    def flood_fill_transparent(start_x, start_y, tolerance=100):
        """Flood fill from a point, making connected similar pixels transparent."""
        if pixels[start_x, start_y][3] == 0:
            return  # Already transparent
        
        start_color = pixels[start_x, start_y][:3]
        visited = set()
        queue = deque([(start_x, start_y)])
        
        while queue:
            x, y = queue.popleft()
            
            if (x, y) in visited:
                continue
            if x < 0 or x >= width or y < 0 or y >= height:
                continue
            
            visited.add((x, y))
            r, g, b, a = pixels[x, y]
            
            if a == 0:
                continue
            
            # Check if this pixel is similar to start color OR is greenish
            dist = color_distance((r, g, b), start_color)
            is_greenish = g > 150 and g > r and g > b
            
            if dist < tolerance or is_greenish:
                pixels[x, y] = (0, 0, 0, 0)
                # Add neighbors
                queue.extend([(x+1, y), (x-1, y), (x, y+1), (x, y-1)])
    
    # Start flood fill from all 4 corners
    corners = [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1)]
    for cx, cy in corners:
        flood_fill_transparent(cx, cy)
    
    # Also flood fill from edges (sample every 10 pixels)
    for x in range(0, width, 10):
        flood_fill_transparent(x, 0)
        flood_fill_transparent(x, height-1)
    for y in range(0, height, 10):
        flood_fill_transparent(0, y)
        flood_fill_transparent(width-1, y)
    
    # ===== PASS 4: Despill - remove green tint from edge pixels =====
    # Find pixels next to transparent areas and reduce green channel
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            
            # Check if this pixel is adjacent to a transparent pixel
            is_edge = False
            for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height:
                    if pixels[nx, ny][3] == 0:
                        is_edge = True
                        break
            
            if is_edge:
                # If this edge pixel has too much green, reduce it (despill)
                if g > max(r, b) + 30:
                    # Reduce green to match the average of red and blue
                    new_g = min(g, (r + b) // 2 + 30)
                    pixels[x, y] = (r, new_g, b, a)
                
                # If pixel is still very greenish, make it semi-transparent
                if g > 200 and r < 80 and b < 80:
                    pixels[x, y] = (0, 0, 0, 0)
    
    # ===== PASS 5: Clean up isolated pixels =====
    # Remove any remaining small isolated green-ish pixels
    for y in range(1, height - 1):
        for x in range(1, width - 1):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            
            # Count transparent neighbors
            transparent_neighbors = 0
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    if dx == 0 and dy == 0:
                        continue
                    if pixels[x + dx, y + dy][3] == 0:
                        transparent_neighbors += 1
            
            # If mostly surrounded by transparent and looks greenish, remove it
            if transparent_neighbors >= 6 and g > max(r, b):
                pixels[x, y] = (0, 0, 0, 0)
    
    return image


class SpriteGenerator:
    """
    Two-stage sprite generation using Nano Banana (Gemini 3 Pro Image).
    
    Stage 1: Generate character reference on chroma green
    Stage 2: Generate sprite sheet on chroma green
    Stage 3: Remove green background (post-processing)
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model = MODEL
    
    async def generate_image(
        self,
        prompt: str,
        reference_image: Image.Image | None = None,
        aspect_ratio: str = "1:1"
    ) -> Image.Image | None:
        """
        Generate image using Gemini 3 Pro Image REST API.
        """
        try:
            parts = []
            
            # Add reference image if provided
            if reference_image:
                buffer = io.BytesIO()
                reference_image.save(buffer, format="PNG")
                img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
                parts.append({
                    "inline_data": {"mime_type": "image/png", "data": img_base64}
                })
            
            # Add prompt
            parts.append({"text": prompt})
            parts.append({"text": f"Aspect Ratio: {aspect_ratio}"})
            
            request_body = {
                "contents": [{"parts": parts}],
                "generationConfig": {
                    "responseModalities": ["TEXT", "IMAGE"],
                    "responseMimeType": "text/plain"
                }
            }
            
            url = f"{API_BASE_URL}/models/{self.model}:generateContent?key={self.api_key}"
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                print(f"  → Calling Gemini API...")
                response = await client.post(
                    url,
                    json=request_body,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code != 200:
                    print(f"  ✗ API error {response.status_code}: {response.text[:300]}")
                    return None
                
                result = response.json()
                
                # Extract image from response
                if "candidates" in result and result["candidates"]:
                    candidate = result["candidates"][0]
                    if "content" in candidate and "parts" in candidate["content"]:
                        for part in candidate["content"]["parts"]:
                            if "inlineData" in part:
                                inline_data = part["inlineData"]
                                if "data" in inline_data:
                                    img_bytes = base64.b64decode(inline_data["data"])
                                    print(f"  ✓ Image generated successfully")
                                    return Image.open(io.BytesIO(img_bytes))
                
                print("  ✗ No image in response")
                return None
                
        except Exception as e:
            print(f"  ✗ Exception: {e}")
            return None
    
    async def generate_character(
        self,
        character_description: str,
        style: str = "16-bit pixel art"
    ) -> tuple[Image.Image | None, Image.Image | None]:
        """
        Stage 1: Generate character reference on CHROMA GREEN background.
        
        Returns:
            Tuple of (raw_image_with_green, processed_image_transparent)
        """
        prompt = f"""Create a single {style} game character sprite.

CRITICAL BACKGROUND REQUIREMENT:
- Place the character on a SOLID CHROMA GREEN background ({CHROMA_GREEN_HEX})
- The background must be PURE, FLAT green - no gradients, no shadows
- The green must be perfectly uniform: RGB(0, 255, 0) exactly
- Green must be visible on ALL sides of the character
- NO other green elements in the character design itself
- Character should NOT use green as a color (to avoid removal issues)

CHARACTER DESCRIPTION:
{character_description}

SPRITE REQUIREMENTS:
- Single character, front-facing idle pose
- Clear {style} style with visible pixels
- Character centered in frame
- Size: approximately 32x32 to 64x64 pixel character
- Clean silhouette with sharp edges against the green
- No anti-aliasing on edges (crisp pixel boundaries)
- Limited color palette (16-32 colors max, NO GREEN)
- The character should look like a retro video game sprite

BACKGROUND (MANDATORY):
- Solid, flat, uniform chroma green ({CHROMA_GREEN_HEX})
- Pure RGB(0, 255, 0) - nothing else
- No shadows, no gradients, no texture on background"""

        print(f"\n[STAGE 1] Generating character on GREEN SCREEN...")
        print(f"  Style: {style}")
        print(f"  Background: Chroma Green ({CHROMA_GREEN_HEX})")
        
        raw_image = await self.generate_image(prompt, aspect_ratio="1:1")
        
        if raw_image:
            # Post-process: remove green background
            print(f"  → Removing green background...")
            processed_image = remove_green_background_advanced(raw_image.copy())
            print(f"  ✓ Background removed")
            return raw_image, processed_image
        
        return None, None
    
    async def generate_sprite_sheet(
        self,
        character_image: Image.Image,
        animation_type: str = "walk cycle",
        frames: int = 4,
        directions: int = 1
    ) -> tuple[Image.Image | None, Image.Image | None]:
        """
        Stage 2: Generate sprite sheet on CHROMA GREEN background.
        
        Returns:
            Tuple of (raw_image_with_green, processed_image_transparent)
        """
        direction_desc = {
            1: "front-facing only",
            4: "4 directions (front, back, left, right)",
            8: "8 directions (cardinal + diagonal)"
        }.get(directions, "front-facing only")
        
        prompt = f"""Using this character as EXACT reference, create a pixel art sprite sheet.

CRITICAL BACKGROUND REQUIREMENT:
- Place ALL sprites on a SOLID CHROMA GREEN background ({CHROMA_GREEN_HEX})
- Background must be PURE, FLAT green - RGB(0, 255, 0) exactly
- Green must fill ALL space between and around sprites
- NO shadows, gradients, or any variation in the green
- Each sprite frame should be clearly separated by green

ANIMATION: {animation_type}
FRAMES: {frames} frames arranged horizontally
DIRECTIONS: {direction_desc}

REQUIREMENTS:
- Maintain EXACT same character design, colors, and proportions as reference
- Create a clean grid layout sprite sheet
- Each frame: same size as reference character
- Frames evenly spaced in a horizontal row
- Smooth animation between frames
- Same pixel art style as reference
- NO anti-aliasing - crisp pixel edges against the green background
- Character should NOT use green color (conflicts with background)

LAYOUT:
- Horizontal strip: Frame 1 | Frame 2 | Frame 3 | Frame 4
- All frames same size, evenly spaced
- Green background fills entire image including gaps

BACKGROUND (MANDATORY):
- Solid chroma green ({CHROMA_GREEN_HEX}) everywhere
- Pure RGB(0, 255, 0)
- Between frames: green
- Around frames: green"""

        print(f"\n[STAGE 2] Generating sprite sheet on GREEN SCREEN...")
        print(f"  Animation: {animation_type}")
        print(f"  Frames: {frames}")
        
        # Use wider aspect ratio for sprite sheets
        aspect = "16:9" if frames >= 4 else "4:3"
        
        raw_image = await self.generate_image(
            prompt, 
            reference_image=character_image, 
            aspect_ratio=aspect
        )
        
        if raw_image:
            # Post-process: remove green background
            print(f"  → Removing green background...")
            processed_image = remove_green_background_advanced(raw_image.copy())
            print(f"  ✓ Background removed")
            return raw_image, processed_image
        
        return None, None


async def run_test_workflow():
    """
    Run the complete test workflow with GREEN SCREEN approach:
    1. Generate a character on green background
    2. Generate a sprite sheet on green background
    3. Remove green from both (post-processing)
    """
    if not API_KEY:
        print("❌ Error: GEMINI_API_KEY not set in environment")
        print("   Create a .env file with: GEMINI_API_KEY=your_key_here")
        return
    
    generator = SpriteGenerator(API_KEY)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    print("=" * 60)
    print("🎮 PixelForge Sprite Pipeline - GREEN SCREEN Workflow")
    print("=" * 60)
    
    # === STAGE 1: Generate Character on Green ===
    character_desc = """
    A brave knight character:
    - Silver/steel armor with blue accents
    - Helmet with a small plume (red or blue)
    - Sword at side or in hand
    - Cape (red or blue, NOT green)
    - Heroic stance
    - Medieval fantasy style
    """
    
    raw_char, processed_char = await generator.generate_character(
        character_description=character_desc,
        style="16-bit pixel art"
    )
    
    if raw_char and processed_char:
        # Save both versions
        raw_char_path = OUTPUT_DIR / f"char_raw_{timestamp}.png"
        proc_char_path = OUTPUT_DIR / f"char_transparent_{timestamp}.png"
        
        raw_char.save(raw_char_path)
        processed_char.save(proc_char_path)
        
        print(f"  → Raw (green bg): {raw_char_path}")
        print(f"  → Transparent: {proc_char_path}")
        
        # === STAGE 2: Generate Sprite Sheet on Green ===
        raw_sheet, processed_sheet = await generator.generate_sprite_sheet(
            character_image=raw_char,  # Use raw (with green) as reference
            animation_type="walk cycle",
            frames=4,
            directions=1
        )
        
        if raw_sheet and processed_sheet:
            raw_sheet_path = OUTPUT_DIR / f"sheet_raw_{timestamp}.png"
            proc_sheet_path = OUTPUT_DIR / f"sheet_transparent_{timestamp}.png"
            
            raw_sheet.save(raw_sheet_path)
            processed_sheet.save(proc_sheet_path)
            
            print(f"  → Raw (green bg): {raw_sheet_path}")
            print(f"  → Transparent: {proc_sheet_path}")
            
            print("\n" + "=" * 60)
            print("✅ SUCCESS! Green screen pipeline complete.")
            print("=" * 60)
            print(f"\nGenerated files in {OUTPUT_DIR}:")
            print(f"  Character:")
            print(f"    - {raw_char_path.name} (with green)")
            print(f"    - {proc_char_path.name} (transparent)")
            print(f"  Sprite Sheet:")
            print(f"    - {raw_sheet_path.name} (with green)")
            print(f"    - {proc_sheet_path.name} (transparent)")
        else:
            print("\n❌ Failed to generate sprite sheet")
    else:
        print("\n❌ Failed to generate character")


if __name__ == "__main__":
    print("\n" + "🍌" * 30)
    print("  NANO BANANA GREEN SCREEN PIPELINE")
    print("🍌" * 30 + "\n")
    
    asyncio.run(run_test_workflow())
