"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { StoredDisplayCard } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import type { PendingTemplateRetarget } from '@/features/creator-workbench/hooks/useTemplateStudioHandoffs';
import type { PendingTemplateSaveImpact } from '@/features/template-editor/client';
import type { ProjectImportMode, ProjectImportPreview } from '@/features/project/client/ui';

interface StudioConfirmationDialogsProps {
  templatePendingDeleteId: string | null;
  templates: TCGCardTemplate[];
  storedCards: StoredDisplayCard[];
  onCloseTemplateDelete: () => void;
  onConfirmTemplateDelete: () => void;
  pendingTemplateSaveImpact: PendingTemplateSaveImpact | null;
  onCancelTemplateSave: () => void;
  onConfirmTemplateSaveShared: () => void;
  onConfirmTemplateSaveFork: () => void;
  onTemplateSaveVariantNameChange: (name: string) => void;
  pendingTemplateRetarget: PendingTemplateRetarget | null;
  onDismissTemplateRetarget: () => void;
  onApplyTemplateRetarget: () => void;
  pendingProjectImport: { preview: ProjectImportPreview } | null;
  onClearProjectImport: () => void;
  onApplyProjectImport: (mode: ProjectImportMode) => void;
}

export function StudioConfirmationDialogs({
  templatePendingDeleteId,
  templates,
  storedCards,
  onCloseTemplateDelete,
  onConfirmTemplateDelete,
  pendingTemplateSaveImpact,
  onCancelTemplateSave,
  onConfirmTemplateSaveShared,
  onConfirmTemplateSaveFork,
  onTemplateSaveVariantNameChange,
  pendingTemplateRetarget,
  onDismissTemplateRetarget,
  onApplyTemplateRetarget,
  pendingProjectImport,
  onClearProjectImport,
  onApplyProjectImport,
}: StudioConfirmationDialogsProps) {
  const template = templates.find((item) => item.id === templatePendingDeleteId);
  const frontDependentCount = storedCards.filter((card) => card.templateId === templatePendingDeleteId).length;
  const backDependentCount = storedCards.filter((card) => card.backingTemplateId === templatePendingDeleteId && card.templateId !== templatePendingDeleteId).length;

  return (
    <>
      <AlertDialog open={Boolean(templatePendingDeleteId)} onOpenChange={(open) => !open && onCloseTemplateDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Template?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm leading-6">
                <p>&quot;{template?.name || templatePendingDeleteId || 'This Template'}&quot; will be permanently removed from this browser.</p>
                {frontDependentCount > 0 ? <p>{frontDependentCount} Artifact{frontDependentCount === 1 ? '' : 's'} use it as their required front design and will also be removed.</p> : null}
                {backDependentCount > 0 ? <p>{backDependentCount} other Artifact{backDependentCount === 1 ? '' : 's'} use it only as a back. Those Artifacts will remain and become front-only.</p> : null}
                {!frontDependentCount && !backDependentCount ? <p>No generated Artifacts currently depend on this Template.</p> : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={onConfirmTemplateDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Template</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pendingTemplateSaveImpact ? <AlertDialog open onOpenChange={(open) => !open && onCancelTemplateSave()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save “{pendingTemplateSaveImpact.templateName}”?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm leading-6">
                <p>{pendingTemplateSaveImpact.affectedArtifactCount} linked Artifact{pendingTemplateSaveImpact.affectedArtifactCount === 1 ? '' : 's'} currently use this design.</p>
                {pendingTemplateSaveImpact.removedFieldKeys.length ? <p><strong>Remove:</strong> {pendingTemplateSaveImpact.removedFieldKeys.join(', ')}. Those stored values will be removed from the Artifacts that adopt this saved design.</p> : null}
                {pendingTemplateSaveImpact.addedRequiredFieldKeys.length ? <p><strong>Needs work:</strong> {pendingTemplateSaveImpact.addedRequiredFieldKeys.join(', ')} will be required after this Save. Existing Artifacts without values stay visible and are marked as needing work.</p> : null}
                {pendingTemplateSaveImpact.selectedArtifactCount > 0 ? <p>The current selection contains {pendingTemplateSaveImpact.selectedArtifactCount} Artifact{pendingTemplateSaveImpact.selectedArtifactCount === 1 ? '' : 's'}.</p> : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingTemplateSaveImpact.canFork ? <div className="space-y-2"><label htmlFor="template-variant-name" className="text-sm font-medium">Variant name</label><Input id="template-variant-name" value={pendingTemplateSaveImpact.variantName} onChange={(event) => onTemplateSaveVariantNameChange(event.target.value)} /></div> : null}
          <AlertDialogFooter className="flex-wrap">
            <AlertDialogCancel onClick={onCancelTemplateSave}>Keep editing</AlertDialogCancel>
            {pendingTemplateSaveImpact.canFork ? <Button type="button" variant={pendingTemplateSaveImpact.canSaveShared ? 'outline' : 'default'} disabled={!pendingTemplateSaveImpact.variantName.trim()} onClick={onConfirmTemplateSaveFork}>{pendingTemplateSaveImpact.selectedArtifactCount > 0 ? `Save variant for ${pendingTemplateSaveImpact.selectedArtifactCount}` : 'Save personal variant'}</Button> : null}
            {pendingTemplateSaveImpact.canSaveShared ? <AlertDialogAction onClick={onConfirmTemplateSaveShared}>Save shared changes</AlertDialogAction> : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog> : null}

      {pendingTemplateRetarget ? <AlertDialog open onOpenChange={(open) => !open && onDismissTemplateRetarget()}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Use the saved back for this set?</AlertDialogTitle><AlertDialogDescription>&quot;{pendingTemplateRetarget.name}&quot; is saved. {pendingTemplateRetarget.count > 0 ? <>Apply it to the current set and {pendingTemplateRetarget.count} existing card{pendingTemplateRetarget.count === 1 ? '' : 's'}?</> : 'Apply it to the current set?'}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={onDismissTemplateRetarget}>Keep current back</AlertDialogCancel><AlertDialogAction onClick={onApplyTemplateRetarget}>Use saved back</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog> : null}

      <AlertDialog open={Boolean(pendingProjectImport)} onOpenChange={(open) => !open && onClearProjectImport()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import project file?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm leading-6">
                <p>{pendingProjectImport?.preview.fileName || 'Selected file'} includes {pendingProjectImport?.preview.templateCount ?? 0} Template{pendingProjectImport?.preview.templateCount === 1 ? '' : 's'}, {pendingProjectImport?.preview.outputCount ?? 0} card{pendingProjectImport?.preview.outputCount === 1 ? '' : 's'}, {pendingProjectImport?.preview.appearanceStyleCount ?? 0} style preset{pendingProjectImport?.preview.appearanceStyleCount === 1 ? '' : 's'}, and {pendingProjectImport?.preview.customAssetCount ?? 0} custom asset{pendingProjectImport?.preview.customAssetCount === 1 ? '' : 's'}.</p>
                {(pendingProjectImport?.preview.templateIdConflicts.length || pendingProjectImport?.preview.templateNameConflicts.length) ? <p>Matching Templates found: {[...(pendingProjectImport?.preview.templateIdConflicts ?? []), ...(pendingProjectImport?.preview.templateNameConflicts ?? [])].slice(0, 4).join(', ')}. Different snapshots are kept independent rather than silently replacing another Set&apos;s design.</p> : null}
                <p>Replace loads the file as the local project. Merge adds its work while preserving independent Template snapshots when designs differ.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><Button type="button" variant="outline" onClick={() => onApplyProjectImport('merge')}>Merge Into Current</Button><AlertDialogAction onClick={() => onApplyProjectImport('replace')}>Replace Project</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
