import 'server-only';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { validateRetainedRelease, type ReleaseStore, type RetainedRelease } from './retainedReleaseCommands';
import { RetainedReleaseReadError } from '../model/retainedReleaseReadContract';
import type { ReleaseCandidate } from '../model/releaseArtifactIdentity';

const BUCKET = 'cardforge-plugin-releases';
const TABLE = 'cardforge_plugin_releases';
type Product = ReleaseCandidate['product'];
type Environment = ReleaseCandidate['environment'];
type Row = {
  product: Product; environment: Environment; package_version: string;
  source_sha: string; checksum_sha256: string; byte_length: number;
  storage_path: string; changes: string; released_at: string;
};
const COLUMNS = 'product,environment,package_version,source_sha,checksum_sha256,byte_length,storage_path,changes,released_at';
const mapRow = (value: unknown): RetainedRelease => {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== COLUMNS.split(',').sort().join(',')) {
    throw new RetainedReleaseReadError('Retained release metadata is malformed.');
  }
  const r = value as Row;
  return validateRetainedRelease({
    product: r.product, environment: r.environment, packageVersion: r.package_version,
    sourceSha: r.source_sha, checksumSha256: r.checksum_sha256, byteLength: r.byte_length,
    storagePath: r.storage_path, changes: r.changes, releasedAt: r.released_at,
  });
};
const requireServer = () => {
  const client = getSupabaseServerClient();
  if (!client) throw new Error('Private release storage is unavailable');
  return client;
};

/**
 * Existing server-only Supabase authority, deliberately NOT invoked by CI,
 * deployment, a public endpoint, or an automatic release hook.
 * Only the explicitly authorized release command may call uploadOnce/admit.
 * No signed URL, delete, upsert or mutable pointer is exposed.
 */
export function createRetainedReleaseStore(): ReleaseStore {
  const db = requireServer();
  return {
    async find(product: Product, environment: Environment, version: string) {
      const { data, error } = await db.from(TABLE).select(COLUMNS)
        .eq('product', product).eq('environment', environment)
        .eq('package_version', version).maybeSingle();
      if (error) throw new RetainedReleaseReadError('Release metadata read unavailable.');
      if (data === null) return null;
      const record = mapRow(data);
      if (record.product !== product || record.environment !== environment || record.packageVersion !== version) throw new RetainedReleaseReadError('Retained metadata returned a different exact identity.');
      return record;
    },
    async list(product: Product, environment: Environment) {
      const { data, error } = await db.from(TABLE).select(COLUMNS)
        .eq('product', product).eq('environment', environment)
        .order('released_at', { ascending: false });
      if (error || !Array.isArray(data)) throw new RetainedReleaseReadError('Release history unavailable; an empty result was not established.');
      const records = data.map(mapRow);
      if (records.some(record => record.product !== product || record.environment !== environment)) throw new RetainedReleaseReadError('Release history returned a different scope.');
      return records;
    },
    async uploadOnce(path: string, bytes: Uint8Array) {
      const { error } = await db.storage.from(BUCKET).upload(path, bytes, {
        contentType: 'application/zip', upsert: false,
      });
      if (!error) return 'created';
      // Only a known existing-object collision can be reconciled by readback.
      // No silent fallback from an unclassified storage failure.
      if (/already exists|duplicate|resource already exists/i.test(error.message)) return 'already-exists';
      throw new Error('Release upload unavailable');
    },
    async readBytes(path: string) {
      const { data, error } = await db.storage.from(BUCKET).download(path);
      if (error || !data) throw new Error('Retained release bytes unavailable');
      return new Uint8Array(await data.arrayBuffer());
    },
    async admit(record: Omit<RetainedRelease, 'releasedAt'>) {
      const { error } = await db.from(TABLE).insert({
        product: record.product, environment: record.environment,
        package_version: record.packageVersion, source_sha: record.sourceSha,
        checksum_sha256: record.checksumSha256, byte_length: record.byteLength,
        storage_path: record.storagePath, changes: record.changes, compatible_hosts: [],
      });
      if (error) throw new Error('Release metadata admission unavailable');
    },
  };
}
