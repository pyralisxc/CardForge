"use client";

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import {
  Check,
  CheckCircle2,
  Circle,
  Copy,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { uploadCampaignMedia } from '@/features/developer-cockpit/client/api';
import { getCampaignPackageReadiness } from '@/features/developer-cockpit/client/campaignWorkflow';
import {
  CAMPAIGN_FIELD_LIMITS,
  SOCIAL_SERVICES,
  SOCIAL_SERVICE_LABELS,
  type SocialCampaign,
  type SocialCampaignMedia,
  type SocialCampaignVariant,
  type SocialService,
} from '@/features/developer-cockpit/model';

export type CampaignDraft = {
  title: string;
  objective: string;
  destinationUrl: string;
  sourceReference: string;
  licenseNotes: string;
  requestedPublishAt: string;
  variants: SocialCampaignVariant[];
};

export const createEmptyCampaignDraft = (): CampaignDraft => ({
  title: '',
  objective: '',
  destinationUrl: 'https://cardforges.com/',
  sourceReference: '',
  licenseNotes: '',
  requestedPublishAt: '',
  variants: [{ service: 'facebook', text: '', media: [] }],
});

export const toLocalDateTime = (value: string | null): string => value
  ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
  : '';

export const toCampaignDraft = (campaign: SocialCampaign): CampaignDraft => ({
  title: campaign.title,
  objective: campaign.objective,
  destinationUrl: campaign.destinationUrl,
  sourceReference: campaign.sourceReference,
  licenseNotes: campaign.licenseNotes,
  requestedPublishAt: toLocalDateTime(campaign.requestedPublishAt),
  variants: campaign.variants.map((variant) => ({
    ...variant,
    media: variant.media.map((media) => ({ ...media })),
  })),
});

export const getCampaignPayload = (draft: CampaignDraft) => ({
  ...draft,
  requestedPublishAt: draft.requestedPublishAt
    ? new Date(draft.requestedPublishAt).toISOString()
    : null,
});

const fieldClassName = 'min-h-11 w-full border border-[#5f4526] bg-[#0c0b09] px-3 py-2 text-sm text-[#ffe7ad] placeholder:text-[#6f5b3a]';

export function DeveloperCampaignComposer({
  draft,
  editing,
  busy,
  onDraftChange,
  onCancel,
  onSave,
  onError,
}: {
  draft: CampaignDraft;
  editing: SocialCampaign | null;
  busy: boolean;
  onDraftChange: (draft: CampaignDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  onError: (message: string) => void;
}) {
  const [mediaAlt, setMediaAlt] = useState<Record<number, string>>({});
  const readiness = getCampaignPackageReadiness(draft);

  const updateVariant = (index: number, update: Partial<SocialCampaignVariant>) => {
    onDraftChange({
      ...draft,
      variants: draft.variants.map((variant, candidateIndex) => (
        candidateIndex === index ? { ...variant, ...update } : variant
      )),
    });
  };

  const addVariant = () => {
    const used = new Set(draft.variants.map((variant) => variant.service));
    const service = SOCIAL_SERVICES.find((candidate) => !used.has(candidate));
    if (service) {
      onDraftChange({
        ...draft,
        variants: [...draft.variants, { service, text: '', media: [] }],
      });
    }
  };

  const addMedia = async (index: number, file: File | null) => {
    if (!file) return;
    const alt = mediaAlt[index]?.trim();
    if (!alt) {
      onError('Add meaningful alt text before uploading the campaign image.');
      return;
    }
    try {
      const uploaded = await uploadCampaignMedia(file);
      updateVariant(index, {
        media: [...draft.variants[index].media, {
          sourceBucket: uploaded.sourceBucket,
          sourcePath: uploaded.sourcePath,
          publicUrl: null,
          alt,
        }],
      });
      setMediaAlt((current) => ({ ...current, [index]: '' }));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unable to upload the campaign image.');
    }
  };

  return (
    <article className="border border-[#5f4526] bg-[#15100a] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[#e2aa4a]">{editing ? 'Editing package' : 'New package'}</p>
          <h2 className="font-serif text-2xl text-[#fff1c7]">{editing ? editing.title : 'Build a campaign package'}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#c7b288]">
            Assemble one durable production brief, then shape channel-specific deliverables around it.
          </p>
        </div>
        <Button type="button" className="min-h-11" variant="outline" onClick={onCancel}>Close composer</Button>
      </div>

      <PackageReadiness readiness={readiness} />

      <fieldset className="mt-5 border border-[#4a3823] bg-[#100c08] p-4" disabled={busy}>
        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#e2aa4a]">
          1. Campaign brief
        </legend>
        <p className="mb-3 text-xs leading-5 text-[#a98a55]">
          Name the story once and define the outcome every channel should support.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <CountedField label="Campaign name" value={draft.title} limit={CAMPAIGN_FIELD_LIMITS.title}>
            <input className={fieldClassName} maxLength={CAMPAIGN_FIELD_LIMITS.title} value={draft.title} onChange={(event) => onDraftChange({ ...draft, title: event.target.value })} placeholder="Founder workflow proof" />
          </CountedField>
          <label className="grid gap-1 text-xs text-[#c7b288]">Destination URL<input type="url" className={fieldClassName} maxLength={CAMPAIGN_FIELD_LIMITS.destinationUrl} value={draft.destinationUrl} onChange={(event) => onDraftChange({ ...draft, destinationUrl: event.target.value })} /></label>
          <CountedField className="md:col-span-2" label="Objective" value={draft.objective} limit={CAMPAIGN_FIELD_LIMITS.objective}>
            <textarea className={`${fieldClassName} min-h-24`} maxLength={CAMPAIGN_FIELD_LIMITS.objective} value={draft.objective} onChange={(event) => onDraftChange({ ...draft, objective: event.target.value })} placeholder="What should someone understand or do after seeing this?" />
          </CountedField>
        </div>
      </fieldset>

      <fieldset className="mt-4 border border-[#4a3823] bg-[#100c08] p-4" disabled={busy}>
        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#e2aa4a]">
          2. Production context
        </legend>
        <p className="mb-3 text-xs leading-5 text-[#a98a55]">
          Connect this package to the work that produced it and make publication rights reviewable.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <CountedField label="Source or release" value={draft.sourceReference} limit={CAMPAIGN_FIELD_LIMITS.sourceReference}>
            <input className={fieldClassName} maxLength={CAMPAIGN_FIELD_LIMITS.sourceReference} value={draft.sourceReference} onChange={(event) => onDraftChange({ ...draft, sourceReference: event.target.value })} placeholder="PR, release, feature, commit, asset, or Jam link" />
          </CountedField>
          <label className="grid gap-1 text-xs text-[#c7b288]">Requested publish time<input type="datetime-local" className={fieldClassName} value={draft.requestedPublishAt} onChange={(event) => onDraftChange({ ...draft, requestedPublishAt: event.target.value })} /></label>
          <CountedField className="md:col-span-2" label="Rights and ownership notes" value={draft.licenseNotes} limit={CAMPAIGN_FIELD_LIMITS.licenseNotes}>
            <textarea className={`${fieldClassName} min-h-20`} maxLength={CAMPAIGN_FIELD_LIMITS.licenseNotes} value={draft.licenseNotes} onChange={(event) => onDraftChange({ ...draft, licenseNotes: event.target.value })} placeholder="Who created the media, what it contains, and why CardForge may publish it." />
          </CountedField>
        </div>
      </fieldset>

      <fieldset className="mt-4 border border-[#4a3823] bg-[#100c08] p-4" disabled={busy}>
        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#e2aa4a]">
          3. Channel deliverables
        </legend>
        <p className="mb-3 text-xs leading-5 text-[#a98a55]">
          Start from the shared brief, then make each channel read naturally on its own.
        </p>
        <div className="space-y-3">
        {draft.variants.map((variant, index) => (
          <div key={`${variant.service}:${index}`} className="border border-[#4a3823] bg-[#100c08] p-4">
            <div className="flex flex-wrap gap-3">
              <select aria-label={`Channel ${index + 1}`} className={`${fieldClassName} flex-1`} value={variant.service} onChange={(event) => updateVariant(index, { service: event.target.value as SocialService })}>
                {SOCIAL_SERVICES.map((service) => <option key={service} value={service} disabled={draft.variants.some((candidate, candidateIndex) => candidateIndex !== index && candidate.service === service)}>{SOCIAL_SERVICE_LABELS[service]}</option>)}
              </select>
              {index > 0 && draft.variants[0]?.text ? (
                <Button
                  type="button"
                  className="min-h-11"
                  variant="ghost"
                  onClick={() => updateVariant(index, { text: draft.variants[0].text })}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Start from {SOCIAL_SERVICE_LABELS[draft.variants[0].service]} copy
                </Button>
              ) : null}
              {draft.variants.length > 1 ? <Button type="button" className="min-h-11" variant="outline" onClick={() => onDraftChange({ ...draft, variants: draft.variants.filter((_, candidateIndex) => candidateIndex !== index) })}><Trash2 className="mr-2 h-4 w-4" />Remove</Button> : null}
            </div>
            <CountedField className="mt-3" label={`${SOCIAL_SERVICE_LABELS[variant.service]} post copy`} value={variant.text} limit={CAMPAIGN_FIELD_LIMITS.variantText}>
              <textarea aria-label={`${SOCIAL_SERVICE_LABELS[variant.service]} post copy`} className={`${fieldClassName} min-h-32`} maxLength={CAMPAIGN_FIELD_LIMITS.variantText} value={variant.text} onChange={(event) => updateVariant(index, { text: event.target.value })} />
            </CountedField>
            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <CountedField label="Next image alt text" value={mediaAlt[index] ?? ''} limit={CAMPAIGN_FIELD_LIMITS.mediaAlt}>
                <input aria-label={`${SOCIAL_SERVICE_LABELS[variant.service]} image alt text`} className={fieldClassName} maxLength={CAMPAIGN_FIELD_LIMITS.mediaAlt} value={mediaAlt[index] ?? ''} onChange={(event) => setMediaAlt((current) => ({ ...current, [index]: event.target.value }))} />
              </CountedField>
              <label className="mt-auto inline-flex min-h-11 cursor-pointer items-center justify-center border border-[#5f4526] px-4 text-sm text-[#ffe7ad] hover:bg-[#2a1b0d]">
                <ImagePlus className="mr-2 h-4 w-4" />Add image
                <input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void addMedia(index, event.target.files?.[0] ?? null)} />
              </label>
            </div>
            {variant.media.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{variant.media.map((media, mediaIndex) => <CampaignMediaPreview key={`${media.sourcePath ?? media.publicUrl}:${mediaIndex}`} media={media} onRemove={() => updateVariant(index, { media: variant.media.filter((_, candidate) => candidate !== mediaIndex) })} />)}</div> : null}
          </div>
        ))}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" className="min-h-11" variant="outline" onClick={addVariant} disabled={busy || draft.variants.length >= SOCIAL_SERVICES.length}><Plus className="mr-2 h-4 w-4" />Add channel variant</Button>
        <Button type="button" className="min-h-11" onClick={onSave} disabled={busy || !readiness.readyToSave}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}{editing ? 'Save package changes' : 'Create campaign draft'}</Button>
      </div>
      {!readiness.readyToSave ? <p className="mt-2 text-xs leading-5 text-[#f0bd75]">Add a campaign name, objective, and copy for every channel before saving this draft.</p> : null}
    </article>
  );
}

function PackageReadiness({
  readiness,
}: {
  readiness: ReturnType<typeof getCampaignPackageReadiness>;
}) {
  return (
    <section className="mt-4 border border-[#6d4f2b] bg-[#1b1209] p-4" aria-labelledby="package-readiness-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="package-readiness-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-[#e2aa4a]">
          Package readiness
        </h3>
        <p className="text-xs text-[#d8c49a]">{readiness.completed} of {readiness.total} production signals ready</p>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {readiness.items.map((item) => (
          <li key={item.key} className={`flex items-center gap-2 text-xs ${item.complete ? 'text-[#a8e7b8]' : 'text-[#c7b288]'}`}>
            {item.complete ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Circle className="h-4 w-4 shrink-0" />}
            <span>{item.label}{item.requiredToSave ? ' *' : ''}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-5 text-[#a98a55]">
        Required signals (*) make a valid draft. Source, rights, and accessible media make it production-ready for owner review.
      </p>
    </section>
  );
}

function CountedField({ label, value, limit, className = '', children }: { label: string; value: string; limit: number; className?: string; children: ReactNode }) {
  return <label className={`grid gap-1 text-xs text-[#c7b288] ${className}`}><span className="flex justify-between gap-3"><span>{label}</span><span>{value.length}/{limit}</span></span>{children}</label>;
}

function CampaignMediaPreview({ media, onRemove }: { media: SocialCampaignMedia; onRemove: () => void }) {
  const src = media.publicUrl ?? (media.sourcePath ? `/api/developer-cockpit/media?path=${encodeURIComponent(media.sourcePath)}` : '');
  return <div className="border border-[#4a3823] bg-[#15100a] p-2">{src ? <Image src={src} alt={media.alt} width={320} height={180} unoptimized className="aspect-video w-full object-cover" /> : null}<p className="mt-2 line-clamp-2 text-xs text-[#c7b288]">{media.alt}</p><Button type="button" className="mt-1 min-h-11" size="sm" variant="ghost" onClick={onRemove}><Trash2 className="mr-2 h-3 w-3" />Remove</Button></div>;
}
