import { describe, expect, it } from 'vitest';

import {
  createDeveloperRequestMailto,
  createRoadmapDeveloperRequestMailto,
  createSupportMailto,
} from '@/lib/contactLinks';
import { DEFAULT_OWNER_SETTINGS } from '@/lib/ownerConsole';

describe('contact links', () => {
  it('creates owner-configured support mailto links', () => {
    const href = createSupportMailto({
      recipient: 'support@example.test',
      subject: 'Need help',
      lines: ['Line one', 'Line two'],
    });

    expect(href).toContain('mailto:support@example.test');
    expect(href).toContain('subject=Need%20help');
    expect(href).toContain('Line%20one%0ALine%20two');
  });

  it('falls back to default support email when no configured recipient is available', () => {
    const href = createDeveloperRequestMailto({
      accountEmail: 'dev@example.test',
      supportEmail: '',
    });

    expect(href).toContain(`mailto:${DEFAULT_OWNER_SETTINGS.supportEmail}`);
    expect(href).toContain('dev%40example.test');
  });

  it('keeps roadmap developer requests routed through the same support destination', () => {
    const href = createRoadmapDeveloperRequestMailto({
      accountEmail: null,
      supportEmail: 'pipeline@example.test',
    });

    expect(href).toContain('mailto:pipeline@example.test');
    expect(href).toContain('CardForge%20developer%20account%20request');
  });
});
