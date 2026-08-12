"use client";

import { useState, type ReactNode } from 'react';
import {
  Check,
  CheckCircle2,
  Circle,
  Loader2,
  Plus,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { uploadCampaignMedia } from '@/features/developer-cockpit/client/api';
import { getCampaignPackageReadiness } from '@/features/developer-cockpit/client/campaignWorkflow';
import { CampaignAssociationEditor } from '@/features/developer-cockpit/components/CampaignAssociationEditor';
import {
  CampaignMediaIngestFields,
  createCampaignMediaIngestDraft,
  type CampaignMediaIngestDraft,
} from '@/features/developer-cockpit/components/CampaignMediaIngestFields';
import { CampaignVariantEditor } from '@/features/developer-cockpit/components/CampaignVariantEditor';
import {
  CAMPAIGN_FIELD_LIMITS,
  SOCIAL_SERVICES,
  type CampaignMedia,
  type SocialCampaign,
  type SocialCampaignVariant,
} from '@/features/developer-cockpit/model';

export type CampaignDraft = {
  idempotencyKey: string;
  title: string;
  objective: string;
  destinationUrl: string;
  productionNote: string;
  requestedPublishAt: string;
  variants: SocialCampaignVariant[];
  associations: SocialCampaign['associations'];
};

export const createEmptyCampaignDraft = (): CampaignDraft => ({
  idempotencyKey: crypto.randomUUID(),
  title: '',
  objective: '',
  destinationUrl: 'https://cardforges.com/',
  productionNote: '',
  requestedPublishAt: '',
  variants: [{ service: 'facebook', text: '', attachments: [] }],
  associations: [],
});

export const toLocalDateTime = (value: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};

export const toCampaignDraft = (campaign: SocialCampaign): CampaignDraft => ({
  idempotencyKey: crypto.randomUUID(),
  title: campaign.title,
  objective: campaign.objective,
  destinationUrl: campaign.destinationUrl,
  productionNote: campaign.productionNote,
  requestedPublishAt: toLocalDateTime(campaign.requestedPublishAt),
  variants: campaign.variants.map((variant) => ({
    ...variant,
    attachments: variant.attachments.map((attachment) => ({
      ...attachment,
      cropIntent: { ...attachment.cropIntent },
      media: { ...attachment.media },
    })),
  })),
  associations: campaign.associations.map((association) => ({
    ...association,
    metadataSnapshot: { ...association.metadataSnapshot },
  })),
});

export const getCampaignPayload = (draft: CampaignDraft) => ({
  ...draft,
  requestedPublishAt: draft.requestedPublishAt
    ? new Date(draft.requestedPublishAt).toISOString()
    : null,
  variants: draft.variants.map((variant) => ({
    service: variant.service,
    text: variant.text,
    attachments: variant.attachments.map(({ media, ...attachment }) => attachment),
  })),
  associations: draft.associations.map(({
    id,
    createdBy,
    createdAt,
    ...association
  }) => association),
});

const fieldClassName = 'min-h-11 w-full border border-[#5f4526] bg-[#0c0b09] px-3 py-2 text-sm text-[#ffe7ad] placeholder:text-[#6f5b3a]';

const buildFocalPoint = (
  metadata: CampaignMediaIngestDraft,
): { x: number; y: number } | undefined | null => {
  if (!metadata.focalX && !metadata.focalY) return undefined;
  if (!metadata.focalX || !metadata.focalY) return null;
  const x = Number(metadata.focalX);
  const y = Number(metadata.focalY);
  return Number.isFinite(x)
    && Number.isFinite(y)
    && x >= 0
    && x <= 1
    && y >= 0
    && y <= 1
    ? { x, y }
    : null;
};

export function DeveloperCampaignComposer({
  draft,
  editing,
  busy,
  mediaLibrary,
  onDraftChange,
  onCancel,
  onSave,
  onError,
}: {
  draft: CampaignDraft;
  editing: SocialCampaign | null;
  busy: boolean;
  mediaLibrary: CampaignMedia[];
  onDraftChange: (draft: CampaignDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  onError: (message: string) => void;
}) {
  const [mediaMetadata, setMediaMetadata] = useState(createCampaignMediaIngestDraft);
  const [uploadingVariant, setUploadingVariant] = useState<number | null>(null);
  const readiness = getCampaignPackageReadiness(draft);
  const associationsComplete = draft.associations.every((association) => (
    Boolean(association.externalKey.trim())
  ));
  const disabled = busy || uploadingVariant !== null;

  const updateVariant = (index: number, variant: SocialCampaignVariant) => {
    onDraftChange({
      ...draft,
      variants: draft.variants.map((candidate, candidateIndex) => (
        candidateIndex === index ? variant : candidate
      )),
    });
  };

  const ingestMedia = async (
    index: number,
    file: File,
  ): Promise<CampaignMedia | null> => {
    const focalPoint = buildFocalPoint(mediaMetadata);
    if (focalPoint === null) {
      onError('Provide both focal point values between 0 and 1, or leave both blank.');
      return null;
    }

    setUploadingVariant(index);
    try {
      return await uploadCampaignMedia(file, {
        idempotencyKey: crypto.randomUUID(),
        rightsBasis: mediaMetadata.rightsBasis,
        creatorCredit: mediaMetadata.creatorCredit,
        rightsRestriction: mediaMetadata.rightsRestriction,
        rightsExpiresAt: mediaMetadata.rightsExpiresAt,
        reusableCaption: mediaMetadata.reusableCaption,
        reusableDescription: mediaMetadata.reusableDescription,
        focalPoint,
      });
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Unable to ingest campaign media.',
      );
      return null;
    } finally {
      setUploadingVariant(null);
    }
  };

  const addVariant = () => {
    const used = new Set(draft.variants.map((variant) => variant.service));
    const service = SOCIAL_SERVICES.find((candidate) => !used.has(candidate));
    if (!service) return;
    onDraftChange({
      ...draft,
      variants: [...draft.variants, { service, text: '', attachments: [] }],
    });
  };

  return (
    <article className="border border-[#5f4526] bg-[#15100a] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[#e2aa4a]">
            {editing ? 'Editing package' : 'New package'}
          </p>
          <h2 className="font-serif text-2xl text-[#fff1c7]">
            {editing ? editing.title : 'Build a campaign package'}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#c7b288]">
            Choose media from CardForge's approved library or upload a new source. The package stores durable media references, not storage paths.
          </p>
        </div>
        <Button
          type="button"
          className="min-h-11"
          variant="outline"
          onClick={onCancel}
        >
          Close editor
        </Button>
      </div>

      <PackageReadiness readiness={readiness} />

      <fieldset
        className="mt-5 border border-[#4a3823] bg-[#100c08] p-4"
        disabled={disabled}
      >
        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#e2aa4a]">
          1. Campaign brief
        </legend>
        <div className="grid gap-3 md:grid-cols-2">
          <CountedField
            label="Campaign name"
            value={draft.title}
            limit={CAMPAIGN_FIELD_LIMITS.title}
          >
            <input
              className={fieldClassName}
              maxLength={CAMPAIGN_FIELD_LIMITS.title}
              value={draft.title}
              onChange={(event) => onDraftChange({
                ...draft,
                title: event.target.value,
              })}
              placeholder="Founder workflow proof"
            />
          </CountedField>
          <label className="grid gap-1 text-xs text-[#c7b288]">
            Link people should open
            <input
              type="url"
              className={fieldClassName}
              maxLength={CAMPAIGN_FIELD_LIMITS.destinationUrl}
              value={draft.destinationUrl}
              onChange={(event) => onDraftChange({
                ...draft,
                destinationUrl: event.target.value,
              })}
            />
          </label>
          <CountedField
            className="md:col-span-2"
            label="Objective"
            value={draft.objective}
            limit={CAMPAIGN_FIELD_LIMITS.objective}
          >
            <textarea
              className={`${fieldClassName} min-h-24`}
              maxLength={CAMPAIGN_FIELD_LIMITS.objective}
              value={draft.objective}
              onChange={(event) => onDraftChange({
                ...draft,
                objective: event.target.value,
              })}
              placeholder="What should someone understand or do after seeing this?"
            />
          </CountedField>
        </div>
      </fieldset>

      <fieldset
        className="mt-4 border border-[#4a3823] bg-[#100c08] p-4"
        disabled={disabled}
      >
        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#e2aa4a]">
          2. Release context
        </legend>
        <div className="grid gap-3 md:grid-cols-2">
          <CountedField
            className="md:col-span-2"
            label="Release and review context"
            value={draft.productionNote}
            limit={CAMPAIGN_FIELD_LIMITS.productionNote}
          >
            <textarea
              className={`${fieldClassName} min-h-20`}
              maxLength={CAMPAIGN_FIELD_LIMITS.productionNote}
              value={draft.productionNote}
              onChange={(event) => onDraftChange({
                ...draft,
                productionNote: event.target.value,
              })}
              placeholder="Release, feature, proof, or review context."
            />
          </CountedField>
          <label className="grid gap-1 text-xs text-[#c7b288]">
            Preferred publish time
            <input
              type="datetime-local"
              className={fieldClassName}
              value={draft.requestedPublishAt}
              onChange={(event) => onDraftChange({
                ...draft,
                requestedPublishAt: event.target.value,
              })}
            />
          </label>
        </div>
        <CampaignAssociationEditor
          associations={draft.associations}
          disabled={disabled}
          onChange={(associations) => onDraftChange({ ...draft, associations })}
        />
        <CampaignMediaIngestFields
          value={mediaMetadata}
          disabled={disabled}
          onChange={setMediaMetadata}
        />
      </fieldset>

      <fieldset
        className="mt-4 border border-[#4a3823] bg-[#100c08] p-4"
        disabled={disabled}
      >
        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#e2aa4a]">
          3. Social posts
        </legend>
        <div className="space-y-3">
          {draft.variants.map((variant, index) => (
            <CampaignVariantEditor
              key={`${variant.service}:${index}`}
              index={index}
              variant={variant}
              variants={draft.variants}
              mediaLibrary={mediaLibrary}
              disabled={disabled}
              uploading={uploadingVariant === index}
              onChange={(nextVariant) => updateVariant(index, nextVariant)}
              onRemove={() => onDraftChange({
                ...draft,
                variants: draft.variants.filter((_, candidateIndex) => (
                  candidateIndex !== index
                )),
              })}
              onIngest={(file) => ingestMedia(index, file)}
              onError={onError}
            />
          ))}
        </div>
      </fieldset>

      {!associationsComplete ? (
        <p className="mt-3 text-sm text-[#f0bd75]">
          Complete or remove each development association before saving.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          className="min-h-11"
          variant="outline"
          onClick={addVariant}
          disabled={disabled || draft.variants.length >= SOCIAL_SERVICES.length}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add channel variant
        </Button>
        <Button
          type="button"
          className="min-h-11"
          onClick={onSave}
          disabled={disabled || !readiness.readyToSave || !associationsComplete}
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          {editing ? 'Save package changes' : 'Create campaign draft'}
        </Button>
      </div>
    </article>
  );
}

function PackageReadiness({
  readiness,
}: {
  readiness: ReturnType<typeof getCampaignPackageReadiness>;
}) {
  return (
    <section className="mt-4 border border-[#6d4f2b] bg-[#1b1209] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#e2aa4a]">
          Package readiness
        </h3>
        <p className="text-xs text-[#d8c49a]">
          {readiness.completed} of {readiness.total} package sections ready
        </p>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {readiness.items.map((item) => (
          <li
            key={item.key}
            className={`flex items-center gap-2 text-xs ${
              item.complete ? 'text-[#a8e7b8]' : 'text-[#c7b288]'
            }`}
          >
            {item.complete ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 shrink-0" />
            )}
            <span>{item.label}{item.requiredToSave ? ' *' : ''}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CountedField({
  label,
  value,
  limit,
  className = '',
  children,
}: {
  label: string;
  value: string;
  limit: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`grid gap-1 text-xs text-[#c7b288] ${className}`}>
      <span className="flex justify-between gap-3">
        <span>{label}</span>
        <span>{value.length}/{limit}</span>
      </span>
      {children}
    </label>
  );
}
