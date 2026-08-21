import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const replacements = new Map([
  ['#0c0b09', 'var(--cf-canvas)'],
  ['#15100a', 'var(--cf-surface)'],
  ['#15110d', 'var(--cf-surface)'],
  ['#1b1510', 'var(--cf-surface-raised)'],
  ['#21170d', 'var(--cf-surface-raised)'],
  ['#100c08', 'var(--cf-surface-inset)'],
  ['#120e09', 'var(--cf-surface-inset)'],
  ['#171207', 'var(--cf-surface-inset)'],
  ['#1b140d', 'var(--cf-surface-raised)'],
  ['#1b1209', 'var(--cf-warning-surface)'],
  ['#1c130b', 'var(--cf-surface-raised)'],
  ['#24180e', 'var(--cf-surface-hover)'],
  ['#2a1b0d', 'var(--cf-surface-hover)'],
  ['#122012', 'var(--cf-success-surface)'],
  ['#181009', 'var(--cf-surface-inset)'],
  ['#1b0d09', 'var(--cf-danger-surface-muted)'],
  ['#5f4526', 'var(--cf-border)'],
  ['#644923', 'var(--cf-border)'],
  ['#3c2c1b', 'var(--cf-border-subtle)'],
  ['#4a3823', 'var(--cf-border-subtle)'],
  ['#42311f', 'var(--cf-border-subtle)'],
  ['#4d3c25', 'var(--cf-border-subtle)'],
  ['#6f532e', 'var(--cf-border-strong)'],
  ['#6d4f2b', 'var(--cf-border-strong)'],
  ['#d8b365', 'var(--cf-accent)'],
  ['#d9a441', 'var(--cf-accent)'],
  ['#d7b469', 'var(--cf-accent)'],
  ['#846634', 'var(--cf-accent)'],
  ['#6d5323', 'var(--cf-accent)'],
  ['#e4aa43', 'var(--cf-accent-strong)'],
  ['#f4c66b', 'var(--cf-accent)'],
  ['#e2aa4a', 'var(--cf-accent-strong)'],
  ['#c79a4a', 'var(--cf-accent-strong)'],
  ['#f2c15d', 'var(--cf-accent-strong)'],
  ['#f0c568', 'var(--cf-accent-strong)'],
  ['#e2c07b', 'var(--cf-accent-strong)'],
  ['#f7ead0', 'var(--cf-text)'],
  ['#f7f1e4', 'var(--cf-text)'],
  ['#f3ead7', 'var(--cf-text)'],
  ['#fff1c7', 'var(--cf-text-strong)'],
  ['#fff3ca', 'var(--cf-text-strong)'],
  ['#f9e7b7', 'var(--cf-text-strong)'],
  ['#cbb58b', 'var(--cf-text-muted)'],
  ['#c7b288', 'var(--cf-text-muted)'],
  ['#c4af87', 'var(--cf-text-muted)'],
  ['#c8bda8', 'var(--cf-text-muted)'],
  ['#dbc79e', 'var(--cf-text-muted)'],
  ['#c8b07f', 'var(--cf-text-muted)'],
  ['#d8c49a', 'var(--cf-text-muted)'],
  ['#d5be8c', 'var(--cf-text-muted)'],
  ['#bfa97d', 'var(--cf-text-muted)'],
  ['#a98a75', 'var(--cf-text-subtle)'],
  ['#a98a55', 'var(--cf-text-subtle)'],
  ['#a9946c', 'var(--cf-text-subtle)'],
  ['#8f7b57', 'var(--cf-text-subtle)'],
  ['#9f8a66', 'var(--cf-text-subtle)'],
  ['#ffe7ad', 'var(--cf-accent-text)'],
  ['#f8e3b0', 'var(--cf-accent-text)'],
  ['#f7d690', 'var(--cf-accent-text)'],
  ['#f6d891', 'var(--cf-accent-text)'],
  ['#f5d27b', 'var(--cf-accent-text)'],
  ['#f3d48f', 'var(--cf-accent-text)'],
  ['#f1d79e', 'var(--cf-accent-text)'],
  ['#140f0a', 'var(--cf-accent-contrast)'],
  ['#bde3a8', 'var(--cf-success)'],
  ['#c8e9ba', 'var(--cf-success)'],
  ['#b8caa0', 'var(--cf-success)'],
  ['#8fca72', 'var(--cf-success)'],
  ['#5f7f54', 'var(--cf-success-border)'],
  ['#f0bd75', 'var(--cf-warning)'],
  ['#8c6436', 'var(--cf-warning-border)'],
  ['#7d5a2e', 'var(--cf-warning-border)'],
  ['#ffd0c6', 'var(--cf-danger)'],
  ['#7d3d32', 'var(--cf-danger-border)'],
  ['#252b35', 'var(--cf-editor-border)'],
  ['#2b2f39', 'var(--cf-editor-border)'],
  ['#111720', 'var(--cf-editor-control)'],
  ['#3b4352', 'var(--cf-editor-control-border)'],
]);

const visit = async (directory) => {
  const entries = await readdir(directory);
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry);
    const info = await stat(path);
    if (info.isDirectory()) files.push(...await visit(path));
    else if (path.endsWith('.tsx')) files.push(path);
  }
  return files;
};

const migrateText = (source) => {
  let next = source;
  for (const [from, to] of replacements) next = next.replaceAll(from, to);
  return next;
};

for (const file of await visit('src')) {
  const source = await readFile(file, 'utf8');
  const next = migrateText(source);
  if (next !== source) await writeFile(file, next);
}

const globalsPath = 'src/app/globals.css';
let globals = migrateText(await readFile(globalsPath, 'utf8'));
const desktopStart = globals.indexOf('  @media (min-width: 1024px) {\n    .cardforge-maker-mobile-switcher');
const clerkStart = globals.indexOf('  .cardforge-clerk-profile .cl-cardBox,');
if (desktopStart >= 0 && clerkStart > desktopStart) {
  globals = globals.slice(0, desktopStart) + globals.slice(clerkStart);
}
await writeFile(globalsPath, globals);

const presentationPath = 'src/app/cardforgePresentation.css';
let presentation = await readFile(presentationPath, 'utf8');
presentation = presentation.replace(
  '  --cf-success: #a8e7b8;\n',
  '  --cf-success: #a8e7b8;\n  --cf-success-surface: #122012;\n',
);
presentation = presentation.replace(
  '  --cf-warning: #f0bd75;\n',
  '  --cf-warning: #f0bd75;\n  --cf-warning-surface: #1b1209;\n',
);
presentation = presentation.replace(
  '  --cf-danger: #ffd0c6;\n',
  '  --cf-danger: #ffd0c6;\n  --cf-danger-surface-muted: #1b0d09;\n',
);
const bridgeMarker = '/*\n * Legacy Forge utility compatibility bridge.';
const bridgeStart = presentation.indexOf(bridgeMarker);
if (bridgeStart >= 0) presentation = presentation.slice(0, bridgeStart).trimEnd() + '\n';
await writeFile(presentationPath, presentation);
