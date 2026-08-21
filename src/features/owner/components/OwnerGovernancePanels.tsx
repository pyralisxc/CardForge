"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  History,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { OwnerActivityEvent } from "@/features/owner/lib/ownerActivity";
import { readApiErrorMessage } from "@/infrastructure/http/clientResponses";
import { formatOwnerDateTime } from "./OwnerPanelPrimitives";

const authorityRows = [
  [
    "Owner",
    "All safe live values, approvals, developer/account authority, asset deletion, legal publication, and provider status visibility.",
    "CardForge owner access",
  ],
  [
    "Developer",
    "Submit/review assets plus explicitly granted campaign drafting and site proposals.",
    "Clerk developer entitlement + active CardForge profile",
  ],
  [
    "Creator Pass",
    "Paid product capabilities only; no production, developer, or owner authority.",
    "Stripe entitlement projected into Clerk",
  ],
  [
    "Free account",
    "Signed-in free product capabilities only.",
    "Clerk account",
  ],
  [
    "Provider operator",
    "Credentials, billing records, email delivery, hosted deployment, or external analytics.",
    "Provider dashboard; never copied into this console",
  ],
] as const;

export function OwnerRolesPanel() {
  return (
    <section className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5">
      <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]">
        <KeyRound className="h-5 w-5" />
        <h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">
          Roles &amp; permission boundaries
        </h2>
      </div>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--cf-text-muted)]">
        This is the effective control model. The console edits authority through
        its real owner; it does not invent a second permissions system.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--cf-border)] text-left text-xs uppercase tracking-[0.14em] text-[var(--cf-text-subtle)]">
              <th className="py-3 pr-3">Role</th>
              <th className="px-3 py-3">Can control</th>
              <th className="px-3 py-3">Authority owner</th>
            </tr>
          </thead>
          <tbody>
            {authorityRows.map(([role, scope, owner]) => (
              <tr key={role} className="border-b border-[#342719]">
                <td className="py-3 pr-3 font-semibold text-[var(--cf-accent-text)]">
                  {role}
                </td>
                <td className="px-3 py-3 leading-6 text-[var(--cf-text-muted)]">{scope}</td>
                <td className="px-3 py-3 text-[var(--cf-text-muted)]">{owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function OwnerRetentionPanel() {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <article className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5">
        <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]">
          <Trash2 className="h-5 w-5" />
          <h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">
            Deletion controls
          </h2>
        </div>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--cf-text-muted)]">
          <li>
            <strong className="text-[var(--cf-accent-text)]">Library assets:</strong>{" "}
            permanently deletable from Studio Library with exact-name
            confirmation; managed storage, revisions, votes, and registry
            lineage are purged.
          </li>
          <li>
            <strong className="text-[var(--cf-accent-text)]">Clerk accounts:</strong>{" "}
            deletable from People with exact-email confirmation. Historical
            contributions remain attributed and the retained profile becomes
            inactive.
          </li>
          <li>
            <strong className="text-[var(--cf-accent-text)]">Campaign media:</strong> archived
            or purged through the campaign media owner workflow, which protects
            active campaign relationships.
          </li>
          <li>
            <strong className="text-[var(--cf-accent-text)]">Provider data:</strong> Stripe,
            Resend, Google, PostHog, Meta, Clerk, and Vercel records follow
            their own dashboards and retention rules.
          </li>
        </ul>
      </article>
      <article className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5">
        <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]">
          <ShieldCheck className="h-5 w-5" />
          <h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">
            Preserved history
          </h2>
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--cf-text-muted)]">
          Votes, publication decisions, legal versions, billing events, and
          contribution attribution may remain after access is revoked or an
          account is deleted. These records explain what the service published
          and why; they are not active access.
        </p>
        <p className="mt-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3 text-xs leading-5 text-[var(--cf-text-muted)]">
          Use People to distinguish a live account from a history-only identity.
          A missing Clerk account should never be presented as an active
          developer.
        </p>
      </article>
    </section>
  );
}

export function OwnerActivityPanel() {
  const [items, setItems] = useState<OwnerActivityEvent[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/owner/activity?page=${page}`, {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          await readApiErrorMessage(response, "Unable to load owner history."),
        );
      const body = (await response.json()) as {
        activity: {
          items: OwnerActivityEvent[];
          total: number;
          page: number;
          pageSize: number;
        };
      };
      setItems(body.activity.items);
      setTotal(body.activity.total);
      setPage(body.activity.page);
      setPageSize(body.activity.pageSize);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load owner history.",
      );
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => {
    void load();
  }, [load]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <section className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]">
          <History className="h-5 w-5" />
          <div>
            <p className="text-xs uppercase tracking-[0.16em]">
              Append-only operations
            </p>
            <h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">
              Owner change history
            </h2>
          </div>
        </div>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--cf-text-muted)]">
        Records safe site-control changes, people/developer authority, inbox
        state, and other migrated owner actions. Retired development proxies
        resolve to their canonical owner without rewriting the original event.
        It never stores provider credentials or raw secrets.
      </p>
      {error ? (
        <p
          role="alert"
          className="mt-4 border border-[var(--cf-danger-border)] bg-[var(--cf-danger-surface-muted)] p-3 text-sm text-[var(--cf-danger)]"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-4 space-y-2">
        {items.map((event) => (
          <article
            key={event.id}
            className="grid gap-2 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3 md:grid-cols-[10rem_minmax(0,1fr)_auto]"
          >
            <time className="text-xs text-[var(--cf-text-subtle)]" dateTime={event.createdAt}>
              {formatOwnerDateTime(event.createdAt)}
            </time>
            <div>
              <p className="text-sm font-semibold text-[var(--cf-accent-text)]">
                {event.summary}
              </p>
              <p className="mt-1 text-xs text-[var(--cf-text-subtle)]">
                {event.action} · {event.targetType}
                {event.targetId
                  ? ` · ${event.targetLabel ?? event.targetId}`
                  : ""}{" "}
                · {event.actorLabel}
              </p>
            </div>
            <span
              className={`self-start border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${event.outcome === "succeeded" ? "border-[#497352] text-[#a8e7b8]" : event.outcome === "partial" ? "border-[var(--cf-warning-border)] text-[var(--cf-warning)]" : "border-[var(--cf-danger-border)] text-[var(--cf-danger)]"}`}
            >
              {event.outcome}
            </span>
          </article>
        ))}
        {!loading && items.length === 0 ? (
          <p className="border border-dashed border-[var(--cf-border)] p-5 text-sm text-[var(--cf-text-muted)]">
            No owner control-plane events are recorded yet.
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[var(--cf-text-muted)]">
        <span>
          Page {page} of {pages} · {total} events
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
