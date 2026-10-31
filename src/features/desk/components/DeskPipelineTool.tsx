'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { EnvironmentToolLayer } from '@/features/app-shell/client/environment';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LibraryRevisionEntry } from '@/features/storage-management/client';
import { useProjectLibraryWorkspace } from '@/features/project/client/libraryWorkspace';
import type { PipelineReviewTarget, PipelineSubmission } from '@/features/pipeline/client';
import { createCardFaceExportRenderer, getExportProfile } from '@/features/card-generator/client/export';
import type { DisplayCard } from '@/domain/rendering';
import type { CardFace } from '@/domain/cards';
import type { WorkbenchBusinessIdentity } from '@/features/creator-workbench/client';
import type { ContributorAccessSessionState } from '@/features/contributor-access/client';
const OwnerPanel = dynamic(() => import('@/features/pipeline/client/owner').then(module => module.OwnerContributorProgramPanel));
const Design = dynamic(() => import('@/features/creator-workbench/client').then(module => module.CreatorWorkbench), {ssr:false});
const renderSpecimen = async (card: DisplayCard, face: CardFace, dpi: number) => {
  const renderer = createCardFaceExportRenderer({...getExportProfile('physical', dpi), canvasPixelRatio:1});
  try { return await renderer.renderToBlob(card,face); } finally { renderer.cleanup(); }
};

/** Composes existing governance and revision owners while Desk retains its scene. */
export function DeskPipelineTool({target, name, owner, businessIdentity, initialContributorAccess, onClose, onMutated}: {
  target: PipelineReviewTarget; name: string; owner: boolean; businessIdentity: WorkbenchBusinessIdentity;
  initialContributorAccess: ContributorAccessSessionState; onClose: () => void; onMutated: () => void;
}) {
  const [dirty,setDirty] = useState(false); const [blocked,setBlocked] = useState<string|null>(null);
  const [discard,setDiscard] = useState(false); const [revisionKind,setRevisionKind] = useState<'templates'|'elementPresets'|null>(null);
  const [templateId,setTemplateId] = useState<string|null>(null);
  const project = useProjectLibraryWorkspace();
  const revise = (submission: PipelineSubmission) => {
    if (dirty || blocked || submission.id !== target.submissionId || submission.status !== 'published' || !['templates','elementPresets'].includes(submission.assetType)) return;
    setRevisionKind(submission.assetType as 'templates'|'elementPresets');
  };
  return <>
    <EnvironmentToolLayer id="desk-pipeline-tool" eyebrow="Selected Desk artifact" title={templateId ? 'Design governed revision' : revisionKind ? 'Revise existing' : 'Review & manage'} summary={`${name} · ${target.submissionId} · revision ${target.revisionNumber ?? 'unassigned'}`} closeLabel="Return to Desk" onClose={onClose} dirty={dirty} closeBlocked={!!blocked} onDirtyCloseRequest={()=>setDiscard(true)} manageHistory presentation="provider-handoff">
      {!owner ? <p>Owner access is required. Close this tool to return to Desk.</p> : templateId ? <Design tool="design" businessIdentity={businessIdentity} initialContributorAccess={initialContributorAccess} contextTemplateId={templateId} onDirtyChange={setDirty} onCloseTool={()=>dirty ? setDiscard(true) : onClose()} />
        : revisionKind ? <LibraryRevisionEntry target={target} kind={revisionKind} onDirtyChange={setDirty} onCloseBlockedChange={setBlocked} onTemplateDraft={draft=>{
          const id=project.actions.installTemplate(draft,'user');
          if(id){ project.actions.openTemplateDesign(id); setTemplateId(id); }
        }} />
        : <OwnerPanel target={target} onDirtyChange={setDirty} onRevise={revise} onSelectionMutated={()=>{onClose();onMutated();}} renderTemplateSpecimen={renderSpecimen} />}
    </EnvironmentToolLayer>
    <AlertDialog open={discard} onOpenChange={setDiscard}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{blocked ? 'Resolve this attempt before closing' : 'Discard unsaved tool changes?'}</AlertDialogTitle><AlertDialogDescription>{blocked ?? 'Keep editing to preserve this local tool draft. Discard closes the tool; the Desk selection and camera remain unchanged.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel>{!blocked && <AlertDialogAction onClick={()=>{setDiscard(false);onClose();}}>Discard</AlertDialogAction>}</AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
