import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_BUSINESS_IDENTITY } from '@/features/business-identity/client';
import {
  createBreadcrumbStructuredData,
  createCardForgeStructuredData,
  createFounderProfileStructuredData,
  serializeStructuredData,
} from '@/features/public-site/server';

describe('structured site identity', () => {
  it('identifies the CardForge brand, software, and Cameron as operator', () => {
    const graph = createCardForgeStructuredData(DEFAULT_BUSINESS_IDENTITY);
    const serialized = JSON.stringify(graph);

    expect(serialized).toContain('"@type":"Brand"');
    expect(serialized).toContain('"@type":"SoftwareApplication"');
    expect(serialized).toContain('Cameron Locke');
    expect(serialized).toContain('CardForge Studio');
    expect(serialized).toContain('Oregon');
  });

  it('publishes a Person as the main entity of Cameron’s ProfilePage', () => {
    const graph = createFounderProfileStructuredData(DEFAULT_BUSINESS_IDENTITY);
    const serialized = JSON.stringify(graph);

    expect(serialized).toContain('"@type":"ProfilePage"');
    expect(serialized).toContain('"@type":"Person"');
    expect(serialized).toContain('"mainEntity"');
    expect(serialized).toContain('https://cardforges.com/cameron');
  });

  it('builds absolute breadcrumb URLs and escapes script-breaking content', () => {
    const breadcrumbs = createBreadcrumbStructuredData(DEFAULT_BUSINESS_IDENTITY, [
      { name: 'Home', path: '/' },
      { name: 'About <CardForge>', path: '/about' },
    ]);
    const serialized = serializeStructuredData(breadcrumbs);

    expect(serialized).toContain('https://cardforges.com/about');
    expect(serialized).toContain('About \\u003cCardForge>');
    expect(serialized).not.toContain('<CardForge>');
  });

  it('ships a factual public founder route', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/cameron/page.tsx'), 'utf8');
    const founderProfile = readFileSync(join(process.cwd(), 'src/features/public-site/model/founderProfile.ts'), 'utf8');

    expect(source).toContain('Cameron Locke');
    expect(source).toContain('profile.introduction');
    expect(founderProfile).toContain('sole proprietor');
    expect(source).toContain('createFounderProfileStructuredData');
    expect(source).not.toMatch(/d\/b\/a/i);
  });
});
