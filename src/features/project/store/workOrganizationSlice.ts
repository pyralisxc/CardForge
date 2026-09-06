import type { StateCreator } from 'zustand';
import {
  applyWorkLabel, cleanWorkLabel, collectWorkLabels, createWorkOrganization,
  normalizeWorkView, renameClassificationLabel, SUPPORTED_WORK_TYPES, workLabelKey,
  type SavedWorkView, type WorkClassification, type WorkLabel, type WorkLabelKind,
  type WorkOrganizationState, type WorkViewFilters,
} from '@/domain/artifacts/workOrganization';
import type { ProjectState } from './types';

export interface WorkOrganizationTarget {
  id: string;
  localSetId?: string;
  classification?: WorkClassification;
}
export interface WorkOrganizationSlice {
  workOrganization: WorkOrganizationState;
  createWorkLabel: (kind: WorkLabelKind, label: string) => WorkLabel | null;
  renameWorkLabel: (kind: WorkLabelKind, id: string, label: string) => boolean;
  removeWorkLabel: (kind: WorkLabelKind, id: string) => boolean;
  setWorkLabel: (targets: readonly WorkOrganizationTarget[], kind: WorkLabelKind, label: WorkLabel, applied: boolean) => number;
  saveDeskView: (name: string, filters: WorkViewFilters, id?: string) => string | null;
  removeDeskView: (id: string) => void;
  setStartupDeskView: (id: string | null) => void;
}
const allClassifications = (state: ProjectState) => [
  state.workOrganization.labels,
  ...state.cardSets.map((set) => set.classification),
  ...state.cardSets.map((set) => ({ types: [], tags: set.organization?.tags ?? [] })),
  ...Object.values(state.workOrganization.annotations),
];
const isSupportedType = (kind: WorkLabelKind, id: string) => kind === 'types' && SUPPORTED_WORK_TYPES.some((type) => type.id === id);

export const createWorkOrganizationSlice: StateCreator<ProjectState, [], [], WorkOrganizationSlice> = (set, get) => {
  const changeLabel = (kind: WorkLabelKind, id: string, label: WorkLabel | null) => {
    const state = get();
    if (isSupportedType(kind, id) || !collectWorkLabels(kind, allClassifications(state)).some((entry) => entry.id === id)) return false;
    const update = (classification: WorkClassification) => renameClassificationLabel(classification, kind, label, id);
    set((current) => {
      const cardSets = current.cardSets.map((work) => ({
        ...work,
        ...(work.classification ? { classification: update(work.classification) } : {}),
        ...(kind === 'tags' && work.organization ? { organization: {
          ...work.organization,
          tags: work.organization.tags.flatMap((tag) => tag.id !== id ? [tag] : label ? [{ ...label }] : []),
          groupTagId: !label && work.organization.groupTagId === id ? undefined : work.organization.groupTagId,
        } } : {}),
      }));
      const stripFilter = (view: SavedWorkView): SavedWorkView => label ? view : {
        ...view, filters: { ...view.filters, [kind]: view.filters[kind].filter((selected) => selected !== id) },
      };
      return {
        cardSets,
        activeCardSet: cardSets.find((work) => work.id === current.activeCardSet?.id) ?? current.activeCardSet,
        storedCards: kind === 'tags' && !label ? current.storedCards.map((card) => ({
          ...card, tagIds: card.tagIds?.filter((tagId) => tagId !== id),
        })) : current.storedCards,
        workOrganization: {
          ...current.workOrganization,
          labels: update(current.workOrganization.labels),
          annotations: Object.fromEntries(Object.entries(current.workOrganization.annotations).map(([key, classification]) => [key, update(classification)])),
          savedViews: current.workOrganization.savedViews.map(stripFilter),
        },
      };
    });
    return true;
  };
  return {
    workOrganization: createWorkOrganization(),
    createWorkLabel: (kind, rawLabel) => {
      const label = cleanWorkLabel(rawLabel);
      if (!label || label.length > 120) return null;
      const existing = collectWorkLabels(kind, allClassifications(get()), kind === 'types').find((entry) => workLabelKey(entry.label) === workLabelKey(label));
      if (existing) return existing;
      const entry = { id: `${kind === 'types' ? 'custom-type' : 'tag'}:${crypto.randomUUID()}`, label };
      set((current) => ({ workOrganization: { ...current.workOrganization, labels: {
        ...current.workOrganization.labels, [kind]: [...current.workOrganization.labels[kind], entry],
      } } }));
      return entry;
    },
    renameWorkLabel: (kind, id, rawLabel) => {
      const label = cleanWorkLabel(rawLabel);
      if (!label || label.length > 120) return false;
      if (collectWorkLabels(kind, allClassifications(get()), kind === 'types').some((entry) => entry.id !== id && workLabelKey(entry.label) === workLabelKey(label))) return false;
      return changeLabel(kind, id, { id, label });
    },
    removeWorkLabel: (kind, id) => changeLabel(kind, id, null),
    setWorkLabel: (targets, kind, label, applied) => {
      if (!targets.length) return 0;
      const bySet = new Map(targets.flatMap((target) => target.localSetId ? [[target.localSetId, target] as const] : []));
      let changed = 0;
      set((current) => {
        const cardSets = current.cardSets.map((work) => {
          if (!bySet.has(work.id)) return work;
          changed += 1;
          return { ...work, classification: applyWorkLabel(work.classification, kind, label, applied) };
        });
        const annotations = { ...current.workOrganization.annotations };
        for (const target of targets) {
          if (target.localSetId) continue;
          annotations[target.id] = applyWorkLabel(annotations[target.id] ?? target.classification, kind, label, applied);
          changed += 1;
        }
        return {
          cardSets,
          activeCardSet: cardSets.find((work) => work.id === current.activeCardSet?.id) ?? current.activeCardSet,
          workOrganization: { ...current.workOrganization, annotations },
        };
      });
      return changed;
    },
    saveDeskView: (rawName, filters, existingId) => {
      const name = cleanWorkLabel(rawName);
      if (!name || name.length > 120) return null;
      const id = existingId && get().workOrganization.savedViews.some((view) => view.id === existingId)
        ? existingId : `view:${crypto.randomUUID()}`;
      const view = { id, name, filters: normalizeWorkView(filters) };
      set((current) => ({ workOrganization: { ...current.workOrganization,
        savedViews: [...current.workOrganization.savedViews.filter((candidate) => candidate.id !== id), view],
      } }));
      return id;
    },
    removeDeskView: (id) => set((current) => ({ workOrganization: { ...current.workOrganization,
      savedViews: current.workOrganization.savedViews.filter((view) => view.id !== id),
      startupViewId: current.workOrganization.startupViewId === id ? null : current.workOrganization.startupViewId,
    } })),
    setStartupDeskView: (id) => {
      if (id !== null && !get().workOrganization.savedViews.some((view) => view.id === id)) return;
      set((current) => ({ workOrganization: { ...current.workOrganization, startupViewId: id } }));
    },
  };
};
