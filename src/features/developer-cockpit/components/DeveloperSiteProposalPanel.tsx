"use client";

import { useState } from 'react';
import { FileDiff, Loader2, PencilLine, Plus, Send, ShieldCheck, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  mutateSiteProposal,
  type DeveloperSiteWorkspaceView,
} from '@/features/developer-cockpit/client/api';
import { ConfirmationDialog as CockpitConfirmationDialog } from '@/components/ui/confirmation-dialog';
import type { SiteContentProposal } from '@/features/developer-cockpit/model';
import type { SiteContentBlockSlug } from '@/features/public-site/client';

type ProposalDraft = {
  slug: SiteContentBlockSlug;
  proposedBody: string;
  rationale: string;
};

const proposalStatusLabels: Record<SiteContentProposal['status'], string> = {
  draft: 'Draft', submitted: 'Awaiting review', changes_requested: 'Changes requested', published: 'Published', rejected: 'Rejected', cancelled: 'Cancelled',
};
const fieldClassName = 'min-h-11 w-full border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 py-2 text-sm text-[var(--cf-accent-text)] placeholder:text-[#6f5b3a]';
const emptyDraft = (cockpit: DeveloperSiteWorkspaceView): ProposalDraft => ({
  slug: cockpit.siteContentBlocks[0]?.slug ?? 'landing.hero.headline',
  proposedBody: cockpit.siteContentBlocks[0]?.body ?? '',
  rationale: '',
});

export function DeveloperSiteProposalPanel({ cockpit, onChange }: { cockpit: DeveloperSiteWorkspaceView; onChange: (cockpit: DeveloperSiteWorkspaceView) => void }) {
  const canPropose = cockpit.scopes.includes('site.propose');
  const canPublish = cockpit.scopes.includes('site.publish');
  const [showComposer, setShowComposer] = useState(canPropose && cockpit.siteProposals.length === 0);
  const [draft, setDraft] = useState<ProposalDraft>(() => emptyDraft(cockpit));
  const [editing, setEditing] = useState<SiteContentProposal | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const selectedBlock = cockpit.siteContentBlocks.find((block) => block.slug === draft.slug);

  const run = async (key: string, success: string, action: () => Promise<DeveloperSiteWorkspaceView>) => {
    setBusy(key); setError(''); setMessage('');
    try { onChange(await action()); setMessage(success); return true; }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Unable to update the site-copy proposal.'); return false; }
    finally { setBusy(null); }
  };

  const closeComposer = () => { setEditing(null); setDraft(emptyDraft(cockpit)); setShowComposer(false); };
  const selectBlock = (slug: SiteContentBlockSlug) => { const block = cockpit.siteContentBlocks.find((candidate) => candidate.slug === slug); setDraft((current) => ({ ...current, slug, proposedBody: block?.body ?? '' })); };
  const save = async () => {
    const saved = editing
      ? await run(`save:${editing.id}`, 'Site proposal changes saved.', () => mutateSiteProposal('PATCH', { action: 'save', proposalId: editing.id, expectedVersion: editing.version, proposal: draft }))
      : await run('create', 'Site proposal draft created.', () => mutateSiteProposal('POST', draft));
    if (saved) closeComposer();
  };
  const workflow = (proposal: SiteContentProposal, action: 'submit' | 'request_changes' | 'publish' | 'reject' | 'cancel', success: string) => run(`${action}:${proposal.id}`, success, () => mutateSiteProposal('PATCH', { action, proposalId: proposal.id, expectedVersion: proposal.version, reviewNote: reviewNotes[proposal.id] ?? '' }));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4"><div className="flex items-center gap-3"><PencilLine className="h-5 w-5 text-[var(--cf-accent-strong)]" /><div><p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">Public site copy</p><p className="text-sm text-[var(--cf-text-muted)]">Propose and review changes to owner-managed public text.</p></div></div>{canPropose && !showComposer ? <Button type="button" className="min-h-11" onClick={() => { setDraft(emptyDraft(cockpit)); setEditing(null); setShowComposer(true); }}><Plus className="mr-2 h-4 w-4" />New site proposal</Button> : null}</div>
      {error ? <p role="alert" className="border border-[var(--cf-danger-border)] bg-[var(--cf-danger-surface-muted)] p-3 text-sm text-[var(--cf-danger)]">{error}</p> : null}
      {message ? <p role="status" className="border border-[#497352] bg-[#0e170f] p-3 text-sm text-[#a8e7b8]">{message}</p> : null}

      {showComposer && canPropose ? <article className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">{editing ? 'Editing proposal' : 'New proposal'}</p><h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Improve public site copy</h2></div><Button type="button" className="min-h-11" variant="outline" onClick={closeComposer}>Close editor</Button></div><div className="mt-4 grid gap-3"><label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">Site text to update<select className={fieldClassName} value={draft.slug} disabled={Boolean(editing)} onChange={(event) => selectBlock(event.target.value as SiteContentBlockSlug)}>{cockpit.siteContentBlocks.map((block) => <option key={block.slug} value={block.slug}>{block.group} / {block.section} / {block.label}</option>)}</select></label><label className="grid gap-1 text-xs text-[var(--cf-text-muted)]"><span className="flex justify-between"><span>Proposed copy</span><span>{draft.proposedBody.length}/{selectedBlock?.maxLength ?? 800}</span></span><textarea className={`${fieldClassName} min-h-32`} maxLength={selectedBlock?.maxLength ?? 800} value={draft.proposedBody} onChange={(event) => setDraft({ ...draft, proposedBody: event.target.value })} /></label><label className="grid gap-1 text-xs text-[var(--cf-text-muted)]"><span className="flex justify-between"><span>Why this helps</span><span>{draft.rationale.length}/800</span></span><textarea className={`${fieldClassName} min-h-24`} maxLength={800} value={draft.rationale} onChange={(event) => setDraft({ ...draft, rationale: event.target.value })} placeholder="Name the ambiguity, audience need, SEO intent, or product truth this improves." /></label></div><Button type="button" className="mt-4 min-h-11" disabled={Boolean(busy)} onClick={() => void save()}>{busy === 'create' || busy?.startsWith('save:') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDiff className="mr-2 h-4 w-4" />}{editing ? 'Save changes' : 'Create proposal'}</Button></article> : null}
      {!canPropose ? <article className="border border-[var(--cf-warning-border)] bg-[var(--cf-surface-inset)] p-5"><h2 className="font-serif text-xl text-[var(--cf-text-strong)]">Site proposals are not enabled</h2><p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">The owner can enable this scope independently from asset and campaign access.</p></article> : null}

      <div className="space-y-3">
        {cockpit.siteProposals.length === 0 ? <article className="border border-dashed border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-6 text-center"><FileDiff className="mx-auto h-6 w-6 text-[var(--cf-text-subtle)]" /><p className="mt-3 text-sm text-[var(--cf-text-muted)]">No site-copy proposals yet.</p></article> : cockpit.siteProposals.map((proposal) => {
          const current = cockpit.siteContentBlocks.find((block) => block.slug === proposal.slug);
          const ownProposal = proposal.contributorId === cockpit.currentUserId;
          const canEdit = ownProposal && (proposal.status === 'draft' || proposal.status === 'changes_requested');
          const canCancel = (ownProposal || cockpit.isOwner) && ['draft', 'changes_requested', 'submitted'].includes(proposal.status);
          const cancelLabel = proposal.status === 'submitted' ? 'Withdraw proposal' : 'Cancel proposal';
          const reviewNote = reviewNotes[proposal.id] ?? '';
          return <article key={proposal.id} className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-serif text-xl text-[var(--cf-text-strong)]">{current?.label ?? proposal.slug}</h3><StatusBadge status={proposal.status} /></div><p className="mt-2 text-xs text-[var(--cf-text-subtle)]">{proposal.contributorName ?? proposal.contributorEmail ?? proposal.contributorId} · v{proposal.version}</p></div><div className="flex flex-wrap gap-2">{canEdit ? <Button type="button" className="min-h-11" variant="outline" onClick={() => { setEditing(proposal); setDraft({ slug: proposal.slug, proposedBody: proposal.proposedBody, rationale: proposal.rationale }); setShowComposer(true); }}>Edit</Button> : null}{canEdit ? <Button type="button" className="min-h-11" onClick={() => void workflow(proposal, 'submit', 'Site proposal submitted for owner review.')} disabled={Boolean(busy)}><Send className="mr-2 h-4 w-4" />Submit for review</Button> : null}{canCancel ? <CockpitConfirmationDialog trigger={<Button type="button" className="min-h-11" variant="ghost" disabled={Boolean(busy)}>{cancelLabel}</Button>} title={`${cancelLabel}?`} description="This closes the proposal while preserving its audit history. The action cannot be undone." actionLabel={cancelLabel} destructive onConfirm={() => void workflow(proposal, 'cancel', 'Site proposal cancelled.')} /> : null}</div></div><div className="mt-4 grid gap-3 lg:grid-cols-2"><div className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4"><p className="text-xs uppercase tracking-[0.14em] text-[var(--cf-text-subtle)]">Current live copy</p><p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">{proposal.baseBody}</p></div><div className="border border-[var(--cf-success-border)] bg-[#10150d] p-4"><p className="text-xs uppercase tracking-[0.14em] text-[#a8e7b8]">Proposed copy</p><p className="mt-2 text-sm leading-6 text-[#d8e7c8]">{proposal.proposedBody}</p></div></div><p className="mt-3 text-sm leading-6 text-[var(--cf-text-muted)]"><span className="text-[var(--cf-text-subtle)]">Rationale:</span> {proposal.rationale}</p>{proposal.reviewNote ? <p className="mt-3 border border-[var(--cf-warning-border)] bg-[var(--cf-warning-surface)] p-3 text-sm text-[var(--cf-warning)]">Owner note: {proposal.reviewNote}</p> : null}{canPublish && proposal.status === 'submitted' ? <div className="mt-4 border border-[var(--cf-warning-border)] bg-[var(--cf-warning-surface)] p-4">{current?.body !== proposal.baseBody ? <p className="mb-3 text-sm text-[var(--cf-danger)]">The live text changed after this proposal was created. Update the proposal using the latest live copy before publishing.</p> : null}<textarea aria-label={`Review note for ${current?.label ?? proposal.slug}`} className={`${fieldClassName} min-h-24`} value={reviewNote} onChange={(event) => setReviewNotes((notes) => ({ ...notes, [proposal.id]: event.target.value }))} placeholder="Owner review note or requested changes" /><div className="mt-3 flex flex-wrap gap-2"><Button type="button" className="min-h-11" variant="outline" disabled={Boolean(busy) || !reviewNote.trim()} onClick={() => void workflow(proposal, 'request_changes', 'Proposal returned with requested changes.')}>Request changes</Button><CockpitConfirmationDialog trigger={<Button type="button" className="min-h-11" variant="outline" disabled={Boolean(busy) || !reviewNote.trim()}><XCircle className="mr-2 h-4 w-4" />Reject</Button>} title="Reject this proposal?" description="This ends the proposal review and preserves the decision note in its history." actionLabel="Reject proposal" destructive onConfirm={() => void workflow(proposal, 'reject', 'Site proposal rejected.')} /><CockpitConfirmationDialog trigger={<Button type="button" className="min-h-11" disabled={Boolean(busy) || current?.body !== proposal.baseBody}><ShieldCheck className="mr-2 h-4 w-4" />Publish to live site</Button>} title="Publish this copy to the live site?" description={<><p>This replaces the current text for <strong>{current?.label ?? proposal.slug}</strong> immediately.</p><div className="mt-3 grid gap-2"><p className="border border-[var(--cf-border-subtle)] p-2"><span className="text-[var(--cf-text-subtle)]">Current:</span> {proposal.baseBody}</p><p className="border border-[var(--cf-success-border)] p-2"><span className="text-[#a8e7b8]">New:</span> {proposal.proposedBody}</p></div></>} actionLabel="Publish to live site" onConfirm={() => void workflow(proposal, 'publish', 'Site copy published successfully.')} /></div></div> : null}</article>;
        })}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: SiteContentProposal['status'] }) {
  return <span className="border border-[var(--cf-border-strong)] px-2 py-1 text-xs uppercase tracking-[0.12em] text-[var(--cf-accent-strong)]">{proposalStatusLabels[status]}</span>;
}
