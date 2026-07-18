"use client";

import type { ElementType, ReactNode } from 'react';
import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/shared/classNames';

interface WorkspaceSectionProps {
  title: string;
  icon?: ElementType;
  defaultOpen?: boolean;
  panelClassName: string;
  children: ReactNode;
}

export function WorkspaceSection({
  title,
  icon: Icon,
  defaultOpen = true,
  panelClassName,
  children,
}: WorkspaceSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <Card className={cn(panelClassName, 'rounded-[8px]')}>
      <CardHeader className="p-0">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-2.5 py-2.5 text-left"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => setIsOpen((open) => !open)}
        >
          <CardTitle className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b7bdc9]">
            {Icon ? <Icon className="h-3.5 w-3.5 text-[#d5ad54]" /> : null}
            {title}
          </CardTitle>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-[#8f95a3] transition-transform', isOpen && 'rotate-180 text-[#d5ad54]')} />
        </button>
      </CardHeader>
      {isOpen ? (
        <CardContent id={contentId} className="p-2.5 pt-0">
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
}
