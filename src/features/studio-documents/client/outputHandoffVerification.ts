import { useProjectStore, selectAllGeneratedDisplayCards } from '@/features/project/client/workspace';
import type { OutputIntent } from '../outputIntent';

/** Fingerprint local selected content, including templates, so later edits cannot silently change output. */
export function fingerprintOutput(intent: OutputIntent): string {
  const state = useProjectStore.getState();
  const cards = intent.cardIds.map((id) => state.storedCards.find((card) => card.uniqueId === id));
  const templates = new Set(cards.flatMap((card) => card ? [card.templateId, card.backingTemplateId].filter(Boolean) : []));
  return JSON.stringify({ cards, templates: state.userTemplates.filter((template) => templates.has(template.id)), defaults: state.defaultTemplates.filter((template) => templates.has(template.id)) });
}

export async function verifyPreparedOutput(intent: OutputIntent, snapshot: string, canExportClean: boolean): Promise<void> {
  if (snapshot !== fingerprintOutput(intent)) throw new Error('The selected local cards or Templates changed. Prepare Output again before downloading.');
  const assertSelection = () => {
    const state = useProjectStore.getState();
    const visible = selectAllGeneratedDisplayCards(state);
    if (state.activeCardSet?.id !== intent.setId || intent.cardIds.some((id) => visible.filter((card) => card.uniqueId === id && card.setId === intent.setId).length !== 1)) {
      throw new Error('The exact selected Set or cards are no longer available. Prepare Output again.');
    }
  };
  assertSelection();
  const params = new URLSearchParams({ revision: String(intent.revision), outputIntent: JSON.stringify(intent) });
  const response = await fetch(`/api/studio-documents/${encodeURIComponent(intent.documentId)}?${params}`, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('The source or account access could not be revalidated. Prepare Output again.');
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new Error('The source or account access could not be revalidated. Prepare Output again.'); }
  const result = payload && typeof payload === 'object' ? payload as { document?: { id?: unknown; revision?: unknown }; watermark?: { required?: unknown } } : null;
  if (result?.document?.id !== intent.documentId || result.document.revision !== intent.revision || result.watermark?.required !== !canExportClean) {
    throw new Error('The exact source or current download access changed. Prepare Output again.');
  }
  if (snapshot !== fingerprintOutput(intent)) throw new Error('The selected local cards or Templates changed during verification. Prepare Output again.');
  assertSelection();
}
