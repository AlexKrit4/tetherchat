/**
 * Renders the PWA icon set from public/icons/icon.svg.
 * Run with: npm run icons -w @tetherchat/web
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(here, '../public/icons');

const targets = [
  { file: 'icon-192.png', size: 192, padding: 0 },
  { file: 'icon-512.png', size: 512, padding: 0 },
  // Maskable icons need ~10% safe padding on every edge.
  { file: 'icon-maskable-512.png', size: 512, padding: 56 },
  { file: 'badge-72.png', size: 72, padding: 0 },
  { file: 'apple-touch-icon.png', size: 180, padding: 0 },
];

const source = await readFile(resolve(iconsDir, 'icon.svg'));
await mkdir(iconsDir, { recursive: true });

for (const target of targets) {
  const inner = target.size - target.padding * 2;
  const rendered = await sharp(source, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: { r: 30, g: 31, b: 34, alpha: 1 } })
    .png()
    .toBuffer();

  const output =
    target.padding > 0
      ? await sharp({
          create: {
            width: target.size,
            height: target.size,
            channels: 4,
            background: { r: 30, g: 31, b: 34, alpha: 1 },
          },
        })
          .composite([{ input: rendered, top: target.padding, left: target.padding }])
          .png()
          .toBuffer()
      : rendered;

  await writeFile(resolve(iconsDir, target.file), output);
  console.info(`wrote icons/${target.file} (${target.size}px)`);
}
