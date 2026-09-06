"use client";

import { useMemo } from 'react';
import { LayoutTemplate } from 'lucide-react';
import type { DisplayCard } from '@/domain/rendering';
import type { TCGCardTemplate } from '@/domain/templates';
import { getTemplateAccent } from '@/features/card-rendering/client';
import styles from './SetTemplates.module.css';

export function SetTemplates({ cards, onDesign }: { cards: DisplayCard[]; onDesign: (templateId: string) => void }) {
  const templates = useMemo(() => {
    const used = new Map<string, { template: TCGCardTemplate; cardIds: Set<string> }>();
    for (const card of cards) {
      for (const template of [card.template, card.backingTemplate]) {
        if (!template?.id) continue;
        const entry = used.get(template.id) ?? { template, cardIds: new Set<string>() };
        entry.cardIds.add(card.uniqueId);
        used.set(template.id, entry);
      }
    }
    return [...used.values()];
  }, [cards]);
  if (!templates.length) return null;
  return <section className={styles.templates} aria-label="Templates used in this Set">
    <div className={styles.heading}><strong>Templates</strong><span>Solid: template · Dashed: its cards</span></div>
    <div className={styles.items}>
      {templates.map(({ template, cardIds }) => <button
        key={template.id}
        type="button"
        className={styles.template}
        style={{ borderColor: getTemplateAccent(template.id!) }}
        data-set-template={template.id}
        onClick={() => onDesign(template.id!)}
        aria-label={`Design ${template.templateUsage === 'back-preset' ? 'back template' : 'template'} ${template.name}, used by ${cardIds.size} ${cardIds.size === 1 ? 'card' : 'cards'} in this Set`}
        title="Edit this shared template in Studio. Changes apply to every linked card across Sets."
      >
        <LayoutTemplate size={20} aria-hidden="true" />
        <span><small>{template.templateUsage === 'back-preset' ? 'Back template' : 'Template'} · {cardIds.size} {cardIds.size === 1 ? 'card' : 'cards'}</small><strong>{template.name}</strong></span>
      </button>)}
    </div>
  </section>;
}
