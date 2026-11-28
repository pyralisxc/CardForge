"use client";

import { Button } from '@/components/ui/button';

/** Both entry points present the same explicit choice after a changed folder copy. */
export function FolderSaveConflictChoices({ busy, reason, onSaveNew, onCancel }: {
  busy: boolean;
  reason: 'unverified' | 'changed';
  onSaveNew: () => void;
  onCancel: () => void;
}) {
  return <div role="alert" className="space-y-2 rounded border border-amber-500 p-3 text-sm">
    <p>{reason === 'changed' ? 'This folder file has changed. CardForge cannot confirm whether the newer file is a Set or a workspace backup.' : 'CardForge cannot confirm whether this older file is a Set or a workspace backup.'} Save as new keeps the original folder file and this device's work.</p>
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onSaveNew}>Save as new copy</Button>
      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
    </div>
  </div>;
}
