"use client";

import type { GoogleDriveProjectBinding } from './googleDriveProjectTransfer';

/** Only this browser JS context. Other tabs, devices and MCP are independent. */
export type DriveSaveHoldReason = 'unknown-commit' | 'confirmed-receipt' | 'remote-dirty';
export interface DriveSaveHold {
  reason: DriveSaveHoldReason;
  attemptId: number;
  cause: Error;
  binding: GoogleDriveProjectBinding | null;
  workId: string;
  targetKey: string;
}

const tails = new Map<string, Promise<void>>();
const heldByWork = new Map<string, DriveSaveHold>();
const heldByTarget = new Map<string, DriveSaveHold>();
let nextAttempt = 0;
const workKey = (scope: string, workId: string) => `${scope}:work:${workId}`;
const fileKey = (scope: string, workId: string, binding: GoogleDriveProjectBinding | null) => (
  `${scope}:drive:${binding?.accountId ?? 'unverified'}:${binding?.fileId ?? `new:${workId}`}`
);

export const getDriveSaveHold = (scope: string, workId: string, binding: GoogleDriveProjectBinding | null): DriveSaveHold | null => (
  heldByWork.get(workKey(scope, workId)) ?? heldByTarget.get(fileKey(scope, workId, binding)) ?? null
);

export const holdDriveSaveForRecovery = (
  scope: string,
  workId: string,
  binding: GoogleDriveProjectBinding | null,
  cause: Error,
  reason: DriveSaveHoldReason,
): DriveSaveHold => {
  const existing = getDriveSaveHold(scope, workId, binding);
  if (existing) return existing;
  const hold: DriveSaveHold = {
    reason, attemptId: ++nextAttempt, cause,
    binding: binding ? structuredClone(binding) : null,
    workId, targetKey: fileKey(scope, workId, binding),
  };
  heldByWork.set(workKey(scope, workId), hold);
  heldByTarget.set(hold.targetKey, hold);
  return hold;
};

/** Explicit provider-reconciled refresh or verified local-only linkage repair. */
export const clearDriveSaveHold = (scope: string, workId: string, binding: GoogleDriveProjectBinding | null) => {
  const key = workKey(scope, workId);
  const held = heldByWork.get(key);
  heldByWork.delete(key);
  if (held) heldByTarget.delete(held.targetKey);
  heldByTarget.delete(fileKey(scope, workId, binding));
};

/** Own the entire binding-read, checkpoint, prepare, upload, receipt sequence. */
export async function withDriveSaveOwner<T>(
  scope: string,
  workId: string,
  binding: GoogleDriveProjectBinding | null,
  action: () => Promise<T>,
  independentCopy = false,
): Promise<T> {
  const target = fileKey(scope, workId, binding);
  const previous = tails.get(target) ?? Promise.resolve();
  const current = previous.then(async () => {
    const held = getDriveSaveHold(scope, workId, binding);
    if (held && !independentCopy) throw held.cause;
    try {
      const result = await action();
      if (independentCopy) heldByWork.delete(workKey(scope, workId));
      return result;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        if (error.code === 'source_commit_unknown') holdDriveSaveForRecovery(scope, workId, binding, error, 'unknown-commit');
        else if (error.code === 'source_committed_linkage_refresh_required') holdDriveSaveForRecovery(scope, workId, binding, error, 'confirmed-receipt');
      }
      throw error;
    }
  });
  // A rejection never stalls the next queued entry (which independently checks the hold).
  const tail = current.then(() => undefined, () => undefined);
  tails.set(target, tail);
  try { return await current; }
  finally { if (tails.get(target) === tail) tails.delete(target); }
}

/** Test-only isolation of process-local owner state. */
export const resetDriveSaveOwnerForTests = () => {
  tails.clear();
  heldByWork.clear();
  heldByTarget.clear();
  nextAttempt = 0;
};
