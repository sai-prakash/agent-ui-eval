import { expect, it } from 'vitest';
import { cosineSimilarity } from './similarity';
import { boundedSize, validateUpload, MAX_UPLOAD_BYTES, MAX_IMAGE_SIDE } from './uploads';
it('scores aligned, orthogonal, opposite and zero vectors', () => {
  expect(cosineSimilarity([1,2],[2,4])).toBeCloseTo(1);
  expect(cosineSimilarity([1,0],[0,1])).toBe(0);
  expect(cosineSimilarity([1],[-1])).toBe(-1);
  expect(cosineSimilarity([0],[1])).toBe(0);
  expect(() => cosineSimilarity([1],[])).toThrow();
});
it('bounds dimensions while preserving aspect ratio', () => {
  expect(boundedSize(MAX_IMAGE_SIDE * 2, MAX_IMAGE_SIDE)).toEqual({width:MAX_IMAGE_SIDE,height:MAX_IMAGE_SIDE/2});
  expect(boundedSize(10,20)).toEqual({width:10,height:20});
  expect(() => boundedSize(0,1)).toThrow();
});
it('enforces upload byte limit before decoding', () => {
  expect(() => validateUpload(new Blob([new Uint8Array(MAX_UPLOAD_BYTES)]))).not.toThrow();
  expect(() => validateUpload(new Blob([new Uint8Array(MAX_UPLOAD_BYTES+1)]))).toThrow(/10 MB/);
  expect(() => validateUpload(new Blob())).toThrow(/non-empty/);
});
