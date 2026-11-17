"use client";

import { useMemo, useState } from 'react';
import { LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { CardSet } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import type { TCGCardTemplate } from '@/domain/templates';
import type { TemplatePreviewRenderer } from './templatePreviewRenderer';
import styles from './SetTemplates.module.css';

export function SetTemplates({ set, cards, templates, onDesign, renderPreview, getTemplateAccent }: {
  set: CardSet; cards: DisplayCard[]; templates: TCGCardTemplate[]; onDesign: (templateId: string) => void;
  renderPreview: TemplatePreviewRenderer; getTemplateAccent: (templateId: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const entries = useMemo(() => {
    const ids = new Set(set.templateIds ?? []);
    cards.forEach((card) => { if (card.template.id) ids.add(card.template.id); if (card.backingTemplate?.id) ids.add(card.backingTemplate.id); });
    return templates.filter((template) => template.id && ids.has(template.id)).map((template) => ({
      template, cards: cards.filter((card) => card.template.id === template.id || card.backingTemplate?.id === template.id),
    }));
  }, [set.templateIds, templates, cards]);
  if (!entries.length) return null;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" size="sm" variant="ghost" className="gap-1.5"><LayoutTemplate className="h-4 w-4" aria-hidden="true" />Templates · {entries.length}</Button></PopoverTrigger>
    <PopoverContent align="start" className={`${styles.templates} w-[min(32rem,calc(100vw-2rem))]`} aria-label="Templates in this Set">
      <div className={styles.heading}><strong>Designs in this Set</strong><span>Open a design in Studio. Source changes are reviewed separately in Updates.</span></div>
      <div className={styles.items}>{entries.map(({ template, cards: affected }) => {
        const back = template.templateUsage === 'back-preset';
        const sample: DisplayCard = {
          ...(affected[0] ?? { data: template.templatePreviewData ?? {} }),
          template: back ? affected[0]?.template ?? template : template,
          ...(back ? { backingTemplate: template, backingData: affected[0]?.backingData ?? template.templatePreviewData ?? {} } : {}),
          uniqueId: `template-nav-${set.id}-${template.id}`,
        };
        return <button key={template.id} type="button" className={`${styles.template} w-full flex-col`} style={{ borderColor: getTemplateAccent(template.id!) }} data-set-template={template.id}
          onClick={() => { setOpen(false); onDesign(template.id!); }} aria-label={`Design ${back ? 'back Template' : 'Template'} ${template.name}, ${affected.length ? `used by ${affected.length} Artifacts` : 'prepared for this Set'}`}>
          {renderPreview(sample, back ? 'back' : 'front', 88)}
          <span><small>{back ? 'Back Template' : 'Template'} · {affected.length ? `${affected.length} Artifacts` : 'Prepared'}</small><strong>{template.name}</strong></span>
        </button>;
      })}</div>
    </PopoverContent>
  </Popover>;
}
