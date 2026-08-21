"use client";

import type { ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function ConfirmationDialog({
  trigger,
  title,
  description,
  actionLabel,
  onConfirm,
  destructive = false,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  actionLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="border-[var(--cf-warning-border)] bg-[var(--cf-surface)] text-[var(--cf-text)]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-2xl text-[var(--cf-text-strong)]">{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm leading-6 text-[var(--cf-text-muted)]">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11 border-[var(--cf-border-strong)] bg-transparent text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)]">
            Go back
          </AlertDialogCancel>
          <AlertDialogAction
            className={`min-h-11 ${destructive ? 'bg-[#9b3f32] text-white hover:bg-[#b24a3b]' : 'bg-[var(--cf-accent)] text-[var(--cf-warning-surface)] hover:bg-[#efd08a]'}`}
            onClick={onConfirm}
          >
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
