import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import JSZip from 'jszip';

const PREVIEW_ORIGIN = 'https://card-forge-git-vercel-preview-pyralis-projects.vercel.app';
const MANIFEST_PATH = '.codex-plugin/plugin.json';
const DATE = new Date('1980-01-01T00:00:00.000Z');
const products = [
  { name: 'cardforge-studio', label: 'CardForge Studio', endpoint: '/mcp', skills: [
    'skills/create-editable-template/SKILL.md',
    'skills/create-cards-and-sets/SKILL.md',
  ] },
  { name: 'cardforge-owner', label: 'CardForge Owner', endpoint: '/mcp/owner', skills: [] },
];

// Only fixed canonical inputs are admitted. No endpoint/header/env override is supported.
const outputDirectory = path.resolve(process.cwd(), process.argv[2] || 'dist/plugins');
if (process.argv.length > 3 || process.argv[2]?.startsWith('--')) {
  throw new Error('Usage: node scripts/package-cardforge-preview-plugins.mjs [output-directory]');
}
const prepared = [];
for (const product of products) {
  const sourceRoot = path.join(process.cwd(), 'plugins', product.name);
  const files = [MANIFEST_PATH, '.mcp.json', ...product.skills].sort();
  const contents = new Map(await Promise.all(files.map(async (file) => [file, await readFile(path.join(sourceRoot, file))])));
  const manifest = JSON.parse(contents.get(MANIFEST_PATH).toString('utf8'));
  const mcp = JSON.parse(contents.get('.mcp.json').toString('utf8'));
  if (manifest.name !== product.name || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(manifest.version)) {
    throw new Error('Canonical plugin identity/version is invalid.');
  }
  if (manifest.mcpServers !== './.mcp.json' || manifest.interface?.displayName !== product.label
    || (product.skills.length ? manifest.skills !== './skills/' : manifest.skills !== undefined)) {
    throw new Error('Canonical plugin references or display identity changed.');
  }
  const connection = mcp.mcpServers?.[product.name];
  if (Object.keys(mcp).join() !== 'mcpServers' || Object.keys(mcp.mcpServers).join() !== product.name
    || !connection || Object.keys(connection).sort().join() !== 'type,url'
    || connection.type !== 'http' || connection.url !== `https://cardforges.com${product.endpoint}`) {
    throw new Error('Canonical MCP must contain only the production-pinned HTTP connection; credentials and overrides are forbidden.');
  }
  const name = `${product.name}-preview`;
  manifest.name = name;
  manifest.description = `Unpublished developer connection to Staging. ${manifest.description}`;
  manifest.homepage = `${PREVIEW_ORIGIN}${product.skills.length ? '/studio' : ''}`;
  manifest.interface.displayName = `${product.label} Preview`;
  manifest.interface.shortDescription = `${product.label} testing`;
  manifest.interface.longDescription = `Unpublished Preview developer connection to isolated Staging providers. Verify the server environment before writes. Authenticate through Clerk Development; this package grants no Owner or Contributor permission. ${manifest.interface.longDescription}`;
  manifest.interface.websiteURL = PREVIEW_ORIGIN;
  contents.set(MANIFEST_PATH, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
  contents.set('.mcp.json', Buffer.from(`${JSON.stringify({ mcpServers: {
    [name]: { type: 'http', url: `${PREVIEW_ORIGIN}${product.endpoint}` },
  } }, null, 2)}\n`));
  // Portable host format and legacy overlay are projections of the same canonical product.
  const portable = {
    $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
    name, version: manifest.version, description: manifest.description,
    author: manifest.author, homepage: manifest.homepage,
    repository: manifest.repository, keywords: manifest.keywords,
    extensions: { 'com.openai': { interface: manifest.interface } },
  };
  contents.set('plugin.json', Buffer.from(`${JSON.stringify(portable, null, 2)}\n`));
  contents.set('mcp.json', Buffer.from(`${JSON.stringify({
    $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
    mcpServers: { [name]: { type: 'streamable-http', url: `${PREVIEW_ORIGIN}${product.endpoint}` } },
  }, null, 2)}\n`));
  const zip = new JSZip();
  for (const file of [...files, 'plugin.json', 'mcp.json'].sort()) {
    const bytes = contents.get(file);
    if (/(?:x-vercel-protection-bypass|VERCEL_AUTOMATION_BYPASS_SECRET|\b(?:sk_live_|sk_test_|sb_secret_|eyJ)[A-Za-z0-9_-]{16,}|"(?:headers|env|password|token|secret)"\s*:)/u.test(bytes.toString('utf8'))) {
      throw new Error(`Forbidden credential material in plugin input: ${file}`);
    }
    zip.file(`${name}/${file}`, bytes, { date: DATE, createFolders: false, unixPermissions: 0o100644 });
  }
  prepared.push({ name: `${name}-${manifest.version}.zip`, bytes: await zip.generateAsync({
    type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 }, platform: 'UNIX',
  }) });
}
// Validate both products before writing either output. Production sources are read-only.
await mkdir(outputDirectory, { recursive: true });
for (const artifact of prepared) {
  const output = path.join(outputDirectory, artifact.name);
  await writeFile(output, artifact.bytes);
  process.stdout.write(`${output}\n`);
}
