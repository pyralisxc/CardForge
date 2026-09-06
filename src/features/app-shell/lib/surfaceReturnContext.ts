export type DeskSurfaceReturnContext = {
  kind: 'desk';
  focusedWorkId: string | null;
  inspectorWorkId: string | null;
  query: string;
  sourceFilter: 'all' | 'device' | 'google-drive' | 'local-folder' | 'assistant-draft' | 'campaign' | 'pipeline' | 'connected' | 'temporary';
  deskViews?: Array<'my-work' | 'campaigns' | 'my-published'>;
  deskSources?: Array<'device' | 'google-drive' | 'local-folder' | 'assistant-draft' | 'campaign' | 'pipeline'>;
  deskTypes?: string[];
  deskTags?: string[];
  deskTagMatch?: 'any' | 'all';
  sort: 'desk' | 'name' | 'size';
  selectedCardIds: string[];
  cardQuery: string;
  tagFilter: string;
  scrollTop: number;
};

export type LibrarySurfaceReturnContext = {
  kind: 'library';
  scope: 'personal' | 'published' | 'pipeline' | 'campaigns';
  objectId: string | null;
  query: string;
  source: 'all' | 'device' | 'google-drive' | 'local-folder' | 'assistant-draft' | 'campaign' | 'pipeline';
  itemKind: 'all' | 'set' | 'template' | 'asset' | 'working-draft' | 'campaign' | 'published-resource';
  librarySources?: Array<'device' | 'google-drive' | 'local-folder' | 'assistant-draft' | 'campaign' | 'pipeline'>;
  libraryKinds?: Array<'set' | 'template' | 'asset' | 'working-draft' | 'campaign' | 'published-resource'>;
  libraryTypes?: string[];
  libraryTags?: string[];
  libraryTagMatch?: 'any' | 'all';
  sort: 'recent' | 'name' | 'kind';
  density: 'gallery' | 'list' | 'expanded';
  sharedType: string;
  scrollTop: number;
};

export type SurfaceReturnContext = DeskSurfaceReturnContext | LibrarySurfaceReturnContext;

type StoredContext = { createdAt: number; value: SurfaceReturnContext };
type StoredContexts = { version: 1; entries: Record<string, StoredContext> };
type ReturnContextStorage = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'cardforge:surface-return-context:v1';
const MAX_CONTEXTS = 16;
const MAX_CONTEXT_AGE_MS = 1000 * 60 * 60 * 6;
const MAX_TEXT_LENGTH = 512;
const MAX_SELECTION_COUNT = 250;

const textValue = (value: unknown): string | null => (
  typeof value === 'string' && value.length <= MAX_TEXT_LENGTH ? value : null
);
const nullableTextValue = (value: unknown): string | null | undefined => (
  value === null ? null : textValue(value) ?? undefined
);
const scrollValue = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(value, 1_000_000) : null
);
const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | null => (
  typeof value === 'string' && allowed.includes(value as T) ? value as T : null
);

const normalizeContext = (value: unknown): SurfaceReturnContext | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const scrollTop = scrollValue(record.scrollTop);
  if (scrollTop === null) return null;

  if (record.kind === 'desk') {
    const focusedWorkId = nullableTextValue(record.focusedWorkId);
    const inspectorWorkId = nullableTextValue(record.inspectorWorkId);
    const query = textValue(record.query);
    const sourceFilter = oneOf(record.sourceFilter, ['all', 'device', 'google-drive', 'local-folder', 'assistant-draft', 'campaign', 'pipeline', 'connected', 'temporary'] as const);
    const sort = oneOf(record.sort, ['desk', 'name', 'size'] as const);
    const cardQuery = textValue(record.cardQuery);
    const tagFilter = textValue(record.tagFilter);
    const selectedCardIds = Array.isArray(record.selectedCardIds)
      ? record.selectedCardIds.slice(0, MAX_SELECTION_COUNT).map(textValue).filter((item): item is string => item !== null)
      : null;
    if (focusedWorkId === undefined || inspectorWorkId === undefined || query === null || !sourceFilter || !sort || cardQuery === null || tagFilter === null || !selectedCardIds) return null;
    const deskViews = Array.isArray(record.deskViews)
      ? record.deskViews.filter((view): view is 'my-work' | 'campaigns' | 'my-published' => typeof view === 'string' && ['my-work', 'campaigns', 'my-published'].includes(view)).slice(0, 3)
      : undefined;
    const deskSources = Array.isArray(record.deskSources)
      ? record.deskSources.filter((source): source is 'device' | 'google-drive' | 'local-folder' | 'assistant-draft' | 'campaign' | 'pipeline' => typeof source === 'string' && ['device', 'google-drive', 'local-folder', 'assistant-draft', 'campaign', 'pipeline'].includes(source)).slice(0, 6)
      : undefined;
    const deskTypes = Array.isArray(record.deskTypes) ? record.deskTypes.map(textValue).filter((value): value is string => value !== null).slice(0, 40) : undefined;
    const deskTags = Array.isArray(record.deskTags) ? record.deskTags.map(textValue).filter((value): value is string => value !== null).slice(0, 40) : undefined;
    const deskTagMatch = oneOf(record.deskTagMatch, ['any', 'all'] as const) ?? undefined;
    return { kind: 'desk', focusedWorkId, inspectorWorkId, query, sourceFilter, sort, selectedCardIds, cardQuery, tagFilter, scrollTop, ...(deskViews ? { deskViews } : {}), ...(deskSources ? { deskSources } : {}), ...(deskTypes ? { deskTypes } : {}), ...(deskTags ? { deskTags } : {}), ...(deskTagMatch ? { deskTagMatch } : {}) };
  }

  if (record.kind === 'library') {
    const scope = oneOf(record.scope, ['personal', 'published', 'pipeline', 'campaigns'] as const);
    const objectId = nullableTextValue(record.objectId);
    const query = textValue(record.query);
    const source = oneOf(record.source, ['all', 'device', 'google-drive', 'local-folder', 'assistant-draft', 'campaign', 'pipeline'] as const);
    const itemKind = oneOf(record.itemKind, ['all', 'set', 'template', 'asset', 'working-draft', 'campaign', 'published-resource'] as const);
    const sort = oneOf(record.sort, ['recent', 'name', 'kind'] as const);
    const density = oneOf(record.density, ['gallery', 'list', 'expanded'] as const);
    const sharedType = textValue(record.sharedType);
    if (!scope || objectId === undefined || query === null || !source || !itemKind || !sort || !density || sharedType === null) return null;
    const librarySources = Array.isArray(record.librarySources)
      ? record.librarySources.filter((value): value is 'device' | 'google-drive' | 'local-folder' | 'assistant-draft' | 'campaign' | 'pipeline' => typeof value === 'string' && ['device', 'google-drive', 'local-folder', 'assistant-draft', 'campaign', 'pipeline'].includes(value)).slice(0, 6)
      : undefined;
    const libraryKinds = Array.isArray(record.libraryKinds)
      ? record.libraryKinds.filter((value): value is 'set' | 'template' | 'asset' | 'working-draft' | 'campaign' | 'published-resource' => typeof value === 'string' && ['set', 'template', 'asset', 'working-draft', 'campaign', 'published-resource'].includes(value)).slice(0, 6)
      : undefined;
    const libraryTypes = Array.isArray(record.libraryTypes) ? record.libraryTypes.map(textValue).filter((value): value is string => value !== null).slice(0, 40) : undefined;
    const libraryTags = Array.isArray(record.libraryTags) ? record.libraryTags.map(textValue).filter((value): value is string => value !== null).slice(0, 40) : undefined;
    const libraryTagMatch = oneOf(record.libraryTagMatch, ['any', 'all'] as const) ?? undefined;
    return { kind: 'library', scope, objectId, query, source, itemKind, sort, density, sharedType, scrollTop, ...(librarySources ? { librarySources } : {}), ...(libraryKinds ? { libraryKinds } : {}), ...(libraryTypes ? { libraryTypes } : {}), ...(libraryTags ? { libraryTags } : {}), ...(libraryTagMatch ? { libraryTagMatch } : {}) };
  }

  return null;
};

const readStoredContexts = (storage: ReturnContextStorage): StoredContexts => {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null') as unknown;
    if (!parsed || typeof parsed !== 'object') return { version: 1, entries: {} };
    const root = parsed as { version?: unknown; entries?: unknown };
    if (root.version !== 1 || !root.entries || typeof root.entries !== 'object') return { version: 1, entries: {} };
    return { version: 1, entries: root.entries as Record<string, StoredContext> };
  } catch {
    return { version: 1, entries: {} };
  }
};

const browserStorage = (): ReturnContextStorage | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

export const storeSurfaceReturnContext = (
  context: SurfaceReturnContext,
  storage: ReturnContextStorage | null = browserStorage(),
  keyOverride?: string,
  now: number = Date.now(),
): string | null => {
  if (!storage) return null;
  const value = normalizeContext(context);
  if (!value) return null;
  const key = keyOverride ?? globalThis.crypto?.randomUUID?.() ?? `${now}-${Math.random().toString(36).slice(2)}`;
  const stored = readStoredContexts(storage);
  const entries = Object.fromEntries(Object.entries(stored.entries)
    .filter(([, entry]) => typeof entry?.createdAt === 'number' && now - entry.createdAt <= MAX_CONTEXT_AGE_MS)
    .sort(([, left], [, right]) => right.createdAt - left.createdAt)
    .slice(0, MAX_CONTEXTS - 1));
  entries[key] = { createdAt: now, value };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries } satisfies StoredContexts));
    return key;
  } catch {
    return null;
  }
};

export const readSurfaceReturnContext = (
  key: string | null | undefined,
  storage: ReturnContextStorage | null = browserStorage(),
  now: number = Date.now(),
): SurfaceReturnContext | null => {
  if (!key || !storage) return null;
  const entry = readStoredContexts(storage).entries[key];
  if (!entry || typeof entry.createdAt !== 'number' || now - entry.createdAt > MAX_CONTEXT_AGE_MS) return null;
  return normalizeContext(entry.value);
};
