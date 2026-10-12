import pixelmatch from 'pixelmatch';

/** Automated, image-only checks. No author notes are used here. */
export type AutoKind = 'colour' | 'state' | 'layout' | 'missing' | 'extra';
export type AutoFlag = { kind: AutoKind; message: string; box: Box };
export type Box = { x: number; y: number; w: number; h: number };
export type VisualReport = {
  width: number;
  height: number;
  diffPixels: number;
  diffPct: number;
  diff: Uint8ClampedArray;
  flags: AutoFlag[];
};
export type Img = { data: Uint8ClampedArray; width: number; height: number };

const CELL = 8;
const MIN_REGION_PX = 25;

const hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

function colourCounts(img: Img, box?: Box): Map<string, number> {
  const m = new Map<string, number>();
  const x0 = box?.x ?? 0, y0 = box?.y ?? 0;
  const x1 = box ? box.x + box.w : img.width, y1 = box ? box.y + box.h : img.height;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4;
      const k = hex(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
  return m;
}

function sorted(m: Map<string, number>) {
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function contentBox(img: Img, box: Box, bg: Set<string>) {
  let n = 0, minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = box.y; y < box.y + box.h; y++)
    for (let x = box.x; x < box.x + box.w; x++) {
      const i = (y * img.width + x) * 4;
      if (bg.has(hex(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!))) continue;
      n++;
      if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
  return { n, minX, minY, maxX, maxY };
}

function regions(diff: Uint8ClampedArray, w: number, h: number): Box[] {
  const cw = Math.ceil(w / CELL), ch = Math.ceil(h / CELL);
  const cells = new Int32Array(cw * ch);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // pixelmatch paints differing pixels pure red
      if (diff[i] === 255 && diff[i + 1] === 0 && diff[i + 2] === 0) cells[Math.floor(y / CELL) * cw + Math.floor(x / CELL)]!++;
    }
  const seen = new Uint8Array(cw * ch);
  const out: Box[] = [];
  for (let s = 0; s < cells.length; s++) {
    if (!cells[s] || seen[s]) continue;
    const stack = [s]; seen[s] = 1;
    let px = 0, minX = cw, minY = ch, maxX = 0, maxY = 0;
    while (stack.length) {
      const c = stack.pop()!; const cx = c % cw, cy = (c / cw) | 0;
      px += cells[c]!;
      minX = Math.min(minX, cx); minY = Math.min(minY, cy); maxX = Math.max(maxX, cx); maxY = Math.max(maxY, cy);
      // 8-neighbourhood plus a one-cell gap so nearby glyphs merge into one element
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
          const n = ny * cw + nx;
          if (cells[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
        }
    }
    if (px < MIN_REGION_PX) continue;
    const x = Math.max(0, minX * CELL - 4), y = Math.max(0, minY * CELL - 4);
    out.push({ x, y, w: Math.min(w, (maxX + 1) * CELL + 4) - x, h: Math.min(h, (maxY + 1) * CELL + 4) - y });
  }
  return out;
}

export function compareImages(golden: Img, agent: Img): VisualReport {
  const { width: w, height: h } = golden;
  if (agent.width !== w || agent.height !== h) throw new Error('size-mismatch');
  const diff = new Uint8ClampedArray(w * h * 4);
  const diffPixels = pixelmatch(golden.data, agent.data, diff, w, h, { threshold: 0.1, includeAA: false, alpha: 0.15 });

  const gAll = sorted(colourCounts(golden));
  // Background = the two most common colours of the approved render (page + card surface).
  const bg = new Set(gAll.slice(0, 2).map(([k]) => k));
  // Approved palette = every colour that fills a real area of the approved design.
  const palette = new Set(gAll.filter(([, n]) => n >= 40).map(([k]) => k));

  const flags: AutoFlag[] = [];
  for (const box of regions(diff, w, h)) {
    const g = contentBox(golden, box, bg), a = contentBox(agent, box, bg);
    if (g.n > 0 && a.n < g.n * 0.35) {
      flags.push({ kind: 'missing', box, message: `Element missing: approved design has content here (${g.n} px), agent version is mostly empty.` });
      continue;
    }
    if (a.n > 0 && g.n < a.n * 0.35) {
      flags.push({ kind: 'extra', box, message: 'Extra element: agent added content the approved design does not have.' });
      continue;
    }
    // Colour-level checks run on every changed region, independent of shape checks.
    const gC = colourCounts(golden, box), aC = colourCounts(agent, box);
    for (const [k, n] of sorted(aC)) {
      if (n < 40 || bg.has(k) || palette.has(k)) continue;
      flags.push({ kind: 'colour', box, message: `Off-palette colour: ${k} (${n} px) is not used anywhere in the approved design.` });
      break;
    }
    for (const [k, n] of sorted(gC)) {
      if (n < 300 || bg.has(k)) continue;
      // Gone, and not simply recoloured: total content in the region shrank by about that area.
      if ((aC.get(k) ?? 0) < n * 0.2 && a.n < g.n - n * 0.5) {
        flags.push({ kind: 'missing', box, message: `Element missing: a ${k} area (${n} px) in the approved design is gone in the agent version.` });
        break;
      }
    }
    const shift = Math.max(Math.abs(g.minX - a.minX), Math.abs(g.minY - a.minY), Math.abs(g.maxX - a.maxX), Math.abs(g.maxY - a.maxY));
    if (shift >= 3) {
      flags.push({ kind: 'layout', box, message: `Position or size changed: edges moved by up to ${shift}px.` });
      continue;
    }
    const gTop = sorted(colourCounts(golden, box)).find(([k]) => !bg.has(k));
    const aTop = sorted(colourCounts(agent, box)).find(([k]) => !bg.has(k));
    if (gTop && aTop && gTop[0] !== aTop[0] && !flags.some((f) => f.box === box && f.kind === 'colour')) {
      if (!palette.has(aTop[0]))
        flags.push({ kind: 'colour', box, message: `Off-palette colour: ${aTop[0]} where the approved design uses ${gTop[0]}.` });
      else
        flags.push({ kind: 'state', box, message: `Looks like a different state: ${gTop[0]} became ${aTop[0]}, a colour used elsewhere in the approved design.` });
    }
  }
  return { width: w, height: h, diffPixels, diffPct: diffPixels / (w * h), diff, flags };
}

/** Verdict from all three signals. */
export const SIM_THRESHOLD = 0.92;
export const DIFF_THRESHOLD = 0.002; // 0.2% of pixels
export function verdict(sim: number | null, v: VisualReport): boolean {
  return (sim === null || sim >= SIM_THRESHOLD) && v.diffPct <= DIFF_THRESHOLD && v.flags.length === 0;
}

/** Which answer-key categories an automated flag counts toward. */
export const KIND_TO_KEY: Record<AutoKind, string[]> = {
  colour: ['token'],
  state: ['missing_state', 'token'],
  layout: ['spacing'],
  missing: ['missing_state'],
  extra: ['missing_state', 'spacing'],
};
