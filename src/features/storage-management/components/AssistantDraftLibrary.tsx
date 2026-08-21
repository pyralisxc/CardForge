"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2, Sparkles, Trash2 } from 'lucide-react';

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
import { useToast } from '@/components/ui/use-toast';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

interface StudioDocumentSummary {
  id: string;
  title: string;
  creationSource: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  expiresAt: string;
  retentionHours: number;
  deletedAt: string | null;
  purgeAfter: string | null;
}

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export function AssistantDraftLibrary({
  isSignedIn,
  refreshVersion,
}: {
  isSignedIn: boolean;
  refreshVersion: number;
}) {
  const { toast } = useToast();
  const [studioDocuments, setStudioDocuments] = useState<StudioDocumentSummary[]>([]);
  const [deletedStudioDocuments, setDeletedStudioDocuments] = useState<StudioDocumentSummary[]>([]);
  const [draftRetentionHours, setDraftRetentionHours] = useState<number | null>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [restoringDocumentId, setRestoringDocumentId] = useState<string | null>(null);
  const [pendingDocumentDelete, setPendingDocumentDelete] = useState<StudioDocumentSummary | null>(null);

  const refreshDocuments = useCallback(async () => {
    if (!isSignedIn) {
      setStudioDocuments([]);
      setDeletedStudioDocuments([]);
      setDraftRetentionHours(null);
      return;
    }
    setLoadingDocuments(true);
    try {
      const response = await fetch('/api/studio-documents', { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to load private working drafts.'));
      const payload = await response.json() as {
        documents?: StudioDocumentSummary[];
        deletedDocuments?: StudioDocumentSummary[];
        retentionHours?: number;
      };
      setStudioDocuments(Array.isArray(payload.documents) ? payload.documents : []);
      setDeletedStudioDocuments(Array.isArray(payload.deletedDocuments) ? payload.deletedDocuments : []);
      setDraftRetentionHours(typeof payload.retentionHours === 'number' ? payload.retentionHours : null);
    } catch (error) {
      toast({
        title: 'Working drafts unavailable',
        description: error instanceof Error ? error.message : 'Unable to load private working drafts.',
        variant: 'destructive',
      });
    } finally {
      setLoadingDocuments(false);
    }
  }, [isSignedIn, toast]);

  useEffect(() => { void refreshDocuments(); }, [refreshDocuments, refreshVersion]);

  const deleteWorkingDraft = useCallback(async (document: StudioDocumentSummary) => {
    setDeletingDocumentId(document.id);
    try {
      const response = await fetch(`/api/studio-documents/${encodeURIComponent(document.id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to delete this working draft.'));
      await refreshDocuments();
      toast({
        title: 'Working draft moved to trash',
        description: `“${document.title}” can be restored for 24 hours. Installed local work and cloud sets were not deleted.`,
      });
    } catch (error) {
      toast({
        title: 'Working draft not deleted',
        description: error instanceof Error ? error.message : 'Unable to delete this working draft.',
        variant: 'destructive',
      });
    } finally {
      setDeletingDocumentId(null);
    }
  }, [refreshDocuments, toast]);

  const restoreWorkingDraft = useCallback(async (document: StudioDocumentSummary) => {
    setRestoringDocumentId(document.id);
    try {
      const response = await fetch(`/api/studio-documents/${encodeURIComponent(document.id)}/restore`, { method: 'POST' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to restore this working draft.'));
      await refreshDocuments();
      toast({
        title: 'Working draft restored',
        description: `“${document.title}” is active again, and its ${draftRetentionHours ?? document.retentionHours}-hour window restarted.`,
      });
    } catch (error) {
      toast({
        title: 'Working draft not restored',
        description: error instanceof Error ? error.message : 'Unable to restore this working draft.',
        variant: 'destructive',
      });
    } finally {
      setRestoringDocumentId(null);
    }
  }, [draftRetentionHours, refreshDocuments, toast]);

  return (
    <>
      <div className="mt-6 border-t border-[#4a3823] pt-5">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#e2aa4a]" /><h3 className="font-serif text-xl text-[#fff1c7]">AI &amp; Studio working drafts</h3></div>
        <p className="mt-1 text-xs leading-5 text-[#a9946c]">These are temporary private collaboration documents. Opening or updating one restarts its {draftRetentionHours ? `${draftRetentionHours}-hour` : 'plan-specific'} active window; visiting this page does not. Expired drafts remain recoverable for 24 hours.</p>
        {!isSignedIn ? (
          <p className="mt-3 text-sm text-[#cbb58b]">Sign in to see private working drafts.</p>
        ) : loadingDocuments ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-[#cbb58b]"><Loader2 className="h-4 w-4 animate-spin" /> Loading working drafts…</p>
        ) : studioDocuments.length ? (
          <div className="mt-3 space-y-2">
            {studioDocuments.map((document) => (
              <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 border border-[#4a3823] bg-[#15100a] p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#fff1c7]">{document.title}</p>
                  <p className="mt-1 text-xs text-[#bba57c]">Revision {document.revision} · {document.creationSource === 'gpt' ? 'ChatGPT working draft' : 'Studio working document'} · active until {formatDate(document.expiresAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline"><Link href={`/studio?document=${encodeURIComponent(document.id)}&revision=${document.revision}`}>Continue <ExternalLink className="ml-2 h-3.5 w-3.5" /></Link></Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={Boolean(deletingDocumentId)}
                    onClick={() => setPendingDocumentDelete(document)}
                  >
                    {deletingDocumentId === document.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Delete draft
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="mt-3 text-sm text-[#cbb58b]">No private working drafts are attached to this account.</p>}

        {deletedStudioDocuments.length ? (
          <div className="mt-5 border-t border-[#3c2c1b] pt-4">
            <h4 className="text-sm font-semibold text-[#f0c77a]">Recoverable trash</h4>
            <p className="mt-1 text-xs leading-5 text-[#8f7b57]">CardForge permanently removes these drafts and their private artwork after the listed time.</p>
            <div className="mt-3 space-y-2">
              {deletedStudioDocuments.map((document) => (
                <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 border border-[#4a3823] bg-[#100c08] p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#fff1c7]">{document.title}</p>
                    <p className="mt-1 text-xs text-[#bba57c]">Permanently removed after {formatDate(document.purgeAfter ?? document.updatedAt)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(restoringDocumentId)}
                    onClick={() => void restoreWorkingDraft(document)}
                  >
                    {restoringDocumentId === document.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Restore draft
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <AlertDialog
        open={pendingDocumentDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingDocumentId) setPendingDocumentDelete(null);
        }}
      >
        <AlertDialogContent className="border-[#6d4f2b] bg-[#15100a] text-[#f7ead0]">
          <AlertDialogHeader>
            <AlertDialogTitle>Move this private working draft to trash?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-[#c7b288]">
              {pendingDocumentDelete
                ? `“${pendingDocumentDelete.title}” will be hidden now and remain recoverable for 24 hours. Installed local work and cloud sets will remain.`
                : 'The private working draft will be hidden now and remain recoverable for 24 hours. Installed local work and cloud sets will remain.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#755632] bg-transparent text-[#f8e3b0]">Keep draft</AlertDialogCancel>
            <AlertDialogAction
              disabled={!pendingDocumentDelete || Boolean(deletingDocumentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const document = pendingDocumentDelete;
                setPendingDocumentDelete(null);
                if (document) void deleteWorkingDraft(document);
              }}
            >
              Move to trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
