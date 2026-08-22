import type { CardSet } from '@/domain/cards';
import type { AppearanceStylePreset } from '@/domain/templates';

export const WORKSPACE_TABS = ['template-maker', 'generator', 'sets'] as const;

export const dedupeAppearanceStyles = (styles: AppearanceStylePreset[]): AppearanceStylePreset[] => {
  const byId = new Map<string, AppearanceStylePreset>();
  styles.forEach((style) => {
    if (style?.id) byId.set(style.id, style);
  });
  return Array.from(byId.values());
};

export const normalizeActiveTab = (tab: string): string => (
  WORKSPACE_TABS.includes(tab as typeof WORKSPACE_TABS[number]) ? tab : WORKSPACE_TABS[0]
);

export const isDraftTemplateSelection = (templateId: string | null): boolean => (
  typeof templateId === 'string' && templateId.startsWith('draft-')
);

export const createDefaultActiveCardSet = (): CardSet => ({
  id: 'active-card-set',
  name: 'Untitled Set',
  frontTemplateId: null,
  backingTemplateId: null,
});
