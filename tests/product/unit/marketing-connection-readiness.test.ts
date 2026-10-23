import { describe, expect, it } from 'vitest';
import { resolveMarketingConnectionReadiness, type MarketingConnectionSummary } from '../../../src/features/marketing-distribution/model';

const example: MarketingConnectionSummary = {
  id: 'fixture', provider: 'meta', service: 'facebook', externalAccountId: 'page-fixture',
  displayName: 'Page', grantedScopes: [], expiresAt: null, status: 'active', statusNote: '',
  lastVerifiedAt: '2026-10-23T14:00:00Z', createdAt: '2026-10-23T12:00:00Z', updatedAt: '2026-10-23T14:00:00Z',
};

describe('Owner social connection readiness', () => {
  it('never conflates a stored active row with a recent verification', () => {
    expect(resolveMarketingConnectionReadiness(example, Date.parse('2026-10-23T15:00:00Z'))).toBe('verified');
    expect(resolveMarketingConnectionReadiness(example, Date.parse('2026-10-25T15:00:00Z'))).toBe('stale');
    expect(resolveMarketingConnectionReadiness({ ...example, lastVerifiedAt: null })).toBe('not_verified');
  });
  it('preserves provider errors and expiration independently of publishing availability', () => {
    expect(resolveMarketingConnectionReadiness({ ...example, status: 'revoked' })).toBe('revoked');
    expect(resolveMarketingConnectionReadiness({ ...example, status: 'error' })).toBe('error');
    expect(resolveMarketingConnectionReadiness({ ...example, expiresAt: '2026-10-01T00:00:00Z' })).toBe('expired');
  });
});
