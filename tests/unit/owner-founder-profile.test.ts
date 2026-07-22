import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('owner-managed founder profile', () => {
  it('loads founder profile into the owner console payload', () => {
    const store = source('src/features/owner/lib/ownerConsoleStore.ts');
    const contract = source('src/features/owner/lib/ownerConsole.ts');

    expect(store).toContain('getFounderProfile()');
    expect(store).toContain('founderProfile,');
    expect(contract).toContain('founderProfile: FounderProfile;');
  });

  it('saves founder copy and social links through a dedicated mutation', () => {
    const route = source('src/app/api/owner/console/route.ts');

    expect(route).toContain("body.kind === 'founderProfile'");
    expect(route).toContain('await updateFounderProfile(');
    expect(route.indexOf('await updateFounderProfile(')).toBeLessThan(route.indexOf('revalidateFounderProfile();'));
  });

  it('keeps founder copy focused while Site Media owns the portrait', () => {
    const panel = source('src/features/owner/components/OwnerFounderProfilePanel.tsx');
    const page = source('src/features/owner/components/OwnerConsolePage.tsx');

    expect(page).toContain('OwnerFounderProfilePanel');
    expect(page).toContain('Cameron Profile');
    expect(panel).toContain("kind: 'founderProfile'");
    expect(panel).toContain('Save Cameron profile');
    expect(panel).toContain('Portrait controls now live in Site Media.');
    expect(panel).not.toContain('Upload portrait');
    expect(page).toContain('OwnerSiteMediaPanel');
  });
});
