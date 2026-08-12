import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = (file: string) => readFile(path.join(process.cwd(), file), 'utf8');

describe('analytics consent presentation', () => {
  it('always gives visitors the three explicit consent choices', async () => {
    const provider = await source('src/features/analytics/components/AnalyticsProvider.tsx');
    expect(provider).toContain('>Accept</Button>');
    expect(provider).toContain('>Accept once</Button>');
    expect(provider).toContain('>Decline</Button>');
  });

  it('supports required, current popup, and quieter banner presentations', async () => {
    const provider = await source('src/features/analytics/components/AnalyticsProvider.tsx');
    expect(provider).toContain("presentation === 'required_popup'");
    expect(provider).toContain("presentation === 'popup'");
    expect(provider).toContain("presentation === 'banner'");
    expect(provider).toContain('aria-modal={requiredChoice}');
    expect(provider).toContain("appContent?.setAttribute('inert', '')");
    expect(provider).toContain("const reviewingPrivacy = pathname === '/privacy'");
    expect(provider).toContain('&& !reviewingPrivacy');
  });
});
