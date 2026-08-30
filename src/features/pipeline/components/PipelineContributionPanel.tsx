"use client";

import { useCallback, useEffect, useState } from 'react';
import { UploadCloud } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import type { PipelineContributorSummary } from '@/features/pipeline/lib/pipelineProgram';
import { PipelineSubmissionPanel } from '@/features/pipeline/components/PipelineSubmissionPanel';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

interface PipelineContributorSummaryResponse {
  summary: PipelineContributorSummary;
}

export function PipelineContributionPanel({
  compact = false,
  initialSubmitSetId = null,
}: {
  compact?: boolean;
  initialSubmitSetId?: string | null;
}) {
  const { toast } = useToast();
  const [context, setContext] = useState<PipelineContributorSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadContext = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/pipeline/contributor-summary', { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to prepare a Pipeline submission.'));
      const body = await response.json() as PipelineContributorSummaryResponse;
      setContext(body.summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to prepare a Pipeline submission.';
      setLoadError(message);
      toast({ title: 'Submission unavailable', description: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { void loadContext(); }, [loadContext]);

  const className = compact ? '' : 'mx-auto max-w-5xl px-5 pb-14 md:px-8';
  if (isLoading) {
    return <section className={className}><div className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5 text-sm text-[var(--cf-text-muted)]">Preparing submission...</div></section>;
  }
  if (!context) {
    return <section className={className}>
      <div className="border border-[var(--cf-warning-border)] bg-[var(--cf-surface-inset)] p-5">
        <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]"><UploadCloud className="h-5 w-5" /><strong>Submission unavailable</strong></div>
        <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">{loadError}</p>
        <Button className="mt-4" variant="outline" onClick={() => void loadContext()}>Retry</Button>
      </div>
    </section>;
  }

  return <TooltipProvider>
    <section className={className}>
      <PipelineSubmissionPanel context={context} onSubmitted={loadContext} initialSetId={initialSubmitSetId} />
    </section>
  </TooltipProvider>;
}
