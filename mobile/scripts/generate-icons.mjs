/**
 * generate-icons.mjs
 * Generates all required Emergo PNG icon files from the SVG source.
 *
 * Run once with:  node scripts/generate-icons.mjs
 *
 * Requires: npm install -D sharp   (run once, then remove from devDependencies if desired)
 */

import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, '..', 'assets');

// ── SVG sources ───────────────────────────────────────────────────────────────

const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#C62828"/>
  <defs>
    <radialGradient id="glow" cx="50%" cy="48%" r="52%">
      <stop offset="0%" stop-color="#EF5350"/>
      <stop offset="100%" stop-color="#B71C1C"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="100" fill="url(#glow)"/>
  <path d="M256 68 L388 128 L388 272 C388 352 320 416 256 444 C192 416 124 352 124 272 L124 128 Z"
        fill="#B71C1C" stroke="white" stroke-width="10" stroke-linejoin="round"/>
  <text x="256" y="318"
        font-family="Arial Black, Arial, sans-serif"
        font-size="190" font-weight="900"
        text-anchor="middle" fill="white">E</text>
  <path d="M200 138 A80 80 0 0 1 312 138"
        fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="12" stroke-linecap="round"/>
  <path d="M220 115 A65 65 0 0 1 292 115"
        fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="8" stroke-linecap="round"/>
</svg>`;

// Foreground on transparent — just the shield + E, no rounded background
const foregroundSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path d="M256 48 L408 118 L408 278 C408 368 332 432 256 460 C180 432 104 368 104 278 L104 118 Z"
        fill="#C62828" stroke="white" stroke-width="8" stroke-linejoin="round"/>
  <text x="256" y="318"
        font-family="Arial Black, Arial, sans-serif"
        font-size="200" font-weight="900"
        text-anchor="middle" fill="white">E</text>
  <path d="M196 132 A88 88 0 0 1 316 132"
        fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="14" stroke-linecap="round"/>
  <path d="M218 108 A70 70 0 0 1 294 108"
        fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="9" stroke-linecap="round"/>
</svg>`;

// Red background tile for adaptive icon
const backgroundSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#EF5350"/>
      <stop offset="100%" stop-color="#B71C1C"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
</svg>`;

// Monochrome — white shield + E on transparent (for notification icon)
const monochromeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path d="M256 48 L408 118 L408 278 C408 368 332 432 256 460 C180 432 104 368 104 278 L104 118 Z"
        fill="white"/>
  <text x="256" y="318"
        font-family="Arial Black, Arial, sans-serif"
        font-size="200" font-weight="900"
        text-anchor="middle" fill="#C62828">E</text>
</svg>`;

// Splash screen — centered icon on white
const splashSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path d="M256 68 L388 128 L388 272 C388 352 320 416 256 444 C192 416 124 352 124 272 L124 128 Z"
        fill="#C62828" stroke="white" stroke-width="10" stroke-linejoin="round"/>
  <text x="256" y="318"
        font-family="Arial Black, Arial, sans-serif"
        font-size="190" font-weight="900"
        text-anchor="middle" fill="white">E</text>
  <path d="M200 138 A80 80 0 0 1 312 138"
        fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="12" stroke-linecap="round"/>
  <path d="M220 115 A65 65 0 0 1 292 115"
        fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="8" stroke-linecap="round"/>
</svg>`;

// ── Output targets ────────────────────────────────────────────────────────────

const targets = [
  { svg: iconSvg,        file: 'icon.png',                        size: 1024 },
  { svg: foregroundSvg,  file: 'android-icon-foreground.png',     size: 1024 },
  { svg: backgroundSvg,  file: 'android-icon-background.png',     size: 1024 },
  { svg: monochromeSvg,  file: 'android-icon-monochrome.png',     size: 1024 },
  { svg: splashSvg,      file: 'splash-icon.png',                 size: 1024 },
  { svg: iconSvg,        file: 'favicon.png',                     size: 196  },
];

// ── Generate ──────────────────────────────────────────────────────────────────

for (const { svg, file, size } of targets) {
  const outPath = join(ASSETS, file);
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`✅ ${file} (${size}×${size})`);
}

console.log('\nDone! All icon assets regenerated.');
