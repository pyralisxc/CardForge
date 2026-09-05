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
import type { StoredDisplayCard } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import type { PendingTemplateRetarget } from '@/features/creator-workbench/hooks/useTemplateStudioHandoffs';
import type { ProjectImportMode, ProjectImportPreview } from '@/features/project/client/ui';

interface StudioConfirmationDialogsProps {
  templatePendingDeleteId: string | null;
  templates: TCGCardTemplate[];
  storedCards: StoredDisplayCard[];
  onCloseTemplateDelete: () => void;
  onConfirmTemplateDelete: () => void;
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
  pendingTemplateRetarget,
  onDismissTemplateRetarget,
  onApplyTemplateRetarget,
  pendingProjectImport,
  onClearProjectImport,
  onApplyProjectImport,
}: StudioConfirmationDialogsProps) {
  const template = templates.find((item) => item.id === templatePendingDeleteId);
  const dependentCardCount = storedCards.filter((card) => card.templateId === templatePendingDeleteId).length;

  return (
    <>
      <AlertDialog open={Boolean(templatePendingDeleteId)} onOpenChange={(open) => !open && onCloseTemplateDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Template?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{template?.name || templatePendingDeleteId || 'This Template'}&quot; will be permanently removed from this browser.{' '}
              {dependentCardCount} card{dependentCardCount === 1 ? '' : 's'} using it will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmTemplateDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pendingTemplateRetarget ? (
        <AlertDialog open onOpenChange={(open) => !open && onDismissTemplateRetarget()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingTemplateRetarget.side === 'back' ? 'Use the saved back for this set?' : 'Use the saved design on existing cards?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                &quot;{pendingTemplateRetarget.name}&quot; is saved.{' '}
                {pendingTemplateRetarget.side === 'back'
                  ? pendingTemplateRetarget.count > 0
                    ? <>Apply it to the current set and {pendingTemplateRetarget.count} existing card{pendingTemplateRetarget.count === 1 ? '' : 's'}?</>
                    : 'Apply it to the current set?'
                  : <>{pendingTemplateRetarget.count} existing card{pendingTemplateRetarget.count === 1 ? '' : 's'} still use the protected built-in design.</>}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={onDismissTemplateRetarget}>
                {pendingTemplateRetarget.side === 'back' ? 'Keep current back' : 'New cards only'}
              </AlertDialogCancel>
              <AlertDialogAction onClick={onApplyTemplateRetarget}>
                {pendingTemplateRetarget.side === 'back' ? 'Use saved back' : 'Update existing cards'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      <AlertDialog open={Boolean(pendingProjectImport)} onOpenChange={(open) => !open && onClearProjectImport()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import project file?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm leading-6">
                <p>
                  {pendingProjectImport?.preview.fileName || 'Selected file'} includes{' '}
                  {pendingProjectImport?.preview.templateCount ?? 0} Template{pendingProjectImport?.preview.templateCount === 1 ? '' : 's'},{' '}
                  {pendingProjectImport?.preview.outputCount ?? 0} card{pendingProjectImport?.preview.outputCount === 1 ? '' : 's'},{' '}
                  {pendingProjectImport?.preview.appearanceStyleCount ?? 0} style preset{pendingProjectImport?.preview.appearanceStyleCount === 1 ? '' : 's'}, and{' '}
                  {pendingProjectImport?.preview.customAssetCount ?? 0} custom asset{pendingProjectImport?.preview.customAssetCount === 1 ? '' : 's'}.
                </p>
                {(pendingProjectImport?.preview.templateIdConflicts.length || pendingProjectImport?.preview.templateNameConflicts.length) ? (
                  <p>
                    Matching templates found: {[
                      ...(pendingProjectImport?.preview.templateIdConflicts ?? []),
                      ...(pendingProjectImport?.preview.templateNameConflicts ?? []),
                    ].slice(0, 4).join(', ')}.
                  </p>
                ) : null}
                <p>Replace loads the file as the local project. Merge adds or updates Templates, cards, styles, assets, and export settings without clearing current local work.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="button" variant="outline" onClick={() => onApplyProjectImport('merge')}>Merge Into Current</Button>
            <AlertDialogAction onClick={() => onApplyProjectImport('replace')}>Replace Project</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
