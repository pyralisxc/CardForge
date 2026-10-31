export {
  prepareTemplateForLibrarySave,
  useTemplateLibraryActions,
  type PendingTemplateSaveImpact,
} from './hooks/useTemplateLibraryActions';
export const loadCardTemplateMaker = () => import('./components/CardTemplateMaker');

export type { TemplateSaveReceipt } from './lib/templateSaveReceipt';
export { createSharedLineageDraft } from './hooks/useTemplateLibraryActions';
export { AppearanceStudioPanel } from './components/AppearanceStudioPanel';
