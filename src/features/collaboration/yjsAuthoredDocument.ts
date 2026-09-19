import * as Y from 'yjs';

import type { CardSet, StoredDisplayCard } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import type { ProjectDocumentV1 } from '@/features/project/client/workspace';

export const COLLABORATION_AUTHORED_DOCUMENT_VERSION = 1 as const;

export interface CollaborationAuthoredDocument {
  version: typeof COLLABORATION_AUTHORED_DOCUMENT_VERSION;
  set: CardSet;
  cards: StoredDisplayCard[];
  templates: TCGCardTemplate[];
}

type JsonObject = Record<string, unknown>;
type YValue = string | number | boolean | null | Uint8Array | Y.Text | Y.Array<unknown> | Y.Map<unknown>;

const ROOT_KEY = 'cardforge-authored-document';
const SET_KEY = 'set';
const CARDS_KEY = 'cards';
const CARD_ORDER_KEY = 'card-order';
const TEMPLATES_KEY = 'templates';
const TEMPLATE_ORDER_KEY = 'template-order';

const AUTHORED_TEXT_KEYS = new Set([
  'content',
  'defaultValue',
  'description',
  'example',
  'label',
  'name',
  'templateDescription',
]);

const isObject = (value: unknown): value is JsonObject => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isYMap = (value: unknown): value is Y.Map<unknown> => value instanceof Y.Map;
const isYArray = (value: unknown): value is Y.Array<unknown> => value instanceof Y.Array;
const isYText = (value: unknown): value is Y.Text => value instanceof Y.Text;

const isAuthoredTextPath = (path: readonly string[]) => {
  const key = path.at(-1) ?? '';
  if (AUTHORED_TEXT_KEYS.has(key)) return true;
  return path.includes('data') || path.includes('backingData') || path.includes('templatePreviewData');
};

const createText = (value: string) => {
  const text = new Y.Text();
  if (value) text.insert(0, value);
  return text;
};

const createYValue = (value: unknown, path: readonly string[]): YValue | undefined => {
  if (value === undefined) return undefined;
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return isAuthoredTextPath(path) ? createText(value) : value;
  if (Array.isArray(value)) {
    const array = new Y.Array<unknown>();
    if (value.length) {
      array.insert(0, value.flatMap((entry, index) => {
        const encoded = createYValue(entry, [...path, String(index)]);
        return encoded === undefined ? [] : [encoded];
      }));
    }
    return array;
  }
  if (isObject(value)) {
    const map = new Y.Map<unknown>();
    Object.entries(value).forEach(([key, entry]) => {
      const encoded = createYValue(entry, [...path, key]);
      if (encoded !== undefined) map.set(key, encoded);
    });
    return map;
  }
  throw new Error('Collaboration state contains an unsupported authored value.');
};

const readYValue = (value: unknown): unknown => {
  if (isYText(value)) return value.toString();
  if (isYArray(value)) return value.toArray().map(readYValue);
  if (isYMap(value)) {
    return Object.fromEntries([...value.entries()].map(([key, entry]) => [key, readYValue(entry)]));
  }
  return value;
};

const syncText = (target: Y.Text, next: string) => {
  const current = target.toString();
  if (current === next) return;
  let prefix = 0;
  while (prefix < current.length && prefix < next.length && current[prefix] === next[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < current.length - prefix
    && suffix < next.length - prefix
    && current[current.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) suffix += 1;
  const removeLength = current.length - prefix - suffix;
  const insertValue = next.slice(prefix, next.length - suffix);
  if (removeLength > 0) target.delete(prefix, removeLength);
  if (insertValue) target.insert(prefix, insertValue);
};

const sameStableObjectSequence = (target: Y.Array<unknown>, next: unknown[]) => {
  const current = target.toArray();
  if (current.length !== next.length) return false;
  return next.every((entry, index) => {
    if (!isObject(entry) || typeof entry.id !== 'string') return false;
    const existing = current[index];
    return isYMap(existing) && readYValue(existing.get('id')) === entry.id;
  });
};

const syncArray = (target: Y.Array<unknown>, next: unknown[], path: readonly string[]) => {
  if (sameStableObjectSequence(target, next)) {
    next.forEach((entry, index) => {
      syncMap(target.get(index) as Y.Map<unknown>, entry as JsonObject, [...path, String(index)]);
    });
    return;
  }
  const current = readYValue(target);
  if (JSON.stringify(current) === JSON.stringify(next)) return;
  if (target.length) target.delete(0, target.length);
  if (next.length) {
    target.insert(0, next.flatMap((entry, index) => {
      const encoded = createYValue(entry, [...path, String(index)]);
      return encoded === undefined ? [] : [encoded];
    }));
  }
};

const syncMapEntry = (
  target: Y.Map<unknown>,
  key: string,
  next: unknown,
  path: readonly string[],
) => {
  const current = target.get(key);
  if (next === undefined) {
    if (target.has(key)) target.delete(key);
    return;
  }
  if (typeof next === 'string' && isAuthoredTextPath(path)) {
    if (isYText(current)) {
      syncText(current, next);
    } else {
      target.set(key, createText(next));
    }
    return;
  }
  if (Array.isArray(next)) {
    if (isYArray(current)) syncArray(current, next, path);
    else target.set(key, createYValue(next, path)!);
    return;
  }
  if (isObject(next)) {
    if (isYMap(current)) syncMap(current, next, path);
    else target.set(key, createYValue(next, path)!);
    return;
  }
  if (current !== next) target.set(key, next as string | number | boolean | null);
};

function syncMap(target: Y.Map<unknown>, next: JsonObject, path: readonly string[]) {
  [...target.keys()].forEach((key) => {
    if (!(key in next) || next[key] === undefined) target.delete(key);
  });
  Object.entries(next).forEach(([key, value]) => syncMapEntry(target, key, value, [...path, key]));
}

const requireRootMap = (document: Y.Doc) => document.getMap<unknown>(ROOT_KEY);

const requireChildMap = (root: Y.Map<unknown>, key: string) => {
  const current = root.get(key);
  if (isYMap(current)) return current;
  if (current !== undefined) throw new Error('Collaboration state has an incompatible map shape.');
  const map = new Y.Map<unknown>();
  root.set(key, map);
  return map;
};

const requireChildArray = (root: Y.Map<unknown>, key: string) => {
  const current = root.get(key);
  if (isYArray(current)) return current;
  if (current !== undefined) throw new Error('Collaboration state has an incompatible order shape.');
  const array = new Y.Array<unknown>();
  root.set(key, array);
  return array;
};

const syncOrder = (order: Y.Array<unknown>, next: readonly string[]) => {
  const current = order.toArray().filter((entry): entry is string => typeof entry === 'string');
  if (current.length === next.length && current.every((id, index) => id === next[index])) return;
  if (order.length) order.delete(0, order.length);
  if (next.length) order.insert(0, [...next]);
};

const syncEntityMap = <Entity extends JsonObject>(
  entities: Y.Map<unknown>,
  order: Y.Array<unknown>,
  next: readonly Entity[],
  getId: (entity: Entity) => string,
  path: readonly string[],
) => {
  const ids = next.map(getId);
  const idSet = new Set(ids);
  [...entities.keys()].forEach((id) => {
    if (!idSet.has(id)) entities.delete(id);
  });
  next.forEach((entity) => {
    const id = getId(entity);
    const existing = entities.get(id);
    if (isYMap(existing)) syncMap(existing, entity, [...path, id]);
    else entities.set(id, createYValue(entity, [...path, id])!);
  });
  syncOrder(order, ids);
};

const readOrderedEntities = <Entity>(
  entities: Y.Map<unknown>,
  order: Y.Array<unknown>,
): Entity[] => {
  const ids = order.toArray().filter((entry): entry is string => typeof entry === 'string');
  const seen = new Set(ids);
  const remaining = [...entities.keys()].filter((id) => !seen.has(id)).sort();
  return [...ids, ...remaining].flatMap((id) => {
    const entity = entities.get(id);
    return entity === undefined ? [] : [readYValue(entity) as Entity];
  });
};

export const createCollaborationAuthoredDocument = (
  project: ProjectDocumentV1,
): CollaborationAuthoredDocument => {
  if (project.cardSets.length !== 1) {
    throw new Error('Live collaboration requires one isolated CardForge Set.');
  }
  const set = project.cardSets[0]!;
  const cards = project.storedCards.filter((card) => !card.setId || card.setId === set.id)
    .map((card) => ({ ...card, setId: set.id, setName: set.name }));
  const referencedTemplateIds = new Set([
    ...(set.templateIds ?? []),
    ...cards.flatMap((card) => [card.templateId, card.backingTemplateId]),
  ].filter((id): id is string => Boolean(id)));
  const templates = project.userTemplates.filter((template) => (
    Boolean(template.id && referencedTemplateIds.has(template.id))
  ));
  return {
    version: COLLABORATION_AUTHORED_DOCUMENT_VERSION,
    set: structuredClone(set),
    cards: structuredClone(cards),
    templates: structuredClone(templates),
  };
};

export const syncCollaborationAuthoredDocument = (
  document: Y.Doc,
  authored: CollaborationAuthoredDocument,
  origin: unknown = 'cardforge-local',
) => {
  if (authored.version !== COLLABORATION_AUTHORED_DOCUMENT_VERSION) {
    throw new Error('Unsupported CardForge collaboration document version.');
  }
  document.transact(() => {
    const root = requireRootMap(document);
    root.set('version', COLLABORATION_AUTHORED_DOCUMENT_VERSION);

    const setMap = requireChildMap(root, SET_KEY);
    syncMap(setMap, authored.set as unknown as JsonObject, ['set']);

    const cards = requireChildMap(root, CARDS_KEY);
    const cardOrder = requireChildArray(root, CARD_ORDER_KEY);
    syncEntityMap(
      cards,
      cardOrder,
      authored.cards as unknown as JsonObject[],
      (card) => String(card.uniqueId),
      ['cards'],
    );

    const templates = requireChildMap(root, TEMPLATES_KEY);
    const templateOrder = requireChildArray(root, TEMPLATE_ORDER_KEY);
    const writableTemplates = authored.templates.filter(
      (template): template is TCGCardTemplate & { id: string } => Boolean(template.id),
    );
    syncEntityMap(
      templates,
      templateOrder,
      writableTemplates as unknown as JsonObject[],
      (template) => String(template.id),
      ['templates'],
    );
  }, origin);
};

export const createYjsCollaborationDocument = (
  authored: CollaborationAuthoredDocument,
): Y.Doc => {
  const document = new Y.Doc();
  syncCollaborationAuthoredDocument(document, authored, 'cardforge-seed');
  return document;
};

export const readCollaborationAuthoredDocument = (
  document: Y.Doc,
): CollaborationAuthoredDocument => {
  const root = requireRootMap(document);
  if (root.get('version') !== COLLABORATION_AUTHORED_DOCUMENT_VERSION) {
    throw new Error('The live collaboration state is missing a supported CardForge version.');
  }
  const set = readYValue(requireChildMap(root, SET_KEY)) as CardSet;
  const cards = readOrderedEntities<StoredDisplayCard>(
    requireChildMap(root, CARDS_KEY),
    requireChildArray(root, CARD_ORDER_KEY),
  );
  const templates = readOrderedEntities<TCGCardTemplate>(
    requireChildMap(root, TEMPLATES_KEY),
    requireChildArray(root, TEMPLATE_ORDER_KEY),
  );
  if (!set?.id || cards.some((card) => !card.uniqueId || (card.setId && card.setId !== set.id))) {
    throw new Error('The live collaboration state contains invalid Set/card identity.');
  }
  if (templates.some((template) => !template.id)) {
    throw new Error('The live collaboration state contains a Template without stable identity.');
  }
  return {
    version: COLLABORATION_AUTHORED_DOCUMENT_VERSION,
    set,
    cards,
    templates,
  };
};

export const encodeCollaborationState = (document: Y.Doc) => Y.encodeStateAsUpdate(document);
export const encodeCollaborationStateVector = (document: Y.Doc) => Y.encodeStateVector(document);
export const encodeCollaborationDelta = (document: Y.Doc, stateVector: Uint8Array) => (
  Y.encodeStateAsUpdate(document, stateVector)
);
export const applyCollaborationUpdate = (
  document: Y.Doc,
  update: Uint8Array,
  origin: unknown = 'cardforge-remote',
) => Y.applyUpdate(document, update, origin);
