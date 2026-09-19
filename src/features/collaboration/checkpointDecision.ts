import type { CollaborationCheckpoint } from './model';
import type { CollaborationAuthoredDocument } from './yjsAuthoredDocument';

export type CollaborationCheckpointDecision =
  | 'already-current'
  | 'adopt-provider-receipt'
  | 'write-room-state'
  | 'external-conflict';

const sameAuthoredState = (
  left: CollaborationAuthoredDocument,
  right: CollaborationAuthoredDocument,
) => JSON.stringify(left) === JSON.stringify(right);

const sameCheckpoint = (
  left: CollaborationCheckpoint,
  right: CollaborationCheckpoint,
) => (
  left.providerRevision === right.providerRevision
  && left.projectRevision === right.projectRevision
);

export const decideCollaborationCheckpoint = ({
  recorded,
  current,
  source,
  room,
}: {
  recorded: CollaborationCheckpoint;
  current: CollaborationCheckpoint;
  source: CollaborationAuthoredDocument;
  room: CollaborationAuthoredDocument;
}): CollaborationCheckpointDecision => {
  const authoredCurrent = sameAuthoredState(source, room);
  if (sameCheckpoint(recorded, current)) {
    return authoredCurrent ? 'already-current' : 'write-room-state';
  }
  return authoredCurrent ? 'adopt-provider-receipt' : 'external-conflict';
};
