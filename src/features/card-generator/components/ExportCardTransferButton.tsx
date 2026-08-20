"use client";

import { FileJson } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useCardTransferActions } from '@/features/project/client';

export function ExportCardTransferButton({ cardUniqueId, ariaLabel }: { cardUniqueId: string; ariaLabel?: string }) {
  const { toast } = useToast();
  const { exportCard } = useCardTransferActions({ toast });
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-10 w-10 shrink-0"
      aria-label={ariaLabel || 'Export editable card'}
      title="Export editable card"
      onClick={(event) => {
        event.stopPropagation();
        void exportCard(cardUniqueId);
      }}
    >
      <FileJson className="h-4 w-4" />
    </Button>
  );
}
