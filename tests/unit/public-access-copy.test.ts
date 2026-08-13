import { describe, expect, it } from 'vitest';

import { getAccessComparisonOptions } from '@/features/public-site/components/AccessComparison';

describe('public access copy', () => {
  it('describes portable project files as free when the owner makes them free', () => {
    const options = getAccessComparisonOptions('free');

    expect(options[0].copy).toContain('portable CardForge project files');
    expect(options[1].copy).toContain('remain free');
  });

  it('describes portable project files as a Creator Pass feature when configured that way', () => {
    const options = getAccessComparisonOptions('creator_pass');

    expect(options[0].copy).not.toContain('project files');
    expect(options[1].copy).toContain('plus portable CardForge project files');
  });
});
