import { Link2, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  CAMPAIGN_FIELD_LIMITS,
  type CampaignAssociationKind,
  type CampaignDevelopmentAssociation,
} from '@/features/marketing-content/model';

const ASSOCIATION_LABELS: Record<CampaignAssociationKind, string> = {
  pull_request: 'GitHub PR',
  commit: 'Commit',
  release: 'Release',
  feature: 'Feature',
  shared_asset: 'Shared asset',
  jam_recording: 'Jam recording',
};

const fieldClassName = 'min-h-11 w-full border border-[#5f4526] bg-[#0c0b09] px-3 py-2 text-sm text-[#ffe7ad] placeholder:text-[#6f5b3a]';

const createAssociation = (): CampaignDevelopmentAssociation => ({
  id: crypto.randomUUID(),
  kind: 'pull_request',
  externalKey: '',
  referenceUrl: '',
  titleSnapshot: '',
  metadataSnapshot: {},
  note: '',
  createdBy: '',
  createdAt: '',
});

export function CampaignAssociationEditor({
  associations,
  disabled,
  onChange,
}: {
  associations: CampaignDevelopmentAssociation[];
  disabled: boolean;
  onChange: (associations: CampaignDevelopmentAssociation[]) => void;
}) {
  const update = (
    index: number,
    patch: Partial<CampaignDevelopmentAssociation>,
  ) => {
    onChange(associations.map((association, candidateIndex) => (
      candidateIndex === index ? { ...association, ...patch } : association
    )));
  };

  return (
    <section className="mt-4 border border-[#4a3823] bg-[#15100a] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#e2aa4a]">
            <Link2 className="h-4 w-4" />
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em]">
              Development associations
            </h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-[#a98a55]">
            Link the PR, release, feature, asset, or recording that produced this package. CardForge keeps the campaign history; the source system keeps development history.
          </p>
        </div>
        <Button
          type="button"
          className="min-h-11"
          variant="outline"
          disabled={disabled || associations.length >= 12}
          onClick={() => onChange([...associations, createAssociation()])}
        >
          <Plus className="mr-2 h-4 w-4" />
          Link work
        </Button>
      </div>

      {associations.length ? (
        <div className="mt-3 space-y-3">
          {associations.map((association, index) => (
            <article
              key={association.id}
              className="grid gap-3 border border-[#4a3823] bg-[#100c08] p-3 md:grid-cols-2"
            >
              <label className="grid gap-1 text-xs text-[#c7b288]">
                Association type
                <select
                  className={fieldClassName}
                  disabled={disabled}
                  value={association.kind}
                  onChange={(event) => update(index, {
                    kind: event.target.value as CampaignAssociationKind,
                  })}
                >
                  {Object.entries(ASSOCIATION_LABELS).map(([kind, label]) => (
                    <option key={kind} value={kind}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-[#c7b288]">
                Reference key or number
                <input
                  className={fieldClassName}
                  disabled={disabled}
                  maxLength={CAMPAIGN_FIELD_LIMITS.associationKey}
                  value={association.externalKey}
                  onChange={(event) => update(index, {
                    externalKey: event.target.value,
                  })}
                  placeholder="PR #94, v0.1.0, or feature key"
                />
              </label>
              <label className="grid gap-1 text-xs text-[#c7b288]">
                Reference URL
                <input
                  type="url"
                  className={fieldClassName}
                  disabled={disabled}
                  maxLength={CAMPAIGN_FIELD_LIMITS.destinationUrl}
                  value={association.referenceUrl}
                  onChange={(event) => update(index, {
                    referenceUrl: event.target.value,
                  })}
                  placeholder="https://github.com/..."
                />
              </label>
              <label className="grid gap-1 text-xs text-[#c7b288]">
                Display title
                <input
                  className={fieldClassName}
                  disabled={disabled}
                  maxLength={CAMPAIGN_FIELD_LIMITS.associationTitle}
                  value={association.titleSnapshot}
                  onChange={(event) => update(index, {
                    titleSnapshot: event.target.value,
                  })}
                  placeholder="Canonical campaign media"
                />
              </label>
              <label className="grid gap-1 text-xs text-[#c7b288] md:col-span-2">
                Relationship note
                <textarea
                  className={`${fieldClassName} min-h-20`}
                  disabled={disabled}
                  maxLength={CAMPAIGN_FIELD_LIMITS.associationNote}
                  value={association.note}
                  onChange={(event) => update(index, { note: event.target.value })}
                  placeholder="What shipped and why this campaign package belongs to it"
                />
              </label>
              <div className="md:col-span-2">
                <Button
                  type="button"
                  className="min-h-11"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => onChange(associations.filter((_, candidate) => (
                    candidate !== index
                  )))}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove association
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 border border-dashed border-[#4a3823] p-3 text-xs text-[#a98a55]">
          Optional for evergreen campaigns; recommended whenever this package supports shipped development work.
        </p>
      )}
    </section>
  );
}
