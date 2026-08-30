"use client";

import { Info } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function FieldHelp({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="grid h-6 w-6 shrink-0 place-items-center border border-[var(--cf-border)] text-[var(--cf-accent)] hover:border-[var(--cf-accent)] hover:text-[var(--cf-text-strong)]"
          aria-label="More information"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border-[var(--cf-border-strong)] bg-[var(--cf-surface)] text-[var(--cf-text)]">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
