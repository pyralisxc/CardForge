import { describe, expect, it } from 'vitest';

import { getAccountAccessActions } from '@/features/account/lib/accountAccessActions';

describe('account access actions', () => {
  it('lets signed-in free users choose Founder Beta or Creator Pass when both are available', () => {
    expect(getAccountAccessActions({
      canClaimFounderBeta: true,
      canStartCheckout: true,
      checkoutConfigured: true,
      effectiveSignedIn: true,
      isClerkSetupIncomplete: false,
    })).toEqual({
      showCheckout: true,
      showFounderBeta: true,
      checkoutLabel: 'Buy Creator Pass',
    });
  });

  it('falls back to paid checkout when Founder Beta seats are unavailable', () => {
    expect(getAccountAccessActions({
      canClaimFounderBeta: false,
      canStartCheckout: true,
      checkoutConfigured: true,
      effectiveSignedIn: true,
      isClerkSetupIncomplete: false,
    })).toEqual({
      showCheckout: true,
      showFounderBeta: false,
      checkoutLabel: 'Unlock export',
    });
  });

  it('keeps manual beta copy when neither demo claim nor checkout is available', () => {
    expect(getAccountAccessActions({
      canClaimFounderBeta: false,
      canStartCheckout: true,
      checkoutConfigured: false,
      effectiveSignedIn: true,
      isClerkSetupIncomplete: false,
    })).toEqual({
      showCheckout: true,
      showFounderBeta: false,
      checkoutLabel: 'Beta access by invite',
    });
  });
});
