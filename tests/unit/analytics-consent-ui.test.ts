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

  it('discloses allow-listed events without session replay', async () => {
    const provider = await source('src/features/analytics/components/AnalyticsProvider.tsx');
    const posthog = await source('src/features/analytics/client/posthog.ts');
    expect(provider).toContain('Google Analytics and PostHog');
    expect(provider).toContain('no session replay or page content');
    expect(posthog).toContain("person_profiles: 'never'");
    expect(posthog).toContain("persistence: 'sessionStorage'");
    expect(posthog).toContain('disable_session_recording: true');
    expect(posthog).not.toContain('session_recording: {');
    expect(posthog).not.toContain('startSessionRecording');
    expect(posthog).not.toContain('stopSessionRecording');
  });

  it('makes consent withdrawal win product-analytics initialization races', async () => {
    const posthog = await source('src/features/analytics/client/posthog.ts');
    expect(posthog).toContain('requestedEpoch !== authorizationEpoch');
    expect(posthog).toContain('analyticsAuthorized = false');
  });
});
