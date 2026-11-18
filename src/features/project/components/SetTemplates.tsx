"use client";

import { memo, useMemo, useState, type ButtonHTMLAttributes, type CSSProperties } from 'react';
import { LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { CardSet } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import type { TCGCardTemplate } from '@/domain/templates';
import type { TemplatePreviewRenderer } from './templatePreviewRenderer';
import styles from './SetTemplates.module.css';

export interface SetTemplateEntry {
  template: TCGCardTemplate;
  sample: DisplayCard;
  face: 'front' | 'back';
  artifactCount: number;
}

export function getSetTemplateEntries(set: CardSet, cards: DisplayCard[], templates: TCGCardTemplate[]): SetTemplateEntry[] {
  const ids = new Set(set.templateIds ?? []);
  cards.forEach((card) => { if (card.template.id) ids.add(card.template.id); if (card.backingTemplate?.id) ids.add(card.backingTemplate.id); });
  return templates.filter((template) => template.id && ids.has(template.id)).map((template) => {
    const affected = cards.filter((card) => card.template.id === template.id || card.backingTemplate?.id === template.id);
    const back = template.templateUsage === 'back-preset';
    return {
      template,
      artifactCount: affected.length,
      face: back ? 'back' : 'front',
      sample: {
        ...(affected[0] ?? { data: template.templatePreviewData ?? {} }),
        template: back ? affected[0]?.template ?? template : template,
        ...(back ? { backingTemplate: template, backingData: affected[0]?.backingData ?? template.templatePreviewData ?? {} } : {}),
        uniqueId: `template-nav-${set.id}-${template.id}`,
      },
    };
  });
}

const TemplateObjectPreview = memo(function TemplateObjectPreview({ entry, width, renderPreview }: {
  entry: SetTemplateEntry; width: number; renderPreview: TemplatePreviewRenderer;
}) { return renderPreview(entry.sample, entry.face, width); });

export function SetTemplateObject({ entry, onDesign, renderPreview, accent, previewWidth = 88, id, className = '', style, tabIndex, showPreview = true, interaction }: {
  entry: SetTemplateEntry; onDesign: (templateId: string) => void; renderPreview: TemplatePreviewRenderer;
  accent: string; previewWidth?: number; id?: string; className?: string; style?: CSSProperties; tabIndex?: number; showPreview?: boolean;
  interaction?: Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onLostPointerCapture' | 'onKeyDown' | 'onClickCapture' | 'aria-describedby'>;
}) {
  const { template, face, artifactCount } = entry;
  const usage = artifactCount ? `${artifactCount} ${artifactCount === 1 ? 'Artifact' : 'Artifacts'}` : null;
  return <button {...interaction} id={id} type="button" className={`${styles.template} ${className}`} style={{ borderColor: accent, ...style }} tabIndex={tabIndex} data-set-template={template.id}
    onClick={() => onDesign(template.id!)} aria-label={`Design ${face === 'back' ? 'back Template' : 'Template'} ${template.name}, ${usage ? `used by ${usage}` : 'prepared for this Set'}`}>
    <span className={styles.kind}><LayoutTemplate aria-hidden="true" />{face === 'back' ? 'Back Template' : 'Template'}</span>
    {showPreview ? <TemplateObjectPreview entry={entry} width={previewWidth} renderPreview={renderPreview} /> : null}
    <span><strong>{template.name}</strong><small>{usage ?? 'Prepared · Template sample'}</small><small>Design in Studio</small></span>
  </button>;
}

export function SetTemplates({ set, cards, templates, onDesign, renderPreview, getTemplateAccent, presentation = 'menu' }: {
  set: CardSet; cards: DisplayCard[]; templates: TCGCardTemplate[]; onDesign: (templateId: string) => void;
  renderPreview: TemplatePreviewRenderer; getTemplateAccent: (templateId: string) => string;
  presentation?: 'menu' | 'contents';
}) {
  const [open, setOpen] = useState(false);
  const entries = useMemo(() => getSetTemplateEntries(set, cards, templates), [set, templates, cards]);
  if (!entries.length) return null;
  const contents = <>
    <div className={styles.heading}><strong>Templates · {entries.length}</strong><span>Designs that shape this Set. Source changes are reviewed in Updates.</span></div>
    <div className={styles.items}>{entries.map((entry) => <SetTemplateObject key={entry.template.id} entry={entry}
      id={`set-template-${presentation}-${set.id}-${entry.template.id}`} accent={getTemplateAccent(entry.template.id!)}
      onDesign={(id) => { setOpen(false); onDesign(id); }} renderPreview={renderPreview} previewWidth={presentation === 'contents' ? 132 : 88} />)}</div>
  </>;
  if (presentation === 'contents') return <section className={styles.contents} aria-label="Templates in this Set">{contents}</section>;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" size="sm" variant="ghost" className="gap-1.5"><LayoutTemplate className="h-4 w-4" aria-hidden="true" />Templates · {entries.length}</Button></PopoverTrigger>
    <PopoverContent align="start" className={`${styles.templates} z-[120]`} aria-label="Templates in this Set">
      {contents}
    </PopoverContent>
  </Popover>;
}
