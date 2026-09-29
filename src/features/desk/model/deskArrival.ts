export type DeskArrivalPhase = 'acquiring' | 'composing' | 'ready';

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
