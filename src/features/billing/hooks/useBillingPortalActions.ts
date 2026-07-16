"use client";

import { useState } from 'react';

import type { useToast } from '@/components/ui/use-toast';
import { extractErrorMessage, withNextStep } from '@/shared/userFacingErrors';

type ToastFn = ReturnType<typeof useToast>['toast'];

interface UseBillingPortalActionsInput {
  isSignedIn: boolean;
  toast: ToastFn;
}

export function useBillingPortalActions({
  isSignedIn,
  toast,
}: UseBillingPortalActionsInput) {
  const [isBillingPortalOpening, setIsBillingPortalOpening] = useState(false);

  const handleOpenBillingPortal = async () => {
    if (!isSignedIn) {
      toast({
        title: 'Sign in required',
        description: withNextStep(
          'Billing management is tied to your Stripe customer record.',
          'Sign in with the account that started Creator Pass, then try again.'
        ),
      });
      return;
    }

    setIsBillingPortalOpening(true);
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
      });
      const payload = await response.json() as {
        url?: string;
        error?: string | { message?: string };
      };
      if (!response.ok || !payload.url) {
        const message = typeof payload.error === 'string'
          ? payload.error
          : payload.error?.message;
        throw new Error(message || 'Unable to open billing management.');
      }

      window.location.assign(payload.url);
    } catch (error) {
      toast({
        title: 'Billing unavailable',
        description: withNextStep(
          extractErrorMessage(error),
          'Open the Owner Console billing snapshot or Stripe Dashboard to confirm the customer record.'
        ),
        variant: 'destructive',
      });
    } finally {
      setIsBillingPortalOpening(false);
    }
  };

  return {
    handleOpenBillingPortal,
    isBillingPortalOpening,
  };
}
