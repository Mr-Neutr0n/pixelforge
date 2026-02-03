/**
 * Gemini 3 Pro Image API Client (Nano Banana)
 * For generating pixel art sprites and characters
 */

const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = "gemini-3-pro-image-preview";

// Chroma green for background
export const CHROMA_GREEN = "#00FF00";

interface GenerateImageOptions {
  prompt: string;
  referenceImages?: string[]; // Base64 or URLs
  aspectRatio?: string;
}

interface GenerateImageResult {
  imageBase64: string;
  mimeType: string;
}

/**
 * Fetch image from URL and convert to base64
 */
export async function urlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return base64;
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // 2 seconds base delay
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate image using Gemini 3 Pro Image API with retry logic
 */
export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResult | null> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not set");
  }

  const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];

  // Add reference images if provided
  if (options.referenceImages && options.referenceImages.length > 0) {
    for (const img of options.referenceImages) {
      let base64Data: string;
      
      if (img.startsWith('data:')) {
        // Already a data URL
        base64Data = img.split(',')[1];
      } else if (img.startsWith('http')) {
        // Fetch and convert URL to base64
        base64Data = await urlToBase64(img);
      } else {
        // Assume it's already base64
        base64Data = img;
      }
      
      parts.push({
        inline_data: {
          mime_type: "image/png",
          data: base64Data
        }
      });
    }
  }

  // Add prompt
  parts.push({ text: options.prompt });
  
  if (options.aspectRatio) {
    parts.push({ text: `Aspect Ratio: ${options.aspectRatio}` });
  }

  const requestBody = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      responseMimeType: "text/plain"
    }
  };

  const url = `${API_BASE_URL}/models/${MODEL}:generateContent?key=${apiKey}`;

  // Retry loop
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[Gemini] Attempt ${attempt}/${MAX_RETRIES}...`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      // Check if we should retry
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Gemini] API error ${response.status}:`, errorText.slice(0, 300));
        
        // Retry on transient errors
        if (RETRYABLE_STATUS_CODES.includes(response.status) && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * attempt; // Exponential backoff
          console.log(`[Gemini] Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        
        return null;
      }

      const result = await response.json();

      // Extract image from response
      if (result.candidates?.[0]?.content?.parts) {
        for (const part of result.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            console.log(`[Gemini] Success on attempt ${attempt}`);
            return {
              imageBase64: part.inlineData.data,
              mimeType: part.inlineData.mimeType || 'image/png'
            };
          }
        }
      }

      // No image in response - retry
      console.error("[Gemini] No image in response");
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * attempt;
        console.log(`[Gemini] Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      
      return null;
    } catch (error) {
      console.error(`[Gemini] Exception on attempt ${attempt}:`, error);
      
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * attempt;
        console.log(`[Gemini] Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      
      return null;
    }
  }
  
  return null;
}

/**
 * Convert base64 image to a data URL for use in responses
 */
export function base64ToDataUrl(base64: string, mimeType: string = 'image/png'): string {
  return `data:${mimeType};base64,${base64}`;
}
