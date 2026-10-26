import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { releaseArtifactPath, verifyRetainedArtifact } from '@/features/plugin-distribution/model/releaseArtifactIdentity';

describe('immutable plugin release admission proposal', () => {
  const bytes = Buffer.from('PK\\x03\\x04 a verified fixture');
  const candidate = {
    product: 'owner' as const, environment: 'preview' as const,
    packageVersion: '0.7.1', sourceSha: 'a'.repeat(40),
    checksumSha256: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length,
  };
  it('keys release objects by environment, exact version and verified digest', () => {
    expect(releaseArtifactPath(candidate)).toBe(`owner/preview/0.7.1/${candidate.checksumSha256}.zip`);
    expect(verifyRetainedArtifact(candidate, bytes)).toBe(releaseArtifactPath(candidate));
  });
  it('rejects incomplete or altered stored bytes; no release metadata admission', () => {
    expect(() => verifyRetainedArtifact(candidate, Buffer.from('tampered'))).toThrow();
    expect(() => releaseArtifactPath({ ...candidate, checksumSha256: 'bad' })).toThrow();
    expect(() => releaseArtifactPath({ ...candidate, byteLength: 0 })).toThrow();
  });
});
