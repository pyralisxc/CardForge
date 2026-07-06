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
    <div className="space-y-2">
      {helperText ? (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      ) : null}
      <div className="flex justify-end">
        <Button type="button" size="lg" onClick={onGenerate} disabled={disabled}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Generate Outputs from Data
        </Button>
      </div>
    </div>
  );
}
