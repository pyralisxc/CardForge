import { PAPER_SIZES, type DisplayCard } from '@/domain/rendering';
import { useProjectStore, selectAllGeneratedDisplayCards } from '@/features/project/client/workspace';
import { outputIntentSchema, type OutputIntent } from '../outputIntent';

/** Fingerprint local selected content, including templates, so later edits cannot silently change output. */
export function fingerprintOutput(intent: OutputIntent): string {
  const state = useProjectStore.getState();
  const byId = new Map(state.storedCards.map((card) => [card.uniqueId, card]));
  const cards = intent.cardIds.map((id) => byId.get(id));
  const templates = new Set(cards.flatMap((card) => card ? [card.templateId, card.backingTemplateId].filter(Boolean) : []));
  return JSON.stringify({ cards, templates: state.userTemplates.filter((template) => templates.has(template.id)), defaults: state.defaultTemplates.filter((template) => templates.has(template.id)) });
}

/** Return no partial projection: duplicates and missing selected cards fail closed. */
export function orderedOutputCards(intent: OutputIntent, visible: DisplayCard[]): DisplayCard[] {
  const byId = new Map<string, DisplayCard>();
  const duplicates = new Set<string>();
  for (const card of visible) {
    if (card.setId !== intent.setId) continue;
    if (byId.has(card.uniqueId)) duplicates.add(card.uniqueId); else byId.set(card.uniqueId, card);
  }
  return intent.cardIds.map((id) => {
    const card = byId.get(id);
    if (!card || duplicates.has(id)) throw new Error('The exact selected Set or cards are no longer available. Prepare Output again.');
    return card;
  });
}

/** Apply only the already-installed exact selection and requested native settings. */
export function prepareOutputOnDevice(intent: OutputIntent): string {
  const state = useProjectStore.getState();
  const available = selectAllGeneratedDisplayCards(state);
  orderedOutputCards(intent, available);
  const paper = PAPER_SIZES.find((candidate) => candidate.name === intent.paper);
  if (!paper) throw new Error('The selected paper size is no longer available.');
  state.setActiveCardSetId(intent.setId);
  state.setSelectedPaperSize(paper);
  state.setPdfOptions({ margin: intent.marginMm, spacing: intent.spacingMm, cutLines: intent.cutLines, duplexLayout: intent.duplex });
  state.setExportMode(intent.mode);
  state.setExportDpi(intent.quality);
  return fingerprintOutput(intent);
}

export async function verifyPreparedOutput(intent: OutputIntent, reference: string, snapshot: string, canExportClean: boolean): Promise<void> {
  if (snapshot !== fingerprintOutput(intent)) throw new Error('The selected local cards or Templates changed. Prepare Output again before downloading.');
  const assertSelection = () => {
    const state = useProjectStore.getState();
    const visible = selectAllGeneratedDisplayCards(state);
    if (state.activeCardSet?.id !== intent.setId) {
      throw new Error('The exact selected Set or cards are no longer available. Prepare Output again.');
    }
    orderedOutputCards(intent, visible);
  };
  assertSelection();
  const params = new URLSearchParams({ revision: String(intent.revision), outputRef: reference });
  const response = await fetch(`/api/studio-documents/${encodeURIComponent(intent.documentId)}?${params}`, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('The source or account access could not be revalidated. Prepare Output again.');
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new Error('The source or account access could not be revalidated. Prepare Output again.'); }
  const result = payload && typeof payload === 'object' ? payload as { document?: { id?: unknown; revision?: unknown }; watermark?: { required?: unknown; canExportClean?: unknown } } : null;
  const parsed = outputIntentSchema.safeParse(result && 'outputIntent' in result ? (result as { outputIntent?: unknown }).outputIntent : null);
  if (!parsed.success || JSON.stringify(parsed.data) !== JSON.stringify(intent) || result?.document?.id !== intent.documentId || result.document.revision !== intent.revision || result.watermark?.required !== !canExportClean || result.watermark?.canExportClean !== canExportClean) {
    throw new Error('The exact source or current download access changed. Prepare Output again.');
  }
  if (snapshot !== fingerprintOutput(intent)) throw new Error('The selected local cards or Templates changed during verification. Prepare Output again.');
  assertSelection();
}
