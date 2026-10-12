import { describe, expect, it } from 'vitest';
import { compareImages, verdict, flagMatches, DIFF_THRESHOLD, type Img } from './visual';
function image(x = 16, color = [255, 0, 0], present = true): Img {
  const width = 128, height = 64;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let px = 0; px < width; px++) {
    const c = present && px >= x && px < x + 16 && y >= 16 && y < 32 ? color : [255,255,255];
    data.set([...c, 255], (y * width + px) * 4);
  }
  return { data, width, height };
}
describe('pixel checks', () => {
  it('passes identical images independently of similarity', () => {
    const v = compareImages(image(), image());
    expect(v.diffPixels).toBe(0); expect(v.flags).toEqual([]); expect(verdict(-1, v)).toBe(true);
  });
  it('flags recolour', () => expect(compareImages(image(), image(16,[0,0,255])).flags.some(f => f.kind === 'colour')).toBe(true));
  it('merges shifted content into a moved layout flag', () => {
    const v = compareImages(image(), image(80));
    expect(v.flags).toHaveLength(1); expect(v.flags[0]?.kind).toBe('layout'); expect(v.flags[0]?.message).toMatch(/moved/i);
  });
  it('flags missing content', () => expect(compareImages(image(), image(16,[],false)).flags.some(f => f.kind === 'missing')).toBe(true));
  it('scales mismatched sizes and records it', () => {
    const a = image(16,[],false);
    const b = { data: new Uint8ClampedArray([255,255,255,255]), width: 1, height: 1 };
    const v = compareImages(a,b); expect(v.resizeNote).toMatch(/scaled/); expect(verdict(null,v)).toBe(true);
  });
  it('requires category and location to grade a defect', () => {
    const flag = { kind: 'colour' as const, message: '', box: { x: 0,y: 0,w: 8,h: 8 } };
    expect(flagMatches(flag,'token',flag.box)).toBe(true);
    expect(flagMatches(flag,'spacing',flag.box)).toBe(false);
    expect(flagMatches(flag,'token',{ x: 8,y: 0,w: 8,h: 8 })).toBe(false);
  });
  it('honours pixel threshold and any flags', () => {
    const v = compareImages(image(),image());
    expect(verdict(null,{...v,diffPct: DIFF_THRESHOLD})).toBe(true);
    expect(verdict(1,{...v,diffPct: DIFF_THRESHOLD + Number.EPSILON})).toBe(false);
    expect(verdict(1,{...v,flags: [{kind:'layout',message:'',box:{x:0,y:0,w:1,h:1}}]})).toBe(false);
  });
});
