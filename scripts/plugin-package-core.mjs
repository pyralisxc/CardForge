import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

const ROOT = process.cwd();
const PRODUCTION = 'https://cardforges.com';
const PREVIEW = 'https://card-forge-git-vercel-preview-pyralis-projects.vercel.app';
const DATE = new Date('1980-01-01T00:00:00.000Z');
const PRODUCTS = {
  studio: { id: 'cardforge-studio', label: 'CardForge Studio', endpoint: '/mcp',
    skills: ['skills/create-editable-template/SKILL.md', 'skills/create-cards-and-sets/SKILL.md'] },
  owner: { id: 'cardforge-owner', label: 'CardForge Owner', endpoint: '/mcp/owner',
    skills: ['skills/operate-cardforge-site/SKILL.md'] },
};
const forbidden = /(?:x-vercel-protection-bypass|VERCEL_AUTOMATION_BYPASS_SECRET|\b(?:sk_live_|sk_test_|sb_secret_|eyJ)[A-Za-z0-9_-]{16,}|"(?:(?:headers)|(?:env)|(?:password)|(?:token)|(?:secret))"\s*:)/u;
const safe = (bytes, file) => {
  if (forbidden.test(bytes.toString('utf8'))) throw new Error('Credential-shaped material in plugin entry: ' + file);
  return bytes;
};
const content = async (root, file) => {
  if (!/^[a-zA-Z0-9._/-]+$/u.test(file) || file.split('/').includes('..')) throw new Error('Invalid plugin entry');
  return safe(await readFile(path.join(root, file)), file);
};

/**
 * The only native ZIP recipe. CLI packagers and the server-authorized download
 * route call this function. There are no user-supplied origins, files or secrets.
 * Unretained historical releases are intentionally not generated.
 */
export async function buildPluginArchive(product, environment) {
  if (!(product in PRODUCTS) || (environment !== 'preview' && environment !== 'production')) throw new Error('Invalid plugin variant');
  const spec = PRODUCTS[product];
  const root = path.join(ROOT, 'plugins', spec.id);
  const canonical = JSON.parse((await content(root, '.codex-plugin/plugin.json')).toString('utf8'));
  const originalMcp = JSON.parse((await content(root, '.mcp.json')).toString('utf8'));
  if (canonical.name !== spec.id || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(canonical.version)
    || canonical.mcpServers !== './.mcp.json' || canonical.skills !== './skills/'
    || canonical.interface?.displayName !== spec.label
    || Object.keys(originalMcp).join() !== 'mcpServers'
    || Object.keys(originalMcp.mcpServers ?? {}).join() !== spec.id
    || originalMcp.mcpServers[spec.id]?.type !== 'http'
    || originalMcp.mcpServers[spec.id]?.url !== PRODUCTION + spec.endpoint
    || Object.keys(originalMcp.mcpServers[spec.id]).sort().join() !== 'type,url') {
    throw new Error('Invalid canonical CardForge plugin identity or endpoint');
  }
  const origin = environment === 'production' ? PRODUCTION : PREVIEW;
  const name = spec.id + (environment === 'preview' ? '-preview' : '');
  const manifest = structuredClone(canonical);
  manifest.name = name;
  if (environment === 'preview') {
    manifest.description = 'Unpublished developer connection to Staging. ' + manifest.description;
    manifest.interface.displayName = spec.label + ' Preview';
    manifest.interface.shortDescription = spec.label + ' testing';
    manifest.interface.longDescription = 'Unpublished Preview developer connection to isolated Staging providers. Verify the server environment before writes. Authenticate through Clerk Development; this package grants no Owner or Contributor permission. ' + manifest.interface.longDescription;
  }
  manifest.homepage = origin + (product === 'studio' ? '/studio' : '');
  manifest.interface.websiteURL = origin;
  const listing = manifest.interface;
  if (listing) {
    if (listing.displayName.length > 30 || listing.shortDescription.length > 30 || listing.longDescription.length > 4000 || listing.developerName.length > 80 || listing.defaultPrompt.length > 3 || new Set(listing.defaultPrompt).size !== listing.defaultPrompt.length || listing.defaultPrompt.some(value => !value.trim() || value.length > 128 || value.includes(String.fromCharCode(10)) || value.includes(String.fromCharCode(13)))) throw new Error('Plugin listing exceeds platform limits');
    for (const key of ['websiteURL','supportURL','privacyPolicyURL','termsOfServiceURL']) if (!String(listing[key] ?? '').startsWith('https://') || listing[key].length > 1024) throw new Error('Invalid plugin listing URL: ' + key);
  }
  const files = new Map();
  if (product === 'studio') {
    const cases = JSON.parse((await content(root, 'REVIEW_CASES.json')).toString('utf8'));
    if (cases.version !== manifest.version || cases.positive.length !== 5 || cases.negative.length !== 5 || [...cases.positive,...cases.negative].some(item => !item.description?.trim() || !item.prompt?.trim() || /[\r\n]/u.test(item.prompt)) || cases.positive.some(item => !item.tools_triggered?.trim() || !item.expected_behavior?.trim())) throw new Error('Studio review cases must match the version with five valid positive and five negative cases');
    const review = { positive: cases.positive.map(({description, prompt, tools_triggered, expected_behavior, setup}) => ({description: `${description}. Setup: ${setup}`,prompt,tools_triggered,expected_behavior})), negative: cases.negative.slice(0,3).map(({description,prompt,setup,expected_behavior}) => ({description: `${description}. Setup: ${setup} Expected behavior: ${expected_behavior}`,prompt})) };
    manifest.extensions ??= {};
    manifest.extensions['com.openai'] = { review: { test_cases: review } };
  }
  for (const file of spec.skills) files.set(file, await content(root, file));
  const json = (object) => Buffer.from(JSON.stringify(object, null, 2) + '\n');
  files.set('.codex-plugin/plugin.json', json(manifest));
  files.set('.mcp.json', json({ mcpServers: { [name]: { type: 'http', url: origin + spec.endpoint } } }));
  files.set('plugin.json', json({
    $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
    name, version: manifest.version, description: manifest.description,
    author: manifest.author, homepage: manifest.homepage, repository: manifest.repository,
    keywords: manifest.keywords, extensions: { 'com.openai': { interface: manifest.interface, ...(manifest.extensions?.['com.openai'] ?? {}) } },
  }));
  files.set('mcp.json', json({
    $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
    mcpServers: { [name]: { type: 'streamable-http', url: origin + spec.endpoint } },
  }));
  files.set('icon.svg', safe(await readFile(path.join(ROOT, 'public/brand/cardforge-studio/favicon.svg')), 'icon.svg'));
  {
    const icon = await readFile(path.join(ROOT, 'public/brand/cardforge-studio/favicon.png'));
    if (icon.length > 5 * 1024 * 1024 || icon.length < 24 || icon.subarray(0,8).toString('hex') !== '89504e470d0a1a0a' || icon.readUInt32BE(16) < 256 || icon.readUInt32BE(20) < 256 || icon.readUInt32BE(16) !== icon.readUInt32BE(20)) throw new Error('Plugin listing PNG must be square and at least 256px, at most 5 MiB');
    files.set('assets/logo.png', icon);
    files.set('assets/icon.png', icon);
  }
  const zip = new JSZip();
  // Keep the established foldered Preview package shape. Production keeps
  // its existing flat-root shape, now including the portable host projection.
  const prefix = environment === 'preview' ? name + '/' : '';
  for (const [file, bytes] of [...files.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    safe(bytes, file);
    zip.file(prefix + file, bytes, { date: DATE, createFolders: false, unixPermissions: 0o100644 });
  }
  const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE',
    compressionOptions: { level: 9 }, platform: 'UNIX' });
  const checksum = createHash('sha256').update(bytes).digest('hex');
  return { bytes, checksum, name, filename: name + '-' + manifest.version + '.zip',
    version: manifest.version, environment, endpoint: origin + spec.endpoint };
}
