import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import type { TCGCardTemplate } from '@/domain/templates';
import { ContributorRevisionContinue } from '@/features/pipeline/components/ContributorRevisionContinue';
import { retainReviewedTemplateAttempt, resolveTemplatePipelineAttempt } from '@/features/template-editor/lib/templatePipelineAttempts';
import { TemplatePipelineAttemptRecovery } from '@/features/template-editor/components/TemplatePipelineAttemptRecovery';
const template: TCGCardTemplate = { id: 'saved-personal', name: 'Saved personal design', aspectRatio: '63:88', templateSource: 'user', freeformCanvas: { width: 100, height: 100, elements: [] } };
const revisionBase = { parentSubmissionId: '11111111-1111-4111-8111-111111111111', assetId: 'shared-original', reviewedAt: '2026-11-26T12:00:00Z', parentContentVersion: 'a'.repeat(32) };
const ignore = () => {};
function Fixture() {
  const [destination, setDestination] = useState('');
  return <><ContributorRevisionContinue templates={[template, { ...template, id: 'other-personal', name: 'Other saved design' }]} revisionBase={revisionBase} onContinue={async (snapshot, base) => {
    const { attempt, created } = await retainReviewedTemplateAttempt(snapshot, base);
    const result = await resolveTemplatePipelineAttempt(attempt, created);
    if (!result) throw new Error('No committed draft was found. Check the saved attempt below before retrying its original snapshot.');
    setDestination(result);
  }} renderRecovery={(templateId, busy, onReadyChange) => <TemplatePipelineAttemptRecovery templateId={templateId} busy={busy}
    onAttemptsChange={ignore} onReadyChange={onReadyChange} onOpenDestination={setDestination} />} />
    <output aria-label="Opened Pipeline destination">{destination}</output></>;
}
createRoot(document.body).render(<Fixture />);
