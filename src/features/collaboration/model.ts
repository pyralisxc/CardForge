export const COLLABORATION_PROVIDERS = ['google-drive'] as const;
export type CollaborationProvider = typeof COLLABORATION_PROVIDERS[number];

export const COLLABORATION_SESSION_STATUSES = ['active', 'conflict', 'closed', 'expired'] as const;
export type CollaborationSessionStatus = typeof COLLABORATION_SESSION_STATUSES[number];

export const COLLABORATION_ROLES = ['viewer', 'editor'] as const;
export type CollaborationRole = typeof COLLABORATION_ROLES[number];

export interface CollaborationProviderCapabilities {
  canDownload: boolean;
  canEdit: boolean;
  canModifyContent: boolean;
}

export interface CollaborationCheckpoint {
  providerRevision: string;
  projectRevision: string;
}

export interface CollaborationSessionSummary {
  id: string;
  provider: CollaborationProvider;
  providerFileId: string;
  workId: string | null;
  topic: string;
  role: CollaborationRole;
  status: CollaborationSessionStatus;
  base: CollaborationCheckpoint;
  checkpoint: CollaborationCheckpoint;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export const getCollaborationRole = (
  capabilities: CollaborationProviderCapabilities,
): CollaborationRole | null => {
  if (!capabilities.canDownload) return null;
  return capabilities.canEdit && capabilities.canModifyContent ? 'editor' : 'viewer';
};

export const hasCollaborationCheckpointConflict = (
  checkpoint: CollaborationCheckpoint,
  current: CollaborationCheckpoint,
): boolean => (
  checkpoint.providerRevision !== current.providerRevision
  || checkpoint.projectRevision !== current.projectRevision
);

export const getCollaborationTopic = (sessionId: string): string => `cardforge-collaboration:${sessionId}`;
