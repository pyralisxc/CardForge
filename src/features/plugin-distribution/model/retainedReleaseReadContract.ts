import { z } from 'zod/v4';

export const retainedPluginScope = z.object({
  product: z.enum(['studio', 'owner']),
  environment: z.enum(['production', 'preview']),
}).strict();
export const retainedPluginVersion = z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/);
export const retainedPluginChecksum = z.string().regex(/^[a-f0-9]{64}$/);
export const retainedPluginExactInput = retainedPluginScope.extend({
  version: retainedPluginVersion,
  checksum: retainedPluginChecksum,
}).strict();

// Internal persisted shape. Never expose storagePath through an agent receipt.
export const retainedReleaseRecord = retainedPluginScope.extend({
  packageVersion: retainedPluginVersion,
  sourceSha: z.string().regex(/^[a-f0-9]{40}$/),
  checksumSha256: retainedPluginChecksum,
  byteLength: z.number().int().min(1).max(16777216),
  storagePath: z.string().min(1),
  changes: z.string(),
  releasedAt: z.iso.datetime({ offset: true }),
}).strict();
export const retainedPluginMetadata = retainedPluginScope.extend({
  name: z.string(),
  version: retainedPluginVersion,
  checksum: retainedPluginChecksum,
  sourceSha: z.string().regex(/^[a-f0-9]{40}$/),
  byteLength: z.number().int().min(1).max(16777216),
  releasedAt: z.iso.datetime({ offset: true }),
  changes: z.string(),
}).strict();
export const retainedPluginHistory = retainedPluginScope.extend({
  releases: z.array(retainedPluginMetadata),
  verification: z.literal('metadata_only'),
}).strict();
export const retainedPluginVerification = z.object({
  release: retainedPluginMetadata,
  verification: z.literal('verified_original_stored_zip'),
}).strict();

export class RetainedReleaseReadError extends Error {
  constructor(message: string, public readonly status: 400 | 404 | 503 = 503) {
    super(message);
  }
}
