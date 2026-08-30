"use client";

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface BulkGenerateActionBarProps {
  isLoading: boolean;
  disabled: boolean;
  helperText?: string;
  onGenerate: () => void;
}

export function BulkGenerateActionBar({
  isLoading,
  disabled,
  helperText,
  onGenerate,
}: BulkGenerateActionBarProps) {
  return (
    <div className="sticky bottom-0 z-10 space-y-2 border-t border-[var(--cf-border-strong)] bg-[var(--cf-surface-inset)] px-3 py-3 shadow-[0_-12px_28px_rgb(0_0_0_/_28%)] sm:px-4">
      {helperText ? (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      ) : null}
      <div className="flex justify-end">
        <Button type="button" size="lg" className="min-h-11 w-full sm:w-auto" onClick={onGenerate} disabled={disabled}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Add Cards to Set
        </Button>
      </div>
    </div>
  );
}
