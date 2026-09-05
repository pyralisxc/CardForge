import type { LocalLibraryResource } from '@/features/project/client/library-resources';

export const ACCOUNT_LIBRARY_KINDS = ['set', 'template', 'asset', 'working-draft'] as const;
export type AccountLibraryKind = typeof ACCOUNT_LIBRARY_KINDS[number];

export const ACCOUNT_LIBRARY_SOURCES = [
  'device',
  'google-drive',
  'local-folder',
  'assistant-draft',
] as const;
export type AccountLibrarySource = typeof ACCOUNT_LIBRARY_SOURCES[number];

export type AccountLibraryLocationStatus = 'available' | 'attached' | 'needs-permission' | 'temporary' | 'unavailable';

export interface AccountLibraryLocation {
  source: AccountLibrarySource;
  status: AccountLibraryLocationStatus;
  label: string;
}

export interface AccountLibraryReferences {
  localSetId?: string;
  localTemplateId?: string;
  localResourceId?: string;
  driveFileId?: string;
  driveProviderRevision?: string;
  driveProjectRevision?: string;
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
  localResource?: LocalLibraryResource;
}

export type AccountLibraryAction = 'open' | 'continue' | 'save-move' | 'duplicate' | 'delete-copy' | 'view-source' | 'manage-storage';

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
    ?? byRecency.find((item) => item.references.workingDraftId || item.references.driveFileId)
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

interface LocalTemplateInput {
  id: string;
  name: string;
}

interface DriveProjectInput {
  fileId: string;
  name: string;
  providerRevision: string;
  projectRevision: string | null;
  modifiedAt: string;
  size: number;
  webViewLink: string | null;
  workId?: string | null;
}

interface LocalWorkFolderInput {
  workId: string;
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
  localTemplates?: LocalTemplateInput[];
  localResources?: readonly LocalLibraryResource[];
  driveProjects: DriveProjectInput[];
  driveBindingFileId: string | null;
  localWorkFolders: LocalWorkFolderInput[];
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
  localTemplates = [],
  localResources = [],
  driveProjects,
  driveBindingFileId,
  localWorkFolders,
  personalAssets,
  workingDrafts,
}: BuildAccountLibraryItemsInput): AccountLibraryItem[] => {
  const items: AccountLibraryItem[] = [];
  const workById = new Map<string, AccountLibraryItem>();

  for (const localSet of localSets) {
    const item: AccountLibraryItem = {
      id: `set:${localSet.id}`,
      kind: 'set',
      name: localSet.name,
      locations: [{ source: 'device', status: 'available', label: 'This device' }],
      details: [
        `${localSet.cardCount} card${localSet.cardCount === 1 ? '' : 's'}`,
        'Device only',
      ],
      sizeBytes: localSet.sizeBytes,
      revision: null,
      updatedAt: null,
      expiresAt: null,
      webViewLink: null,
      references: { localSetId: localSet.id },
    };
    items.push(item);
    workById.set(localSet.id, item);
  }

  for (const template of localTemplates) {
    items.push({
      id: `template:${template.id}`,
      kind: 'template',
      name: template.name,
      locations: [{ source: 'device', status: 'available', label: 'This device' }],
      details: ['Personal Template', 'Reusable in Studio'],
      sizeBytes: null,
      revision: null,
      updatedAt: null,
      expiresAt: null,
      webViewLink: null,
      references: { localTemplateId: template.id },
    });
  }

  for (const resource of localResources) {
    items.push({
      id: resource.id,
      kind: 'asset',
      name: resource.name,
      locations: [{ source: 'device', status: resource.status === 'available' ? 'available' : 'unavailable', label: 'This device' }],
      details: [resource.kind === 'font' ? 'Project font' : `Local ${resource.kind}`, resource.status === 'missing-source' ? 'Source missing; restore a backup' : resource.status === 'unavailable' ? 'Source unavailable; retry this collection' : 'Reusable in Studio'],
      sizeBytes: resource.sizeBytes,
      revision: null,
      updatedAt: null,
      expiresAt: null,
      webViewLink: null,
      references: { localResourceId: resource.id },
      localResource: resource,
    });
  }

  for (const project of driveProjects) {
    const attached = project.fileId === driveBindingFileId;
    const matchingWork = project.workId ? workById.get(project.workId) : null;
    const location: AccountLibraryLocation = {
      source: 'google-drive',
      status: attached || Boolean(matchingWork) ? 'attached' : 'available',
      label: attached || matchingWork ? 'Google Drive · linked copy' : 'Google Drive',
    };
    if (matchingWork) {
      matchingWork.locations.push(location);
      matchingWork.references.driveFileId = project.fileId;
      matchingWork.references.driveProviderRevision = project.providerRevision;
      if (project.projectRevision) matchingWork.references.driveProjectRevision = project.projectRevision;
      matchingWork.revision = project.projectRevision;
      matchingWork.updatedAt = project.modifiedAt;
      matchingWork.webViewLink = project.webViewLink;
      matchingWork.sizeBytes = Math.max(matchingWork.sizeBytes ?? 0, project.size);
      continue;
    }
    const item: AccountLibraryItem = {
      id: `drive-project:${project.fileId}`,
      kind: 'set',
      name: project.name,
      locations: [location],
      details: [`Provider revision ${project.providerRevision}`, project.projectRevision ? 'Verified CardForge revision' : 'Revision needs refresh'],
      sizeBytes: project.size,
      revision: project.projectRevision,
      updatedAt: project.modifiedAt,
      expiresAt: null,
      webViewLink: project.webViewLink,
      references: {
        driveFileId: project.fileId,
        driveProviderRevision: project.providerRevision,
        ...(project.projectRevision ? { driveProjectRevision: project.projectRevision } : {}),
      },
    };
    items.push(item);
    if (project.workId) workById.set(project.workId, item);
  }

  for (const localFolder of localWorkFolders) {
    const matchingWork = workById.get(localFolder.workId);
    if (!matchingWork) continue;
    const needsPermission = localFolder.permission !== 'granted';
    matchingWork.locations.push({
        source: 'local-folder',
        status: needsPermission ? 'needs-permission' : 'attached',
        label: needsPermission ? `${localFolder.folderName} · reconnect` : localFolder.folderName,
    });
    matchingWork.references.localFolder = true;
    matchingWork.revision ??= localFolder.sourceRevision;
    matchingWork.updatedAt ??= localFolder.lastSavedAt;
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
    case 'google-drive': return 'Google Drive';
    case 'local-folder': return 'Local folder';
    case 'assistant-draft': return 'Private draft';
  }
};

export const getAccountLibraryAvailableActions = (item: AccountLibraryItem): AccountLibraryAction[] => {
  const actions: AccountLibraryAction[] = [];

  if (item.references.workingDraftId) actions.push('continue');
  else if (item.references.localSetId || item.references.localTemplateId || item.references.driveFileId) actions.push('open');

  if (item.kind === 'set') actions.push('save-move');
  if (item.references.localSetId || item.references.localTemplateId) actions.push('duplicate');
  if (item.references.localSetId || item.references.driveFileId) actions.push('delete-copy');

  if (item.webViewLink) actions.push('view-source');
  if (item.references.driveFileId || item.references.localFolder) actions.push('manage-storage');

  return actions;
};

export const getAccountLibraryMcpWorkflow = (item: AccountLibraryItem): AccountLibraryMcpWorkflow => {
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
