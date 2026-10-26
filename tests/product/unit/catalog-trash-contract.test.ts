import { describe, expect, it } from 'vitest';
import { catalogTrashCommandSchema } from '@/features/pipeline/lib/catalogTrashContract';

const identity = {
  lineageId: '00000000-0000-4000-8000-000000000001',
  submissionId: '00000000-0000-4000-8000-000000000002',
  registrySubmissionId: '00000000-0000-4000-8000-000000000002',
  revisionHighWater: 3,
};
const active = { identity, trashedAt: null, purgeAfter: null, held: false };
const trashed = { ...active, trashedAt: '2026-10-26T00:00:00Z', purgeAfter: '2026-11-25T00:00:00Z' };
const accepts = (value: unknown) => catalogTrashCommandSchema.safeParse(value).success;

describe('catalog Trash command boundary', () => {
  it('accepts exact native Trash, Restore and Hold/unhold requests', () => {
    expect(accepts({action:'trash',expected:active})).toBe(true);
    expect(accepts({action:'restore',expected:trashed})).toBe(true);
    for (const held of [true, false]) expect(accepts({action:'hold',expected:trashed,held})).toBe(true);
  });
  it('does not accept storage URLs or embedded hashes as catalog targets', () => {
    for (const submissionId of ['https://example.com/clash.webp', 'a'.repeat(64)]) {
      expect(accepts({action:'trash',expected:{...active,identity:{...identity,submissionId}}})).toBe(false);
    }
  });
  it('does not accept caller dependency claims, custom timers, expiry or purge intent', () => {
    for (const extra of [{liveManagedReferences:[]}, {retentionDays:0}, {isOwner:true}]) {
      expect(accepts({action:'trash',expected:active,...extra})).toBe(false);
    }
    expect(accepts({action:'expire',expected:trashed})).toBe(false);
    expect(accepts({action:'purge',expected:trashed})).toBe(false);
  });
  it('requires the observed Trash epoch for Restore/Hold and rejects invalid state', () => {
    expect(accepts({action:'restore',expected:active})).toBe(false);
    expect(accepts({action:'trash',expected:trashed})).toBe(false);
    for (const purgeAfter of [null,'not-a-date','infinity','2026-10-25T00:00:00Z']) {
      expect(accepts({action:'restore',expected:{...trashed,purgeAfter}})).toBe(false);
    }
    expect(accepts({action:'trash',expected:{...active,held:true}})).toBe(false);
  });
  it('requires a finite native revision high-water mark', () => {
    for (const revisionHighWater of [-1, 1.5, NaN, Infinity, 2147483648]) {
      expect(accepts({action:'trash',expected:{...active,identity:{...identity,revisionHighWater}}})).toBe(false);
    }
  });
});
