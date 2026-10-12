import type { Img } from './visual';

/** Rasterize an image URL (SVG included) to RGBA at its natural size via canvas. */
export function rasterize(src: string): Promise<Img> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      resolve({ data: d.data, width: d.width, height: d.height });
    };
    img.onerror = () => reject(new Error('decode'));
    img.src = src;
  });
}
