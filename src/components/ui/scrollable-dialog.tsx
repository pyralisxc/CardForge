"use client";

import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { DialogContent } from '@/components/ui/dialog';
import { cn } from '@/shared/classNames';

export function ScrollableDialogContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogContent>) {
  return (
    <DialogContent
      className={cn('flex max-h-[calc(100dvh-1rem)] min-h-0 flex-col overflow-hidden sm:max-h-[90dvh]', className)}
      {...props}
    />
  );
}

export function ScrollableDialogBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'cardforge-scroll-body min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] touch-pan-y',
        className,
      )}
    >
      {children}
    </div>
  );
}
