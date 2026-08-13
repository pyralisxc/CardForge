import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = path.join(repositoryRoot, 'assets', 'brand', 'cardforge-studio');
const outputDirectory = path.join(repositoryRoot, 'output', 'brand', 'cardforge-studio', 'png');
const runtimeDirectory = path.join(repositoryRoot, 'public', 'brand', 'cardforge-studio');
const runtimeSvgFiles = ['brand-mark.svg', 'favicon.svg', 'watermark.svg'];

const exportsToCreate = [
  {
    source: 'primary-lockup.svg',
    output: 'primary-lockup.png',
    resize: { width: 2400 },
  },
  {
    source: 'compact-lockup.svg',
    output: 'compact-lockup.png',
    resize: { width: 1600 },
  },
  {
    source: 'brand-mark.svg',
    output: 'brand-mark.png',
    resize: { height: 1024 },
  },
  {
    source: 'watermark.svg',
    output: 'watermark.png',
    resize: { width: 2000 },
  },
  ...[512, 192, 64, 32].map((size) => ({
    source: 'favicon.svg',
    output: `favicon-${size}.png`,
    resize: { width: size, height: size },
  })),
];

await Promise.all([
  mkdir(outputDirectory, { recursive: true }),
  mkdir(runtimeDirectory, { recursive: true }),
]);

await Promise.all(runtimeSvgFiles.map((fileName) => (
  copyFile(path.join(sourceDirectory, fileName), path.join(runtimeDirectory, fileName))
)));

for (const brandExport of exportsToCreate) {
  const sourcePath = path.join(sourceDirectory, brandExport.source);
  const outputPath = path.join(outputDirectory, brandExport.output);
  const svg = await readFile(sourcePath);

  const result = await sharp(svg, { density: 300 })
    .resize({
      ...brandExport.resize,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .ensureAlpha()
    .png({
      adaptiveFiltering: true,
      compressionLevel: 9,
      palette: false,
    })
    .toFile(outputPath);

  console.log(`${brandExport.output}: ${result.width}x${result.height}, ${result.size} bytes`);
}

console.log(`Synced ${runtimeSvgFiles.length} runtime SVG assets to ${runtimeDirectory}`);
console.log(`Exported ${exportsToCreate.length} PNG assets to ${outputDirectory}`);
