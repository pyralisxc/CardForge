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

  it('discloses masked public replay and excludes private workspaces', async () => {
    const provider = await source('src/features/analytics/components/AnalyticsProvider.tsx');
    const posthog = await source('src/features/analytics/client/posthog.ts');
    expect(provider).toContain('Google Analytics and PostHog');
    expect(provider).toContain('Studio, account, owner, and developer pages are never recorded');
    expect(posthog).toContain("maskTextSelector: '*'");
    expect(posthog).toContain('maskAllInputs: true');
    expect(posthog).toContain('recordCanvas: false');
    expect(posthog).toContain("person_profiles: 'never'");
    expect(posthog).toContain("persistence: 'sessionStorage'");
    expect(posthog).toContain('blockSelector:');
    expect(posthog).toContain("if (/^(blob|data):/iu.test(value)) return ''");
    expect(posthog).toContain("if (normalizedName === 'style') return ''");
  });

  it('blocks private route DOM before replay can observe it and makes withdrawal win initialization races', async () => {
    const provider = await source('src/features/analytics/components/AnalyticsProvider.tsx');
    const boundary = await source('src/features/analytics/components/AnalyticsReplayBoundary.tsx');
    const posthog = await source('src/features/analytics/client/posthog.ts');
    expect(provider).toContain('useLayoutEffect(() =>');
    expect(provider).toContain("document.addEventListener('click', trackNavigation, true)");
    expect(boundary).toContain("data-analytics-replay={replayAllowed ? 'public' : 'blocked'}");
    expect(boundary).toContain("className={replayAllowed ? undefined : 'ph-no-capture'}");
    expect(posthog).toContain('requestedEpoch !== authorizationEpoch');
    expect(posthog).toContain('analyticsAuthorized = false');
  });
});
