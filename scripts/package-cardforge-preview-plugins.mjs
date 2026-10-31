import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildPluginArchive } from './plugin-package-core.mjs';

if (process.argv.length > 3 || process.argv[2]?.startsWith('--')) throw new Error('Usage: node scripts/package-cardforge-preview-plugins.mjs [output-directory]');
const prepared = await Promise.all([
  buildPluginArchive('studio', 'preview'),
  buildPluginArchive('owner', 'preview'),
]);
const dir = path.resolve(process.cwd(), process.argv[2] || 'dist/plugins');
await mkdir(dir, { recursive: true });
for (const artifact of prepared) {
  const target = path.join(dir, artifact.filename);
  await writeFile(target, artifact.bytes);
  process.stdout.write(target + '\n');
}
