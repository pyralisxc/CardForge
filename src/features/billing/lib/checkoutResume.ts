import type { ProductAccessOffering } from './billing';

export const CHECKOUT_RESUME_KEY = 'cardforge.billing.checkout-resume.v1';

export interface CheckoutResumeIntent {
  offering: ProductAccessOffering;
  returnTo: string;
}

export const serializeCheckoutResumeIntent = (intent: CheckoutResumeIntent): string => JSON.stringify(intent);

export const readCheckoutResumeIntent = (
  raw: string | null,
  currentPath: string,
): CheckoutResumeIntent | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { offering?: unknown; returnTo?: unknown };
    const offering = value.offering === 'creator_pass' || value.offering === 'designer_pass'
      ? value.offering
      : null;
    if (!offering || typeof value.returnTo !== 'string' || value.returnTo !== currentPath || !currentPath.startsWith('/')) {
      return null;
    }
    return { offering, returnTo: currentPath };
  } catch {
    return null;
  }
};
