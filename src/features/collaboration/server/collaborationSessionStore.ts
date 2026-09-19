import * as Y from 'yjs';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import {
  buildCardForgeProjectSnapshot,
  createCardForgeProjectPackageBlob,
  getGoogleDriveProject,
  GOOGLE_DRIVE_PROJECT_PROVIDER,
  isGoogleDriveFileId,
  updateGoogleDriveProjectFromServer,
  type GoogleDriveProjectSummary,
  type ProjectDocumentV1,
} from '@/features/project/server';

import { decideCollaborationCheckpoint } from '../checkpointDecision';
import {
  getCollaborationRole,
  getCollaborationTopic,
  type CollaborationCheckpoint,
  type CollaborationRole,
  type CollaborationRoomState,
  type CollaborationSessionStatus,
  type CollaborationSessionSummary,
} from '../model';
import {
  applyCollaborationUpdate,
  createCollaborationAuthoredDocument,
  createYjsCollaborationDocument,
  encodeCollaborationState,
  readCollaborationAuthoredDocument,
  type CollaborationAuthoredDocument,
} from '../yjsAuthoredDocument';

const SESSION_HOURS = 8;
export const MAX_COLLABORATION_STATE_BYTES = 4 * 1024 * 1024;
export const MAX_COLLABORATION_UPDATE_BYTES = 512 * 1024;
const MAX_CRDT_WRITE_ATTEMPTS = 4;
const SESSION_COLUMNS = 'id,provider,provider_file_id,work_id,created_by_user_id,status,base_provider_revision,base_project_revision,checkpoint_provider_revision,checkpoint_project_revision,crdt_state,crdt_version,created_at,updated_at,expires_at';

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
  crdt_state: string | null;
  crdt_version: number;
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

const encodeRoomState = (state: Uint8Array): string => {
  if (state.byteLength <= 0 || state.byteLength > MAX_COLLABORATION_STATE_BYTES) {
    throw new CollaborationSessionError(
      'This collaboration state exceeds the safe live-session limit.',
      413,
      'collaboration_unavailable',
    );
  }
  return Buffer.from(state).toString('base64url');
};

const decodeRoomState = (state: string | null): Uint8Array => {
  if (!state?.trim()) {
    throw new CollaborationSessionError(
      'The collaboration room has no recoverable live state.',
      409,
      'collaboration_session_changed',
    );
  }
  let bytes: Buffer;
  try {
    bytes = Buffer.from(state, 'base64url');
  } catch {
    throw new CollaborationSessionError(
      'The collaboration room state is unreadable.',
      409,
      'collaboration_session_changed',
    );
  }
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_COLLABORATION_STATE_BYTES) {
    throw new CollaborationSessionError(
      'The collaboration room state is outside the safe live-session limit.',
      409,
      'collaboration_session_changed',
    );
  }
  return new Uint8Array(bytes);
};

const decodeIncomingUpdate = (value: string): Uint8Array => {
  if (!value?.trim()) {
    throw new CollaborationSessionError('A collaboration update is required.', 400, 'collaboration_invalid_file');
  }
  let bytes: Buffer;
  try {
    bytes = Buffer.from(value, 'base64url');
  } catch {
    throw new CollaborationSessionError('The collaboration update is invalid.', 400, 'collaboration_invalid_file');
  }
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_COLLABORATION_UPDATE_BYTES) {
    throw new CollaborationSessionError('The collaboration update exceeds the safe live-update limit.', 413, 'collaboration_unavailable');
  }
  return new Uint8Array(bytes);
};

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
  crdtState,
}: {
  ownerUserId: string;
  project: GoogleDriveProjectSummary;
  checkpoint: CollaborationCheckpoint;
  crdtState: string;
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
      crdt_state: crdtState,
      crdt_version: 0,
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
  if (!row) {
    const authored = createCollaborationAuthoredDocument(source.document);
    const document = createYjsCollaborationDocument(authored);
    const crdtState = encodeRoomState(encodeCollaborationState(document));
    document.destroy();
    row = await createSession({ ownerUserId, project, checkpoint: current, crdtState });
  }

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

const getMembershipRole = async ({
  sessionId,
  ownerUserId,
}: {
  sessionId: string;
  ownerUserId: string;
}): Promise<CollaborationRole | null> => {
  const { data, error } = await requireStore()
    .from('cardforge_collaboration_members')
    .select('role')
    .eq('session_id', sessionId)
    .eq('user_id', ownerUserId)
    .is('left_at', null)
    .maybeSingle();
  if (error) {
    console.error('Unable to read CardForge collaboration membership:', error);
    throw new CollaborationSessionError('CardForge could not read your live collaboration membership.');
  }
  return data?.role === 'viewer' || data?.role === 'editor' ? data.role : null;
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
  const role = await getMembershipRole({ sessionId: row.id, ownerUserId });
  if (!role) return null;
  return toSummary(row, role);
};

export const getGoogleDriveCollaborationState = async ({
  ownerUserId,
  fileId,
}: {
  ownerUserId: string;
  fileId: string;
}): Promise<CollaborationRoomState> => {
  if (!isGoogleDriveFileId(fileId)) {
    throw new CollaborationSessionError('Google Drive file id is invalid.', 400, 'collaboration_invalid_file');
  }
  const row = await readActiveSession(fileId);
  if (!row) {
    throw new CollaborationSessionError('No active collaboration session exists for this Drive file.', 404, 'collaboration_session_changed');
  }
  const role = await getMembershipRole({ sessionId: row.id, ownerUserId });
  if (!role) throw new CollaborationSessionError('Join this collaboration session before reading its live state.', 403, 'collaboration_not_permitted');
  const state = row.crdt_state;
  decodeRoomState(state);
  return { state: state!, version: row.crdt_version };
};

export const mergeGoogleDriveCollaborationUpdate = async ({
  ownerUserId,
  fileId,
  update,
}: {
  ownerUserId: string;
  fileId: string;
  update: string;
}): Promise<CollaborationRoomState> => {
  if (!isGoogleDriveFileId(fileId)) {
    throw new CollaborationSessionError('Google Drive file id is invalid.', 400, 'collaboration_invalid_file');
  }
  const incoming = decodeIncomingUpdate(update);
  for (let attempt = 0; attempt < MAX_CRDT_WRITE_ATTEMPTS; attempt += 1) {
    const row = await readActiveSession(fileId);
    if (!row) throw new CollaborationSessionError('The collaboration session is no longer active.', 409, 'collaboration_session_changed');
    const role = await getMembershipRole({ sessionId: row.id, ownerUserId });
    if (role !== 'editor') {
      throw new CollaborationSessionError('Your current Drive role is view-only for this collaboration session.', 403, 'collaboration_not_permitted');
    }

    const document = new Y.Doc();
    try {
      applyCollaborationUpdate(document, decodeRoomState(row.crdt_state), 'server-room-state');
      applyCollaborationUpdate(document, incoming, 'server-room-update');
      const merged = encodeRoomState(encodeCollaborationState(document));
      const now = new Date().toISOString();
      const { data, error } = await requireStore()
        .from('cardforge_collaboration_sessions')
        .update({
          crdt_state: merged,
          crdt_version: row.crdt_version + 1,
          last_activity_at: now,
          updated_at: now,
        })
        .eq('id', row.id)
        .eq('status', 'active')
        .eq('crdt_version', row.crdt_version)
        .select('crdt_state,crdt_version')
        .maybeSingle();
      if (error) {
        console.error('Unable to persist CardForge collaboration update:', error);
        throw new CollaborationSessionError('CardForge could not persist the live collaboration update.');
      }
      if (data?.crdt_state && Number.isInteger(data.crdt_version)) {
        return { state: data.crdt_state, version: data.crdt_version };
      }
    } finally {
      document.destroy();
    }
  }
  throw new CollaborationSessionError(
    'The collaboration room changed too quickly to persist this update. Retry from the latest room state.',
    409,
    'collaboration_session_changed',
  );
};

const applyAuthoredStateToSourceDocument = (
  source: ProjectDocumentV1,
  authored: CollaborationAuthoredDocument,
): ProjectDocumentV1 => {
  if (source.cardSets.length !== 1 || source.cardSets[0]?.id !== authored.set.id) {
    throw new CollaborationSessionError(
      'The Drive document identity changed while collaboration was active.',
      409,
      'collaboration_external_change',
    );
  }
  return {
    ...source,
    userTemplates: structuredClone(authored.templates),
    cardSets: [structuredClone(authored.set)],
    activeCardSetId: authored.set.id,
    storedCards: structuredClone(authored.cards),
  };
};

const readAuthoredRoomState = (row: CollaborationSessionRow): CollaborationAuthoredDocument => {
  const document = new Y.Doc();
  try {
    applyCollaborationUpdate(document, decodeRoomState(row.crdt_state), 'server-checkpoint-state');
    return readCollaborationAuthoredDocument(document);
  } finally {
    document.destroy();
  }
};

export const checkpointGoogleDriveCollaborationSession = async ({
  ownerUserId,
  fileId,
}: {
  ownerUserId: string;
  fileId: string;
}) => {
  if (!isGoogleDriveFileId(fileId)) {
    throw new CollaborationSessionError('Google Drive file id is invalid.', 400, 'collaboration_invalid_file');
  }
  const row = await readActiveSession(fileId);
  if (!row) throw new CollaborationSessionError('The collaboration session is no longer active.', 409, 'collaboration_session_changed');
  const role = await getMembershipRole({ sessionId: row.id, ownerUserId });
  if (role !== 'editor') {
    throw new CollaborationSessionError('Your current Drive role is view-only for this collaboration session.', 403, 'collaboration_not_permitted');
  }

  const source = await getGoogleDriveProject({ ownerUserId, fileId });
  const current = getCheckpoint(source.summary);
  const roomAuthored = readAuthoredRoomState(row);
  const sourceAuthored = createCollaborationAuthoredDocument(source.document);

  const decision = decideCollaborationCheckpoint({
    recorded: {
      providerRevision: row.checkpoint_provider_revision,
      projectRevision: row.checkpoint_project_revision,
    },
    current,
    source: sourceAuthored,
    room: roomAuthored,
  });

  if (decision === 'adopt-provider-receipt') {
    const { error } = await requireStore()
      .from('cardforge_collaboration_sessions')
      .update({
        checkpoint_provider_revision: current.providerRevision,
        checkpoint_project_revision: current.projectRevision,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'active');
    if (error) {
      console.error('Unable to recover collaboration checkpoint lineage:', error);
      throw new CollaborationSessionError(
        'Drive contains the collaborative state, but CardForge could not record its revision. Do not repeat the checkpoint until the room is reloaded.',
        503,
        'collaboration_unavailable',
      );
    }
    return { source: source.summary, roomVersion: row.crdt_version, changed: false };
  }

  if (decision === 'external-conflict') {
    await markConflict(row);
    throw new CollaborationSessionError(
      'Google Drive changed outside this collaboration session. The room was stopped before overwriting that revision.',
      409,
      'collaboration_external_change',
    );
  }

  if (decision === 'already-current') {
    return { source: source.summary, roomVersion: row.crdt_version, changed: false };
  }

  const document = applyAuthoredStateToSourceDocument(source.document, roomAuthored);
  const snapshot = await buildCardForgeProjectSnapshot({
    document,
    name: source.summary.name,
  });
  const blob = await createCardForgeProjectPackageBlob(snapshot);
  const updated = await updateGoogleDriveProjectFromServer({
    ownerUserId,
    fileId,
    name: source.summary.name,
    blob,
    projectRevision: snapshot.manifest.projectRevision,
    expectedProviderRevision: row.checkpoint_provider_revision,
    expectedProjectRevision: row.checkpoint_project_revision,
  });
  const nextProjectRevision = updated.projectRevision ?? snapshot.manifest.projectRevision;
  const now = new Date().toISOString();
  const { data, error } = await requireStore()
    .from('cardforge_collaboration_sessions')
    .update({
      checkpoint_provider_revision: updated.providerRevision,
      checkpoint_project_revision: nextProjectRevision,
      last_activity_at: now,
      updated_at: now,
    })
    .eq('id', row.id)
    .eq('status', 'active')
    .eq('checkpoint_provider_revision', row.checkpoint_provider_revision)
    .eq('checkpoint_project_revision', row.checkpoint_project_revision)
    .select(SESSION_COLUMNS)
    .maybeSingle();
  if (error || !data) {
    console.error('Drive checkpoint committed but collaboration lineage did not advance:', error);
    throw new CollaborationSessionError(
      'Drive saved the collaborative revision, but CardForge could not finish recording the checkpoint. Do not repeat the save until the room is reloaded.',
      503,
      'collaboration_unavailable',
    );
  }
  return {
    source: {
      ...updated,
      projectRevision: nextProjectRevision,
    },
    roomVersion: row.crdt_version,
    changed: true,
  };
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
