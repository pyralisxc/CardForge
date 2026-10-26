import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildPluginArchive } from './plugin-package-core.mjs';

const variant = process.argv[1]?.includes('owner') ? 'owner' : 'studio';
if (process.argv.length > 3 || process.argv[2]?.startsWith('--')) throw new Error('Usage: node <plugin packager> [output-directory]');
const result = await buildPluginArchive(variant, 'production');
const dir = path.resolve(process.cwd(), process.argv[2] || 'dist/plugins');
await mkdir(dir, { recursive: true });
const target = path.join(dir, result.filename);
await writeFile(target, result.bytes);
process.stdout.write(target + '\n');
