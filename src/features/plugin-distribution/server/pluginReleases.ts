import 'server-only';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

export type PluginProduct = 'studio' | 'owner';
export type PluginEnvironment = 'production' | 'preview';
const ORIGINS = { production: 'https://cardforges.com', preview: 'https://card-forge-git-vercel-preview-pyralis-projects.vercel.app' } as const;
const DATE = new Date('1980-01-01T00:00:00.000Z');
const SOURCE = {
  studio: { id: 'cardforge-studio', endpoint: '/mcp', display: 'CardForge Studio', skills: ['skills/create-editable-template/SKILL.md', 'skills/create-cards-and-sets/SKILL.md'] },
  owner: { id: 'cardforge-owner', endpoint: '/mcp/owner', display: 'CardForge Owner', skills: ['skills/operate-cardforge-site/SKILL.md'] },
} as const;
const ICON = 'public/brand/cardforge-studio/favicon.svg';
function validText(bytes: Buffer, entry: string) {
  if (/(?:x-vercel-protection-bypass|VERCEL_AUTOMATION_BYPASS_SECRET|\b(?:sk_live_|sk_test_|sb_secret_|eyJ)[A-Za-z0-9_-]{16,}|"(?:(?:headers)|(?:env)|(?:password)|(?:token)|(?:secret))"\s*:)/u.test(bytes.toString('utf8'))) {
    throw new Error('Forbidden credential-shaped material in plugin entry: ' + entry);
  }
}
export async function buildCurrentPlugin(product: PluginProduct, environment: PluginEnvironment) {
  const spec = SOURCE[product];
  const root = path.join(process.cwd(), 'plugins', spec.id);
  const read = async (file: string) => {
    if (!/^[a-zA-Z0-9._/-]+$/u.test(file) || file.split('/').includes('..')) throw new Error('Invalid plugin entry');
    const bytes = await readFile(path.join(root, file));
    validText(bytes, file);
    return bytes;
  };
  const manifest = JSON.parse((await read('.codex-plugin/plugin.json')).toString('utf8'));
  const canonicalMcp = JSON.parse((await read('.mcp.json')).toString('utf8'));
  if (manifest.name !== spec.id || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(manifest.version)
    || manifest.mcpServers !== './.mcp.json'
    || canonicalMcp.mcpServers?.[spec.id]?.url !== ORIGINS.production + spec.endpoint
    || Object.keys(canonicalMcp.mcpServers ?? {}).length !== 1) throw new Error('Canonical plugin identity or endpoint changed');
  const name = environment === 'preview' ? spec.id + '-preview' : spec.id;
  const origin = ORIGINS[environment];
  const description = environment === 'preview'
    ? 'Development Preview (isolated Staging). No role or OAuth grant is included. ' + manifest.description
    : manifest.description;
  manifest.name = name;
  manifest.description = description;
  manifest.homepage = origin + (product === 'studio' ? '/studio' : '');
  manifest.interface = { ...manifest.interface, displayName: spec.display + (environment === 'preview' ? ' Preview' : ''), websiteURL: origin };
  manifest.skills = './skills/';
  const portable = {
    $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
    name, version: manifest.version, description, author: manifest.author,
    homepage: manifest.homepage, repository: manifest.repository, keywords: manifest.keywords,
    extensions: { 'com.openai': { interface: manifest.interface } },
  };
  const sources = new Map<string, Buffer>();
  for (const file of spec.skills) sources.set(file, await read(file));
  sources.set('.codex-plugin/plugin.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  sources.set('.mcp.json', Buffer.from(JSON.stringify({ mcpServers: { [name]: { type: 'http', url: origin + spec.endpoint } } }, null, 2) + '\n'));
  sources.set('plugin.json', Buffer.from(JSON.stringify(portable, null, 2) + '\n'));
  sources.set('mcp.json', Buffer.from(JSON.stringify({
    $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
    mcpServers: { [name]: { type: 'streamable-http', url: origin + spec.endpoint } },
  }, null, 2) + '\n'));
  const icon = await readFile(path.join(process.cwd(), ICON));
  validText(icon, ICON);
  sources.set('icon.svg', icon);
  const zip = new JSZip();
  for (const [file, bytes] of [...sources.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    validText(bytes, file);
    zip.file(name + '/' + file, bytes, { date: DATE, createFolders: false, unixPermissions: 0o100644 });
  }
  const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 }, platform: 'UNIX' });
  const checksum = createHash('sha256').update(bytes).digest('hex');
  return {
    bytes, checksum, version: manifest.version, name, environment,
    endpoint: origin + spec.endpoint,
    filename: name + '-' + manifest.version + '.zip',
    appSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    // This release is verified from bytes in this build only. Never invent older ZIPs.
    releaseDate: process.env.VERCEL_GIT_COMMIT_DATE || null,
    changes: 'Canonical CardForge package with host manifests, icon, and maintained skills.',
    compatibility: ['Agent Plugins portable manifest', 'CardForge Codex overlay'],
  };
}
