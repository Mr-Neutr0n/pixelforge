/**
 * Green Screen Background Remover
 * Multi-pass algorithm for clean chroma key removal
 */

import Jimp from 'jimp';
import { CHROMA_GREEN } from './gemini';

/**
 * Calculate Euclidean distance between two RGB colors
 */
function colorDistance(c1: [number, number, number], c2: [number, number, number]): number {
  return Math.sqrt(
    Math.pow(c1[0] - c2[0], 2) +
    Math.pow(c1[1] - c2[1], 2) +
    Math.pow(c1[2] - c2[2], 2)
  );
}

/**
 * Parse hex color to RGB tuple
 */
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 255, 0];
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ];
}

const CHROMA_RGB = hexToRgb(CHROMA_GREEN);

/**
 * Remove green screen background from base64 image
 * Uses multi-pass algorithm for clean results
 */
export async function removeGreenBackground(imageBase64: string): Promise<string> {
  const buffer = Buffer.from(imageBase64, 'base64');
  const image = await Jimp.read(buffer);
  
  const width = image.getWidth();
  const height = image.getHeight();

  // ===== PASS 1: Remove pure chroma green (tight tolerance) =====
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = image.getPixelColor(x, y);
      const rgba = Jimp.intToRGBA(color);
      
      const dist = colorDistance([rgba.r, rgba.g, rgba.b], CHROMA_RGB);
      if (dist < 50) {
        image.setPixelColor(Jimp.rgbaToInt(0, 0, 0, 0), x, y);
      }
    }
  }

  // ===== PASS 2: Remove near-green variations =====
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = image.getPixelColor(x, y);
      const rgba = Jimp.intToRGBA(color);
      
      if (rgba.a === 0) continue;
      
      if (rgba.g > 180 && rgba.r < 100 && rgba.b < 100 && 
          rgba.g > rgba.r + 80 && rgba.g > rgba.b + 80) {
        image.setPixelColor(Jimp.rgbaToInt(0, 0, 0, 0), x, y);
      }
    }
  }

  // ===== PASS 3: Flood fill from corners =====
  const visited = new Set<string>();
  const queue: Array<[number, number]> = [];
  
  const isBackgroundColor = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    
    const color = image.getPixelColor(x, y);
    const rgba = Jimp.intToRGBA(color);
    
    if (rgba.a === 0) return true;
    if (rgba.g > 150 && rgba.g > rgba.r && rgba.g > rgba.b) return true;
    if (rgba.r > 240 && rgba.g > 240 && rgba.b > 240) return true;
    
    return false;
  };

  const corners: Array<[number, number]> = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]
  ];
  
  for (const [cx, cy] of corners) {
    if (isBackgroundColor(cx, cy)) {
      queue.push([cx, cy]);
    }
  }
  
  for (let x = 0; x < width; x += 10) {
    if (isBackgroundColor(x, 0)) queue.push([x, 0]);
    if (isBackgroundColor(x, height - 1)) queue.push([x, height - 1]);
  }
  for (let y = 0; y < height; y += 10) {
    if (isBackgroundColor(0, y)) queue.push([0, y]);
    if (isBackgroundColor(width - 1, y)) queue.push([width - 1, y]);
  }

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const key = `${x},${y}`;
    
    if (visited.has(key)) continue;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    
    visited.add(key);
    
    const color = image.getPixelColor(x, y);
    const rgba = Jimp.intToRGBA(color);
    
    if (rgba.a === 0) continue;
    
    const dist = colorDistance([rgba.r, rgba.g, rgba.b], CHROMA_RGB);
    const isGreenish = rgba.g > 150 && rgba.g > rgba.r && rgba.g > rgba.b;
    
    if (dist < 100 || isGreenish) {
      image.setPixelColor(Jimp.rgbaToInt(0, 0, 0, 0), x, y);
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }

  // ===== PASS 4: Despill =====
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = image.getPixelColor(x, y);
      const rgba = Jimp.intToRGBA(color);
      
      if (rgba.a === 0) continue;
      
      let isEdge = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const ncolor = image.getPixelColor(nx, ny);
          const nrgba = Jimp.intToRGBA(ncolor);
          if (nrgba.a === 0) {
            isEdge = true;
            break;
          }
        }
      }
      
      if (isEdge) {
        if (rgba.g > Math.max(rgba.r, rgba.b) + 30) {
          const newG = Math.min(rgba.g, Math.floor((rgba.r + rgba.b) / 2) + 30);
          image.setPixelColor(Jimp.rgbaToInt(rgba.r, newG, rgba.b, rgba.a), x, y);
        }
        if (rgba.g > 200 && rgba.r < 80 && rgba.b < 80) {
          image.setPixelColor(Jimp.rgbaToInt(0, 0, 0, 0), x, y);
        }
      }
    }
  }

  // ===== PASS 5: Cleanup isolated pixels =====
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const color = image.getPixelColor(x, y);
      const rgba = Jimp.intToRGBA(color);
      
      if (rgba.a === 0) continue;
      
      let transparentCount = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const ncolor = image.getPixelColor(x + dx, y + dy);
          const nrgba = Jimp.intToRGBA(ncolor);
          if (nrgba.a === 0) {
            transparentCount++;
          }
        }
      }
      
      if (transparentCount >= 6 && rgba.g > Math.max(rgba.r, rgba.b)) {
        image.setPixelColor(Jimp.rgbaToInt(0, 0, 0, 0), x, y);
      }
    }
  }

  const outputBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
  return outputBuffer.toString('base64');
}
