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
    <section className="relative mb-3 flex flex-col items-stretch gap-2 border-b border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] px-3 py-2.5 pr-12 no-print sm:flex-row sm:items-center sm:gap-x-5">
      <div className="w-full min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">Your first Set</p>
        <p className="mt-0.5 text-sm text-[var(--cf-text-muted)]"><strong className="text-[var(--cf-text-strong)]">Choose a Template, then generate cards.</strong> Work saves in this browser while you build.</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1.5 top-1/2 h-9 w-9 -translate-y-1/2 text-[var(--cf-text-muted)] hover:bg-[var(--cf-surface-hover)] hover:text-[var(--cf-text-strong)]"
        onClick={onDismiss}
        aria-label="Dismiss first run guide"
      >
        <X className="h-4 w-4" />
      </Button>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <Button type="button" size="sm" onClick={onStartMakingCards}>Generate cards</Button>
        <Button type="button" size="sm" variant="outline" onClick={onEditDesignFirst}>Choose Template</Button>
      </div>
    </section>
  );
}
