/** Creator-owned vocabulary. Labels describe work; they never grant capabilities. */
export interface WorkLabel { id: string; label: string }
export interface WorkClassification { types: WorkLabel[]; tags: WorkLabel[] }
export type WorkLabelKind = keyof WorkClassification;
export type DeskWorkView = 'work' | 'campaigns' | 'published';
export interface WorkViewFilters {
  views: DeskWorkView[];
  sources: string[];
  types: string[];
  tags: string[];
  tagMatch: 'any' | 'all';
  query: string;
}
export interface SavedWorkView { id: string; name: string; filters: WorkViewFilters }
export interface WorkOrganizationState {
  version: 1;
  labels: WorkClassification;
  annotations: Record<string, WorkClassification>;
  savedViews: SavedWorkView[];
  startupViewId: string | null;
}

export const SUPPORTED_WORK_TYPES: readonly WorkLabel[] = [
  { id: 'type:cards', label: 'Cards' },
  { id: 'type:game', label: 'Game' },
  { id: 'type:tcg', label: 'Trading-card game' },
  { id: 'type:playing-cards', label: 'Playing cards' },
  { id: 'type:campaign', label: 'Campaign' },
];
export const createDefaultWorkView = (): WorkViewFilters => ({
  views: ['work'], sources: [], types: [], tags: [], tagMatch: 'any', query: '',
});
export const createWorkOrganization = (): WorkOrganizationState => ({
  version: 1, labels: { types: [], tags: [] }, annotations: {}, savedViews: [], startupViewId: null,
});
const record = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
);
export const cleanWorkLabel = (value: string): string => value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/gu, ' ').replace(/\s+/gu, ' ').trim();
export const workLabelKey = (value: string): string => cleanWorkLabel(value).toLocaleLowerCase();
const strings = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))] : [];
export const normalizeWorkLabels = (value: unknown): WorkLabel[] => {
  const byId = new Map<string, WorkLabel>();
  for (const entry of Array.isArray(value) ? value : []) {
    const candidate = record(entry);
    if (!candidate || typeof candidate.id !== 'string' || typeof candidate.label !== 'string') continue;
    const id = candidate.id.trim();
    const label = cleanWorkLabel(candidate.label);
    if (id && label && id.length <= 160 && label.length <= 120) byId.set(id, { id, label });
  }
  return [...byId.values()];
};
export const normalizeWorkClassification = (value: unknown): WorkClassification | undefined => {
  const candidate = record(value);
  return candidate ? { types: normalizeWorkLabels(candidate.types), tags: normalizeWorkLabels(candidate.tags) } : undefined;
};
export const normalizeWorkView = (value: unknown): WorkViewFilters => {
  const candidate = record(value);
  if (!candidate) return createDefaultWorkView();
  return {
    views: Array.isArray(candidate.views) ? strings(candidate.views).filter((id): id is DeskWorkView => ['work', 'campaigns', 'published'].includes(id)) : ['work'],
    sources: strings(candidate.sources), types: strings(candidate.types), tags: strings(candidate.tags),
    tagMatch: candidate.tagMatch === 'all' ? 'all' : 'any',
    query: typeof candidate.query === 'string' ? candidate.query : '',
  };
};
export const normalizeWorkOrganization = (value: unknown): WorkOrganizationState => {
  const candidate = record(value);
  if (!candidate) return createWorkOrganization();
  const views = new Map<string, SavedWorkView>();
  for (const entry of Array.isArray(candidate.savedViews) ? candidate.savedViews : []) {
    const view = record(entry);
    if (view && typeof view.id === 'string' && typeof view.name === 'string' && cleanWorkLabel(view.name)) {
      views.set(view.id, { id: view.id, name: cleanWorkLabel(view.name), filters: normalizeWorkView(view.filters) });
    }
  }
  return {
    version: 1,
    labels: normalizeWorkClassification(candidate.labels) ?? { types: [], tags: [] },
    annotations: Object.fromEntries(Object.entries(record(candidate.annotations) ?? {}).flatMap(([id, entry]) => {
      const classification = normalizeWorkClassification(entry);
      return classification ? [[id, classification]] : [];
    })),
    savedViews: [...views.values()],
    startupViewId: typeof candidate.startupViewId === 'string' && views.has(candidate.startupViewId) ? candidate.startupViewId : null,
  };
};
export const applyWorkLabel = (current: WorkClassification | undefined, kind: WorkLabelKind, label: WorkLabel, applied: boolean): WorkClassification => {
  const classification = current ?? { types: [], tags: [] };
  return { ...classification, [kind]: applied
    ? [...classification[kind].filter((item) => item.id !== label.id), { ...label }]
    : classification[kind].filter((item) => item.id !== label.id) };
};
export const renameClassificationLabel = (classification: WorkClassification, kind: WorkLabelKind, label: WorkLabel | null, id: string): WorkClassification => ({
  ...classification,
  [kind]: classification[kind].flatMap((item) => item.id !== id ? [item] : label ? [{ ...label }] : []),
});
export const collectWorkLabels = (kind: WorkLabelKind, classifications: readonly (WorkClassification | undefined)[], includeSupported = false): WorkLabel[] => {
  const labels = new Map<string, WorkLabel>((includeSupported ? SUPPORTED_WORK_TYPES : []).map((label) => [label.id, label]));
  classifications.forEach((classification) => classification?.[kind].forEach((label) => {
    if (!labels.has(label.id)) labels.set(label.id, label);
  }));
  return [...labels.values()].sort((left, right) => left.label.localeCompare(right.label));
};

export interface WorkViewCandidate {
  id: string;
  name: string;
  views: readonly DeskWorkView[];
  sources: readonly string[];
  classification?: WorkClassification;
  details?: readonly string[];
}

/** The caller supplies authorized membership; labels never create it. */
export const matchesWorkView = (item: WorkViewCandidate, filters: WorkViewFilters, allowedViews: readonly DeskWorkView[]): boolean => {
  if (!item.views.some((view) => allowedViews.includes(view) && filters.views.includes(view))) return false;
  if (filters.sources.length && !filters.sources.some((source) => item.sources.includes(source))) return false;
  const types = item.classification?.types ?? [];
  if (filters.types.length && !filters.types.some((id) => types.some((type) => type.id === id))) return false;
  const tags = new Set(item.classification?.tags.map((tag) => tag.id) ?? []);
  if (filters.tags.length && !(filters.tagMatch === 'all'
    ? filters.tags.every((id) => tags.has(id)) : filters.tags.some((id) => tags.has(id)))) return false;
  const query = filters.query.trim().toLocaleLowerCase();
  return !query || [item.name, ...(item.details ?? []), ...types.map((type) => type.label), ...(item.classification?.tags.map((tag) => tag.label) ?? [])]
    .join(' ').toLocaleLowerCase().includes(query);
};

export const authorizedDeskViews = ({ campaigns, published }: { campaigns: boolean; published: boolean }): DeskWorkView[] => [
  'work', ...(campaigns ? ['campaigns' as const] : []), ...(published ? ['published' as const] : []),
];
