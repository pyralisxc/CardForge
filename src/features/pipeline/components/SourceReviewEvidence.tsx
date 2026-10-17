"use client";
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { requireOkResponse } from '@/infrastructure/http/clientResponses';
import { sourceReviewSnapshotSchema, type SourceReviewFacts, type SourceReviewSnapshot } from '../lib/sourceReviewEvidence';

const emptyFacts: SourceReviewFacts = { technicalTrace: '', creatorFacts: null, rightsFacts: null, aiFacts: null };
const labels = { technicalTrace: 'Technical source trace', creatorFacts: 'Creator / authorship evidence', rightsFacts: 'Publication rights / license evidence', aiFacts: 'AI-use disclosure evidence' } as const;

export function SourceReviewEvidence({ submissionId, onVersionChange, onRecorded }: {
  submissionId: string; onVersionChange: (version: number) => void; onRecorded?: () => Promise<void> | void;
}) {
  const [snapshot, setSnapshot] = useState<SourceReviewSnapshot | null>(null);
  const [facts, setFacts] = useState<SourceReviewFacts>(emptyFacts);
  const [status, setStatus] = useState('Loading exact source evidence…');
  const [saving, setSaving] = useState(false);
  const latestFacts = useRef(facts); latestFacts.current = facts;
  const onVersionChangeRef = useRef(onVersionChange); onVersionChangeRef.current = onVersionChange;
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/pipeline/${encodeURIComponent(submissionId)}`);
        await requireOkResponse(response, 'Source evidence is unavailable. Existing observations are unchanged.');
        const result = sourceReviewSnapshotSchema.parse(await response.json());
        if (!active) return;
        setSnapshot(result); setFacts(result.evidence?.facts ?? emptyFacts);
        onVersionChangeRef.current(result.evidence?.version ?? 0);
        setStatus(result.evidence ? `Recorded evidence version ${result.evidence.version}.` : 'No reviewer source evidence recorded. Blank fact fields remain unknown.');
      } catch (error) { if (active) setStatus(error instanceof Error ? error.message : 'Source evidence could not be verified.'); }
    })();
    return () => { active = false; };
  }, [submissionId]);
  const save = async () => {
    if (!snapshot || saving) return;
    const savedFacts = facts;
    setSaving(true);
    try {
      const response = await fetch(`/api/pipeline/${encodeURIComponent(submissionId)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceReviewEvidence: {
          facts: savedFacts, expectedCandidateVersion: snapshot.candidateVersion, expectedEvidenceVersion: snapshot.evidence?.version ?? 0,
        } }),
      });
      await requireOkResponse(response, 'Evidence outcome is unavailable. Keep these observations and retry the same request.');
      const result = await response.json() as { snapshot?: unknown };
      const next = sourceReviewSnapshotSchema.parse(result.snapshot);
      setSnapshot(next); onVersionChangeRef.current(next.evidence!.version);
      setStatus(`Evidence version ${next.evidence!.version} recorded. Approval remains separate.${JSON.stringify(latestFacts.current) !== JSON.stringify(savedFacts) ? ' Newer form edits are still unsaved.' : ''}`);
      await onRecorded?.();
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Evidence could not be confirmed. Keep your observations.'); }
    finally { setSaving(false); }
  };
  return <section className="grid gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-canvas)] p-3" aria-label="Correction source evidence">
    <p className="text-xs font-semibold uppercase tracking-[0.12em]">Reviewer source evidence</p>
    <p className="text-xs leading-5 text-[var(--cf-text-muted)]">Inherited creator/source notes remain unchanged. A parent revision, repository path or hash proves a technical trace, not authorship, licensing or AI usage. Leave unsupported facts blank. Recording observations never approves or publishes content; changed evidence requires a fresh exact-version review.</p>
    {(Object.keys(labels) as Array<keyof SourceReviewFacts>).map((key) => <label key={key} className="grid gap-1 text-xs">
      {labels[key]}{key !== 'technicalTrace' ? ' · blank means unknown' : ''}
      <textarea value={facts[key] ?? ''} maxLength={key === 'technicalTrace' ? 2400 : 1200} disabled={!snapshot?.canRecord || saving}
        className="min-h-20 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-2"
        onChange={(event) => setFacts((current) => ({ ...current, [key]: key === 'technicalTrace' ? event.target.value : event.target.value.trim() ? event.target.value : null }))} />
    </label>)}
    <p className="text-xs leading-5" role="status">{status}</p>
    {snapshot?.evidence ? <p className="text-xs text-[var(--cf-text-muted)]">Recorded {new Date(snapshot.evidence.recordedAt).toLocaleString()}. Unknown facts are not a rights attestation.</p> : null}
    <Button type="button" size="sm" variant="outline" className="w-fit" disabled={!snapshot?.canRecord || !facts.technicalTrace.trim() || saving} onClick={() => void save()}>{saving ? 'Recording…' : 'Record source evidence'}</Button>
  </section>;
}
