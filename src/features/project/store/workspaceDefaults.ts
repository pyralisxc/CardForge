import type { CardSet } from '@/domain/cards';
import type { AppearanceStylePreset } from '@/domain/templates';

export const STUDIO_VIEWS = ['template', 'generate'] as const;
export type StudioView = typeof STUDIO_VIEWS[number];

export const dedupeAppearanceStyles = (styles: AppearanceStylePreset[]): AppearanceStylePreset[] => {
  const byId = new Map<string, AppearanceStylePreset>();
  styles.forEach((style) => {
    if (style?.id) byId.set(style.id, style);
  });
  return Array.from(byId.values());
};

export const normalizeStudioView = (view: unknown): StudioView => {
  if (STUDIO_VIEWS.includes(view as StudioView)) return view as StudioView;
  if (view === 'template-maker' || view === 'templates') return 'template';
  if (view === 'generator' || view === 'desk' || view === 'sets') return 'generate';
  return 'generate';
};

export const isDraftTemplateSelection = (templateId: string | null): boolean => (
  typeof templateId === 'string' && templateId.startsWith('draft-')
);

export const createDefaultActiveCardSet = (): CardSet => ({
  id: 'active-card-set',
  name: 'Untitled Set',
  frontTemplateId: null,
  backingTemplateId: null,
});
