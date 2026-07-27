import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('developer cockpit routing', () => {
  it('keeps public recruitment separate from the protected workspace', () => {
    const publicPage = source('src/app/developer/page.tsx');
    const cockpitPage = source('src/app/developer/cockpit/page.tsx');

    expect(publicPage).toContain('DeveloperProgramPage');
    expect(publicPage).not.toContain('DeveloperCockpitPage');
    expect(cockpitPage).toContain('DeveloperCockpitPage');
    expect(cockpitPage).toContain('index: false');
  });
});
