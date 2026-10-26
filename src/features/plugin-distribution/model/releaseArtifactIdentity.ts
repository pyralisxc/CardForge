import { createHash } from 'node:crypto';

export type ReleaseCandidate = {
  product: 'studio' | 'owner';
  environment: 'production' | 'preview';
  packageVersion: string;
  sourceSha: string;
  checksumSha256: string;
  byteLength: number;
};

const validVersion = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/u;
const sha40 = /^[a-f0-9]{40}$/u;
const sha64 = /^[a-f0-9]{64}$/u;

/** Deterministic immutable key. No user-supplied path or overwrite option. */
export function releaseArtifactPath(candidate: ReleaseCandidate): string {
  if (!['studio','owner'].includes(candidate.product)
    || !['production','preview'].includes(candidate.environment)
    || !validVersion.test(candidate.packageVersion)
    || !sha40.test(candidate.sourceSha)
    || !sha64.test(candidate.checksumSha256)
    || !Number.isSafeInteger(candidate.byteLength)
    || candidate.byteLength <= 0 || candidate.byteLength > 16777216) throw new Error('Invalid release candidate');
  return `${candidate.product}/${candidate.environment}/${candidate.packageVersion}/${candidate.checksumSha256}.zip`;
}

/** Before admission compare bytes *downloaded from private storage*, not merely upload acknowledgment. */
export function verifyRetainedArtifact(candidate: ReleaseCandidate, downloadedBytes: Uint8Array): string {
  const key = releaseArtifactPath(candidate);
  if (downloadedBytes.byteLength !== candidate.byteLength
    || createHash('sha256').update(downloadedBytes).digest('hex') !== candidate.checksumSha256) {
    throw new Error('Retained plugin release bytes could not be verified');
  }
  return key;
}
