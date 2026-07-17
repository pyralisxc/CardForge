export const AUTO_ADVANCE_MS = 12_000;
export const INTERACTION_PAUSE_MS = 60_000;

interface ShowcaseAdvanceDelayInput {
  now: number;
  pauseUntil: number;
  reducedMotion: boolean;
}

export const getShowcaseAdvanceDelay = ({
  now,
  pauseUntil,
  reducedMotion,
}: ShowcaseAdvanceDelayInput): number | null => {
  if (reducedMotion) return null;
  if (pauseUntil > now) return pauseUntil - now;
  return AUTO_ADVANCE_MS;
};

export const getNextShowcaseStage = (currentIndex: number, stageCount: number): number => {
  if (stageCount <= 0) return 0;
  return (currentIndex + 1) % stageCount;
};
