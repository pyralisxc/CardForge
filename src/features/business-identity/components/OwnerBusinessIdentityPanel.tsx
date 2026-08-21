"use client";

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  type BusinessIdentity,
  type BusinessIdentityInput,
} from '@/features/business-identity/model/businessIdentity';

type OwnerBusinessIdentityPanelProps = {
  businessIdentity: BusinessIdentity;
  onSave: (
    businessIdentity: BusinessIdentityInput,
    expectedIdentityVersion: number,
  ) => Promise<void>;
};

type BusinessIdentityDraft = Omit<
  BusinessIdentity,
  'identityVersion' | 'assumedBusinessNameStatus'
>;

const toDraft = ({
  identityVersion: _identityVersion,
  assumedBusinessNameStatus: _assumedBusinessNameStatus,
  ...identity
}: BusinessIdentity): BusinessIdentityDraft => identity;

const inputClassName = 'border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-accent-text)] outline-none focus:border-[var(--cf-accent)]';

function TextField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'url' | 'date';
}) {
  return (
    <label className="grid gap-2 text-sm text-[var(--cf-text-muted)]">
      {label}
      <input
        className={inputClassName}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function OwnerBusinessIdentityPanel({
  businessIdentity,
  onSave,
}: OwnerBusinessIdentityPanelProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<BusinessIdentityDraft>(() => toDraft(businessIdentity));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(toDraft(businessIdentity));
  }, [businessIdentity]);

  const setField = <Field extends keyof BusinessIdentityDraft>(
    field: Field,
    value: BusinessIdentityDraft[Field],
  ) => setDraft((current) => ({ ...current, [field]: value }));

  const save = async () => {
    setIsSaving(true);
    try {
      await onSave(draft, businessIdentity.identityVersion);
      toast({
        title: 'Business identity saved',
        description: 'Operator, jurisdiction, and public contact details are updated.',
      });
    } catch (error) {
      toast({
        title: 'Business identity not saved',
        description: error instanceof Error ? error.message : 'Unable to save business identity.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Business identity</h2>
          <p className="mt-2 text-sm text-[var(--cf-text-muted)]">
            Version {businessIdentity.identityVersion}. The version is server-owned and used to prevent overwriting newer edits.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <TextField label="Brand name" value={draft.brandName} onChange={(value) => setField('brandName', value)} />
        <TextField label="Legal operator name" value={draft.legalOperatorName} onChange={(value) => setField('legalOperatorName', value)} />
        <label className="grid gap-2 text-sm text-[var(--cf-text-muted)]">
          Entity type
          <select className={inputClassName} value={draft.entityType} onChange={(event) => setField('entityType', event.target.value as 'sole_proprietor')}>
            <option value="sole_proprietor">Sole proprietor</option>
          </select>
        </label>
        <div className="grid gap-2 text-sm text-[var(--cf-text-muted)]">
          <span>Assumed business name status</span>
          <div className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3">
            <p className="font-medium text-[var(--cf-accent-text)]">
              {businessIdentity.assumedBusinessNameStatus === 'registered'
                ? 'Registered (externally verified)'
                : 'Unverified'}
            </p>
            <p className="mt-2 leading-6 text-[var(--cf-text-subtle)]">
              {businessIdentity.assumedBusinessNameStatus === 'unverified'
                ? 'CardForge does not use assumed-name operator wording while this status is unverified. Changes require documented external verification and a separate reviewed update.'
                : 'Assumed-name status is read-only. Changes require documented external verification and a separate reviewed update.'}
            </p>
          </div>
        </div>
        <TextField label="Jurisdiction state" value={draft.jurisdictionState} onChange={(value) => setField('jurisdictionState', value)} />
        <TextField label="Jurisdiction country" value={draft.jurisdictionCountry} onChange={(value) => setField('jurisdictionCountry', value)} />
        <TextField label="Support email" type="email" value={draft.supportEmail} onChange={(value) => setField('supportEmail', value)} />
        <TextField label="Legal and privacy email" type="email" value={draft.legalEmail} onChange={(value) => setField('legalEmail', value)} />
        <TextField label="Support phone (optional)" value={draft.supportPhone ?? ''} onChange={(value) => setField('supportPhone', value)} />
        <TextField label="Website" type="url" value={draft.websiteUrl} onChange={(value) => setField('websiteUrl', value)} />
        <TextField label="Effective date" type="date" value={draft.effectiveDate} onChange={(value) => setField('effectiveDate', value)} />
        <TextField label="Copyright holder" value={draft.copyrightHolder} onChange={(value) => setField('copyrightHolder', value)} />
      </div>
      <Button
        className="mt-5 bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]"
        disabled={isSaving}
        onClick={save}
      >
        <Save className="mr-2 h-4 w-4" />
        {isSaving ? 'Saving business identity...' : 'Save business identity'}
      </Button>
    </section>
  );
}
