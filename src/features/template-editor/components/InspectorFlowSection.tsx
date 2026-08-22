"use client";

import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/shared/classNames';

interface InspectorFlowSectionProps {
  title: string;
  description?: string;
  badge?: string;
  defaultOpen?: boolean;
  collapsible?: boolean;
  children: ReactNode;
}

export function InspectorFlowSection({
  title,
  description,
  badge,
  defaultOpen = true,
  collapsible = true,
  children,
}: InspectorFlowSectionProps) {
  const contentId = useId();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const open = collapsible ? isOpen : true;
  const headerContent = (
    <span className="min-w-0 space-y-1">
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d5ad54]">{title}</span>
        {badge ? (
          <span className="rounded-full border border-[#3a3142] bg-[var(--cf-editor-control)] px-2 py-0.5 text-[10px] font-medium text-[#b7bdc9]">
            {badge}
          </span>
        ) : null}
      </span>
      {description ? (
        <span className="block text-[11px] leading-4 text-[#8f95a3]">{description}</span>
      ) : null}
    </span>
  );

  return (
    <section className="cardforge-inspector-flow-section rounded-[7px] border border-[var(--cf-editor-border)] bg-[#0b0f15]/72">
      {collapsible ? (
        <button
          type="button"
          className="cardforge-inspector-flow-section-header flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setIsOpen((value) => !value)}
        >
          {headerContent}
          <ChevronDown className={cn('mt-0.5 h-4 w-4 shrink-0 text-[#8f95a3] transition-transform', open && 'rotate-180 text-[#d5ad54]')} />
        </button>
      ) : (
        <div className="cardforge-inspector-flow-section-header flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left">
          {headerContent}
        </div>
      )}
      {open ? (
        <div id={contentId} className="cardforge-inspector-flow-section-content space-y-2 border-t border-[#202631] px-3 py-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}
