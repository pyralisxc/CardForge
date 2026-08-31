import type { CardSet, CardSetOrganization, StoredDisplayCard } from '@/domain/cards';
import type { ExportMode, DisplayCard, PaperSize, PdfDuplexLayout } from '@/domain/rendering';
import type { AppearanceStylePreset, TCGCardTemplate, TemplateSource } from '@/domain/templates';
import type { StudioView } from './workspaceDefaults';

export interface TemplateSlice {
  defaultTemplates: TCGCardTemplate[];
  userTemplates: TCGCardTemplate[];
  addOrUpdateTemplate: (template: TCGCardTemplate, source?: TemplateSource) => string;
  setDefaultTemplatesFromFiles: (templates: Partial<TCGCardTemplate>[], preferredTemplateId?: string | null) => number;
  setUserTemplatesFromFiles: (templates: Partial<TCGCardTemplate>[]) => number;
  mergeUserTemplatesFromFiles: (templates: Partial<TCGCardTemplate>[]) => number;
  deleteTemplate: (templateId: string, source?: TemplateSource) => void;
  cloneTemplate: (templateId: string) => string | null;
}

export interface AppearanceSlice {
  appearanceStyles: AppearanceStylePreset[];
  setAppearanceStylesFromFiles: (styles: AppearanceStylePreset[]) => void;
  replaceAppearanceStylesFromFiles: (styles: AppearanceStylePreset[]) => void;
  addOrUpdateAppearanceStyle: (style: AppearanceStylePreset) => string;
  deleteAppearanceStyle: (styleId: string) => void;
}

export interface OutputSlice {
  storedCards: StoredDisplayCard[];
  editingCardUniqueId: string | null;
  isEditDialogOpen: boolean;
  addGeneratedCards: (newCards: DisplayCard[]) => void;
  clearGeneratedCards: () => void;
  removeGeneratedCard: (cardUniqueId: string) => void;
  removeGeneratedCards: (cardUniqueIds: string[]) => number;
  moveGeneratedCardToSet: (cardUniqueId: string, setId: string) => boolean;
  moveGeneratedCardsToSet: (cardUniqueIds: string[], setId: string) => number;
  reorderGeneratedCard: (cardUniqueId: string, direction: 'earlier' | 'later') => boolean;
  updateGeneratedCard: (updatedCard: DisplayCard) => void;
  retargetGeneratedCardsTemplate: (fromTemplateId: string, toTemplateId: string) => void;
  retargetGeneratedCardsBackingTemplate: (fromTemplateId: string, toTemplateId: string) => void;
  setStoredCardsFromFile: (loadedCards: StoredDisplayCard[]) => { successCount: number; skippedCount: number };
  mergeStoredCardsFromFile: (loadedCards: StoredDisplayCard[]) => { successCount: number; skippedCount: number };
  openEditDialog: (cardUniqueId: string) => void;
  closeEditDialog: () => void;
}

export interface SettingsSlice {
  selectedPaperSize: PaperSize;
  studioView: StudioView;
  richTextHighlightColor: string;
  cardSets: CardSet[];
  activeCardSet: CardSet;
  singleCardGeneratorSelectedTemplateId: string | null;
  singleCardGeneratorSelectedBackingTemplateId: string | null;
  templateEditorSelectedTemplateId: string | null;
  pdfMarginMm: number;
  pdfCardSpacingMm: number;
  pdfIncludeCutLines: boolean;
  pdfDuplexLayout: PdfDuplexLayout;
  exportMode: ExportMode;
  exportDpi: number;
  setSelectedPaperSize: (size: PaperSize) => void;
  setStudioView: (view: StudioView) => void;
  setRichTextHighlightColor: (color: string) => void;
  createCardSet: (name?: string) => string;
  setActiveCardSetId: (id: string) => void;
  renameCardSet: (id: string, name: string) => boolean;
  duplicateCardSet: (id: string) => string | null;
  deleteCardSet: (id: string) => boolean;
  setCardSetsFromFiles: (sets: CardSet[], activeSetId?: string | null) => number;
  mergeCardSetsFromFiles: (sets: CardSet[], activeSetId?: string | null) => number;
  setActiveCardSetName: (name: string) => void;
  setActiveCardSetFrontTemplateId: (id: string | null) => void;
  setActiveCardSetBackingTemplateId: (id: string | null) => void;
  setSingleCardGeneratorSelectedTemplateId: (id: string | null) => void;
  setSingleCardGeneratorSelectedBackingTemplateId: (id: string | null) => void;
  setTemplateEditorSelectedTemplateId: (id: string | null) => void;
  setPdfOptions: (options: { margin?: number; spacing?: number; cutLines?: boolean; duplexLayout?: PdfDuplexLayout }) => void;
  setExportMode: (mode: ExportMode) => void;
  setExportDpi: (dpi: number) => void;
}

export interface OrganizationSlice {
  updateCardSetOrganization: (setId: string, patch: Partial<Omit<CardSetOrganization, 'tags' | 'positions'>>) => boolean;
  addCardSetTag: (setId: string, label: string) => string | null;
  renameCardSetTag: (setId: string, tagId: string, label: string) => boolean;
  removeCardSetTag: (setId: string, tagId: string) => boolean;
  setCardsTag: (cardIds: string[], tagId: string, applied: boolean) => number;
  setCardPositions: (setId: string, positions: CardSetOrganization['positions']) => boolean;
}

export interface WorkspaceLifecycleSlice {
  _rehydrateCallback: () => void;
}

export type ProjectState = TemplateSlice
  & AppearanceSlice
  & OutputSlice
  & SettingsSlice
  & OrganizationSlice
  & WorkspaceLifecycleSlice;
