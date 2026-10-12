export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 2048;
export function validateUpload(blob: Blob) {
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error('Please choose an image of 10 MB or less.');
  if (!blob.size) throw new Error('Please choose a non-empty image.');
}
export function boundedSize(width: number, height: number) {
  if (width <= 0 || height <= 0) throw new Error('Image has no dimensions.');
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
