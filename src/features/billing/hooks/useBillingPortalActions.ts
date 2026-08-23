"use client";

import { useState } from 'react';

import type { useToast } from '@/components/ui/use-toast';
import { extractErrorMessage, withNextStep } from '@/shared/userFacingErrors';
import { readApiError } from '@/infrastructure/http/clientResponses';

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
      if (!response.ok) throw await readApiError(response, 'Unable to open billing management.');
      const payload = await response.json() as { url?: string };
      if (!payload.url) throw new Error('Billing management did not return a destination.');

      window.location.assign(payload.url);
    } catch (error) {
      toast({
        title: 'Billing unavailable',
        description: withNextStep(
          extractErrorMessage(error),
          'Retry once. If it still fails, contact CardForge support from the signed-in account.'
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
