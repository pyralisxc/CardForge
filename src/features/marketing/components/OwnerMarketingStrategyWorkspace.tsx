"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  MARKETING_AUDIENCES,
  MARKETING_CONTENT_PILLARS,
  runMarketingCommand,
  type MarketingStrategyRecord,
} from "@/features/marketing/client";

import {
  OwnerMarketingSelectField,
  OwnerMarketingTextArea,
  OwnerMarketingTextField,
} from "./OwnerMarketingFields";

export function OwnerMarketingStrategyWorkspace({
  strategy,
  onSaved,
  onError,
}: {
  strategy: MarketingStrategyRecord;
  onSaved: (strategy: MarketingStrategyRecord) => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState(strategy);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(strategy), [strategy]);

  const save = async () => {
    setBusy(true);
    onError("");
    try {
      const result = await runMarketingCommand<{
        strategy: MarketingStrategyRecord;
      }>({
        action: "update_strategy",
        expectedVersion: strategy.version,
        strategy: draft,
      });
      onSaved(result.strategy);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Unable to save strategy.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="border border-[#5f4526] bg-[#15100a] p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-[#e2aa4a]">
        Shared brief
      </p>
      <h3 className="mt-1 font-serif text-2xl text-[#fff1c7]">
        The source of truth every contributor writes from
      </h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <OwnerMarketingSelectField
          label="Primary market"
          value={draft.primaryAudience}
          onChange={(value) =>
            setDraft({
              ...draft,
              primaryAudience:
                value as MarketingStrategyRecord["primaryAudience"],
            })
          }
          options={MARKETING_AUDIENCES.map((item) => [item.id, item.label])}
        />
        <OwnerMarketingSelectField
          label="Validation market"
          value={draft.validationAudience}
          onChange={(value) =>
            setDraft({
              ...draft,
              validationAudience:
                value as MarketingStrategyRecord["validationAudience"],
            })
          }
          options={MARKETING_AUDIENCES.map((item) => [item.id, item.label])}
        />
        <OwnerMarketingTextArea
          label="Positioning"
          value={draft.positioning}
          onChange={(positioning) => setDraft({ ...draft, positioning })}
        />
        <OwnerMarketingTextArea
          label="Current offer"
          value={draft.offer}
          onChange={(offer) => setDraft({ ...draft, offer })}
        />
        <OwnerMarketingTextField
          label="Default call to action"
          value={draft.defaultCallToAction}
          onChange={(defaultCallToAction) =>
            setDraft({ ...draft, defaultCallToAction })
          }
        />
        <div className="border border-[#4a3823] bg-[#100c08] p-3">
          <p className="text-xs text-[#c7b288]">Enabled content pillars</p>
          <div className="mt-2 space-y-2">
            {MARKETING_CONTENT_PILLARS.map((pillar) => (
              <label
                key={pillar.id}
                className="flex gap-2 text-sm text-[#ffe7ad]"
              >
                <input
                  type="checkbox"
                  checked={draft.enabledPillars.includes(pillar.id)}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      enabledPillars: event.target.checked
                        ? [...draft.enabledPillars, pillar.id]
                        : draft.enabledPillars.filter((id) => id !== pillar.id),
                    })
                  }
                />
                {pillar.label}
              </label>
            ))}
          </div>
        </div>
        <OwnerMarketingTextArea
          label="Approved claims — one per line"
          value={draft.approvedClaims.join("\n")}
          onChange={(value) =>
            setDraft({ ...draft, approvedClaims: value.split("\n") })
          }
        />
        <OwnerMarketingTextArea
          label="Claims we must not make — one per line"
          value={draft.prohibitedClaims.join("\n")}
          onChange={(value) =>
            setDraft({ ...draft, prohibitedClaims: value.split("\n") })
          }
        />
      </div>
      <Button className="mt-4" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving..." : "Save strategy"}
      </Button>
    </article>
  );
}
