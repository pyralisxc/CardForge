"use client";

import { useState } from 'react';

import type { useToast } from '@/components/ui/use-toast';
import type { ProductAccessOffering } from '@/features/billing/lib/billing';
import { extractErrorMessage, withNextStep } from '@/shared/userFacingErrors';

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
          'Add Clerk and Stripe environment variables before testing paid export checkout.',
          'Configure .env.local from .env.example, restart the app, then try again.'
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
            'Stripe checkout is not enabled in this environment.',
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
      const payload = await response.json() as {
        url?: string;
        error?: string | { message?: string };
      };
      if (!response.ok || !payload.url) {
        const message = typeof payload.error === 'string'
          ? payload.error
          : payload.error?.message;
        throw new Error(message || 'Unable to start checkout.');
      }

      window.location.assign(payload.url);
    } catch (error) {
      toast({
        title: 'Checkout unavailable',
        description: withNextStep(
          extractErrorMessage(error),
          'Check Stripe environment variables and payment method settings, then retry.'
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
