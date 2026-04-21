/**
 * Gera ícones PNG a partir do favicon.svg pra PWA/iOS/Android.
 * Rodar: npx --yes -p sharp@0.33 node scripts/gen-icons.mjs
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = 'static/favicon.svg';
const OUT = 'static';

await mkdir(OUT, { recursive: true });

const sizes = [
  { file: 'icon-180.png', size: 180 }, // apple-touch-icon
  { file: 'icon-192.png', size: 192 }, // PWA Android
  { file: 'icon-512.png', size: 512 }, // PWA Android splash
  { file: 'icon-1024.png', size: 1024 } // iOS hi-res
];

for (const { file, size } of sizes) {
  await sharp(SRC, { density: 400 })
    .resize(size, size, { fit: 'contain', background: { r: 7, g: 9, b: 13, alpha: 1 } })
    .png({ quality: 95 })
    .toFile(`${OUT}/${file}`);
  console.log(`✓ ${OUT}/${file} (${size}×${size})`);
}

// Maskable (Android adaptive icon) — fundo sólido com logo inset
await sharp(SRC, { density: 400 })
  .resize(400, 400, { fit: 'contain', background: { r: 7, g: 9, b: 13, alpha: 1 } })
  .extend({
    top: 56, bottom: 56, left: 56, right: 56,
    background: { r: 7, g: 9, b: 13, alpha: 1 }
  })
  .png({ quality: 95 })
  .toFile(`${OUT}/icon-maskable-512.png`);
console.log(`✓ ${OUT}/icon-maskable-512.png (512×512 maskable)`);

console.log('\nTodos os ícones gerados.');
