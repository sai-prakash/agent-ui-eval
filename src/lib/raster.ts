import { compareImages, type Img } from './visual';
import { boundedSize, validateUpload } from './uploads';

/** Decode and bound dimensions before diffing or embedding. */
export function rasterize(src: string): Promise<Img> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        const size = boundedSize(img.naturalWidth, img.naturalHeight);
        c.width = size.width; c.height = size.height;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Could not read image pixels.');
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const d = ctx.getImageData(0, 0, c.width, c.height);
        resolve({ data: d.data, width: d.width, height: d.height });
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('Could not decode this image.'));
    img.src = src;
  });
}
export async function rasterizeBlob(blob: Blob) {
  validateUpload(blob);
  const url = URL.createObjectURL(blob);
  try { return await rasterize(url); } finally { URL.revokeObjectURL(url); }
}
export async function compareUploadedImages(approved: Blob, agent: Blob) {
  const [a, b] = await Promise.all([rasterizeBlob(approved), rasterizeBlob(agent)]);
  return compareImages(a, b);
}
