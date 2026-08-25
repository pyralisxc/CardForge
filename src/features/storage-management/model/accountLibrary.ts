export const ACCOUNT_LIBRARY_KINDS = ['set', 'project', 'asset', 'working-draft'] as const;
export type AccountLibraryKind = typeof ACCOUNT_LIBRARY_KINDS[number];

export const ACCOUNT_LIBRARY_SOURCES = [
  'device',
  'cardforge-cloud',
  'google-drive',
  'local-folder',
  'assistant-draft',
] as const;
export type AccountLibrarySource = typeof ACCOUNT_LIBRARY_SOURCES[number];

export type AccountLibraryLocationStatus = 'available' | 'attached' | 'needs-permission' | 'temporary';

export interface AccountLibraryLocation {
  source: AccountLibrarySource;
  status: AccountLibraryLocationStatus;
  label: string;
}

export interface AccountLibraryReferences {
  localSetId?: string;
  cloudSetId?: string;
  driveFileId?: string;
  localFolder?: boolean;
  personalAssetId?: string;
  workingDraftId?: string;
}

export interface AccountLibraryItem {
  id: string;
  kind: AccountLibraryKind;
  name: string;
  locations: AccountLibraryLocation[];
  details: string[];
  sizeBytes: number | null;
  revision: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
  webViewLink: string | null;
  references: AccountLibraryReferences;
}

export type AccountLibraryAction = 'open' | 'continue' | 'view-source' | 'manage-storage';

export interface AccountLibraryMcpWorkflow {
  availability: 'browser-only' | 'read-only' | 'revision-safe' | 'working-document';
  tools: string[];
}

export interface AccountHomeLibraryProjection {
  featuredItem: AccountLibraryItem | null;
  moreItems: AccountLibraryItem[];
}

export const resolveAccountHomeLibraryProjection = (
  items: readonly AccountLibraryItem[],
  activeSetId: string | null,
  limit = 5,
): AccountHomeLibraryProjection => {
  const byRecency = [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt ?? '');
    const rightTime = Date.parse(right.updatedAt ?? '');
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return rightTime - leftTime;
    if (Number.isFinite(leftTime)) return -1;
    if (Number.isFinite(rightTime)) return 1;
    return left.name.localeCompare(right.name);
  });
  const featuredItem = items.find((item) => activeSetId !== null && item.references.localSetId === activeSetId)
    ?? byRecency.find((item) => item.references.workingDraftId || item.references.driveFileId || item.references.cloudSetId)
    ?? byRecency[0]
    ?? null;
  return {
    featuredItem,
    moreItems: (featuredItem ? byRecency.filter((item) => item.id !== featuredItem.id) : byRecency).slice(0, limit),
  };
};

interface LocalSetInput {
  id: string;
  name: string;
  cardCount: number;
  sizeBytes: number | null;
}

interface CloudSetInput {
  setId: string;
  name: string;
  cardCount: number;
  revision: number;
  storageBytes: number;
  updatedAt: string;
}

interface DriveProjectInput {
  fileId: string;
  name: string;
  providerRevision: string;
  projectRevision: string | null;
  modifiedAt: string;
  size: number;
  webViewLink: string | null;
}

interface LocalFolderInput {
  folderName: string;
  sourceRevision: string | null;
  lastSavedAt: string | null;
  permission: 'granted' | 'denied' | 'prompt' | 'unavailable';
}

interface PersonalAssetInput {
  id: string;
  displayName: string;
  roleLabel: string;
  byteSize: number;
  providerRevision: string;
  providerModifiedAt: string;
  providerWebViewLink: string | null;
}

interface WorkingDraftInput {
  id: string;
  title: string;
  revision: number;
  creationSource: string;
  updatedAt: string;
  expiresAt: string;
}

export interface BuildAccountLibraryItemsInput {
  localSets: LocalSetInput[];
  cloudSets: CloudSetInput[];
  driveProjects: DriveProjectInput[];
  driveBindingFileId: string | null;
  localFolder: LocalFolderInput | null;
  personalAssets: PersonalAssetInput[];
  workingDrafts: WorkingDraftInput[];
}

const kindOrder = new Map<AccountLibraryKind, number>(ACCOUNT_LIBRARY_KINDS.map((kind, index) => [kind, index]));

const compareLibraryItems = (left: AccountLibraryItem, right: AccountLibraryItem) => {
  const kindDifference = (kindOrder.get(left.kind) ?? 0) - (kindOrder.get(right.kind) ?? 0);
  if (kindDifference !== 0) return kindDifference;
  const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : Number.NaN;
  const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : Number.NaN;
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return rightTime - leftTime;
  return left.name.localeCompare(right.name);
};

export const buildAccountLibraryItems = ({
  localSets,
  cloudSets,
  driveProjects,
  driveBindingFileId,
  localFolder,
  personalAssets,
  workingDrafts,
}: BuildAccountLibraryItemsInput): AccountLibraryItem[] => {
  const items: AccountLibraryItem[] = [];
  const cloudBySetId = new Map(cloudSets.map((set) => [set.setId, set]));

  for (const localSet of localSets) {
    const cloudSet = cloudBySetId.get(localSet.id) ?? null;
    cloudBySetId.delete(localSet.id);
    items.push({
      id: `set:${localSet.id}`,
      kind: 'set',
      name: localSet.name,
      locations: [
        { source: 'device', status: 'available', label: 'This device' },
        ...(cloudSet ? [{ source: 'cardforge-cloud', status: 'available', label: 'CardForge Cloud' } as const] : []),
      ],
      details: [
        `${localSet.cardCount} card${localSet.cardCount === 1 ? '' : 's'}`,
        cloudSet ? `Cloud revision ${cloudSet.revision}` : 'Device only',
      ],
      sizeBytes: cloudSet?.storageBytes ?? localSet.sizeBytes,
      revision: cloudSet ? String(cloudSet.revision) : null,
      updatedAt: cloudSet?.updatedAt ?? null,
      expiresAt: null,
      webViewLink: null,
      references: {
        localSetId: localSet.id,
        ...(cloudSet ? { cloudSetId: cloudSet.setId } : {}),
      },
    });
  }

  for (const cloudSet of cloudBySetId.values()) {
    items.push({
      id: `set:${cloudSet.setId}`,
      kind: 'set',
      name: cloudSet.name,
      locations: [{ source: 'cardforge-cloud', status: 'available', label: 'CardForge Cloud' }],
      details: [`${cloudSet.cardCount} card${cloudSet.cardCount === 1 ? '' : 's'}`, `Cloud revision ${cloudSet.revision}`],
      sizeBytes: cloudSet.storageBytes,
      revision: String(cloudSet.revision),
      updatedAt: cloudSet.updatedAt,
      expiresAt: null,
      webViewLink: null,
      references: { cloudSetId: cloudSet.setId },
    });
  }

  for (const project of driveProjects) {
    const attached = project.fileId === driveBindingFileId;
    items.push({
      id: `drive-project:${project.fileId}`,
      kind: 'project',
      name: project.name,
      locations: [{
        source: 'google-drive',
        status: attached ? 'attached' : 'available',
        label: attached ? 'Google Drive · attached here' : 'Google Drive',
      }],
      details: [`Provider revision ${project.providerRevision}`, project.projectRevision ? 'Verified CardForge revision' : 'Revision needs refresh'],
      sizeBytes: project.size,
      revision: project.projectRevision,
      updatedAt: project.modifiedAt,
      expiresAt: null,
      webViewLink: project.webViewLink,
      references: { driveFileId: project.fileId },
    });
  }

  if (localFolder) {
    const needsPermission = localFolder.permission !== 'granted';
    items.push({
      id: 'local-folder:attached-project',
      kind: 'project',
      name: localFolder.folderName,
      locations: [{
        source: 'local-folder',
        status: needsPermission ? 'needs-permission' : 'attached',
        label: needsPermission ? 'Local folder · reconnect needed' : 'Local folder · attached here',
      }],
      details: [localFolder.sourceRevision ? 'Portable project revision available' : 'Project revision unknown'],
      sizeBytes: null,
      revision: localFolder.sourceRevision,
      updatedAt: localFolder.lastSavedAt,
      expiresAt: null,
      webViewLink: null,
      references: { localFolder: true },
    });
  }

  for (const asset of personalAssets) {
    items.push({
      id: `personal-asset:${asset.id}`,
      kind: 'asset',
      name: asset.displayName,
      locations: [{ source: 'google-drive', status: 'available', label: 'Google Drive' }],
      details: [asset.roleLabel, `Provider revision ${asset.providerRevision}`],
      sizeBytes: asset.byteSize,
      revision: asset.providerRevision,
      updatedAt: asset.providerModifiedAt,
      expiresAt: null,
      webViewLink: asset.providerWebViewLink,
      references: { personalAssetId: asset.id },
    });
  }

  for (const draft of workingDrafts) {
    items.push({
      id: `working-draft:${draft.id}`,
      kind: 'working-draft',
      name: draft.title,
      locations: [{ source: 'assistant-draft', status: 'temporary', label: 'Private working draft' }],
      details: [draft.creationSource === 'gpt' ? 'Created with ChatGPT' : 'Created in Studio'],
      sizeBytes: null,
      revision: String(draft.revision),
      updatedAt: draft.updatedAt,
      expiresAt: draft.expiresAt,
      webViewLink: null,
      references: { workingDraftId: draft.id },
    });
  }

  return items.sort(compareLibraryItems);
};

export const getAccountLibrarySourceLabel = (source: AccountLibrarySource): string => {
  switch (source) {
    case 'device': return 'This device';
    case 'cardforge-cloud': return 'CardForge Cloud';
    case 'google-drive': return 'Google Drive';
    case 'local-folder': return 'Local folder';
    case 'assistant-draft': return 'Private draft';
  }
};

export const getAccountLibraryAvailableActions = (item: AccountLibraryItem): AccountLibraryAction[] => {
  const actions: AccountLibraryAction[] = [];

  if (item.references.workingDraftId) actions.push('continue');
  else if (item.references.localSetId || item.references.cloudSetId || item.references.driveFileId) actions.push('open');

  if (item.webViewLink) actions.push('view-source');
  if (item.references.cloudSetId || item.references.driveFileId || item.references.localFolder) actions.push('manage-storage');

  return actions;
};

export const getAccountLibraryMcpWorkflow = (item: AccountLibraryItem): AccountLibraryMcpWorkflow => {
  if (item.references.cloudSetId) {
    return {
      availability: 'revision-safe',
      tools: ['list_cloud_sets', 'get_cloud_set', 'checkout_cloud_set', 'commit_cloud_set'],
    };
  }

  if (item.references.driveFileId) {
    return {
      availability: 'revision-safe',
      tools: ['list_connected_projects', 'checkout_project', 'commit_project'],
    };
  }

  if (item.references.workingDraftId) {
    return {
      availability: 'working-document',
      tools: ['list_agent_working_documents', 'get_agent_install_status'],
    };
  }

  if (item.references.personalAssetId) {
    return { availability: 'read-only', tools: ['search_personal_library'] };
  }

  return { availability: 'browser-only', tools: [] };
};
