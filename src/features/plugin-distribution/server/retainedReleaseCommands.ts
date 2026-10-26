import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { releaseArtifactPath, verifyRetainedArtifact, type ReleaseCandidate } from '../model/releaseArtifactIdentity';

export type RetainedRelease = ReleaseCandidate & {
  storagePath: string; changes: string; releasedAt: string;
};
export type BuiltRelease = {
  bytes: Uint8Array; version: string; checksum: string; endpoint: string; name: string;
};
export type ReleaseStore = {
  find(product: ReleaseCandidate['product'], environment: ReleaseCandidate['environment'], version: string): Promise<RetainedRelease | null>;
  list(product: ReleaseCandidate['product'], environment: ReleaseCandidate['environment']): Promise<RetainedRelease[]>;
  uploadOnce(path: string, bytes: Uint8Array): Promise<'created' | 'already-exists'>;
  readBytes(path: string): Promise<Uint8Array>;
  admit(record: Omit<RetainedRelease, 'releasedAt'>): Promise<void>;
};
export type TrustedReleaseBuild = {
  /** Trusted CI/deployment SHA. NEVER accept from an HTTP request. */
  sourceSha: string;
  build: (product: ReleaseCandidate['product'], environment: ReleaseCandidate['environment']) => Promise<BuiltRelease>;
};
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

const endpointFor = (product: ReleaseCandidate['product'], environment: ReleaseCandidate['environment']) =>
  (environment === 'preview' ? 'https://card-forge-git-vercel-preview-pyralis-projects.vercel.app' : 'https://cardforges.com')
  + (product === 'owner' ? '/mcp/owner' : '/mcp');
const exact = (value: unknown, shape: Record<string, unknown>) =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join() === Object.keys(shape).sort().join()
    && Object.entries(shape).every(([key, expected]) => (value as Record<string, unknown>)[key] === expected));
function originalZipNames(bytes: Uint8Array): string[] {
  // Read original central-directory names before JSZip's path normalization.
  const b = Buffer.from(bytes);
  const end = b.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  if (end < 0 || end + 22 > b.length) throw new Error('Invalid ZIP directory');
  const total = b.readUInt16LE(end + 10), offset = b.readUInt32LE(end + 16);
  if (b.readUInt16LE(end + 4) || b.readUInt16LE(end + 6)
    || b.readUInt32LE(end + 12) === 0xffffffff || offset === 0xffffffff) throw new Error('Unsupported ZIP directory');
  const names: string[] = []; let p = offset;
  for (let i = 0; i < total; i++) {
    if (p + 46 > end || b.readUInt32LE(p) !== 0x02014b50) throw new Error('Invalid ZIP entry');
    const length = b.readUInt16LE(p + 28), extra = b.readUInt16LE(p + 30), comment = b.readUInt16LE(p + 32);
    if (p + 46 + length + extra + comment > end) throw new Error('Invalid ZIP entry bounds');
    names.push(b.subarray(p + 46, p + 46 + length).toString('utf8'));
    p += 46 + length + extra + comment;
  }
  if (p !== end - b.readUInt16LE(end + 20)) throw new Error('Invalid ZIP trailing directory');
  return names;
}
async function validatePackage(bytes: Uint8Array, product: ReleaseCandidate['product'], environment: ReleaseCandidate['environment'], version: string, endpoint: string) {
  const expectedEndpoint = endpointFor(product, environment);
  if (endpoint !== expectedEndpoint) throw new Error('Release endpoint violates environment policy');
  const prefix = environment === 'preview' ? `cardforge-${product}-preview/` : '';
  const skill = product === 'studio'
    ? ['skills/create-editable-template/SKILL.md','skills/create-cards-and-sets/SKILL.md']
    : ['skills/operate-cardforge-site/SKILL.md'];
  const paths = ['plugin.json','mcp.json','icon.svg','.codex-plugin/plugin.json','.mcp.json',...skill].map(n => prefix+n);
  const originals = originalZipNames(bytes);
  if (originals.length !== paths.length || new Set(originals).size !== paths.length
    || originals.some(n => !paths.includes(n) || n.includes('..') || n.includes('\\\\') || n.startsWith('/'))) throw new Error('Unexpected raw ZIP entry');
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  if (Object.keys(zip.files).length !== paths.length || paths.some(p => !zip.file(p))) throw new Error('Unexpected ZIP entries');
  const parse = async (p: string) => JSON.parse(await zip.file(prefix+p)!.async('string')) as Record<string, unknown>;
  const manifest = await parse('plugin.json');
  const legacy = await parse('.codex-plugin/plugin.json');
  const mcp = await parse('mcp.json');
  const legacyMcp = await parse('.mcp.json');
  const name = `cardforge-${product}${environment === 'preview' ? '-preview' : ''}`;
  if (manifest.name !== name || manifest.version !== version || legacy.name !== name || legacy.version !== version
    || legacy.mcpServers !== './.mcp.json' || legacy.skills !== './skills/'
    || !exact(mcp.mcpServers, { [name]: (mcp.mcpServers as Record<string, unknown>)?.[name] })
    || !exact((mcp.mcpServers as Record<string, unknown>)[name], { type:'streamable-http', url:expectedEndpoint })
    || !exact(legacyMcp, { mcpServers: legacyMcp.mcpServers })
    || !exact(legacyMcp.mcpServers, { [name]: (legacyMcp.mcpServers as Record<string, unknown>)?.[name] })
    || !exact((legacyMcp.mcpServers as Record<string, unknown>)[name], { type:'http', url:expectedEndpoint })) {
    throw new Error('Release manifest/endpoint mismatch');
  }
}
export async function verifyReleaseBytes(record: ReleaseCandidate & { storagePath: string }, bytes: Uint8Array, expectedEndpoint: string) {
  if (expectedEndpoint !== endpointFor(record.product, record.environment)) throw new Error('Release endpoint violates environment policy');
  if (verifyRetainedArtifact(record, bytes) !== record.storagePath) throw new Error('Storage key mismatch');
  await validatePackage(bytes, record.product, record.environment, record.packageVersion, expectedEndpoint);
}
/**
 * Explicitly invoked only by an authorized future release operation, never a
 * request handler or deployment hook. The store is injected so tests never
 * access providers. No deletion, replacement, or latest pointer exists.
 */
function assertAdmitted(record: RetainedRelease | null, candidate: ReleaseCandidate, storagePath: string): asserts record is RetainedRelease {
  if (!record || record.product !== candidate.product || record.environment !== candidate.environment
    || record.packageVersion !== candidate.packageVersion || record.sourceSha !== candidate.sourceSha
    || record.checksumSha256 !== candidate.checksumSha256 || record.byteLength !== candidate.byteLength
    || record.storagePath !== storagePath) throw new Error('Release admission readback mismatch');
}
export async function admitBuiltRelease(store: ReleaseStore, trusted: TrustedReleaseBuild, args: {
  product: ReleaseCandidate['product']; environment: ReleaseCandidate['environment'];
  changes: string;
}): Promise<RetainedRelease> {
  if (!/^[a-f0-9]{40}$/.test(trusted.sourceSha)) throw new Error('Untrusted release source identity');
  if (!args.changes.trim()) throw new Error('Missing release description');
  const built = await trusted.build(args.product, args.environment);
  const candidate: ReleaseCandidate = {
    product: args.product, environment: args.environment, packageVersion: built.version,
    sourceSha: trusted.sourceSha, checksumSha256: built.checksum, byteLength: built.bytes.byteLength,
  };
  const storagePath = releaseArtifactPath(candidate);
  if (digest(built.bytes) !== built.checksum) throw new Error('Build checksum mismatch');
  await validatePackage(built.bytes, args.product, args.environment, built.version, built.endpoint);
  const existing = await store.find(args.product, args.environment, built.version);
  if (existing) {
    assertAdmitted(existing, candidate, storagePath);
    await verifyReleaseBytes(existing, await store.readBytes(existing.storagePath), built.endpoint);
    return existing;
  }
  // An interrupted prior upload may already own the same key; reconcile exact
  // stored bytes. A different same-version checksum never overwrites that key.
  await store.uploadOnce(storagePath, built.bytes);
  await verifyReleaseBytes({ ...candidate, storagePath }, await store.readBytes(storagePath), built.endpoint);
  try {
    await store.admit({ ...candidate, storagePath, changes: args.changes });
  } catch (error) {
    const winner = await store.find(args.product, args.environment, built.version);
    try { assertAdmitted(winner, candidate, storagePath); } catch { throw error; }
    await verifyReleaseBytes(winner, await store.readBytes(winner.storagePath), built.endpoint);
    return winner;
  }
  const admitted = await store.find(args.product, args.environment, built.version);
  assertAdmitted(admitted, candidate, storagePath);
  await verifyReleaseBytes(admitted, await store.readBytes(admitted.storagePath), built.endpoint);
  return admitted;
}
/** A reader must be called only AFTER existing product/environment role gate. */
export async function readRetainedRelease(store: ReleaseStore, record: RetainedRelease, endpoint: string): Promise<Uint8Array> {
  const bytes = await store.readBytes(record.storagePath);
  await verifyReleaseBytes(record, bytes, endpoint);
  return bytes;
}
export async function listRetainedReleases(store: ReleaseStore, product: ReleaseCandidate['product'], environment: ReleaseCandidate['environment']) {
  const list = await store.list(product, environment);
  return list.filter(x => x.product === product && x.environment === environment)
    .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt) || a.checksumSha256.localeCompare(b.checksumSha256));
}
