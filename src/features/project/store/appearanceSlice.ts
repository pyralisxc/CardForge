import type { StateCreator } from 'zustand';
import { authoredPlanValuesEqual } from '@/domain/cards';

import type { AppearanceSlice, ProjectState } from './types';
import { dedupeAppearanceStyles } from './workspaceDefaults';

export const createAppearanceSlice: StateCreator<ProjectState, [], [], AppearanceSlice> = (set) => ({
  appearanceStyles: [],
  setAppearanceStylesFromFiles: (styles) => set((state) => {
    const merged = dedupeAppearanceStyles(state.appearanceStyles);
    styles.forEach((style) => {
      const index = merged.findIndex((existing) => existing.id === style.id);
      if (index > -1) merged[index] = style;
      else merged.push(style);
    });
    const appearanceStyles = dedupeAppearanceStyles(merged);
    return authoredPlanValuesEqual(state.appearanceStyles, appearanceStyles) ? state : { appearanceStyles };
  }),
  replaceAppearanceStylesFromFiles: (styles) => set({
    appearanceStyles: dedupeAppearanceStyles(styles),
  }),
  addOrUpdateAppearanceStyle: (style) => {
    set((state) => {
      const styles = dedupeAppearanceStyles(state.appearanceStyles);
      const index = styles.findIndex((existing) => existing.id === style.id);
      if (index > -1) styles[index] = style;
      else styles.push(style);
      return { appearanceStyles: dedupeAppearanceStyles(styles) };
    });
    return style.id;
  },
  deleteAppearanceStyle: (styleId) => set((state) => ({
    appearanceStyles: state.appearanceStyles.filter((style) => style.id !== styleId),
  })),
});
