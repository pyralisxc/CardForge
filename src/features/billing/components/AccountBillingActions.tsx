"use client";

import { CreditCard, ReceiptText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useBillingPortalActions } from '@/features/billing/hooks/useBillingPortalActions';
import { useCheckoutActions } from '@/features/billing/hooks/useCheckoutActions';

export function AccountBillingActions({
  authConfigured,
  canManageBilling,
  effectiveSignedIn,
  checkoutLabel,
  showCheckout,
}: {
  authConfigured: boolean;
  canManageBilling: boolean;
  effectiveSignedIn: boolean;
  checkoutLabel: string;
  showCheckout: boolean;
}) {
  const { toast } = useToast();
  const { handleStartCheckout, isCheckoutStarting } = useCheckoutActions({
    authConfigured,
    isSignedIn: effectiveSignedIn,
    toast,
  });
  const { handleOpenBillingPortal, isBillingPortalOpening } = useBillingPortalActions({
    isSignedIn: effectiveSignedIn,
    toast,
  });

  return (
    <>
      {canManageBilling ? (
        <Button
          size="lg"
          variant="outline"
          className="min-w-[11rem] border-[#d8b365]/70 bg-[#120e09] font-semibold text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]"
          onClick={handleOpenBillingPortal}
          disabled={isBillingPortalOpening}
        >
          <ReceiptText className="mr-2 h-5 w-5" />
          {isBillingPortalOpening ? 'Opening billing...' : 'Manage billing'}
        </Button>
      ) : null}
      {showCheckout ? (
        <Button
          size="lg"
          variant="outline"
          className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]"
          onClick={handleStartCheckout}
          disabled={isCheckoutStarting}
        >
          <CreditCard className="mr-2 h-5 w-5" />
          {isCheckoutStarting ? 'Checking access...' : checkoutLabel}
        </Button>
      ) : null}
    </>
  );
}
