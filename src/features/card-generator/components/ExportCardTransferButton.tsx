"use client";

import { FileJson } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { exportCardProjectPackage } from '@/features/project/client/locations';

export function ExportCardTransferButton({ cardUniqueId, canUseProjectFiles, ariaLabel }: { cardUniqueId: string; canUseProjectFiles: boolean; ariaLabel?: string }) {
  const { toast } = useToast();
  const [working, setWorking] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-10 w-10 shrink-0"
      aria-label={ariaLabel || 'Export editable card'}
      title="Export editable card"
      disabled={working}
      onClick={async (event) => {
        event.stopPropagation();
        if (!canUseProjectFiles) {
          toast({ title: 'Project-file access required', description: 'Open Profile to review access to portable CardForge files.' });
          return;
        }
        setWorking(true);
        try {
          await exportCardProjectPackage(cardUniqueId);
          toast({ title: 'Card exported', description: 'The editable card and its artwork were saved in a portable CardForge package.' });
        } catch (error) {
          toast({ title: 'Card not exported', description: error instanceof Error ? error.message : 'The card could not be packaged. Try again.', variant: 'destructive' });
        } finally {
          setWorking(false);
        }
      }}
    >
      <FileJson className="h-4 w-4" />
    </Button>
  );
}
