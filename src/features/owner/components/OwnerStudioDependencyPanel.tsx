"use client";

import { useState } from "react";
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
  const [receipt, setReceipt] = useState<ReconciliationReceipt | null>(null);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const parsedRevision = Number(revision);
  const valid = uuidPattern.test(documentId.trim()) && Number.isSafeInteger(parsedRevision) && parsedRevision > 0;

  const reconcile = async () => {
    if (!valid || pending || uncertain) return;
    setPending(true);
    setReceipt(null);
    setError("");
    try {
      const response = await fetch("/api/owner/studio-dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ documentId: documentId.trim(), expectedRevision: parsedRevision }),
      });
      if (!response.ok) {
        const message = await readApiErrorMessage(response, "Studio reconciliation was not confirmed.");
        if (response.status >= 500) setUncertain(true);
        setError(message);
        return;
      }
      const result = (await response.json()) as ReconciliationReceipt;
      if (result.documentId !== documentId.trim() || result.revision !== parsedRevision ||
        typeof result.complete !== "boolean" || !Array.isArray(result.opaqueReasons)) {
        setUncertain(true);
        setError("The response could not be verified. Inspect persisted dependency metadata before any retry.");
        return;
      }
      setReceipt(result);
    } catch {
      setUncertain(true);
      setError("The outcome is unknown. Inspect persisted dependency metadata before any retry.");
    } finally {
      setPending(false);
    }
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
          <input aria-label="Studio document ID" value={documentId} onChange={event => { setDocumentId(event.target.value); setReceipt(null); setError(""); }}
            placeholder="UUID from native inspection" autoComplete="off" spellCheck={false}
            className="w-full border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-2 text-[var(--cf-text-strong)]" />
        </label>
        <label className="space-y-1 text-sm text-[var(--cf-text-muted)]">
          <span>Exact revision</span>
          <input aria-label="Expected Studio revision" value={revision} onChange={event => { setRevision(event.target.value); setReceipt(null); setError(""); }}
            inputMode="numeric" type="number" min="1" step="1" autoComplete="off"
            className="w-full border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-2 text-[var(--cf-text-strong)]" />
        </label>
      </div>
      <Button disabled={!valid || pending || uncertain} onClick={() => void reconcile()}>
        {pending ? "Reconciling…" : "Reconcile exact Studio revision"}
      </Button>
      {uncertain ? <p role="alert" className="text-sm text-[var(--cf-warning)]">
        Outcome uncertain: the action remains disabled for this session. Read native Studio dependency state before retrying in a fresh session.
      </p> : null}
      {error ? <p role="alert" className="text-sm text-[var(--cf-danger)]">{error}</p> : null}
      {receipt ? <div role="status" className="space-y-1 border border-[var(--cf-border)] p-3 text-sm text-[var(--cf-text-strong)]">
        <p>Reconciliation acknowledged for revision {receipt.revision}; interpretation contract {receipt.contractVersion}.</p>
        <p>{receipt.complete ? "Dependency interpretation complete." : "Dependency interpretation remains incomplete; content stays opaque."}</p>
        {receipt.opaqueReasons.length ? <p>Opaque reasons: {receipt.opaqueReasons.join(", ")}</p> : null}
        <p className="text-[var(--cf-text-muted)]">Confirm persisted dependency metadata separately before accepting lifecycle recovery.</p>
      </div> : null}
    </section>
  );
}
