import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CardForgeSurface } from '@/components/ui/cardforge-presentation';
import type { GeneratorBackWorkflowMode } from '@/features/app-shell/hooks/useTemplateStudioHandoffs';

const WORKFLOW_GUIDANCE: Record<GeneratorBackWorkflowMode, string> = {
  edit: 'Edit the selected back, save it, then return to the same set.',
  create: 'Create and save a matching back, then choose whether to apply it to this set.',
  manage: 'Choose an existing back to edit, or create another design for the set.',
};

export function GeneratorBackWorkflowBanner({
  mode,
  onReturn,
}: {
  mode: GeneratorBackWorkflowMode;
  onReturn: () => void;
}) {
  return (
    <CardForgeSurface className="no-print flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cf-accent-strong)]">Card back workflow</p>
        <p className="mt-1 text-sm text-[var(--cf-text-muted)]">{WORKFLOW_GUIDANCE[mode]}</p>
      </div>
      <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={onReturn}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Make Cards
      </Button>
    </CardForgeSurface>
  );
}
