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
      <AlertDialogContent className="border-[#7d5a2e] bg-[#15100a] text-[#f7ead0]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-2xl text-[#fff1c7]">{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm leading-6 text-[#c7b288]">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11 border-[#6d4f2b] bg-transparent text-[#ffe7ad] hover:bg-[#2a1b0d]">
            Go back
          </AlertDialogCancel>
          <AlertDialogAction
            className={`min-h-11 ${destructive ? 'bg-[#9b3f32] text-white hover:bg-[#b24a3b]' : 'bg-[#d8b365] text-[#1b1209] hover:bg-[#efd08a]'}`}
            onClick={onConfirm}
          >
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
