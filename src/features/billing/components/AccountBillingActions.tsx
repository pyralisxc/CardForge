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
  portalLabel = 'Manage or change plan',
  showDesignerCheckout = false,
  showCheckout,
}: {
  authConfigured: boolean;
  canManageBilling: boolean;
  effectiveSignedIn: boolean;
  checkoutLabel: string;
  portalLabel?: string;
  showDesignerCheckout?: boolean;
  showCheckout: boolean;
}) {
  const { toast } = useToast();
  const { checkoutOffering, handleStartCheckout, isCheckoutStarting } = useCheckoutActions({
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
          {isBillingPortalOpening ? 'Opening billing...' : portalLabel}
        </Button>
      ) : null}
      {showCheckout ? (
        <Button
          size="lg"
          variant="outline"
          className="border-[#d8b365]/70 bg-transparent text-[#f8e3b0] hover:bg-[#2a1b0d] hover:text-[#fff1c7]"
          onClick={() => handleStartCheckout('creator_pass')}
          disabled={isCheckoutStarting}
        >
          <CreditCard className="mr-2 h-5 w-5" />
          {checkoutOffering === 'creator_pass' ? 'Checking access...' : checkoutLabel}
        </Button>
      ) : null}
      {showDesignerCheckout ? (
        <Button
          size="lg"
          variant="outline"
          className="border-[#846634] bg-transparent text-[#f8e3b0] hover:border-[#d9a441] hover:bg-[#24180e] hover:text-[#fff1c7]"
          onClick={() => handleStartCheckout('designer_pass')}
          disabled={isCheckoutStarting}
        >
          <CreditCard className="mr-2 h-5 w-5" />
          {checkoutOffering === 'designer_pass' ? 'Checking access...' : 'Choose Designer'}
        </Button>
      ) : null}
    </>
  );
}
