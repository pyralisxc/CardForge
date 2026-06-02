"use client";

import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

interface InspectorFlowSectionProps {
  title: string;
  description?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function InspectorFlowSection({
  title,
  description,
  badge,
  defaultOpen = true,
  children,
}: InspectorFlowSectionProps) {
  const contentId = useId();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="rounded-[7px] border border-[#252b35] bg-[#0b0f15]/72">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="min-w-0 space-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d5ad54]">{title}</span>
            {badge ? (
              <span className="rounded-full border border-[#3a3142] bg-[#111720] px-2 py-0.5 text-[10px] font-medium text-[#b7bdc9]">
                {badge}
              </span>
            ) : null}
          </span>
          {description ? (
            <span className="block text-[11px] leading-4 text-[#8f95a3]">{description}</span>
          ) : null}
        </span>
        <ChevronDown className={cn('mt-0.5 h-4 w-4 shrink-0 text-[#8f95a3] transition-transform', isOpen && 'rotate-180 text-[#d5ad54]')} />
      </button>
      {isOpen ? (
        <div id={contentId} className="space-y-2 border-t border-[#202631] px-3 py-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}
