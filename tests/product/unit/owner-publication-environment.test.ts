import { describe, expect, it } from 'vitest';

import {
  getOwnerPublicationPresentation,
  resolveOwnerPublicationEnvironment,
} from '@/features/public-site/model/ownerPublicationEnvironment';

describe('Owner publication environment', () => {
  it('uses Vercel deployment identity as the authority for live-versus-staging wording', () => {
    expect(resolveOwnerPublicationEnvironment('production')).toBe('production');
    expect(resolveOwnerPublicationEnvironment('preview')).toBe('preview');
    expect(resolveOwnerPublicationEnvironment('development')).toBe('development');
    expect(resolveOwnerPublicationEnvironment(undefined)).toBe('development');
  });

  it('labels production actions as live publications', () => {
    const presentation = getOwnerPublicationPresentation('production');

    expect(presentation.badgeLabel).toBe('Production — publishes live');
    expect(presentation.publishActionLabel).toBe('Publish live');
    expect(presentation.publishedDescription('Headline')).toMatch(/live on CardForge/i);
  });

  it('labels Preview actions as staging-only and does not imply production changed', () => {
    const presentation = getOwnerPublicationPresentation('preview');

    expect(presentation.badgeLabel).toBe('Preview — staging only');
    expect(presentation.publishActionLabel).toBe('Publish to Preview');
    expect(presentation.dialogDescription).toMatch(/does not change production/i);
    expect(presentation.publishedDescription('Headline')).toMatch(/production is unchanged/i);
  });

  it('keeps non-Vercel development wording local rather than calling a production-mode build live', () => {
    const presentation = getOwnerPublicationPresentation('development');

    expect(presentation.badgeLabel).toBe('Development — local only');
    expect(presentation.publishActionLabel).toBe('Publish locally');
  });
});
