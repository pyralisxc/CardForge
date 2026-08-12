import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = (...parts: string[]) => readFile(path.join(process.cwd(), ...parts), 'utf8');

describe('analytics ownership', () => {
  it('keeps provider credentials and reporting behind the owner route', async () => {
    const route = await source('src', 'app', 'api', 'owner', 'analytics', 'route.ts');
    const client = await source('src', 'features', 'analytics', 'client.ts');

    expect(route).toContain('getCurrentOwnerAccess');
    expect(route).toContain('getOwnerAnalyticsSnapshot');
    expect(client).not.toContain('SERVICE_ACCOUNT');
    expect(client).not.toContain('PRIVATE_KEY');
  });

  it('keeps Google as measurement owner instead of duplicating raw events in Supabase', async () => {
    const reporting = await source('src', 'features', 'analytics', 'server', 'googleReporting.ts');
    expect(reporting).toContain('analyticsdata.googleapis.com');
    expect(reporting).toContain('searchconsole.googleapis.com');
    expect(reporting).not.toContain('supabase');
  });
});
