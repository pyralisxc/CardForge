"use client";

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import * as Y from 'yjs';

import type { GoogleDriveProjectSummary } from '@/features/project/client/provider-google-drive';
import type { ProjectDocumentIdentityMap } from '@/features/project/client/workspace';

import type { CollaborationRoomState, CollaborationSessionSummary } from '../model';
import { mapCollaborationAuthoredDocumentIdentity } from './driveIdentity';
import {
  createCollaborationWorkspaceBridge,
  type CollaborationWorkspaceBridge,
} from './workspaceBridge';
import { applyCollaborationUpdate } from '../yjsAuthoredDocument';

const BROADCAST_EVENT = 'yjs-update';
const CHECKPOINT_EVENT = 'drive-checkpoint';

const encodeUpdate = (update: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < update.length; index += 1) binary += String.fromCharCode(update[index]!);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
};

const decodeUpdate = (value: string): Uint8Array => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padding = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
  const binary = atob(normalized + padding);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const readJson = async <T>(response: Response, fallback: string): Promise<T> => {
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message || fallback);
  }
  return await response.json() as T;
};

export interface CollaborationRealtimeParticipant {
  userId: string;
  label?: string | null;
}

export interface DriveCollaborationClientSession {
  session: CollaborationSessionSummary;
  document: Y.Doc;
  bridge: CollaborationWorkspaceBridge;
  channel: RealtimeChannel;
  getPresence: () => Record<string, unknown[]>;
  isCheckpointLeader: () => boolean;
  checkpointNow: () => Promise<void>;
  destroy: () => Promise<void>;
}

export const startDriveCollaborationClientSession = async ({
  fileId,
  localSetId,
  identities,
  participant,
  getClerkToken,
  onError,
  onCheckpoint,
  onPresenceChange,
}: {
  fileId: string;
  localSetId: string;
  identities: ProjectDocumentIdentityMap;
  participant: CollaborationRealtimeParticipant;
  getClerkToken: () => Promise<string | null>;
  onError?: (error: Error) => void;
  onCheckpoint?: (source: GoogleDriveProjectSummary) => void | Promise<void>;
  onPresenceChange?: (presence: Record<string, unknown[]>) => void;
}): Promise<DriveCollaborationClientSession> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
  if (!supabaseUrl || !publishableKey) {
    throw new Error('Live collaboration needs the browser Supabase URL and publishable key.');
  }

  const session = await readJson<{ session: CollaborationSessionSummary }>(
    await fetch(`/api/collaboration/google-drive/${encodeURIComponent(fileId)}`, {
      method: 'POST',
      cache: 'no-store',
    }),
    'Unable to join live collaboration.',
  ).then((payload) => payload.session);

  const room = await readJson<CollaborationRoomState>(
    await fetch(`/api/collaboration/google-drive/${encodeURIComponent(fileId)}/state`, {
      cache: 'no-store',
    }),
    'Unable to load live collaboration state.',
  );

  const document = new Y.Doc();
  applyCollaborationUpdate(document, decodeUpdate(room.state), 'server-room-bootstrap');

  const supabase: SupabaseClient = createClient(supabaseUrl, publishableKey, {
    accessToken: getClerkToken,
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const channel = supabase.channel(session.topic, {
    config: {
      private: true,
      broadcast: { self: false, ack: true },
      presence: { key: participant.userId },
    },
  });

  let bridge: CollaborationWorkspaceBridge | null = null;
  let writeChain = Promise.resolve();
  let checkpointLeader = false;
  let checkpointTimer: number | null = null;

  const updateCheckpointLeader = () => {
    const presence = channel.presenceState() as Record<string, Array<{ role?: unknown }>>;
    const editors = Object.entries(presence)
      .filter(([, entries]) => entries.some((entry) => entry.role === 'editor'))
      .map(([key]) => key)
      .sort();
    checkpointLeader = session.role === 'editor' && editors[0] === participant.userId;
    onPresenceChange?.(presence);
  };

  const checkpointNow = async () => {
    if (session.role !== 'editor') return;
    await writeChain;
    const result = await readJson<{
      source: GoogleDriveProjectSummary;
      roomVersion: number;
      changed: boolean;
    }>(
      await fetch(`/api/collaboration/google-drive/${encodeURIComponent(fileId)}/checkpoint`, {
        method: 'POST',
        cache: 'no-store',
      }),
      'Unable to checkpoint collaborative work to Drive.',
    );
    await onCheckpoint?.(result.source);
    void channel.send({
      type: 'broadcast',
      event: CHECKPOINT_EVENT,
      payload: { source: result.source },
    }).catch((error) => {
      onError?.(error instanceof Error ? error : new Error('Drive saved, but the checkpoint receipt could not be broadcast to peers.'));
    });
  };

  const scheduleCheckpoint = () => {
    if (!checkpointLeader) return;
    if (checkpointTimer) window.clearTimeout(checkpointTimer);
    checkpointTimer = window.setTimeout(() => {
      checkpointTimer = null;
      void checkpointNow().catch((error) => {
        onError?.(error instanceof Error ? error : new Error('Unable to checkpoint collaborative work to Drive.'));
      });
    }, 4_000);
  };

  channel.on('presence', { event: 'sync' }, updateCheckpointLeader);

  channel.on('broadcast', { event: CHECKPOINT_EVENT }, ({ payload }) => {
    const source = payload && typeof payload === 'object' && payload.source && typeof payload.source === 'object'
      ? payload.source as Partial<GoogleDriveProjectSummary>
      : null;
    if (!source
      || source.fileId !== fileId
      || typeof source.name !== 'string'
      || typeof source.providerRevision !== 'string'
      || typeof source.projectRevision !== 'string'
      || typeof source.modifiedAt !== 'string') return;
    void Promise.resolve(onCheckpoint?.(source as GoogleDriveProjectSummary)).catch((error) => {
      onError?.(error instanceof Error ? error : new Error('Unable to record a peer Drive checkpoint receipt.'));
    });
  });

  channel.on('broadcast', { event: BROADCAST_EVENT }, ({ payload }) => {
    const update = payload && typeof payload === 'object' && typeof payload.update === 'string'
      ? payload.update
      : null;
    if (!update) return;
    try {
      bridge?.applyRemoteUpdate(decodeUpdate(update));
      scheduleCheckpoint();
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Unable to apply a live collaboration update.'));
    }
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Live collaboration channel connection timed out.'));
    }, 10_000);
    channel.subscribe(async (status) => {
      if (settled) return;
      if (status === 'SUBSCRIBED') {
        settled = true;
        window.clearTimeout(timeout);
        try {
          await channel.track({
            userId: participant.userId,
            label: participant.label ?? null,
            role: session.role,
            joinedAt: new Date().toISOString(),
          });
          updateCheckpointLeader();
          resolve();
        } catch (error) {
          reject(error);
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        settled = true;
        window.clearTimeout(timeout);
        reject(new Error('Live collaboration channel could not be authorized.'));
      }
    });
  });

  const persistUpdate = (encoded: string) => {
    writeChain = writeChain
      .then(async () => {
        const state = await readJson<CollaborationRoomState>(
          await fetch(`/api/collaboration/google-drive/${encodeURIComponent(fileId)}/state`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ update: encoded }),
          }),
          'Unable to persist the live collaboration update.',
        );
        void state.version;
      })
      .catch((error) => {
        onError?.(error instanceof Error ? error : new Error('Unable to persist the live collaboration update.'));
      });
  };

  bridge = createCollaborationWorkspaceBridge({
    document,
    setId: localSetId,
    onLocalUpdate: (update) => {
      if (session.role !== 'editor') return;
      const encoded = encodeUpdate(update);
      // Peers get the CRDT update immediately; durable room continuity is
      // serialized separately so network latency never turns typing into a
      // request/response loop.
      void channel.send({
        type: 'broadcast',
        event: BROADCAST_EVENT,
        payload: { update: encoded },
      }).catch((error) => {
        onError?.(error instanceof Error ? error : new Error('Unable to broadcast the live collaboration update.'));
      });
      persistUpdate(encoded);
      scheduleCheckpoint();
    },
    toSharedIdentity: (authored) => mapCollaborationAuthoredDocumentIdentity(authored, identities, 'save'),
    fromSharedIdentity: (authored) => mapCollaborationAuthoredDocumentIdentity(authored, identities, 'open'),
    readOnly: session.role !== 'editor',
  });

  // Reconcile the room bootstrap with any intentional unsaved local work that
  // existed before collaboration was joined.
  bridge.syncFromWorkspace();

  return {
    session,
    document,
    bridge,
    channel,
    getPresence: () => channel.presenceState(),
    isCheckpointLeader: () => checkpointLeader,
    checkpointNow,
    destroy: async () => {
      bridge?.destroy();
      if (checkpointTimer) {
        window.clearTimeout(checkpointTimer);
        checkpointTimer = null;
      }
      await writeChain.catch(() => undefined);
      if (checkpointLeader) {
        await checkpointNow().catch((error) => {
          onError?.(error instanceof Error ? error : new Error('Unable to checkpoint collaborative work to Drive.'));
        });
      }
      await fetch(`/api/collaboration/google-drive/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
        cache: 'no-store',
      }).catch(() => undefined);
      await supabase.removeChannel(channel);
      document.destroy();
    },
  };
};
