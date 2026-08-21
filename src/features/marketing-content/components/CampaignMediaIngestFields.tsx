import { CAMPAIGN_FIELD_LIMITS } from '@/features/marketing-content/model';

export type CampaignMediaIngestDraft = {
  rightsBasis: string;
  creatorCredit: string;
  rightsRestriction: string;
  rightsExpiresAt: string;
  reusableCaption: string;
  reusableDescription: string;
  focalX: string;
  focalY: string;
};

export const createCampaignMediaIngestDraft = (): CampaignMediaIngestDraft => ({
  rightsBasis: 'CardForge-authorized marketing use.',
  creatorCredit: '',
  rightsRestriction: '',
  rightsExpiresAt: '',
  reusableCaption: '',
  reusableDescription: '',
  focalX: '',
  focalY: '',
});

const fieldClassName = 'min-h-11 w-full border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 py-2 text-sm text-[var(--cf-accent-text)] placeholder:text-[#6f5b3a]';

export function CampaignMediaIngestFields({
  value,
  disabled,
  onChange,
}: {
  value: CampaignMediaIngestDraft;
  disabled: boolean;
  onChange: (value: CampaignMediaIngestDraft) => void;
}) {
  const update = (field: keyof CampaignMediaIngestDraft, nextValue: string) => {
    onChange({ ...value, [field]: nextValue });
  };

  return (
    <section className="mt-4 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cf-accent-strong)]">
          New media details
        </h3>
        <p className="mt-1 text-xs leading-5 text-[var(--cf-text-subtle)]">
          These values apply to the next image you ingest. Contextual alt text stays with each channel attachment.
        </p>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">
          Rights basis
          <input
            className={fieldClassName}
            disabled={disabled}
            maxLength={CAMPAIGN_FIELD_LIMITS.rightsBasis}
            value={value.rightsBasis}
            onChange={(event) => update('rightsBasis', event.target.value)}
            placeholder="CardForge-owned capture or licensed marketing use"
          />
        </label>
        <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">
          Creator / credit
          <input
            className={fieldClassName}
            disabled={disabled}
            maxLength={CAMPAIGN_FIELD_LIMITS.creatorCredit}
            value={value.creatorCredit}
            onChange={(event) => update('creatorCredit', event.target.value)}
            placeholder="CardForge or credited creator"
          />
        </label>
        <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">
          Rights restriction
          <input
            className={fieldClassName}
            disabled={disabled}
            maxLength={CAMPAIGN_FIELD_LIMITS.rightsRestriction}
            value={value.rightsRestriction}
            onChange={(event) => update('rightsRestriction', event.target.value)}
            placeholder="Optional usage limits"
          />
        </label>
        <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">
          Rights expiry
          <input
            type="date"
            className={fieldClassName}
            disabled={disabled}
            value={value.rightsExpiresAt}
            onChange={(event) => update('rightsExpiresAt', event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs text-[var(--cf-text-muted)] md:col-span-2">
          Reusable caption
          <textarea
            className={`${fieldClassName} min-h-20`}
            disabled={disabled}
            maxLength={CAMPAIGN_FIELD_LIMITS.reusableCaption}
            value={value.reusableCaption}
            onChange={(event) => update('reusableCaption', event.target.value)}
            placeholder="Optional base caption for future campaign reuse"
          />
        </label>
        <label className="grid gap-1 text-xs text-[var(--cf-text-muted)] md:col-span-2">
          Reusable visual description
          <textarea
            className={`${fieldClassName} min-h-20`}
            disabled={disabled}
            maxLength={CAMPAIGN_FIELD_LIMITS.reusableDescription}
            value={value.reusableDescription}
            onChange={(event) => update('reusableDescription', event.target.value)}
            placeholder="Describe the reusable image itself; channel alt text can be more contextual"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2 md:col-span-2">
          <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">
            Focal point X (0–1)
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              className={fieldClassName}
              disabled={disabled}
              value={value.focalX}
              onChange={(event) => update('focalX', event.target.value)}
              placeholder="0.50"
            />
          </label>
          <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">
            Focal point Y (0–1)
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              className={fieldClassName}
              disabled={disabled}
              value={value.focalY}
              onChange={(event) => update('focalY', event.target.value)}
              placeholder="0.50"
            />
          </label>
        </div>
      </div>
    </section>
  );
}
