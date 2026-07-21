"use client";

import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BulkDataResolutionDialogProps {
  open: boolean;
  issues: string[];
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
}

export function BulkDataResolutionDialog({
  open,
  issues,
  onOpenChange,
  children,
}: BulkDataResolutionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(86dvh,48rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            We found something to fix
          </DialogTitle>
          <DialogDescription>
            Fix the items below, then return to add your cards.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {issues.map((issue) => <li key={issue}>{issue}</li>)}
        </ul>
        {children}
      </DialogContent>
    </Dialog>
  );
}
