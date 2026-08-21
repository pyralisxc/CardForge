"use client";

import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/shared/classNames';

export function ScrollableDialogContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogContent>) {
  return (
    <DialogContent
      className={cn('flex max-h-[90dvh] min-h-0 flex-col overflow-hidden', className)}
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
    <ScrollArea className={cn('cardforge-scroll-body min-h-0 flex-1', className)}>
      {children}
    </ScrollArea>
  );
}
