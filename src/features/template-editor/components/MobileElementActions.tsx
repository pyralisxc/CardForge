"use client";

import { Copy, PencilLine, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { FreeformCardElement } from '@/domain/templates';

interface MobileElementActionsProps {
  element: FreeformCardElement | null;
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onOpenChange: (open: boolean) => void;
}

export function MobileElementActions({
  element,
  onDelete,
  onDuplicate,
  onEdit,
  onOpenChange,
}: MobileElementActionsProps) {
  return (
    <Dialog open={element !== null} onOpenChange={onOpenChange}>
      <DialogContent className="fixed bottom-0 left-0 top-auto max-h-[min(80dvh,32rem)] max-w-none translate-x-0 translate-y-0 gap-3 overflow-y-auto rounded-t-[14px] border-[#3b3324] bg-[#0b0f16] p-4 text-[var(--cf-text)] sm:left-1/2 sm:bottom-auto sm:top-1/2 sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[12px]">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="text-base text-[var(--cf-text)]">{element?.name || 'Layer'} actions</DialogTitle>
          <DialogDescription className="text-[#aeb6c4]">Choose what to do with this layer.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Button type="button" variant="outline" className="justify-start gap-2 border-[#4a5361] bg-[var(--cf-editor-control)] text-[var(--cf-text)] hover:bg-[#1b2430] hover:text-[var(--cf-text)]" onClick={onEdit}>
            <PencilLine className="h-4 w-4" />
            Edit layer
          </Button>
          <Button type="button" variant="outline" className="justify-start gap-2 border-[#4a5361] bg-[var(--cf-editor-control)] text-[var(--cf-text)] hover:bg-[#1b2430] hover:text-[var(--cf-text)]" onClick={onDuplicate}>
            <Copy className="h-4 w-4" />
            Duplicate layer
          </Button>
          <Button type="button" variant="outline" className="justify-start gap-2 border-[#8a3b3b] bg-[#1b1113] text-[#f4b6b6] hover:bg-[#2a1519] hover:text-[#ffd0d0]" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            Delete layer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
