import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const projectMocks = vi.hoisted(() => ({
  getGoogleDriveProject: vi.fn(),
  updateGoogleDriveProjectFromServer: vi.fn(),
}));
const documentMocks = vi.hoisted(() => ({
  createStudioDocument: vi.fn(),
  getStudioDocument: vi.fn(),
  recordStudioDocumentProjectSourceCommit: vi.fn(),
}));

vi.mock('@/features/project/server', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/project/server')>(),
  ...projectMocks,
}));
vi.mock('@/features/studio-documents/server/studioDocumentStore', () => documentMocks);
vi.mock('@/features/studio-documents/server/studioDocumentAccess', () => ({
  getStudioDocumentRetentionHours: vi.fn(async () => 24),
}));
vi.mock('@/features/studio-documents/server/studioDocumentAssetStore', () => ({
  getStudioDocumentAssetDownloads: vi.fn(async () => []),
}));

import {
  checkoutConnectedProjectForAgent,
  commitAgentWorkingProjectToSource,
} from '@/features/studio-documents/server/mcpProjectSourceBridge';
import type { ProjectDocumentV1 } from '@/features/project/server';

const sourceRevision = 'a'.repeat(64);
const document: ProjectDocumentV1 = {
  version: 1,
  userTemplates: [{
    id: 'template-source',
    name: 'Source Template',
    aspectRatio: '63:88',
    templateSource: 'user',
    freeformCanvas: { width: 630, height: 880, elements: [] },
  }],
  cardSets: [{ id: 'set-source', name: 'Source Set' }],
  activeCardSetId: 'set-source',
  storedCards: [{ uniqueId: 'card-source', templateId: 'template-source', setId: 'set-source', data: { title: 'Source' } }],
  appearanceStyles: [],
  exportSettings: {},
  customAssets: {
    'cardforge-maker-custom-textures': [],
    'cardforge-maker-custom-dividers': [],
    'cardforge-maker-custom-icons': [],
    'cardforge-maker-custom-images': [],
  },
};
const access = {
  user: { id: 'user-source' },
  entitlement: { isSignedIn: true, accountUserId: 'account-source', accessMode: 'creator' },
  isOwner: false,
  isContributor: false,
  scopes: [],
  capabilities: ['studio.ai.create'],
  email: 'creator@example.com',
  displayName: 'Creator',
} as never;

const driveSource = {
  summary: {
    fileId: 'drive_file_source',
    name: 'Source Set.cardforge',
    providerRevision: '8',
    projectRevision: sourceRevision,
    workId: 'set-source',
  },
  document,
};

describe('MCP connected-project revision bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectMocks.getGoogleDriveProject.mockResolvedValue(driveSource);
    documentMocks.createStudioDocument.mockResolvedValue({ id: 'working-source', revision: 1 });
  });

  it('rejects a stale Drive provider revision before creating an agent checkout', async () => {
    await expect(checkoutConnectedProjectForAgent({
      access,
      provider: 'google-drive',
      projectId: 'drive_file_source',
      expectedProviderRevision: '7',
      expectedProjectRevision: sourceRevision,
    })).rejects.toMatchObject({ status: 409 });

    expect(documentMocks.createStudioDocument).not.toHaveBeenCalled();
  });

  it('records the exact Drive and CardForge revisions on checkout', async () => {
    await checkoutConnectedProjectForAgent({
      access,
      provider: 'google-drive',
      projectId: 'drive_file_source',
      expectedProviderRevision: '8',
      expectedProjectRevision: sourceRevision,
    });

    expect(documentMocks.createStudioDocument).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: 'user-source',
      document,
      sourceProject: {
        provider: 'google-drive',
        externalId: 'drive_file_source',
        providerRevision: '8',
        projectRevision: sourceRevision,
        projectName: 'Source Set.cardforge',
      },
    }));
  });

  it('commits only the checked-out lineage and preserves the Drive work identity', async () => {
    documentMocks.getStudioDocument.mockResolvedValue({
      id: 'working-source',
      revision: 3,
      document,
      sourceProjectProvider: 'google-drive',
      sourceProjectExternalId: 'drive_file_source',
      sourceProviderRevision: '8',
      sourceProjectRevision: sourceRevision,
      sourceProjectName: 'Source Set.cardforge',
    });
    projectMocks.updateGoogleDriveProjectFromServer.mockImplementation(async (input) => ({
      fileId: input.fileId,
      name: input.name,
      providerRevision: '9',
      projectRevision: input.projectRevision,
      workId: 'set-source',
    }));
    documentMocks.recordStudioDocumentProjectSourceCommit.mockResolvedValue({
      provider: 'google-drive', externalId: 'drive_file_source', providerRevision: '9', projectRevision: 'b'.repeat(64), projectName: 'Source Set.cardforge',
    });

    const result = await commitAgentWorkingProjectToSource({
      access,
      documentId: 'working-source',
      expectedDocumentRevision: 3,
      provider: 'google-drive',
      projectId: 'drive_file_source',
      expectedProviderRevision: '8',
      expectedProjectRevision: sourceRevision,
    });

    expect(projectMocks.updateGoogleDriveProjectFromServer).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: 'account-source',
      fileId: 'drive_file_source',
      expectedProviderRevision: '8',
      expectedProjectRevision: sourceRevision,
    }));
    expect(result.source.workId).toBe('set-source');
    expect(documentMocks.recordStudioDocumentProjectSourceCommit).toHaveBeenCalledOnce();
  });

  it('rejects a commit whose supplied revisions do not match the checkout lineage', async () => {
    documentMocks.getStudioDocument.mockResolvedValue({
      revision: 3,
      document,
      sourceProjectProvider: 'google-drive',
      sourceProjectExternalId: 'drive_file_source',
      sourceProviderRevision: '9',
      sourceProjectRevision: sourceRevision,
      sourceProjectName: 'Source Set.cardforge',
    });

    await expect(commitAgentWorkingProjectToSource({
      access,
      documentId: 'working-source',
      expectedDocumentRevision: 3,
      provider: 'google-drive',
      projectId: 'drive_file_source',
      expectedProviderRevision: '8',
      expectedProjectRevision: sourceRevision,
    })).rejects.toMatchObject({ status: 409 });

    expect(projectMocks.updateGoogleDriveProjectFromServer).not.toHaveBeenCalled();
  });
});
