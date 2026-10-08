import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { projectStripeProductAccessPrice } from '@/features/billing/server/productAccessPricePresentation';
import {
  DEFAULT_MCP_ALLOWANCES,
  applyProductAccessPricePresentation,
} from '@/features/mcp-usage/lib/mcpUsage';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanChoiceGrid } from '@/features/mcp-usage/components/PlanChoiceGrid';

describe('commercial plan price presentation', () => {
  beforeAll(() => {
    // Ensure the locale formatting assumptions used by customer-facing copy are stable.
    expect(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(8.99)).toContain('8.99');
  });

  it('projects the configured Stripe recurring amount, currency, and interval', () => {
    expect(projectStripeProductAccessPrice({
      id: 'price_creator',
      active: true,
      currency: 'usd',
      unit_amount: 899,
      recurring: { interval: 'month', interval_count: 1 },
    } as never)).toMatchObject({
      available: true,
      priceId: 'price_creator',
      priceLabel: '$8.99',
      priceNote: 'per month',
      currency: 'usd',
      interval: 'month',
      intervalCount: 1,
      provider: 'stripe',
    });

    expect(projectStripeProductAccessPrice({
      id: 'price_quarterly',
      active: true,
      currency: 'usd',
      unit_amount: 2499,
      recurring: { interval: 'month', interval_count: 3 },
    } as never)).toMatchObject({
      available: true,
      priceLabel: '$24.99',
      priceNote: 'every 3 months',
    });
  });

  it('refuses to present inactive or non-recurring Stripe prices as verified checkout prices', () => {
    expect(projectStripeProductAccessPrice({
      id: 'price_inactive',
      active: false,
      currency: 'usd',
      unit_amount: 899,
      recurring: { interval: 'month', interval_count: 1 },
    } as never)).toMatchObject({
      available: false,
      priceLabel: 'Unavailable',
      priceNote: 'Stripe price temporarily unavailable',
    });

    expect(projectStripeProductAccessPrice({
      id: 'price_one_time',
      active: true,
      currency: 'usd',
      unit_amount: 899,
      recurring: null,
    } as never)).toMatchObject({
      available: false,
      priceLabel: 'Unavailable',
    });
  });

  it('replaces legacy paid price strings while leaving Free and inquiry pricing under their native owners', () => {
    const presented = applyProductAccessPricePresentation(DEFAULT_MCP_ALLOWANCES, {
      creator: { available: true, priceLabel: '$9.49', priceNote: 'per month' },
      designer: { available: false, priceLabel: 'Unavailable', priceNote: 'Stripe price temporarily unavailable' },
    });

    expect(presented.find((plan) => plan.planKey === 'free')).toMatchObject({
      priceLabel: '$0',
      priceAuthority: 'fixed',
      priceAvailable: true,
    });
    expect(presented.find((plan) => plan.planKey === 'creator')).toMatchObject({
      priceLabel: '$9.49',
      priceNote: 'per month',
      priceAuthority: 'stripe',
      priceAvailable: true,
    });
    expect(presented.find((plan) => plan.planKey === 'designer')).toMatchObject({
      priceLabel: 'Unavailable',
      priceAuthority: 'stripe',
      priceAvailable: false,
    });
    expect(presented.find((plan) => plan.planKey === 'enterprise')).toMatchObject({
      priceLabel: 'Custom',
      priceAuthority: 'inquiry',
      priceAvailable: true,
    });
  });

  it('removes the paid self-serve action when the configured Stripe price cannot be verified', () => {
    const plans = applyProductAccessPricePresentation(DEFAULT_MCP_ALLOWANCES, {
      creator: { available: false, priceLabel: 'Unavailable', priceNote: 'Stripe price temporarily unavailable' },
      designer: { available: true, priceLabel: '$19.99', priceNote: 'per month' },
    });

    const markup = renderToStaticMarkup(createElement(PlanChoiceGrid, { plans }));
    expect(markup).toContain('Checkout price unavailable');
    expect(markup).toContain('$19.99');
  });
});
