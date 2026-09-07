"use client";

import { useRouter } from 'next/navigation';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { createDeskReturnHref, createLibraryReturnHref, createStudioHref } from '@/features/app-shell/client/navigation';
import { loadCardForgeStudioBootstrap } from '@/features/pipeline/client';
import { getGoogleDriveProjectBinding, loadGoogleDriveProjectLibrary, openGoogleDriveProject, type GoogleDriveProjectListResult } from '@/features/project/client/provider-google-drive';
import { getLocalProjectFolderStatus, listLocalProjectWorkBindings, type LocalProjectFolderStatus, type LocalProjectWorkBindingStatus } from '@/features/project/client/provider-local-folder';
import { PROJECT_FONT_LIBRARY_CHANGE_EVENT } from '@/features/project/client/assets';
import { hydrateProjectWorkspaceForScope, useProjectStore } from '@/features/project/client/workspace';
import { type ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { readProjectPreferenceSafely, writeProjectPreference } from '@/features/project/client/persistence-preferences';
import {
  getPersonalLibraryRoleLabel,
  loadPersonalLibrary,
  type PersonalLibraryListResult,
} from '@/features/personal-library/client';
import { ApiClientError, readApiError } from '@/infrastructure/http/clientResponses';
import type { BoundaryFailureKind } from '@/shared/boundaryFailure';
import { readLocalLibraryResources, retainLocalLibraryResources, type LocalLibraryResource } from '@/features/project/client/library-resources';
import {
  beginScopedSource,
  sourcePhaseForFailure,
  settleScopedSourceFailure,
  settleScopedSourceValue,
  type ScopedSourcePhase,
  type ScopedSourceSnapshot,
} from '@/shared/scopedSource';

import {
  buildAccountLibraryItems,
  applyAccountLibraryPrivateOrganization,
  resolveAccountHomeLibraryProjection,
  type AccountLibraryPrivateOrganization,
  type AccountLibraryItem,
  type AccountLibraryKind,
  type AccountLibrarySource,
} from '../model/accountLibrary';

interface StudioDocumentSummary {
  id: string;
  title: string;
  creationSource: string;
  revision: number;
  updatedAt: string;
  expiresAt: string;
}

const EMPTY_STUDIO_DOCUMENT_SUMMARIES: StudioDocumentSummary[] = [];
const EMPTY_LOCAL_PROJECT_WORK_BINDINGS: LocalProjectWorkBindingStatus[] = [];

const loadAllStudioDocumentSummaries = async (): Promise<StudioDocumentSummary[]> => {
  let cursor: number | null = 0;
  const documents: StudioDocumentSummary[] = [];
  const seenCursors = new Set<number>();
  while (cursor !== null) {
    const response = await fetch(`/api/studio-documents?cursor=${cursor}`, { cache: 'no-store' });
    if (!response.ok) throw await readApiError(response, 'Private working drafts are unavailable.');
    const page = await response.json() as {
      documents?: StudioDocumentSummary[];
      documentsNextCursor?: number | null;
    };
    documents.push(...(Array.isArray(page.documents) ? page.documents : []));
    const next = typeof page.documentsNextCursor === 'number' && page.documentsNextCursor >= 0
      ? page.documentsNextCursor
      : null;
    if (next === null || seenCursors.has(next)) cursor = null;
    else {
      seenCursors.add(next);
      cursor = next;
    }
  }
  return documents;
};

export type AccountLibrarySourceId =
  | 'workspace'
  | 'published-library'
  | 'device-assets'
  | 'local-folder'
  | 'google-drive'
  | 'personal-library'
  | 'assistant-drafts';

export interface AccountLibrarySourceFailure {
  id: AccountLibrarySourceId;
  kind: BoundaryFailureKind;
  code: string;
  message: string;
  retryable: boolean;
  nextAction?: string;
  correlationId: string | null;
}

export interface AccountLibrarySourceStatus {
  id: AccountLibrarySourceId;
  label: string;
  phase: ScopedSourcePhase;
  failure: AccountLibrarySourceFailure | null;
}

export const retainLastKnownLibrarySource = <Value,>(
  current: Value | null,
  refreshed: Value | null | undefined,
): Value | null => refreshed === undefined ? current : refreshed;

type ScopedLibrarySource<Value> = ScopedSourceSnapshot<ProjectPersistenceScope, Value, AccountLibrarySourceFailure>;

interface ScopedLibrarySourceValue<Value> {
  scope: ProjectPersistenceScope;
  value: Value | null;
}

export const retainScopedLastKnownLibrarySource = <Value,>(
  current: ScopedLibrarySourceValue<Value> | null,
  scope: ProjectPersistenceScope,
  refreshed: Value | null | undefined,
): ScopedLibrarySourceValue<Value> => ({
  scope,
  value: retainLastKnownLibrarySource(current?.scope === scope ? current.value : null, refreshed),
});

const ACCOUNT_LIBRARY_ORGANIZATION_KEY = 'account-library-organization:v1';

const normalizePrivateOrganization = (value: unknown): Record<string, AccountLibraryPrivateOrganization> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([id, entry]) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const tags = Array.isArray(record.tags)
      ? record.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 40)
      : [];
    const type = typeof record.type === 'string' ? record.type : undefined;
    return [[id, { ...(type ? { type } : {}), tags }] as const];
  }));
};

interface UseAccountLibraryProjectionOptions {
  persistenceScope: ProjectPersistenceScope;
  isSignedIn: boolean;
}

const sourceFailure = (
  id: AccountLibrarySourceId,
  error: unknown,
  fallback: string,
): AccountLibrarySourceFailure => {
  if (error instanceof ApiClientError) {
    return {
      id,
      kind: error.kind,
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...(error.nextAction ? { nextAction: error.nextAction } : {}),
      correlationId: error.correlationId,
    };
  }
  return {
    id,
    kind: 'unavailable',
    code: `${id.replaceAll('-', '_')}_unavailable`,
    message: error instanceof Error ? error.message : fallback,
    retryable: true,
    nextAction: 'Retry this source.',
    correlationId: null,
  };
};

const compareRecent = (left: AccountLibraryItem, right: AccountLibraryItem) => {
  const leftTime = Date.parse(left.updatedAt ?? '');
  const rightTime = Date.parse(right.updatedAt ?? '');
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return rightTime - leftTime;
  if (Number.isFinite(leftTime)) return -1;
  if (Number.isFinite(rightTime)) return 1;
  return left.name.localeCompare(right.name);
};

const sourceStatus = <Value,>(
  id: AccountLibrarySourceId,
  label: string,
  source: ScopedLibrarySource<Value> | null,
  persistenceScope: ProjectPersistenceScope,
): AccountLibrarySourceStatus => ({
  id,
  label,
  phase: source?.scope === persistenceScope ? source.phase : 'loading',
  failure: source?.scope === persistenceScope ? source.failure : null,
});

export function useAccountLibraryProjection({
  persistenceScope,
  isSignedIn,
}: UseAccountLibraryProjectionOptions) {
  const router = useRouter();
  const { toast } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [hydrationFailure, setHydrationFailure] = useState<AccountLibrarySourceFailure | null>(null);
  const [localResourceSource, setLocalResourceSource] = useState<ScopedLibrarySource<LocalLibraryResource[]> | null>(null);
  const [driveLibrarySource, setDriveLibrarySource] = useState<ScopedLibrarySource<GoogleDriveProjectListResult> | null>(null);
  const [driveBindingSource, setDriveBindingSource] = useState<ScopedLibrarySource<string> | null>(null);
  const [localFolderSource, setLocalFolderSource] = useState<ScopedLibrarySource<LocalProjectFolderStatus> | null>(null);
  const [localWorkFolderSource, setLocalWorkFolderSource] = useState<ScopedLibrarySource<LocalProjectWorkBindingStatus[]> | null>(null);
  const [personalLibrarySource, setPersonalLibrarySource] = useState<ScopedLibrarySource<PersonalLibraryListResult> | null>(null);
  const [workingDraftSource, setWorkingDraftSource] = useState<ScopedLibrarySource<StudioDocumentSummary[]> | null>(null);
  const [privateOrganization, setPrivateOrganization] = useState<Record<string, AccountLibraryPrivateOrganization>>({});
  const [privateOrganizationReady, setPrivateOrganizationReady] = useState(false);
  const [privateOrganizationUnavailable, setPrivateOrganizationUnavailable] = useState(false);
  const [sourceFailures, setSourceFailures] = useState<AccountLibrarySourceFailure[]>([]);
  const [loadingSourceIds, setLoadingSourceIds] = useState<Set<string>>(new Set());
  // A deep-linked Design or Generate tool must wait for its one required
  // catalog source. This deliberately stays separate from the general source
  // activity indicator: a slow Drive, folder, or draft request must never
  // hold the tool hostage once Templates are ready.
  const [templateCatalogReady, setTemplateCatalogReady] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kindFilters, setKindFilters] = useState<AccountLibraryKind[]>([]);
  const [sourceFilters, setSourceFilters] = useState<AccountLibrarySource[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [tagMatch, setTagMatch] = useState<'any' | 'all'>('any');
  const [sort, setSort] = useState<'recent' | 'name' | 'kind'>('recent');
  const deferredQuery = useDeferredValue(query);
  const refreshGeneration = useRef(0);
  const driveLibrary = driveLibrarySource?.scope === persistenceScope ? driveLibrarySource.value : null;
  const driveBindingFileId = driveBindingSource?.scope === persistenceScope ? driveBindingSource.value : null;
  const localFolder = localFolderSource?.scope === persistenceScope ? localFolderSource.value : null;
  const localWorkFolders = localWorkFolderSource?.scope === persistenceScope
    ? localWorkFolderSource.value ?? EMPTY_LOCAL_PROJECT_WORK_BINDINGS
    : EMPTY_LOCAL_PROJECT_WORK_BINDINGS;
  const personalLibrary = personalLibrarySource?.scope === persistenceScope ? personalLibrarySource.value : null;
  const workingDrafts = workingDraftSource?.scope === persistenceScope
    ? workingDraftSource.value ?? EMPTY_STUDIO_DOCUMENT_SUMMARIES
    : EMPTY_STUDIO_DOCUMENT_SUMMARIES;
  const localResources = useMemo(() => localResourceSource?.scope === persistenceScope ? localResourceSource.value ?? [] : [], [localResourceSource, persistenceScope]);
  const loadingSources = loadingSourceIds.size > 0;
  // Compatibility values keep existing deep-link return contexts readable;
  // the collection itself uses the full multi-select arrays below.
  const kind = kindFilters[0] ?? 'all';
  const source = sourceFilters[0] ?? 'all';

  const cardSets = useProjectStore((state) => state.cardSets);
  const activeSetId = useProjectStore((state) => state.activeCardSet?.id ?? null);
  const storedCards = useProjectStore((state) => state.storedCards);
  const userTemplates = useProjectStore((state) => state.userTemplates);
  const setDefaultTemplatesFromFiles = useProjectStore((state) => state.setDefaultTemplatesFromFiles);
  const updateCardSetMetadata = useProjectStore((state) => state.updateCardSetMetadata);
  useEffect(() => {
    let cancelled = false;
    // Prevent an older account's in-flight source from publishing a value or
    // failure after the persistence namespace changes.
    refreshGeneration.current += 1;
    setHydrated(false);
    setLoadingSourceIds(new Set());
    setHydrationFailure(null);
    setLocalResourceSource(null);
    setDriveLibrarySource(null);
    setDriveBindingSource(null);
    setLocalFolderSource(null);
    setLocalWorkFolderSource(null);
    setPersonalLibrarySource(null);
    setWorkingDraftSource(null);
    setSourceFailures([]);
    setTemplateCatalogReady(false);
    void hydrateProjectWorkspaceForScope(persistenceScope)
      .then(() => { if (!cancelled) setHydrated(true); })
      .catch((error) => {
        if (cancelled) return;
        setHydrationFailure(sourceFailure('workspace', error, 'This device workspace is unavailable.'));
        setHydrated(true);
      });
    return () => { cancelled = true; };
  }, [persistenceScope]);

  const organizationPreferenceKey = `${ACCOUNT_LIBRARY_ORGANIZATION_KEY}:${persistenceScope}`;
  useEffect(() => {
    let cancelled = false;
    setPrivateOrganization({});
    setPrivateOrganizationReady(false);
    setPrivateOrganizationUnavailable(false);
    void readProjectPreferenceSafely<unknown>(organizationPreferenceKey).then((result) => {
      if (cancelled) return;
      if (result.kind === 'unavailable') {
        setPrivateOrganizationUnavailable(true);
      } else {
        setPrivateOrganization(result.kind === 'available' ? normalizePrivateOrganization(result.value) : {});
        setPrivateOrganizationReady(true);
      }
    });
    return () => { cancelled = true; };
  }, [organizationPreferenceKey]);

  const refreshLibrarySources = useCallback(async () => {
    const generation = refreshGeneration.current + 1;
    refreshGeneration.current = generation;
    setTemplateCatalogReady(false);
    const markLoading = (id: string, loading: boolean) => {
      setLoadingSourceIds((current) => {
        const next = new Set(current);
        if (loading) next.add(id); else next.delete(id);
        return next;
      });
    };
    const setFailure = (failure: AccountLibrarySourceFailure | null, id: AccountLibrarySourceId) => {
      setSourceFailures((current) => {
        const withoutSource = current.filter((entry) => entry.id !== id);
        return failure ? [...withoutSource, failure] : withoutSource;
      });
    };
    const begin = (id: string, source: AccountLibrarySourceId) => {
      markLoading(id, true);
      setFailure(null, source);
    };
    const finish = (id: string) => markLoading(id, false);
    const current = () => generation === refreshGeneration.current;

    begin('device-assets', 'device-assets');
    setLocalResourceSource((previous) => beginScopedSource(previous, persistenceScope));
    begin('local-folder-status', 'local-folder');
    setLocalFolderSource((previous) => beginScopedSource(previous, persistenceScope));
    begin('local-folder-work', 'local-folder');
    setLocalWorkFolderSource((previous) => beginScopedSource(previous, persistenceScope));
    begin('published-library', 'published-library');
    if (isSignedIn) {
      begin('google-drive-library', 'google-drive');
      setDriveLibrarySource((previous) => beginScopedSource(previous, persistenceScope));
      begin('google-drive-binding', 'google-drive');
      setDriveBindingSource((previous) => beginScopedSource(previous, persistenceScope));
      begin('personal-library', 'personal-library');
      setPersonalLibrarySource((previous) => beginScopedSource(previous, persistenceScope));
      begin('assistant-drafts', 'assistant-drafts');
      setWorkingDraftSource((previous) => beginScopedSource(previous, persistenceScope));
    } else {
      setDriveLibrarySource(settleScopedSourceValue<ProjectPersistenceScope, GoogleDriveProjectListResult, AccountLibrarySourceFailure>(persistenceScope, null, { empty: true }));
      setDriveBindingSource(settleScopedSourceValue<ProjectPersistenceScope, string, AccountLibrarySourceFailure>(persistenceScope, null, { empty: true }));
      setPersonalLibrarySource(settleScopedSourceValue<ProjectPersistenceScope, PersonalLibraryListResult, AccountLibrarySourceFailure>(persistenceScope, null, { empty: true }));
      setWorkingDraftSource(settleScopedSourceValue<ProjectPersistenceScope, StudioDocumentSummary[], AccountLibrarySourceFailure>(persistenceScope, [], { empty: true }));
    }

    const deviceAssets = readLocalLibraryResources()
      .then((result) => {
        if (!current()) return;
        const failures = result.failures.map(({ collection, error }) => sourceFailure('device-assets', error, `Local ${collection} resources are unavailable.`));
        if (failures[0]) setFailure(failures[0], 'device-assets');
        setLocalResourceSource((previous) => settleScopedSourceValue(
          persistenceScope,
          retainLocalLibraryResources(previous?.scope === persistenceScope ? previous.value ?? [] : [], result.resources, result.failures.map((failure) => failure.collection)),
          { empty: result.resources.length === 0, incomplete: result.failures.length > 0 },
        ));
      })
      .catch((error) => {
        if (!current()) return;
        const failure = sourceFailure('device-assets', error, 'This device library is unavailable.');
        setFailure(failure, 'device-assets');
        setLocalResourceSource((previous) => settleScopedSourceFailure(previous, persistenceScope, failure));
      })
      .finally(() => { if (current()) finish('device-assets'); });

    const folderStatus = getLocalProjectFolderStatus()
      .then((value) => {
        if (!current()) return;
        setLocalFolderSource(settleScopedSourceValue(persistenceScope, value));
      })
      .catch((error) => {
        if (!current()) return;
        const failure = sourceFailure('local-folder', error, 'Local-folder status is unavailable.');
        setFailure(failure, 'local-folder');
        setLocalFolderSource((previous) => settleScopedSourceFailure(previous, persistenceScope, failure));
      })
      .finally(() => { if (current()) finish('local-folder-status'); });

    const folderWork = listLocalProjectWorkBindings()
      .then((value) => {
        if (!current()) return;
        setLocalWorkFolderSource(settleScopedSourceValue(persistenceScope, value, { empty: value.length === 0 }));
      })
      .catch((error) => {
        if (!current()) return;
        const failure = sourceFailure('local-folder', error, 'Saved local-folder locations are unavailable.');
        setFailure(failure, 'local-folder');
        // A failed refresh must not replace reconnectable folder-only work
        // with an empty list. Browser permission is never requested here.
        setLocalWorkFolderSource((previous) => settleScopedSourceFailure(previous, persistenceScope, failure));
      })
      .finally(() => { if (current()) finish('local-folder-work'); });

    const bootstrap = loadCardForgeStudioBootstrap()
      .then((value) => {
        if (!current()) return;
        setDefaultTemplatesFromFiles(value.templates.defaults, value.studioDefaults.defaultTemplateId);
      })
      .catch((error) => {
        if (!current()) return;
        setFailure(sourceFailure('published-library', error, 'CardForge previews are unavailable.'), 'published-library');
      })
      .finally(() => {
        if (!current()) return;
        // Whether it succeeded or failed, the dependent tool can now make an
        // honest decision: use the loaded templates or show the source error.
        setTemplateCatalogReady(true);
        finish('published-library');
      });

    const signedInTasks = !isSignedIn ? [] : [
      loadGoogleDriveProjectLibrary()
        .then((value) => {
          if (!current()) return;
          setDriveLibrarySource(settleScopedSourceValue(persistenceScope, value, { empty: value.projects.length === 0 }));
        })
        .catch((error) => {
          if (!current()) return;
          const failure = sourceFailure('google-drive', error, 'Google Drive projects are unavailable.');
          setFailure(failure, 'google-drive');
          setDriveLibrarySource((previous) => settleScopedSourceFailure(previous, persistenceScope, failure));
        })
        .finally(() => { if (current()) finish('google-drive-library'); }),
      getGoogleDriveProjectBinding()
        .then((value) => {
          if (!current()) return;
          setDriveBindingSource(settleScopedSourceValue(persistenceScope, value?.fileId ?? null, { empty: !value?.fileId }));
        })
        .catch((error) => {
          if (!current()) return;
          const failure = sourceFailure('google-drive', error, 'Google Drive project attachment is unavailable.');
          setFailure(failure, 'google-drive');
          setDriveBindingSource((previous) => settleScopedSourceFailure(previous, persistenceScope, failure));
        })
        .finally(() => { if (current()) finish('google-drive-binding'); }),
      loadPersonalLibrary()
        .then((value) => {
          if (!current()) return;
          setPersonalLibrarySource(settleScopedSourceValue(persistenceScope, value, { empty: value.items.length === 0 }));
        })
        .catch((error) => {
          if (!current()) return;
          const failure = sourceFailure('personal-library', error, 'Connected assets are unavailable.');
          setFailure(failure, 'personal-library');
          setPersonalLibrarySource((previous) => settleScopedSourceFailure(previous, persistenceScope, failure));
        })
        .finally(() => { if (current()) finish('personal-library'); }),
      loadAllStudioDocumentSummaries()
        .then((value) => {
          if (!current()) return;
          setWorkingDraftSource(settleScopedSourceValue(persistenceScope, value, { empty: value.length === 0 }));
        })
        .catch((error) => {
          if (!current()) return;
          const failure = sourceFailure('assistant-drafts', error, 'Private working drafts are unavailable.');
          setFailure(failure, 'assistant-drafts');
          setWorkingDraftSource((previous) => settleScopedSourceFailure(previous, persistenceScope, failure));
        })
        .finally(() => { if (current()) finish('assistant-drafts'); }),
    ];

    // This await only lets callers observe that a refresh round has settled.
    // Each source above applies independently as soon as it resolves.
    await Promise.allSettled([deviceAssets, folderStatus, folderWork, bootstrap, ...signedInTasks]);
  }, [isSignedIn, persistenceScope, setDefaultTemplatesFromFiles]);

  useEffect(() => {
    if (!hydrated) return;
    void refreshLibrarySources();
  }, [hydrated, refreshLibrarySources]);

  useEffect(() => {
    if (!hydrated) return;
    const refresh = () => { void refreshLibrarySources(); };
    window.addEventListener(PROJECT_FONT_LIBRARY_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(PROJECT_FONT_LIBRARY_CHANGE_EVENT, refresh);
  }, [hydrated, refreshLibrarySources]);

  const cardCounts = useMemo(() => {
    const counts = new Map<string, number>();
    storedCards.forEach((card) => {
      if (card.setId) counts.set(card.setId, (counts.get(card.setId) ?? 0) + 1);
    });
    return counts;
  }, [storedCards]);

  const items = useMemo(() => applyAccountLibraryPrivateOrganization(buildAccountLibraryItems({
    localSets: cardSets.map((set) => ({
      id: set.id,
      name: set.name,
      cardCount: cardCounts.get(set.id) ?? 0,
      sizeBytes: null,
      metadata: set.metadata,
      })),
    localTemplates: userTemplates.flatMap((template) => template.id ? [{ id: template.id, name: template.name }] : []),
    localResources,
    driveProjects: driveLibrary?.projects ?? [],
    driveBindingFileId,
    localWorkFolders: localWorkFolders.map((binding) => ({
      workId: binding.workId,
      folderName: binding.folderName,
      sourceRevision: binding.sourceRevision,
      lastSavedAt: binding.lastSavedAt,
      permission: binding.permission,
    })),
    personalAssets: (personalLibrary?.items ?? []).map((item) => ({
      id: item.id,
      displayName: item.displayName,
      roleLabel: getPersonalLibraryRoleLabel(item.role),
      byteSize: item.byteSize,
      providerRevision: item.providerRevision,
      providerModifiedAt: item.providerModifiedAt,
      providerWebViewLink: item.providerWebViewLink,
    })),
    workingDrafts,
  }), privateOrganization), [cardCounts, cardSets, driveBindingFileId, driveLibrary?.projects, localResources, localWorkFolders, personalLibrary?.items, privateOrganization, userTemplates, workingDrafts]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
    const filtered = items.filter((item) => {
      if (kindFilters.length && !kindFilters.includes(item.kind)) return false;
      if (sourceFilters.length && !item.locations.some((location) => sourceFilters.includes(location.source))) return false;
      if (typeFilters.length && (!item.organization.type || !typeFilters.includes(item.organization.type))) return false;
      if (tagFilters.length) {
        const itemTags = new Set(item.organization.tags);
        if (tagMatch === 'all' && !tagFilters.every((tag) => itemTags.has(tag))) return false;
        if (tagMatch === 'any' && !tagFilters.some((tag) => itemTags.has(tag))) return false;
      }
      if (!normalizedQuery) return true;
      return [item.name, ...item.details, ...item.locations.map((location) => location.label)]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
    return filtered.toSorted((left, right) => {
      if (sort === 'name') return left.name.localeCompare(right.name);
      if (sort === 'kind') return left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name);
      return compareRecent(left, right);
    });
  }, [deferredQuery, items, kindFilters, sort, sourceFilters, tagFilters, tagMatch, typeFilters]);

  const sourceCounts = useMemo(() => {
    const counts = new Map<AccountLibrarySource, number>();
    items.forEach((item) => item.locations.forEach((location) => counts.set(location.source, (counts.get(location.source) ?? 0) + 1)));
    return counts;
  }, [items]);
  const sourceStatuses = useMemo<AccountLibrarySourceStatus[]>(() => [
    {
      id: 'workspace',
      label: 'This device',
      phase: !hydrated ? 'loading' : hydrationFailure ? sourcePhaseForFailure(hydrationFailure.kind) : 'ready',
      failure: hydrationFailure,
    },
    sourceStatus('device-assets', 'Device assets', localResourceSource, persistenceScope),
    sourceStatus('local-folder', 'Remembered folders', localWorkFolderSource, persistenceScope),
    ...(isSignedIn ? [
      sourceStatus('google-drive', 'Google Drive projects', driveLibrarySource, persistenceScope),
      sourceStatus('personal-library', 'Connected assets', personalLibrarySource, persistenceScope),
      sourceStatus('assistant-drafts', 'Private Studio drafts', workingDraftSource, persistenceScope),
    ] : []),
  ], [driveLibrarySource, hydrationFailure, hydrated, isSignedIn, localResourceSource, localWorkFolderSource, persistenceScope, personalLibrarySource, workingDraftSource]);
  const typeFacets = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      if (item.organization.type) counts.set(item.organization.type, (counts.get(item.organization.type) ?? 0) + 1);
    });
    return [...counts.entries()].map(([id, count]) => ({ id, label: id, count })).toSorted((left, right) => left.label.localeCompare(right.label));
  }, [items]);
  const tagFacets = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => item.organization.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
    return [...counts.entries()].map(([id, count]) => ({ id, label: id, count })).toSorted((left, right) => left.label.localeCompare(right.label));
  }, [items]);

  const home = useMemo(() => resolveAccountHomeLibraryProjection(items, activeSetId), [activeSetId, items]);

  const updatePersonalOrganization = useCallback((item: AccountLibraryItem, patch: { type?: string; tags?: string[] }): boolean => {
    if (item.references.localSetId) return updateCardSetMetadata(item.references.localSetId, patch);
    if (!privateOrganizationReady) return false;
    setPrivateOrganization((current) => {
      const existing = current[item.id] ?? { tags: [] };
      const next: AccountLibraryPrivateOrganization = {
        ...(patch.type !== undefined ? { type: patch.type } : existing.type ? { type: existing.type } : {}),
        tags: patch.tags ?? existing.tags,
      };
      const updated = { ...current, [item.id]: next };
      void writeProjectPreference(organizationPreferenceKey, updated);
      return updated;
    });
    return true;
  }, [organizationPreferenceKey, privateOrganizationReady, updateCardSetMetadata]);

  const openItem = useCallback(async (item: AccountLibraryItem, returnTo: string = createLibraryReturnHref()) => {
    setBusyItemId(item.id);
    try {
      if (item.references.workingDraftId) {
        router.push(createStudioHref({ documentId: item.references.workingDraftId, revision: item.revision, returnTo }));
        return;
      }
      if (item.references.localSetId) {
        useProjectStore.getState().setActiveCardSetId(item.references.localSetId);
        router.push(createDeskReturnHref(`set:${item.references.localSetId}`));
        return;
      }
      if (item.references.localTemplateId) {
        const store = useProjectStore.getState();
        store.setTemplateEditorSelectedTemplateId(item.references.localTemplateId);
        store.setStudioView('template');
        const params = new URLSearchParams({ section: 'library', scope: 'personal', tool: 'design', artifact: item.references.localTemplateId });
        router.push(`/account?${params.toString()}`);
        return;
      }
      if (item.references.campaignId) {
        router.push(`/account?section=library&scope=campaigns&campaign=${encodeURIComponent(item.references.campaignId)}`);
        return;
      }
      if (item.references.pipelineLineageId) {
        router.push(`/account?section=library&scope=published&lineage=${encodeURIComponent(item.references.pipelineLineageId)}`);
        return;
      }
      if (item.references.localFolderWorkId) {
        // A remembered directory handle cannot be elevated in the background.
        // The Library location tool makes the user-triggered reconnect choice.
        router.push('/account?section=library&tool=locations');
        return;
      }
      if (item.references.driveFileId) {
        const binding = await openGoogleDriveProject({ fileId: item.references.driveFileId, name: item.name });
        router.push(binding.workId ? createDeskReturnHref(`set:${binding.workId}`) : '/account');
      }
    } catch (error) {
      toast({
        title: 'Library item could not be opened',
        description: error instanceof Error ? error.message : 'CardForge could not open that library item.',
        variant: 'destructive',
      });
    } finally {
      setBusyItemId(null);
    }
  }, [router, toast]);

  return {
    items,
    localResources,
    visibleItems,
    featuredItem: home.featuredItem,
    recentItems: home.moreItems,
    sourceCounts,
    sourceStatuses,
    privateOrganization,
    privateOrganizationReady,
    privateOrganizationUnavailable,
    updatePersonalOrganization,
    failures: [hydrationFailure, ...sourceFailures].filter((failure): failure is AccountLibrarySourceFailure => Boolean(failure)),
    isLoading: !hydrated || loadingSources,
    loadingSources,
    templateCatalogReady,
    busyItemId,
    query,
    kind,
    source,
    kindFilters,
    sourceFilters,
    typeFilters,
    tagFilters,
    tagMatch,
    sort,
    setQuery,
    setKind: (next: AccountLibraryKind | 'all') => setKindFilters(next === 'all' ? [] : [next]),
    setSource: (next: AccountLibrarySource | 'all') => setSourceFilters(next === 'all' ? [] : [next]),
    setKindFilters,
    setSourceFilters,
    setTypeFilters,
    setTagFilters,
    setTagMatch,
    setSort,
    openItem,
    refresh: () => { void refreshLibrarySources(); },
    driveConnection: driveLibrary?.connection ?? null,
    localFolderSupported: localFolder?.supported ?? false,
    typeFacets,
    tagFacets,
    router,
  };
}
