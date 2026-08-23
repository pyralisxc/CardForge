"use client";

import { useState } from 'react';

import type { useToast } from '@/components/ui/use-toast';
import type { ProductAccessOffering } from '@/features/billing/lib/billing';
import { extractErrorMessage, withNextStep } from '@/shared/userFacingErrors';
import { readApiError } from '@/infrastructure/http/clientResponses';

type ToastFn = ReturnType<typeof useToast>['toast'];

interface BillingStatusPayload {
  billing?: {
    productAccessConfigured: boolean;
    designerPassConfigured: boolean;
  };
}

interface UseCheckoutActionsInput {
  authConfigured: boolean;
  isSignedIn: boolean;
  toast: ToastFn;
}

export function useCheckoutActions({
  authConfigured,
  isSignedIn,
  toast,
}: UseCheckoutActionsInput) {
  const [checkoutOffering, setCheckoutOffering] = useState<ProductAccessOffering | null>(null);

  const handleStartCheckout = async (offering: ProductAccessOffering = 'creator_pass') => {
    if (!authConfigured) {
      toast({
        title: 'Checkout not configured',
        description: withNextStep(
          'Secure checkout is not available right now. Your local work is unchanged.',
          'Try again later or contact CardForge support if checkout should be available.'
        ),
        variant: 'default',
      });
      return;
    }

    if (!isSignedIn) {
      toast({
        title: 'Sign in required',
        description: withNextStep(
          'Paid export is tied to your account entitlement.',
          'Sign in with Google, Apple, Microsoft, GitHub, or email, then start checkout again.'
        ),
        variant: 'default',
      });
      return;
    }

    setCheckoutOffering(offering);
    try {
      const statusResponse = await fetch('/api/billing/status', {
        cache: 'no-store',
      });
      const status = statusResponse.ok
        ? await statusResponse.json() as BillingStatusPayload
        : null;

      const configured = offering === 'designer_pass'
        ? status?.billing?.designerPassConfigured
        : status?.billing?.productAccessConfigured;
      if (!configured) {
        const planName = offering === 'designer_pass' ? 'Designer Pass' : 'Creator Pass';
        toast({
          title: `${planName} checkout is unavailable`,
          description: withNextStep(
            'Secure checkout is not available right now.',
            `Contact CardForge support if you expected ${planName} to be available.`
          ),
          variant: 'default',
        });
        return;
      }

      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ offering }),
      });
      if (!response.ok) throw await readApiError(response, 'Unable to start checkout.');
      const payload = await response.json() as { url?: string };
      if (!payload.url) throw new Error('Secure checkout did not return a destination.');

      window.location.assign(payload.url);
    } catch (error) {
      toast({
        title: 'Checkout unavailable',
        description: withNextStep(
          extractErrorMessage(error),
          'Retry once. If it still fails, contact CardForge support; your account and local work are unchanged.'
        ),
        variant: 'destructive',
      });
    } finally {
      setCheckoutOffering(null);
    }
  };

  return {
    handleStartCheckout,
    checkoutOffering,
    isCheckoutStarting: checkoutOffering !== null,
  };
}
