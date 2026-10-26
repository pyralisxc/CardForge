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

async function validatePackage(bytes: Uint8Array, product: ReleaseCandidate['product'], environment: ReleaseCandidate['environment'], version: string, endpoint: string) {
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const prefix = environment === 'preview' ? `cardforge-${product}-preview/` : '';
  const manifestPath = prefix + 'plugin.json';
  const mcpPath = prefix + 'mcp.json';
  const expected = [manifestPath, mcpPath, prefix + 'icon.svg', prefix + '.codex-plugin/plugin.json', prefix + '.mcp.json'];
  const skill = product === 'studio'
    ? ['skills/create-editable-template/SKILL.md','skills/create-cards-and-sets/SKILL.md']
    : ['skills/operate-cardforge-site/SKILL.md'];
  for (const file of [...expected, ...skill.map(s => prefix + s)]) {
    if (!zip.file(file)) throw new Error('Missing release package entry');
  }
  const manifest = JSON.parse(await zip.file(manifestPath)!.async('string')) as { name: string; version: string };
  const mcp = JSON.parse(await zip.file(mcpPath)!.async('string')) as { mcpServers?: Record<string, { url?: string }> };
  const name = `cardforge-${product}${environment === 'preview' ? '-preview' : ''}`;
  if (manifest.name !== name || manifest.version !== version || mcp.mcpServers?.[name]?.url !== endpoint) {
    throw new Error('Release manifest/endpoint mismatch');
  }
  const names = Object.keys(zip.files);
  if (names.some(n => !n.startsWith(prefix) || n.includes('..') || (!expected.includes(n) && !skill.map(s => prefix + s).includes(n)))) {
    throw new Error('Unexpected release package entry');
  }
}
export async function verifyReleaseBytes(record: ReleaseCandidate & { storagePath: string }, bytes: Uint8Array, expectedEndpoint: string) {
  if (verifyRetainedArtifact(record, bytes) !== record.storagePath) throw new Error('Storage key mismatch');
  await validatePackage(bytes, record.product, record.environment, record.packageVersion, expectedEndpoint);
}
/**
 * Explicitly invoked only by an authorized future release operation, never a
 * request handler or deployment hook. The store is injected so tests never
 * access providers. No deletion, replacement, or latest pointer exists.
 */
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
    if (existing.checksumSha256 !== candidate.checksumSha256 || existing.sourceSha !== candidate.sourceSha) throw new Error('Release version conflict');
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
    if (!winner || winner.checksumSha256 !== candidate.checksumSha256 || winner.sourceSha !== candidate.sourceSha) throw error;
    await verifyReleaseBytes(winner, await store.readBytes(winner.storagePath), built.endpoint);
    return winner;
  }
  const admitted = await store.find(args.product, args.environment, built.version);
  if (!admitted || admitted.checksumSha256 !== candidate.checksumSha256) throw new Error('Release admission readback missing');
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
