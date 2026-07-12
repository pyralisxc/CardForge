export interface AccountAccessActionInput {
  canClaimFounderBeta: boolean;
  canStartCheckout: boolean;
  checkoutConfigured: boolean;
  effectiveSignedIn: boolean;
  isClerkSetupIncomplete: boolean;
}

export interface AccountAccessActions {
  showCheckout: boolean;
  showFounderBeta: boolean;
  checkoutLabel: 'Buy Creator Pass' | 'Unlock export' | 'Beta access by invite';
}

export const getAccountAccessActions = ({
  canClaimFounderBeta,
  canStartCheckout,
  checkoutConfigured,
  effectiveSignedIn,
  isClerkSetupIncomplete,
}: AccountAccessActionInput): AccountAccessActions => {
  const canShowSignedInAccessActions = !isClerkSetupIncomplete && effectiveSignedIn && canStartCheckout;
  const showFounderBeta = canShowSignedInAccessActions && canClaimFounderBeta;
  const showCheckout = canShowSignedInAccessActions && (checkoutConfigured || !showFounderBeta);

  return {
    showCheckout,
    showFounderBeta,
    checkoutLabel: showFounderBeta && checkoutConfigured
      ? 'Buy Creator Pass'
      : checkoutConfigured
        ? 'Unlock export'
        : 'Beta access by invite',
  };
};
