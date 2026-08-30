import { describe, expect, it } from 'vitest';

import {
  createDeskReturnHref,
  createLibraryReturnHref,
  createStudioHref,
  resolveStudioReturnTarget,
} from '@/features/app-shell/client/navigation';

describe('Studio navigation contract', () => {
  it('round-trips a focused Desk Set through Studio', () => {
    const returnTo = createDeskReturnHref('set:playing-cards', 'desk-context');

    expect(returnTo).toBe('/account?focus=set%3Aplaying-cards&returnContext=desk-context');
    expect(createStudioHref({ returnTo })).toBe('/studio?returnTo=%2Faccount%3Ffocus%3Dset%253Aplaying-cards%26returnContext%3Ddesk-context');
    expect(resolveStudioReturnTarget({
      activeSetId: 'playing-cards',
      activeSetName: 'Playing Cards',
      requestedReturnTo: returnTo,
    })).toEqual({
      href: returnTo,
      label: 'Set',
      ariaLabel: 'Back to Playing Cards',
    });
  });

  it('preserves a Library scope while rejecting non-account destinations', () => {
    const returnTo = createLibraryReturnHref('pipeline', 'library-context');

    expect(returnTo).toBe('/account?section=library&scope=pipeline&returnContext=library-context');
    expect(resolveStudioReturnTarget({
      activeSetId: 'set-one',
      activeSetName: 'Set One',
      requestedReturnTo: returnTo,
    })).toEqual({ href: returnTo, label: 'Library', ariaLabel: 'Back to Pipeline Library' });
    expect(resolveStudioReturnTarget({
      activeSetId: 'set-one',
      activeSetName: 'Set One',
      requestedReturnTo: 'https://example.com',
    }).href).toBe('/account?focus=set%3Aset-one');
  });
});
