import { Frame, BoundingBox } from "@/types";

export function extractFramesFromSheet(
  imageUrl: string,
  rows: number,
  cols: number
): Promise<Frame[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const frameWidth = Math.floor(img.width / cols);
      const frameHeight = Math.floor(img.height / rows);
      const frames: Frame[] = [];

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const canvas = document.createElement("canvas");
          canvas.width = frameWidth;
          canvas.height = frameHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(
            img,
            col * frameWidth,
            row * frameHeight,
            frameWidth,
            frameHeight,
            0,
            0,
            frameWidth,
            frameHeight
          );

          const imageData = ctx.getImageData(0, 0, frameWidth, frameHeight);
          const data = imageData.data;
          let minX = frameWidth,
            minY = frameHeight,
            maxX = 0,
            maxY = 0;

          for (let y = 0; y < frameHeight; y++) {
            for (let x = 0; x < frameWidth; x++) {
              const idx = (y * frameWidth + x) * 4;
              if (data[idx + 3] > 10) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
              }
            }
          }

          const contentBounds: BoundingBox =
            minX <= maxX && minY <= maxY
              ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
              : { x: 0, y: 0, width: frameWidth, height: frameHeight };

          frames.push({
            dataUrl: canvas.toDataURL("image/png"),
            width: frameWidth,
            height: frameHeight,
            contentBounds,
          });
        }
      }
      resolve(frames);
    };
    img.onerror = () => resolve([]);
    img.src = imageUrl;
  });
}
