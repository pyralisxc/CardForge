import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import {
  getGoogleDriveProject,
  GOOGLE_DRIVE_PROJECT_PROVIDER,
  isGoogleDriveFileId,
  type GoogleDriveProjectSummary,
} from '@/features/project/server';

import {
  getCollaborationRole,
  getCollaborationTopic,
  hasCollaborationCheckpointConflict,
  type CollaborationCheckpoint,
  type CollaborationRole,
  type CollaborationSessionStatus,
  type CollaborationSessionSummary,
} from '../model';

const SESSION_HOURS = 8;
const SESSION_COLUMNS = 'id,provider,provider_file_id,work_id,created_by_user_id,status,base_provider_revision,base_project_revision,checkpoint_provider_revision,checkpoint_project_revision,created_at,updated_at,expires_at';

type CollaborationSessionRow = {
  id: string;
  provider: typeof GOOGLE_DRIVE_PROJECT_PROVIDER;
  provider_file_id: string;
  work_id: string | null;
  created_by_user_id: string;
  status: CollaborationSessionStatus;
  base_provider_revision: string;
  base_project_revision: string;
  checkpoint_provider_revision: string;
  checkpoint_project_revision: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

export type CollaborationErrorCode =
  | 'collaboration_auth_required'
  | 'collaboration_capabilities_unavailable'
  | 'collaboration_external_change'
  | 'collaboration_invalid_file'
  | 'collaboration_not_permitted'
  | 'collaboration_project_revision_required'
  | 'collaboration_provider_identity_unavailable'
  | 'collaboration_session_changed'
  | 'collaboration_unavailable';

export class CollaborationSessionError extends Error {
  readonly status: number;
  readonly code: CollaborationErrorCode;

  constructor(message: string, status = 500, code: CollaborationErrorCode = 'collaboration_unavailable') {
    super(message);
    this.name = 'CollaborationSessionError';
    this.status = status;
    this.code = code;
  }
}

const requireStore = () => {
  const database = getSupabaseServerClient();
  if (!database) throw new CollaborationSessionError('Live collaboration is not configured.', 503);
  return database;
};

const getCheckpoint = (project: GoogleDriveProjectSummary): CollaborationCheckpoint => {
  if (!project.projectRevision) {
    throw new CollaborationSessionError(
      'This Drive file does not expose a verified CardForge project revision yet. Reopen or resave it before starting collaboration.',
      409,
      'collaboration_project_revision_required',
    );
  }
  return {
    providerRevision: project.providerRevision,
    projectRevision: project.projectRevision,
  };
};

const getDriveRole = (project: GoogleDriveProjectSummary): CollaborationRole => {
  const capabilities = project.capabilities;
  if (!capabilities) {
    throw new CollaborationSessionError(
      'Google Drive did not return collaboration capabilities for this file.',
      503,
      'collaboration_capabilities_unavailable',
    );
  }
  const role = getCollaborationRole({
    canDownload: capabilities.canDownload,
    canEdit: capabilities.canEdit,
    canModifyContent: capabilities.canModifyContent,
  });
  if (!role) {
    throw new CollaborationSessionError(
      'Your Google Drive role cannot download this CardForge file.',
      403,
      'collaboration_not_permitted',
    );
  }
  return role;
};

const toSummary = (row: CollaborationSessionRow, role: CollaborationRole): CollaborationSessionSummary => ({
  id: row.id,
  provider: row.provider,
  providerFileId: row.provider_file_id,
  workId: row.work_id,
  topic: getCollaborationTopic(row.id),
  role,
  status: row.status,
  base: {
    providerRevision: row.base_provider_revision,
    projectRevision: row.base_project_revision,
  },
  checkpoint: {
    providerRevision: row.checkpoint_provider_revision,
    projectRevision: row.checkpoint_project_revision,
  },
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  expiresAt: row.expires_at,
});

const readActiveSession = async (fileId: string): Promise<CollaborationSessionRow | null> => {
  const { data, error } = await requireStore()
    .from('cardforge_collaboration_sessions')
    .select(SESSION_COLUMNS)
    .eq('provider', GOOGLE_DRIVE_PROJECT_PROVIDER)
    .eq('provider_file_id', fileId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error) {
    console.error('Unable to read CardForge collaboration session:', error);
    throw new CollaborationSessionError('CardForge could not read the live collaboration session.');
  }
  return data ? data as unknown as CollaborationSessionRow : null;
};

const createSession = async ({
  ownerUserId,
  project,
  checkpoint,
}: {
  ownerUserId: string;
  project: GoogleDriveProjectSummary;
  checkpoint: CollaborationCheckpoint;
}): Promise<CollaborationSessionRow> => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await requireStore()
    .from('cardforge_collaboration_sessions')
    .insert({
      provider: GOOGLE_DRIVE_PROJECT_PROVIDER,
      provider_file_id: project.fileId,
      work_id: project.workId,
      created_by_user_id: ownerUserId,
      status: 'active',
      base_provider_revision: checkpoint.providerRevision,
      base_project_revision: checkpoint.projectRevision,
      checkpoint_provider_revision: checkpoint.providerRevision,
      checkpoint_project_revision: checkpoint.projectRevision,
      last_activity_at: now.toISOString(),
      expires_at: expiresAt,
    })
    .select(SESSION_COLUMNS)
    .single();

  if (!error && data) return data as unknown as CollaborationSessionRow;

  // A second authorized participant may create the same file session at the
  // same moment. The partial unique index is the arbiter; on that race, join
  // the surviving active session instead of manufacturing a second room.
  if (error?.code === '23505') {
    const concurrent = await readActiveSession(project.fileId);
    if (concurrent) return concurrent;
  }
  console.error('Unable to create CardForge collaboration session:', error);
  throw new CollaborationSessionError('CardForge could not start the live collaboration session.');
};

const markConflict = async (row: CollaborationSessionRow): Promise<void> => {
  const { error } = await requireStore()
    .from('cardforge_collaboration_sessions')
    .update({ status: 'conflict', updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('status', 'active')
    .eq('checkpoint_provider_revision', row.checkpoint_provider_revision)
    .eq('checkpoint_project_revision', row.checkpoint_project_revision);
  if (error) console.error('Unable to mark collaboration session conflicted:', error);
};

const joinSession = async ({
  row,
  ownerUserId,
  role,
  providerAccountId,
}: {
  row: CollaborationSessionRow;
  ownerUserId: string;
  role: CollaborationRole;
  providerAccountId: string;
}): Promise<CollaborationSessionRow> => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  const database = requireStore();
  const { error: memberError } = await database
    .from('cardforge_collaboration_members')
    .upsert({
      session_id: row.id,
      user_id: ownerUserId,
      role,
      provider_account_id: providerAccountId,
      last_seen_at: now.toISOString(),
      left_at: null,
    }, { onConflict: 'session_id,user_id' });
  if (memberError) {
    console.error('Unable to join CardForge collaboration session:', memberError);
    throw new CollaborationSessionError('CardForge could not join the live collaboration session.');
  }

  const { data, error } = await database
    .from('cardforge_collaboration_sessions')
    .update({ last_activity_at: now.toISOString(), expires_at: expiresAt })
    .eq('id', row.id)
    .eq('status', 'active')
    .select(SESSION_COLUMNS)
    .maybeSingle();
  if (error || !data) {
    console.error('Unable to refresh CardForge collaboration session:', error);
    throw new CollaborationSessionError(
      'The collaboration session changed while you were joining. Reopen the Drive file and try again.',
      409,
      'collaboration_session_changed',
    );
  }
  return data as unknown as CollaborationSessionRow;
};

export const startOrJoinGoogleDriveCollaborationSession = async ({
  ownerUserId,
  fileId,
}: {
  ownerUserId: string;
  fileId: string;
}): Promise<CollaborationSessionSummary> => {
  if (!isGoogleDriveFileId(fileId)) {
    throw new CollaborationSessionError('Google Drive file id is invalid.', 400, 'collaboration_invalid_file');
  }
  const source = await getGoogleDriveProject({ ownerUserId, fileId });
  const project = source.summary;
  const role = getDriveRole(project);
  const providerAccountId = project.accountId?.trim();
  if (!providerAccountId) {
    throw new CollaborationSessionError(
      'CardForge could not verify which Google account authorized this file.',
      503,
      'collaboration_provider_identity_unavailable',
    );
  }
  const current = getCheckpoint(project);
  let row = await readActiveSession(fileId);
  if (!row) row = await createSession({ ownerUserId, project, checkpoint: current });

  if (hasCollaborationCheckpointConflict({
    providerRevision: row.checkpoint_provider_revision,
    projectRevision: row.checkpoint_project_revision,
  }, current)) {
    await markConflict(row);
    throw new CollaborationSessionError(
      'Google Drive changed outside this collaboration session. The live room was stopped before merging against an unknown Drive revision.',
      409,
      'collaboration_external_change',
    );
  }

  row = await joinSession({ row, ownerUserId, role, providerAccountId });
  return toSummary(row, role);
};

export const getGoogleDriveCollaborationSession = async ({
  ownerUserId,
  fileId,
}: {
  ownerUserId: string;
  fileId: string;
}): Promise<CollaborationSessionSummary | null> => {
  if (!isGoogleDriveFileId(fileId)) return null;
  const row = await readActiveSession(fileId);
  if (!row) return null;
  const { data, error } = await requireStore()
    .from('cardforge_collaboration_members')
    .select('role')
    .eq('session_id', row.id)
    .eq('user_id', ownerUserId)
    .is('left_at', null)
    .maybeSingle();
  if (error) {
    console.error('Unable to read CardForge collaboration membership:', error);
    throw new CollaborationSessionError('CardForge could not read your live collaboration membership.');
  }
  if (!data || (data.role !== 'viewer' && data.role !== 'editor')) return null;
  return toSummary(row, data.role);
};

export const leaveGoogleDriveCollaborationSession = async ({
  ownerUserId,
  fileId,
}: {
  ownerUserId: string;
  fileId: string;
}): Promise<boolean> => {
  const row = await readActiveSession(fileId);
  if (!row) return false;
  const now = new Date().toISOString();
  const { data, error } = await requireStore()
    .from('cardforge_collaboration_members')
    .update({ left_at: now, last_seen_at: now })
    .eq('session_id', row.id)
    .eq('user_id', ownerUserId)
    .is('left_at', null)
    .select('session_id')
    .maybeSingle();
  if (error) {
    console.error('Unable to leave CardForge collaboration session:', error);
    throw new CollaborationSessionError('CardForge could not leave the live collaboration session.');
  }
  return Boolean(data);
};
