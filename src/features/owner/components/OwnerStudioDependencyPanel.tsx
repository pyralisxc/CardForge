"use client";

import { useRef, useState } from "react";
import { ownerStudioDependencyResult, ownerStudioDependencySnapshot } from "@/features/studio-documents/client";
import { Button } from "@/components/ui/button";
import { readApiErrorMessage } from "@/infrastructure/http/clientResponses";

type ReconciliationReceipt = {
  documentId: string;
  revision: number;
  contractVersion: number;
  complete: boolean;
  opaqueReasons: string[];
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The Owner Profile is a caller; the Studio store and its native CAS remain authoritative. */
export function OwnerStudioDependencyPanel() {
  const [documentId, setDocumentId] = useState("");
  const [revision, setRevision] = useState("");
  const [pending, setPending] = useState(false);
  const requestInFlight = useRef(false);
  const [receipt, setReceipt] = useState<ReconciliationReceipt | null>(null);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [notice, setNotice] = useState("");
  const [readPending, setReadPending] = useState(false);
  const [observed, setObserved] = useState("");
  const parsedRevision = Number(revision);
  const valid = uuidPattern.test(documentId.trim()) && Number.isSafeInteger(parsedRevision) && parsedRevision > 0;

  const reconcile = async () => {
    if (!valid || pending || uncertain || requestInFlight.current) return;
    requestInFlight.current = true;
    const target = { documentId: documentId.trim(), expectedRevision: parsedRevision };
    setPending(true);
    setReceipt(null);
    setError("");
    setNotice("");
    setObserved("");
    try {
      const response = await fetch("/api/owner/studio-dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(target),
      });
      if (!response.ok) {
        const message = await readApiErrorMessage(response, "Studio reconciliation was not confirmed.");
        if (response.status >= 500) setUncertain(true);
        setError(message);
        return;
      }
      const parsed = ownerStudioDependencyResult.safeParse(await response.json());
      if (!parsed.success || parsed.data.documentId !== target.documentId || parsed.data.revision !== target.expectedRevision ||
        parsed.data.receipt.committed !== true || parsed.data.receipt.outcome !== "committed" || parsed.data.contractVersion === null || parsed.data.complete === null) {
        setUncertain(true);
        setError("The response could not be verified. Inspect persisted dependency metadata before any retry.");
        return;
      }
      const result = parsed.data;
      setReceipt({ documentId: result.documentId, revision: result.revision, contractVersion: result.contractVersion!, complete: result.complete!, opaqueReasons: result.opaqueReasons });
      setNotice(result.receipt.warnings.join(" "));
    } catch {
      setUncertain(true);
      setError("The outcome is unknown. Inspect persisted dependency metadata before any retry.");
    } finally {
      requestInFlight.current = false;
      setPending(false);
    }
  };

  const inspect = async () => {
    if (!valid || pending || readPending) return;
    const target = { documentId: documentId.trim(), expectedRevision: parsedRevision };
    setReadPending(true); setObserved("");
    try {
      const response = await fetch(`/api/owner/studio-dependencies?${new URLSearchParams({ documentId: target.documentId, expectedRevision: String(target.expectedRevision) })}`, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) { setObserved(await readApiErrorMessage(response, "Persisted metadata is unavailable.")); return; }
      const parsed = ownerStudioDependencySnapshot.safeParse(await response.json());
      if (!parsed.success || parsed.data.documentId !== target.documentId || parsed.data.revision !== target.expectedRevision) { setObserved("Persisted metadata response could not be verified."); return; }
      setObserved(`Persisted dependency state: ${parsed.data.state}, document ${target.documentId}, revision ${target.expectedRevision}. This observation does not prove a previous operation committed and is not deletion permission.`);
    } catch { setObserved("Persisted metadata is unavailable; absence or completeness was not established."); }
    finally { setReadPending(false); }
  };

  return (
    <section className="space-y-4 border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5">
      <h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Studio dependency integrity</h2>
      <p className="max-w-3xl text-sm leading-6 text-[var(--cf-text-muted)]">
        Reconcile one existing Studio document's derived catalog dependencies using its exact stored revision.
        This does not edit authored content, advance the document revision, or delete any history.
        Select the document and revision from trusted native inspection; do not guess values.
      </p>
      <div className="grid max-w-3xl gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <label className="space-y-1 text-sm text-[var(--cf-text-muted)]">
          <span>Document ID</span>
          <input aria-label="Studio document ID" value={documentId} disabled={pending || readPending} onChange={event => { setDocumentId(event.target.value); setReceipt(null); setError(""); setNotice(""); setObserved(""); }}
            placeholder="UUID from native inspection" autoComplete="off" spellCheck={false}
            className="w-full border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-2 text-[var(--cf-text-strong)]" />
        </label>
        <label className="space-y-1 text-sm text-[var(--cf-text-muted)]">
          <span>Exact revision</span>
          <input aria-label="Expected Studio revision" value={revision} disabled={pending || readPending} onChange={event => { setRevision(event.target.value); setReceipt(null); setError(""); setNotice(""); setObserved(""); }}
            inputMode="numeric" type="number" min="1" step="1" autoComplete="off"
            className="w-full border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-2 text-[var(--cf-text-strong)]" />
        </label>
      </div>
      <Button disabled={!valid || pending || readPending || uncertain} onClick={() => void reconcile()}>
        {pending ? "Reconciling…" : "Reconcile exact Studio revision"}
      </Button>
      <Button disabled={!valid || pending || readPending} onClick={() => void inspect()}>{readPending ? "Reading…" : "Read exact persisted dependency state"}</Button>
      {observed ? <p role="status" className="text-sm text-[var(--cf-text-muted)]">{observed}</p> : null}
      {notice ? <p role="status" className="text-sm text-[var(--cf-warning)]">{notice}</p> : null}
      {uncertain ? <p role="alert" className="text-sm text-[var(--cf-warning)]">
        Outcome uncertain: this control is locked while mounted. Inspect native Studio dependency state before any retry, including after reopening this panel.
      </p> : null}
      {error ? <p role="alert" className="text-sm text-[var(--cf-danger)]">{error}</p> : null}
      {receipt ? <div role="status" className="space-y-1 border border-[var(--cf-border)] p-3 text-sm text-[var(--cf-text-strong)]">
        <p>Reconciliation acknowledged for document {receipt.documentId}, revision {receipt.revision}; interpretation contract {receipt.contractVersion}.</p>
        <p>{receipt.complete ? "Dependency interpretation complete." : "Dependency interpretation remains incomplete; content stays opaque."}</p>
        {receipt.opaqueReasons.length ? <p>Opaque reasons: {receipt.opaqueReasons.join(", ")}</p> : null}
        <p className="text-[var(--cf-text-muted)]">Dependency completeness is not deletion permission. Read persisted metadata separately; matching state is not proof of operation causation.</p>
      </div> : null}
    </section>
  );
}
