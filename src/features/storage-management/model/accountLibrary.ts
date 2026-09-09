import type { CardSetMetadata } from '@/domain/cards';
import type { LocalLibraryResource } from '@/features/project/client/library-resources';

export const ACCOUNT_LIBRARY_KINDS = ['set', 'template', 'asset', 'working-draft', 'campaign', 'published-resource'] as const;
export type AccountLibraryKind = typeof ACCOUNT_LIBRARY_KINDS[number];

export const ACCOUNT_LIBRARY_SOURCES = [
  'device',
  'google-drive',
  'local-folder',
  'assistant-draft',
  'campaign',
  'pipeline',
] as const;
export type AccountLibrarySource = typeof ACCOUNT_LIBRARY_SOURCES[number];

export type AccountLibraryLocationStatus = 'available' | 'attached' | 'needs-permission' | 'temporary' | 'unavailable';

export interface AccountLibraryLocation {
  source: AccountLibrarySource;
  /** Storage is a durable copy; work-source identifies a server-owned projection. */
  kind?: 'storage' | 'work-source';
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
  localFolderWorkId?: string;
  personalAssetId?: string;
  workingDraftId?: string;
  campaignId?: string;
  pipelineLineageId?: string;
  pipelineAssetType?: string;
  pipelineSourceUrl?: string;
  pipelineSourceNotes?: string;
}

export type AccountLibraryPublicationState = 'working' | 'published' | 'campaign' | 'temporary';

/**
 * A small, already-authorized visual reference for a work object. Provider
 * source links remain navigation destinations and must never double as images.
 */
export type AccountLibraryWorkPreview =
  | { kind: 'authored-object' }
  | { kind: 'image'; url: string }
  | { kind: 'fallback'; reason: 'no-media' | 'permission-required' | 'unavailable' };

/**
 * Each field is deliberately descriptive. Provider locations and Pipeline
 * status remain on their native records; labels cannot unlock an action.
 */
export interface AccountLibraryOrganization {
  workflow: 'card-set' | 'assistant-document' | 'campaign' | 'published-resource' | 'resource';
  type: string | null;
  tags: string[];
  source: 'portable' | 'private' | 'none';
  publicationState: AccountLibraryPublicationState;
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
  /** Optional while legacy browser-local records are hydrated. */
  workPreview?: AccountLibraryWorkPreview;
  /** A native provider/browser destination, never an image source. */
  webViewLink: string | null;
  references: AccountLibraryReferences;
  localResource?: LocalLibraryResource;
  organization: AccountLibraryOrganization;
}

export const getAccountLibraryWorkPreview = (
  item: Pick<AccountLibraryItem, 'locations' | 'references' | 'workPreview'>,
): AccountLibraryWorkPreview => {
  if (item.references.localSetId) return { kind: 'authored-object' };
  if (item.locations.some((location) => location.status === 'needs-permission')) {
    return { kind: 'fallback', reason: 'permission-required' };
  }
  if (item.locations.some((location) => location.status === 'unavailable')) {
    return { kind: 'fallback', reason: 'unavailable' };
  }
  return item.workPreview ?? { kind: 'fallback', reason: 'no-media' };
};

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
  metadata?: CardSetMetadata;
}

interface LocalTemplateInput {
  id: string;
  name: string;
}

interface DriveProjectInput {
  localWorkId?: string;
  fileId: string;
  name: string;
  providerRevision: string;
  projectRevision: string | null;
  modifiedAt: string;
  size: number;
  webViewLink: string | null;
  thumbnailLink?: string | null;
  workId?: string | null;
}

interface LocalWorkFolderInput {
  workId: string;
  folderName: string;
  sourceRevision: string | null;
  lastSavedAt: string | null;
  permission: 'granted' | 'denied' | 'prompt' | 'unavailable';
}

export interface AccountLibraryPrivateOrganization {
  type?: string;
  tags: string[];
}

export type AccountLibraryOrganizationOperation =
  | { kind: 'set-type'; type: string }
  | { kind: 'add-tag'; tag: string }
  | { kind: 'remove-tag'; tag: string }
  | { kind: 'rename-tag'; from: string; to: string }
  | { kind: 'clear' };

const normalizeOrganizationText = (value: string | undefined, limit: number): string | null => {
  const normalized = value?.trim().replace(/\s+/gu, ' ').slice(0, limit) ?? '';
  return normalized || null;
};

const normalizeOrganizationTags = (tags: readonly string[]): string[] => Array.from(new Set(tags
  .map((tag) => normalizeOrganizationText(tag, 60))
  .filter((tag): tag is string => Boolean(tag)))).slice(0, 40);

/** Applies one deliberate label operation to one work object. */
export const applyAccountLibraryOrganizationOperation = (
  organization: Pick<AccountLibraryOrganization, 'type' | 'tags'>,
  operation: AccountLibraryOrganizationOperation,
): { type: string; tags: string[] } => {
  switch (operation.kind) {
    case 'set-type': return { type: operation.type, tags: organization.tags };
    case 'add-tag': return { type: organization.type ?? '', tags: normalizeOrganizationTags([...organization.tags, operation.tag]) };
    case 'remove-tag': return {
      type: organization.type ?? '',
      tags: organization.tags.filter((tag) => tag.toLocaleLowerCase() !== operation.tag.trim().toLocaleLowerCase()),
    };
    case 'rename-tag': return {
      type: organization.type ?? '',
      tags: normalizeOrganizationTags(organization.tags.map((tag) => (
        tag.toLocaleLowerCase() === operation.from.trim().toLocaleLowerCase() ? operation.to : tag
      ))),
    };
    case 'clear': return { type: '', tags: [] };
  }
};

const portableSetOrganization = (metadata: CardSetMetadata | undefined): AccountLibraryOrganization => ({
  workflow: 'card-set',
  type: normalizeOrganizationText(metadata?.type, 80),
  tags: normalizeOrganizationTags(metadata?.tags ?? []),
  source: metadata ? 'portable' : 'none',
  publicationState: 'working',
});

const organization = (
  workflow: AccountLibraryOrganization['workflow'],
  publicationState: AccountLibraryPublicationState,
  type: string | null = null,
): AccountLibraryOrganization => ({ workflow, publicationState, type, tags: [], source: 'none' });

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
      organization: portableSetOrganization(localSet.metadata),
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
      organization: organization('resource', 'working', 'Template'),
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
      organization: organization('resource', 'working', resource.kind === 'font' ? 'Font' : resource.kind),
    });
  }

  for (const project of driveProjects) {
    const attached = project.fileId === driveBindingFileId;
    const matchingWork = project.localWorkId ? workById.get(project.localWorkId) : null;
    const location: AccountLibraryLocation = {
      source: 'google-drive',
      status: attached || Boolean(matchingWork) ? 'attached' : 'available',
      label: attached || matchingWork ? 'Google Drive · linked copy' : 'Google Drive',
    };
    if (matchingWork) {
      matchingWork.locations.push(location);
      matchingWork.references.driveFileId = project.fileId;
      matchingWork.references.driveProviderRevision = project.providerRevision;
      matchingWork.references.driveProjectRevision = project.projectRevision ?? undefined;
      matchingWork.revision = project.projectRevision;
      // Provider modifiedAt describes the saved file, not the browser edits.
      matchingWork.details = matchingWork.details.filter((detail) => detail !== 'Device only');
      matchingWork.details.push('Google Drive · browser working data', `Drive saved ${project.modifiedAt}`);
      matchingWork.webViewLink = project.webViewLink;
      if (project.thumbnailLink) matchingWork.workPreview = { kind: 'image', url: project.thumbnailLink };
      matchingWork.sizeBytes = Math.max(matchingWork.sizeBytes ?? 0, project.size);
      continue;
    }
    const item: AccountLibraryItem = {
      id: `drive-project:${project.fileId}`,
      kind: 'set',
      name: project.name,
      locations: [location],
      details: ['Verified Drive content revision', project.projectRevision ? 'Verified CardForge revision' : 'Revision needs refresh'],
      sizeBytes: project.size,
      revision: project.projectRevision,
      updatedAt: project.modifiedAt,
      expiresAt: null,
      workPreview: project.thumbnailLink
        ? { kind: 'image', url: project.thumbnailLink }
        : { kind: 'fallback', reason: 'no-media' },
      webViewLink: project.webViewLink,
      references: {
        driveFileId: project.fileId,
        driveProviderRevision: project.providerRevision,
        ...(project.projectRevision ? { driveProjectRevision: project.projectRevision } : {}),
      },
      organization: organization('card-set', 'working'),
    };
    items.push(item);
  }

  for (const localFolder of localWorkFolders) {
    const matchingWork = workById.get(localFolder.workId);
    const needsPermission = localFolder.permission !== 'granted';
    const location: AccountLibraryLocation = {
        source: 'local-folder',
        status: needsPermission ? 'needs-permission' : 'attached',
        label: needsPermission ? `${localFolder.folderName} · reconnect` : localFolder.folderName,
    };
    if (!matchingWork) {
      items.push({
        id: `local-folder-work:${localFolder.workId}`,
        kind: 'set',
        name: localFolder.folderName,
        locations: [location],
        details: [needsPermission ? 'Folder permission required' : 'Saved folder work'],
        sizeBytes: null,
        revision: localFolder.sourceRevision,
        updatedAt: localFolder.lastSavedAt,
        expiresAt: null,
        webViewLink: null,
        references: { localFolder: true, localFolderWorkId: localFolder.workId },
        organization: organization('card-set', 'working'),
      });
      continue;
    }
    matchingWork.locations.push(location);
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
      organization: organization('resource', 'working', asset.roleLabel),
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
      organization: organization('assistant-document', 'temporary'),
    });
  }

  return items.sort(compareLibraryItems);
};

/**
 * Shared/Pipeline records remain immutable. A user may arrange them privately
 * in their account scope, but portable local Set metadata stays authoritative.
 */
export const applyAccountLibraryPrivateOrganization = (
  items: readonly AccountLibraryItem[],
  privateOrganization: Readonly<Record<string, AccountLibraryPrivateOrganization | undefined>>,
): AccountLibraryItem[] => items.map((item) => {
  if (item.references.localSetId) return item;
  const override = privateOrganization[item.id];
  if (!override) return item;
  const type = normalizeOrganizationText(override.type, 80);
  const tags = normalizeOrganizationTags(override.tags);
  if (!type && tags.length === 0) return item;
  return {
    ...item,
    organization: {
      ...item.organization,
      type: type ?? item.organization.type,
      tags,
      source: 'private',
    },
  };
});

export const getAccountLibrarySourceLabel = (source: AccountLibrarySource): string => {
  switch (source) {
    case 'device': return 'This device';
    case 'google-drive': return 'Google Drive';
    case 'local-folder': return 'Local folder';
    case 'assistant-draft': return 'Private draft';
    case 'campaign': return 'Marketing workspace';
    case 'pipeline': return 'CardForge Pipeline';
  }
};

export const getAccountLibraryAvailableActions = (item: AccountLibraryItem): AccountLibraryAction[] => {
  const actions: AccountLibraryAction[] = [];

  if (item.references.workingDraftId) actions.push('continue');
  else if (
    item.references.localSetId
    || item.references.localTemplateId
    || item.references.driveFileId
    || item.references.localFolderWorkId
    || item.references.campaignId
    || item.references.pipelineLineageId
  ) actions.push('open');

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
