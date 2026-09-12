"use client";

import { useEffect, useMemo, useState } from 'react';
import { Check, Database } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { CardData } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import { extractTemplateFieldDefinitions } from '@/domain/templates';
import { GeneratorFieldInput } from './GeneratorFieldInput';

interface SelectionFieldEditorProps {
  cards: DisplayCard[];
  highlightColor: string;
  onHighlightColorChange: (color: string) => void;
  onCardsRevised: (cards: DisplayCard[]) => number;
  onDirtyChange?: (dirty: boolean) => void;
  onUpdateFromData: () => void;
}

const sharedValue = (cards: readonly DisplayCard[], key: string, face: 'front' | 'back') => {
  const values = cards.map((card) => String((face === 'front' ? card.data : card.backingData)?.[key] ?? ''));
  const first = values[0] ?? '';
  return { value: values.every((value) => value === first) ? first : '', mixed: values.some((value) => value !== first) };
};

const applyPatch = (data: CardData | undefined, patch: Readonly<Record<string, string>>) => ({ ...(data ?? {}), ...patch });

export function SelectionFieldEditor({
  cards,
  highlightColor,
  onHighlightColorChange,
  onCardsRevised,
  onDirtyChange,
  onUpdateFromData,
}: SelectionFieldEditorProps) {
  const [frontPatch, setFrontPatch] = useState<Record<string, string>>({});
  const [backPatch, setBackPatch] = useState<Record<string, string>>({});
  const frontTemplateId = cards[0]?.template.id ?? null;
  const sameFront = Boolean(frontTemplateId) && cards.every((card) => card.template.id === frontTemplateId);
  const backTemplateId = cards[0]?.backingTemplate?.id ?? null;
  const sameBack = cards.every((card) => (card.backingTemplate?.id ?? null) === backTemplateId);
  const frontFields = useMemo(() => sameFront && cards[0]
    ? extractTemplateFieldDefinitions(cards[0].template).filter((field) => !field.isStaticBaseText)
    : [], [cards, sameFront]);
  const backFields = useMemo(() => sameBack && cards[0]?.backingTemplate
    ? extractTemplateFieldDefinitions(cards[0].backingTemplate).filter((field) => !field.isStaticBaseText)
    : [], [cards, sameBack]);
  const dirty = Object.keys(frontPatch).length > 0 || Object.keys(backPatch).length > 0;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  if (!cards.length) return null;
  if (!sameFront) {
    return <section className="space-y-4 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4">
      <div><h3 className="font-semibold text-[var(--cf-text-strong)]">Edit one design group at a time</h3><p className="mt-1 text-sm text-[var(--cf-text-muted)]">The selection uses more than one front Template. CardForge will not guess that same-named fields across different designs mean the same thing.</p></div>
      <Button type="button" variant="outline" onClick={onUpdateFromData}><Database className="mr-2 h-4 w-4" />Update from data instead</Button>
    </section>;
  }

  const missingRequired = [
    ...frontFields.filter((field) => field.required && field.defaultValue === undefined).flatMap((field) => cards.some((card) => String((field.key in frontPatch ? frontPatch[field.key] : card.data[field.key]) ?? '').trim() === '') ? [`Front: ${field.label}`] : []),
    ...backFields.filter((field) => field.required && field.defaultValue === undefined).flatMap((field) => cards.some((card) => String((field.key in backPatch ? backPatch[field.key] : card.backingData?.[field.key]) ?? '').trim() === '') ? [`Back: ${field.label}`] : []),
  ];

  const save = () => {
    if (!dirty || missingRequired.length) return;
    const now = new Date().toISOString();
    const revisions = cards.map((card) => ({
      ...card,
      data: applyPatch(card.data, frontPatch),
      backingData: card.backingTemplate ? applyPatch(card.backingData, backPatch) : card.backingData,
      updatedAt: now,
    }));
    const count = onCardsRevised(revisions);
    if (count > 0) {
      setFrontPatch({});
      setBackPatch({});
      onDirtyChange?.(false);
    }
  };

  const renderFields = (face: 'front' | 'back') => {
    const fields = face === 'front' ? frontFields : backFields;
    const patch = face === 'front' ? frontPatch : backPatch;
    const setPatch = face === 'front' ? setFrontPatch : setBackPatch;
    return <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((field) => {
        const shared = sharedValue(cards, field.key, face);
        const touched = Object.hasOwn(patch, field.key);
        return <div key={`${face}:${field.key}`} className="rounded-md border border-[var(--cf-border-subtle)] bg-[var(--cf-canvas)] p-3">
          {shared.mixed && !touched ? <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--cf-accent-strong)]">Mixed values · unchanged until edited</p> : null}
          <GeneratorFieldInput
            field={field}
            value={touched ? patch[field.key] : shared.value}
            placeholder={shared.mixed && !touched ? 'Mixed' : undefined}
            onChange={(value) => setPatch((current) => ({ ...current, [field.key]: value }))}
            highlightColor={highlightColor}
            onHighlightColorChange={onHighlightColorChange}
            compact
            showDefaultText={false}
          />
        </div>;
      })}
    </div>;
  };

  return <section className="space-y-5" aria-label={`Edit ${cards.length} selected Artifacts`}>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Selection edit</p><h3 className="mt-1 text-xl font-semibold">Edit {cards.length} selected Artifact{cards.length === 1 ? '' : 's'}</h3><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Only fields you touch are changed. Mixed values remain different unless you replace them here.</p></div>
      <Button type="button" variant="outline" onClick={onUpdateFromData}><Database className="mr-2 h-4 w-4" />Update from data</Button>
    </header>
    <div className="space-y-3"><h4 className="font-semibold">Front details</h4>{renderFields('front')}</div>
    {backTemplateId && sameBack ? <div className="space-y-3"><h4 className="font-semibold">Back details</h4>{renderFields('back')}</div> : backTemplateId || cards.some((card) => card.backingTemplate) ? <p className="rounded-md border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3 text-sm text-[var(--cf-text-muted)]">Back designs differ across this selection, so only front fields can be edited together.</p> : null}
    {missingRequired.length ? <p role="alert" className="text-sm text-[var(--cf-danger)]">Required values are missing: {missingRequired.slice(0, 4).join(', ')}{missingRequired.length > 4 ? ', …' : ''}</p> : null}
    <div className="flex justify-end border-t border-[var(--cf-border-subtle)] pt-4"><Button type="button" disabled={!dirty || missingRequired.length > 0} onClick={save}><Check className="mr-2 h-4 w-4" />Apply to {cards.length}</Button></div>
  </section>;
}
