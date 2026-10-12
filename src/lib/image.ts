import { RawImage } from '@huggingface/transformers';
import { rasterize, rasterizeBlob } from './raster';
export async function loadImageForEmbedding(input: string | Blob): Promise<RawImage> {
  const img = typeof input === 'string' ? await rasterize(input) : await rasterizeBlob(input);
  return new RawImage(img.data, img.width, img.height, 4);
}
