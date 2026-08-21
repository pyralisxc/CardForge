"use client";

import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function StudioFirstRunGuide({
  onDismiss,
  onStartMakingCards,
  onEditDesignFirst,
}: {
  onDismiss: () => void;
  onStartMakingCards: () => void;
  onEditDesignFirst: () => void;
}) {
  return (
    <section className="relative mb-4 border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-4 no-print md:p-5">
      <div className="pr-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cf-accent-strong)]">Welcome to the forge</p>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-[var(--cf-text-strong)]">Make one card, then build the set.</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cf-text-muted)]">
          Choose a ready-made Template and add your card details. Your work saves in this browser as you go. Clearing browser data or changing devices can remove this copy; a downloaded project backup is the portable recovery path when it is available to you.
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 text-[var(--cf-text-muted)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]"
        onClick={onDismiss}
        aria-label="Dismiss first run guide"
      >
        <X className="h-4 w-4" />
      </Button>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" onClick={onStartMakingCards}>Start making cards</Button>
        <Button type="button" variant="outline" onClick={onEditDesignFirst}>Build a Template first</Button>
      </div>
    </section>
  );
}
