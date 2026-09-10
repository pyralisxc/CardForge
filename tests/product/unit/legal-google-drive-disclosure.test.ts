import { describe, expect, it } from 'vitest';

import { getDefaultLegalDocument } from '@/features/legal/model/legalDocument';

describe('Google Drive privacy disclosure', () => {
  it('keeps the fallback Privacy Policy aligned with connected Drive behavior', () => {
    const privacy = getDefaultLegalDocument('privacy');

    expect(privacy.effectiveDate).toBe('2026-09-09');
    expect(privacy.body).toContain('drive.file');
    expect(privacy.body).toContain('does not request broad access to all files');
    expect(privacy.body).toContain('encrypted Google OAuth refresh credential');
    expect(privacy.body).toContain('does not delete the user\'s Drive project files');
    expect(privacy.body).toContain('Google API Services User Data Policy');
    expect(privacy.body).toContain('Limited Use requirements');
  });
});