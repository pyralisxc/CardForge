import { BlobReader, TextReader, TextWriter, Uint8ArrayReader, Uint8ArrayWriter, ZipReader, ZipWriter } from '@zip.js/zip.js';
import { CARDFORGE_PROJECT_MANIFEST_FILE, MAX_PROJECT_PACKAGE_BYTES, MAX_PROJECT_PACKAGE_METADATA_BYTES } from '../model/projectPackage';
import { parseWorkspaceBackupDocument, type ParsedWorkspaceBackupDocument, type WorkspaceBackupDocumentV2 } from '../model/workspaceBackupDocument';
import { buildCardForgeProjectSnapshot, decodeCardForgeProjectPackage, encodeCardForgeProjectPackage, hydrateCardForgeProjectSnapshot } from './projectPackageCodec';

// A separate outer package prevents V1/V2 readers from silently discarding groups.
const VERSION = 3;
const INNER = 'workspace-project.cardforge';
const LIMIT = MAX_PROJECT_PACKAGE_BYTES + MAX_PROJECT_PACKAGE_METADATA_BYTES;

// This preliminary codec has no browser/provider resolver. Fail closed rather
// than exporting references that cannot be restored on another device.
const assertPortablePlanAssets = (groups: ParsedWorkspaceBackupDocument['documentPlanGroups']) => {
  for (const { plan } of groups) for (const asset of plan.assets) {
    if (asset.assetUrl && !asset.assetUrl.startsWith('data:')) {
      throw new Error('Workspace plan asset must be materialized before backup.');
    }
    if (asset.embeddedAssetId) throw new Error('Workspace plan embedded asset must be materialized before backup.');
  }
};

export const encodeWorkspaceBackupPackage = async (backup: WorkspaceBackupDocumentV2, name: string): Promise<Uint8Array> => {
  const parsed = parseWorkspaceBackupDocument(backup);
  assertPortablePlanAssets(parsed.documentPlanGroups);
  const snapshot = await buildCardForgeProjectSnapshot({ document: parsed.document, name });
  const inner = await encodeCardForgeProjectPackage(snapshot);
  const manifest = JSON.stringify({ cardforgeProject: VERSION, cardforgeWorkspaceBackup: 1, documentPlanGroups: parsed.documentPlanGroups });
  if (new TextEncoder().encode(manifest).length > MAX_PROJECT_PACKAGE_METADATA_BYTES || inner.length + new TextEncoder().encode(manifest).length > LIMIT) throw new Error('Workspace backup exceeds safe package limits.');
  const zip = new ZipWriter(new Uint8ArrayWriter());
  await zip.add(CARDFORGE_PROJECT_MANIFEST_FILE, new TextReader(manifest), { level: 0 });
  await zip.add(INNER, new Uint8ArrayReader(inner), { level: 0 });
  const bytes = await zip.close();
  if (bytes.length > LIMIT) throw new Error('Workspace backup exceeds safe package limits.');
  return bytes;
};

export const decodeWorkspaceBackupPackage = async (input: Uint8Array | ArrayBuffer | Blob): Promise<ParsedWorkspaceBackupDocument> => {
  const size = input instanceof Blob ? input.size : input.byteLength;
  if (!size || size > LIMIT) throw new Error('Workspace backup exceeds safe package limits.');
  const bytes = input instanceof Blob ? input : new Blob([new Uint8Array(input instanceof Uint8Array ? input : new Uint8Array(input)).buffer]);
  const zip = new ZipReader(new BlobReader(bytes), { strictness: 'strict' });
  try {
    const entries = await zip.getEntries();
    if (entries.length !== 2 || new Set(entries.map(entry => entry.filename)).size !== 2) throw new Error('Invalid workspace backup entries.');
    const manifestEntry = entries.find(entry => entry.filename === CARDFORGE_PROJECT_MANIFEST_FILE);
    const innerEntry = entries.find(entry => entry.filename === INNER);
    if (!manifestEntry || !innerEntry || manifestEntry.directory || innerEntry.directory || manifestEntry.uncompressedSize > MAX_PROJECT_PACKAGE_METADATA_BYTES || innerEntry.uncompressedSize > LIMIT || manifestEntry.uncompressedSize + innerEntry.uncompressedSize > LIMIT) throw new Error('Invalid workspace backup entries or size.');
    const manifest: unknown = JSON.parse(await manifestEntry.getData!(new TextWriter(), { checkSignature: true }));
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Invalid workspace backup manifest.');
    const value = manifest as Record<string, unknown>;
    if (value.cardforgeProject !== VERSION || value.cardforgeWorkspaceBackup !== 1) throw new Error('Unsupported workspace backup package version.');
    if (Object.keys(value).some(key => !['cardforgeProject', 'cardforgeWorkspaceBackup', 'documentPlanGroups'].includes(key))) throw new Error('Unsupported workspace backup manifest field.');
    const inner = await innerEntry.getData!(new Uint8ArrayWriter(), { checkSignature: true });
    const snapshot = await decodeCardForgeProjectPackage(inner);
    const document = hydrateCardForgeProjectSnapshot(snapshot);
    const parsed = parseWorkspaceBackupDocument({ version: 2, project: document, documentPlanGroups: value.documentPlanGroups });
    assertPortablePlanAssets(parsed.documentPlanGroups);
    return parsed;
  } finally {
    await zip.close();
  }
};
