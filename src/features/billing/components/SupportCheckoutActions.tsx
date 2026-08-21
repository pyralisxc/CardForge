'use client';

import { useState } from 'react';
import { ArrowUpRight, HeartHandshake } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { CreatorSupportOffering } from '@/features/billing/lib/billing';

const formatMoney = (amountCents: number, currency: string): string => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: currency.toUpperCase(),
}).format(amountCents / 100);

export function SupportCheckoutActions({
  currency,
  monthlyAmountsCents,
  oneTimeMaximumCents,
  oneTimeMinimumCents,
  oneTimePresetCents,
  portalUrl,
}: {
  currency: string;
  monthlyAmountsCents: readonly number[];
  oneTimeMaximumCents: number;
  oneTimeMinimumCents: number;
  oneTimePresetCents: number;
  portalUrl: string;
}) {
  const [oneTimeAmount, setOneTimeAmount] = useState((oneTimePresetCents / 100).toFixed(2));
  const [pendingChoice, setPendingChoice] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const startCheckout = async (offering: CreatorSupportOffering, amountCents: number) => {
    const choice = `${offering}:${amountCents}`;
    setPendingChoice(choice);
    setMessage('Connecting securely to Stripe…');
    try {
      const response = await fetch('/api/billing/support/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offering, amountCents }),
      });
      const body = await response.json() as { url?: string; error?: { message?: string } };
      if (!response.ok || !body.url) {
        throw new Error(body.error?.message ?? 'Unable to start support checkout.');
      }
      window.location.assign(body.url);
    } catch (error) {
      setPendingChoice(null);
      setMessage(error instanceof Error ? error.message : 'Unable to start support checkout.');
    }
  };

  const parsedOneTimeAmount = Number(oneTimeAmount);
  const oneTimeAmountCents = Number.isFinite(parsedOneTimeAmount)
    ? Math.round(parsedOneTimeAmount * 100)
    : 0;
  const oneTimeAmountIsValid = /^\d+(?:\.\d{1,2})?$/.test(oneTimeAmount)
    && oneTimeAmountCents >= oneTimeMinimumCents
    && oneTimeAmountCents <= oneTimeMaximumCents;

  return (
    <div className="mt-8 rounded-[var(--public-radius)] border border-[#9f8a69] bg-[#fffaf0] p-6 shadow-[var(--public-shadow)]">
      <div className="flex items-start gap-3">
        <HeartHandshake className="mt-1 h-6 w-6 shrink-0 text-[#775817]" aria-hidden="true" />
        <div>
          <h2 className="font-[var(--public-font-display)] text-2xl font-semibold text-[#2f2418]">Choose voluntary support</h2>
          <p className="mt-2 text-base leading-7 text-[#5f5548]">Stripe shows the same amount and recurrence again before you authorize payment.</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--public-radius)] border border-[#ad9d84] bg-[var(--public-ivory)] p-5">
          <p className="text-lg font-bold text-[#2f2418]">Choose a one-time amount</p>
          <p className="mt-2 text-sm leading-6 text-[#5f5548]">A single voluntary support payment. It does not renew.</p>
          <label className="mt-4 grid gap-2 text-sm font-semibold text-[#2f2418]">
            Amount in USD
            <span className="flex min-h-11 items-center rounded-[var(--public-radius)] border border-[var(--cf-text-subtle)] bg-white px-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#76551c]">
              <span aria-hidden="true" className="text-[#2f2418]">$</span>
              <input
                aria-describedby="one-time-support-range"
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[#2f2418] outline-none placeholder:text-[#6b5b47]"
                inputMode="decimal"
                min={oneTimeMinimumCents / 100}
                max={oneTimeMaximumCents / 100}
                step="0.01"
                type="number"
                value={oneTimeAmount}
                onChange={(event) => setOneTimeAmount(event.target.value)}
              />
            </span>
          </label>
          <p id="one-time-support-range" className="mt-2 text-xs text-[#5f5548]">
            Choose {formatMoney(oneTimeMinimumCents, currency)}–{formatMoney(oneTimeMaximumCents, currency)}.
          </p>
          <Button
            type="button"
            className="mt-5 min-h-11 w-full bg-[var(--public-charcoal)] text-[var(--public-ivory)]"
            disabled={pendingChoice !== null || !oneTimeAmountIsValid}
            onClick={() => void startCheckout('support_one_time', oneTimeAmountCents)}
          >
            {pendingChoice === `support_one_time:${oneTimeAmountCents}` ? 'Connecting…' : `Support once — ${formatMoney(oneTimeAmountCents, currency)}`}
          </Button>
        </div>
        <div className="rounded-[var(--public-radius)] border border-[#ad9d84] bg-[var(--public-ivory)] p-5">
          <p className="text-lg font-bold text-[#2f2418]">Choose monthly support</p>
          <p className="mt-2 text-sm leading-6 text-[#5f5548]">Renews monthly until canceled. Cancel future renewals through Stripe at any time.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {monthlyAmountsCents.map((amountCents) => (
              <Button
                key={amountCents}
                type="button"
                className="min-h-11 bg-[var(--public-charcoal)] text-[var(--public-ivory)]"
                disabled={pendingChoice !== null}
                onClick={() => void startCheckout('support_monthly', amountCents)}
              >
                {pendingChoice === `support_monthly:${amountCents}` ? 'Connecting…' : `${formatMoney(amountCents, currency)} / month`}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-5 text-sm leading-6 text-[#5f5548]">Support is separate from Creator Pass and does not provide CardForge product access.</p>
      <a className="mt-4 inline-flex min-h-11 items-center gap-2 font-bold text-[#76551c]" href={portalUrl} rel="noreferrer">
        Manage or cancel monthly support <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </a>
      <p aria-live="polite" className="mt-3 min-h-6 text-sm font-semibold text-[#76551c]">{message}</p>
    </div>
  );
}
