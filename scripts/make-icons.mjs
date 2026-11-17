// One-off icon generator (UI-9). Run with: node scripts/make-icons.mjs
// Draws the tier 1 emblem as SVG and renders PNGs with next/og's ImageResponse.
// The outputs in public/icons/ are committed, so builds never depend on this script.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { ImageResponse } from 'next/og.js';

const BG = '#0b0f17';
const TRACK = '#5a6b86';
const STATS = ['#ff8f80', '#ffb454', '#7ee787', '#79c0ff', '#d2a8ff'];
const FIGURE = '#e8edf5';
const ACCENT = '#2fd6c3';

function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arc(cx, cy, r, start, end) {
  const [x1, y1] = polar(cx, cy, r, start);
  const [x2, y2] = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Emblem centered at 256, scaled by `scale` (1 fills most of the canvas). */
function emblemSvg({ scale, background }) {
  const c = 256;
  const r = 190 * scale;
  const w = 34 * scale;
  // Round caps reach past each arc end by about 5 degrees at this radius, so the arc gap is
  // 18 degrees to leave a visible gap of about 8 degrees between segments.
  const GAP = 18;
  const SWEEP = 72 - GAP;
  const segments = STATS.map((color, i) => {
    const start = i * 72 + GAP / 2;
    const end = start + SWEEP;
    return [
      `<path d="${arc(c, c, r, start, end)}" stroke="${TRACK}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`,
      `<path d="${arc(c, c, r, start, start + SWEEP * 0.55)}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`,
    ].join('');
  }).join('');
  const s = scale;
  const figure = [
    `<circle cx="${c}" cy="${c - 62 * s}" r="${34 * s}" fill="${FIGURE}"/>`,
    `<rect x="${c - 44 * s}" y="${c - 76 * s}" width="${88 * s}" height="${12 * s}" rx="${6 * s}" fill="${ACCENT}"/>`,
    `<rect x="${c - 42 * s}" y="${c - 20 * s}" width="${84 * s}" height="${96 * s}" rx="${22 * s}" fill="${FIGURE}"/>`,
  ].join('');
  const bg = background ? `<rect width="512" height="512" fill="${BG}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${bg}${segments}${figure}</svg>`;
}

async function png(svg, size, file) {
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const res = new ImageResponse(
    h('div', { style: { display: 'flex', width: '100%', height: '100%', background: BG } },
      h('img', { src, width: size, height: size })),
    { width: size, height: size },
  );
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log('wrote', file);
}

mkdirSync('public/icons', { recursive: true });
const full = emblemSvg({ scale: 1, background: true });
// Maskable: keep the emblem inside the central 80% safe zone (radius 204 of 256).
const maskable = emblemSvg({ scale: 0.86, background: true });
writeFileSync('public/icons/icon.svg', full);
await png(full, 192, 'public/icons/icon-192.png');
await png(full, 512, 'public/icons/icon-512.png');
await png(maskable, 512, 'public/icons/icon-maskable-512.png');
