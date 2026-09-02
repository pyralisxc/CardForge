import { describe, expect, it } from 'vitest';

import {
  readCheckoutResumeIntent,
  serializeCheckoutResumeIntent,
} from '@/features/billing/lib/checkoutResume';

describe('checkout resume intent', () => {
  it('preserves the exact safe CardForge object and tool return context', () => {
    const returnTo = '/account?focus=set%3Aplaying-cards&artifact=ace-spades&tool=output#export';
    const serialized = serializeCheckoutResumeIntent({ offering: 'designer_pass', returnTo });

    expect(readCheckoutResumeIntent(serialized, returnTo)).toEqual({
      offering: 'designer_pass',
      returnTo,
    });
  });

  it('does not consume malformed, stale, or non-local resume data', () => {
    expect(readCheckoutResumeIntent('{', '/account')).toBeNull();
    expect(readCheckoutResumeIntent(JSON.stringify({ offering: 'creator_pass', returnTo: '/account?tool=output' }), '/account')).toBeNull();
    expect(readCheckoutResumeIntent(JSON.stringify({ offering: 'unknown', returnTo: '/account' }), '/account')).toBeNull();
    expect(readCheckoutResumeIntent(JSON.stringify({ offering: 'creator_pass', returnTo: 'https://attacker.example' }), 'https://attacker.example')).toBeNull();
  });
});
