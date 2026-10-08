import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import JSZip from 'jszip';

const ROOT = process.cwd();
const PLUGIN_ROOT = path.join(ROOT, 'plugins', 'cardforge-owner');
const MANIFEST_PATH = '.codex-plugin/plugin.json';
const PACKAGE_FILES = [
  MANIFEST_PATH,
  '.mcp.json',
].sort();
const DETERMINISTIC_DATE = new Date('1980-01-01T00:00:00.000Z');

const readPluginFile = async (relativePath) => {
  const absolutePath = path.resolve(PLUGIN_ROOT, relativePath);
  const relative = path.relative(PLUGIN_ROOT, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Plugin package path escapes its root: ' + relativePath);
  }
  const fileStat = await stat(absolutePath);
  if (!fileStat.isFile()) throw new Error('Plugin package entry is not a file: ' + relativePath);
  return readFile(absolutePath);
};

const manifest = JSON.parse(await readFile(path.join(PLUGIN_ROOT, MANIFEST_PATH), 'utf8'));
if (manifest.name !== 'cardforge-owner' || typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(manifest.version)) {
  throw new Error('CardForge Owner plugin manifest must contain a valid name and semantic version.');
}
if (manifest.mcpServers !== './.mcp.json') {
  throw new Error('CardForge Owner plugin manifest must keep its package-local MCP reference.');
}

const mcp = JSON.parse(await readFile(path.join(PLUGIN_ROOT, '.mcp.json'), 'utf8'));
if (mcp?.mcpServers?.['cardforge-owner']?.url !== 'https://cardforges.com/mcp/owner') {
  throw new Error('The CardForge Owner package must target the canonical production Owner MCP endpoint.');
}

const zip = new JSZip();
for (const relativePath of PACKAGE_FILES) {
  zip.file(relativePath, await readPluginFile(relativePath), {
    date: DETERMINISTIC_DATE,
    createFolders: false,
    unixPermissions: 0o100644,
  });
}
const bytes = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
  platform: 'UNIX',
});

const outputDirectory = path.resolve(ROOT, process.argv[2] || 'dist/plugins');
await mkdir(outputDirectory, { recursive: true });
const outputPath = path.join(outputDirectory, 'cardforge-owner-' + manifest.version + '.zip');
await writeFile(outputPath, bytes);
process.stdout.write(outputPath + '\n');
