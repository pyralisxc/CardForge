export type DeskArrivalPhase = 'acquiring' | 'composing' | 'ready';

interface DeskArrivalSource {
  phase: string;
}

export const isDeskSourceSnapshotReady = (loading: boolean, sources: readonly DeskArrivalSource[]): boolean => (
  !loading && sources.every((source) => source.phase !== 'loading')
);

export const resolveDeskMissingFocus = ({
  requestedWorkId,
  workAvailable,
  sourceSnapshotReady,
  sources,
  sourceFailed,
}: {
  requestedWorkId: string | null;
  workAvailable: boolean;
  sourceSnapshotReady: boolean;
  sources: readonly DeskArrivalSource[];
  sourceFailed: boolean;
}): 'missing' | 'unavailable' | null => {
  if (!requestedWorkId || workAvailable || !sourceSnapshotReady) return null;
  return sourceFailed || sources.some((source) => source.phase !== 'ready' && source.phase !== 'empty')
    ? 'unavailable'
    : 'missing';
};

export const deriveDeskArrivalPhase = ({
  presented,
  acquisitionReady,
  compositionReady,
}: {
  presented: boolean;
  acquisitionReady: boolean;
  compositionReady: boolean;
}): DeskArrivalPhase => {
  if (presented || (acquisitionReady && compositionReady)) return 'ready';
  return acquisitionReady ? 'composing' : 'acquiring';
};
