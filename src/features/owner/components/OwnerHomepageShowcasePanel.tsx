"use client";

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, RefreshCw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { extractTemplateFieldDefinitions, type TCGCardTemplate } from '@/domain/templates';
import { loadCardForgeCatalog } from '@/features/developer-assets/client/catalog';
import type { HomepageShowcaseExample } from '@/features/public-site/client';

const inputClassName = 'min-h-11 w-full border border-[#5f4526] bg-[#0c0b09] px-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]';
const MAX_EXAMPLES = 6;
const MAX_ROWS = 12;
const MAX_FIELDS = 24;

const move = <T,>(items: T[], index: number, direction: -1 | 1): T[] => {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

const fieldKeysFor = (example: HomepageShowcaseExample): string[] => (
  Array.from(new Set(example.rows.flatMap((row) => Object.keys(row))))
);

const syncRowsToTemplate = (
  rows: Record<string, string>[],
  template: TCGCardTemplate,
): Record<string, string>[] => {
  const definitions = extractTemplateFieldDefinitions(template);
  if (!definitions.length) return rows;
  return rows.map((row) => Object.fromEntries(definitions.map((field) => [
    field.key,
    row[field.key] ?? field.defaultValue ?? '',
  ])));
};

const createExampleSlug = (examples: HomepageShowcaseExample[]): string => {
  const base = `marketing-set-${Date.now().toString(36)}`;
  let slug = base;
  let suffix = 2;
  while (examples.some((example) => example.slug === slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
};

export function OwnerHomepageShowcasePanel({
  examples,
  onChange,
}: {
  examples: HomepageShowcaseExample[];
  onChange: (examples: HomepageShowcaseExample[]) => void;
}) {
  const [templates, setTemplates] = useState<readonly TCGCardTemplate[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [newFields, setNewFields] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void loadCardForgeCatalog()
      .then((payload) => {
        if (cancelled) return;
        setTemplates(Array.isArray(payload.templates.defaults) ? payload.templates.defaults : []);
        setCatalogError(null);
      })
      .catch(() => {
        if (!cancelled) setCatalogError('Published Templates could not be loaded. Existing selections can still be saved.');
      });
    return () => { cancelled = true; };
  }, []);

  const templatesById = useMemo(() => new Map(
    templates.flatMap((template) => template.id ? [[template.id, template] as const] : []),
  ), [templates]);

  const updateExample = (index: number, patch: Partial<HomepageShowcaseExample>) => {
    onChange(examples.map((example, exampleIndex) => exampleIndex === index ? { ...example, ...patch } : example));
  };

  const selectFrontTemplate = (index: number, templateId: string) => {
    const template = templatesById.get(templateId);
    if (!template) {
      updateExample(index, { frontTemplateId: templateId, frontTemplateName: undefined });
      return;
    }
    updateExample(index, {
      frontTemplateId: templateId,
      frontTemplateName: template.name,
      rows: syncRowsToTemplate(examples[index]!.rows, template),
    });
  };

  const addExample = () => {
    if (examples.length >= MAX_EXAMPLES) return;
    const template = templates.find((candidate) => Boolean(candidate.id));
    const fallbackTemplateId = examples[0]?.frontTemplateId ?? 'default-mtg-theme';
    const initialRows = template
      ? syncRowsToTemplate([{ CardName: '' }], template)
      : [{ CardName: '' }];
    onChange([...examples, {
      slug: createExampleSlug(examples),
      name: 'New demonstration set',
      visible: false,
      frontTemplateId: template?.id ?? fallbackTemplateId,
      frontTemplateName: template?.name,
      rows: initialRows,
      altText: ['New sample card. Update this description before making the set visible.'],
    }]);
  };

  const addField = (index: number) => {
    const example = examples[index]!;
    const field = (newFields[example.slug] ?? '').trim();
    const fields = fieldKeysFor(example);
    if (!field || field.length > 80 || fields.includes(field) || fields.length >= MAX_FIELDS) return;
    updateExample(index, { rows: example.rows.map((row) => ({ ...row, [field]: '' })) });
    setNewFields((current) => ({ ...current, [example.slug]: '' }));
  };

  const removeField = (index: number, field: string) => {
    const example = examples[index]!;
    const fields = fieldKeysFor(example);
    if (fields.length <= 1) return;
    updateExample(index, {
      rows: example.rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== field))),
    });
  };

  const addRow = (index: number) => {
    const example = examples[index]!;
    if (example.rows.length >= MAX_ROWS) return;
    const fields = fieldKeysFor(example);
    updateExample(index, {
      rows: [...example.rows, Object.fromEntries(fields.map((field) => [field, '']))],
      altText: [...example.altText, `Additional sample card in ${example.name}.`],
    });
  };

  const removeRow = (index: number, rowIndex: number) => {
    const example = examples[index]!;
    if (example.rows.length <= 1) return;
    updateExample(index, {
      rows: example.rows.filter((_, candidateIndex) => candidateIndex !== rowIndex),
      altText: example.altText.filter((_, candidateIndex) => candidateIndex !== rowIndex),
    });
  };

  return (
    <article className="border border-[#5f4526] bg-[#15100a] p-5 xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-[#fff1c7]">Homepage demonstration sets</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#c7b288]">
            Choose the published Templates and sample card data used by the landing page’s “Review the set” view. These cards use CardForge’s real bulk renderer; this panel only controls the marketing selection and sample values.
          </p>
        </div>
        <Button type="button" variant="outline" disabled={examples.length >= MAX_EXAMPLES} onClick={addExample}>
          <Plus className="mr-2 h-4 w-4" /> Add demo set
        </Button>
      </div>
      {catalogError ? <p className="mt-3 border border-[#8b4c35] bg-[#2a130e] p-3 text-sm text-[#efb6a4]">{catalogError}</p> : null}

      <div className="mt-5 space-y-4">
        {examples.map((example, index) => {
          const fields = fieldKeysFor(example);
          const selectedTemplate = templatesById.get(example.frontTemplateId);
          return (
            <section key={example.slug} className="border border-[#4a3823] bg-[#100c08] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-h-11 items-center gap-2 border border-[#3c2c1b] bg-[#0c0b09] px-3 text-sm text-[#ffe7ad]">
                  <input type="checkbox" checked={example.visible} onChange={(event) => updateExample(index, { visible: event.target.checked })} />
                  {example.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  Show this set
                </label>
                <div className="ml-auto flex gap-1">
                  <Button type="button" size="icon" variant="outline" aria-label={`Move ${example.name} up`} disabled={index === 0} onClick={() => onChange(move(examples, index, -1))}><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="outline" aria-label={`Move ${example.name} down`} disabled={index === examples.length - 1} onClick={() => onChange(move(examples, index, 1))}><ArrowDown className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${example.name}`} disabled={examples.length <= 1} onClick={() => onChange(examples.filter((_, candidateIndex) => candidateIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <label className="grid gap-1 text-sm text-[#c7b288]">Display name<input className={inputClassName} maxLength={100} value={example.name} onChange={(event) => updateExample(index, { name: event.target.value })} /></label>
                <label className="grid gap-1 text-sm text-[#c7b288]">Published front Template
                  <select className={inputClassName} value={example.frontTemplateId} onChange={(event) => selectFrontTemplate(index, event.target.value)}>
                    {!selectedTemplate ? <option value={example.frontTemplateId}>{example.frontTemplateName ?? example.frontTemplateId}</option> : null}
                    {templates.flatMap((template) => template.id ? [<option key={template.id} value={template.id}>{template.name}</option>] : [])}
                  </select>
                </label>
                <label className="grid gap-1 text-sm text-[#c7b288]">Shared back Template
                  <select
                    className={inputClassName}
                    value={example.backTemplateId ?? ''}
                    onChange={(event) => {
                      const template = templatesById.get(event.target.value);
                      updateExample(index, {
                        backTemplateId: template?.id ?? undefined,
                        backTemplateName: template?.name,
                      });
                    }}
                  >
                    <option value="">No shared back</option>
                    {example.backTemplateId && !templatesById.has(example.backTemplateId) ? <option value={example.backTemplateId}>{example.backTemplateName ?? example.backTemplateId}</option> : null}
                    {templates.flatMap((template) => template.id ? [<option key={template.id} value={template.id}>{template.name}</option>] : [])}
                  </select>
                </label>
                <div className="grid content-end gap-1 text-sm text-[#c7b288]">
                  <span>Stable demo id</span>
                  <div className="flex min-h-11 items-center border border-[#3c2c1b] bg-[#0c0b09] px-3 font-mono text-xs text-[#a9946c]">{example.slug}</div>
                </div>
              </div>

              <div className="mt-4 border-t border-[#3c2c1b] pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-[#ffe7ad]">Sample data fields</h3>
                    <p className="mt-1 text-xs text-[#9f8a66]">Template selection syncs these fields to the Template’s current generator contract. You can also add or remove fields manually.</p>
                  </div>
                  {selectedTemplate ? <Button type="button" size="sm" variant="outline" onClick={() => updateExample(index, { rows: syncRowsToTemplate(example.rows, selectedTemplate) })}><RefreshCw className="mr-2 h-4 w-4" /> Sync Template fields</Button> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {fields.map((field) => (
                    <span key={field} className="inline-flex min-h-9 items-center gap-2 border border-[#4a3823] bg-[#0c0b09] px-2 text-xs text-[#d8c49a]">
                      {field}
                      <button type="button" aria-label={`Remove ${field} field`} disabled={fields.length <= 1} className="text-[#b98b70] disabled:opacity-30" onClick={() => removeField(index, field)}>×</button>
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input className={inputClassName} maxLength={80} placeholder="Add a data field, e.g. Artwork" value={newFields[example.slug] ?? ''} onChange={(event) => setNewFields((current) => ({ ...current, [example.slug]: event.target.value }))} />
                  <Button type="button" variant="outline" disabled={fields.length >= MAX_FIELDS} onClick={() => addField(index)}><Plus className="mr-2 h-4 w-4" /> Add field</Button>
                </div>
              </div>

              <div className="mt-4 border-t border-[#3c2c1b] pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-[#ffe7ad]">Sample cards</h3>
                    <p className="mt-1 text-xs text-[#9f8a66]">Alt text is required for every card so the live showcase remains accessible.</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" disabled={example.rows.length >= MAX_ROWS} onClick={() => addRow(index)}><Plus className="mr-2 h-4 w-4" /> Add card</Button>
                </div>
                <div className="mt-3 space-y-3">
                  {example.rows.map((row, rowIndex) => (
                    <details key={`${example.slug}-${rowIndex}`} className="border border-[#3a2d1d] bg-[#0c0b09]" open={rowIndex === 0}>
                      <summary className="cursor-pointer px-3 py-2 font-semibold text-[#d8c49a]">Card {rowIndex + 1}</summary>
                      <div className="grid gap-3 border-t border-[#3a2d1d] p-3 lg:grid-cols-2">
                        <label className="grid gap-1 text-sm text-[#c7b288] lg:col-span-2">Accessibility description
                          <input className={inputClassName} maxLength={240} value={example.altText[rowIndex] ?? ''} onChange={(event) => updateExample(index, { altText: example.altText.map((text, textIndex) => textIndex === rowIndex ? event.target.value : text) })} />
                        </label>
                        {fields.map((field) => (
                          <label key={field} className="grid gap-1 text-sm text-[#c7b288]">{field}
                            <textarea
                              className="min-h-20 border border-[#5f4526] bg-[#100c08] p-3 text-sm text-[#ffe7ad]"
                              maxLength={4000}
                              value={row[field] ?? ''}
                              onChange={(event) => updateExample(index, {
                                rows: example.rows.map((candidate, candidateIndex) => candidateIndex === rowIndex ? { ...candidate, [field]: event.target.value } : candidate),
                              })}
                            />
                          </label>
                        ))}
                        <div className="lg:col-span-2">
                          <Button type="button" size="sm" variant="ghost" disabled={example.rows.length <= 1} onClick={() => removeRow(index, rowIndex)}><Trash2 className="mr-2 h-4 w-4" /> Remove card</Button>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}
