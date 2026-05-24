"use client";

import { useState } from 'react';

import type { useToast } from '@/hooks/use-toast';
import { extractErrorMessage, withNextStep } from '@/lib/userFacingErrors';

type ToastFn = ReturnType<typeof useToast>['toast'];

interface BillingStatusPayload {
  billing?: {
    checkoutConfigured: boolean;
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
  const [isCheckoutStarting, setIsCheckoutStarting] = useState(false);

  const handleStartCheckout = async () => {
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

    setIsCheckoutStarting(true);
    try {
      const statusResponse = await fetch('/api/billing/status', {
        cache: 'no-store',
      });
      const status = statusResponse.ok
        ? await statusResponse.json() as BillingStatusPayload
        : null;

      if (!status?.billing?.checkoutConfigured) {
        toast({
          title: 'Beta access is manual for now',
          description: withNextStep(
            'Stripe checkout is not enabled yet. Early beta export access is granted by the CardForge team in Clerk.',
            'Ask for beta access, then refresh your account after it is granted.'
          ),
          variant: 'default',
        });
        return;
      }

      const response = await fetch('/api/billing/checkout', {
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
      setIsCheckoutStarting(false);
    }
  };

  return {
    handleStartCheckout,
    isCheckoutStarting,
  };
}
