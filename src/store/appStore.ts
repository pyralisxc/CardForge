
import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { TCGCardTemplate, TemplateSource, PaperSize, DisplayCard, CardData, StoredDisplayCard, AppearanceStylePreset, PdfDuplexLayout } from '@/types';
import { PAPER_SIZES, TABS_CONFIG, TCG_ASPECT_RATIO } from '@/lib/constants';
import type { ExportMode } from '@/lib/printValidation';
import { createDefaultFreeformCanvas, reconstructFreeformCanvas, reconstructMinimalTemplateObject } from '@/lib/templateModel';
import { selectAllTemplates, selectEditingCard, selectGeneratedDisplayCards } from '@/store/selectors';


const dedupeAppearanceStyles = (styles: AppearanceStylePreset[]): AppearanceStylePreset[] => {
  const byId = new Map<string, AppearanceStylePreset>();
  styles.forEach(style => {
    if (style?.id) byId.set(style.id, style);
  });
  return Array.from(byId.values());
};

const normalizeActiveTab = (tab: string): string => {
  if (tab === 'template-maker-2') return 'template-maker';
  return TABS_CONFIG.some(config => config.value === tab) ? tab : TABS_CONFIG[0].value;
};

const isDraftTemplateSelection = (templateId: string | null): boolean => (
  typeof templateId === 'string' && templateId.startsWith('draft-')
);

interface AppState {
  defaultTemplates: TCGCardTemplate[];
  userTemplates: TCGCardTemplate[];
  appearanceStyles: AppearanceStylePreset[];
  storedCards: StoredDisplayCard[];

  selectedPaperSize: PaperSize;
  activeTab: string;
  richTextHighlightColor: string;
  singleCardGeneratorSelectedTemplateId: string | null;

  pdfMarginMm: number;
  pdfCardSpacingMm: number;
  pdfIncludeCutLines: boolean;
  pdfDuplexLayout: PdfDuplexLayout;
  exportMode: ExportMode;
  exportDpi: number;

  editingCardUniqueId: string | null;
  isEditDialogOpen: boolean;
  
  // Actions
  addOrUpdateTemplate: (template: TCGCardTemplate, source?: TemplateSource) => string; 
  setDefaultTemplatesFromFiles: (templates: Partial<TCGCardTemplate>[]) => number;
  setUserTemplatesFromFiles: (templates: Partial<TCGCardTemplate>[]) => number;
  mergeUserTemplatesFromFiles: (templates: Partial<TCGCardTemplate>[]) => number;
  deleteTemplate: (templateId: string, source?: TemplateSource) => void;
  cloneTemplate: (templateId: string) => string | null;
  setAppearanceStylesFromFiles: (styles: AppearanceStylePreset[]) => void;
  replaceAppearanceStylesFromFiles: (styles: AppearanceStylePreset[]) => void;
  addOrUpdateAppearanceStyle: (style: AppearanceStylePreset) => string;
  deleteAppearanceStyle: (styleId: string) => void;
  
  addGeneratedCards: (newCards: DisplayCard[]) => void;
  clearGeneratedCards: () => void;
  updateGeneratedCard: (updatedCard: DisplayCard) => void;
  retargetGeneratedCardsTemplate: (fromTemplateId: string, toTemplateId: string) => void;
  setStoredCardsFromFile: (loadedCards: StoredDisplayCard[]) => { successCount: number, skippedCount: number };
  mergeStoredCardsFromFile: (loadedCards: StoredDisplayCard[]) => { successCount: number, skippedCount: number };

  setSelectedPaperSize: (size: PaperSize) => void;
  setActiveTab: (tab: string) => void;
  setRichTextHighlightColor: (color: string) => void;
  setSingleCardGeneratorSelectedTemplateId: (id: string | null) => void;
  setPdfOptions: (options: { margin?: number; spacing?: number; cutLines?: boolean; duplexLayout?: PdfDuplexLayout }) => void;
  setExportMode: (mode: ExportMode) => void;
  setExportDpi: (dpi: number) => void;

  openEditDialog: (cardUniqueId: string) => void;
  closeEditDialog: () => void;

  _rehydrateCallback: () => void; 
}

export const useAppStore = create<AppState>()(
  devtools( 
    persist(
      (set, get) => ({
        defaultTemplates: [],
        userTemplates: [],
        appearanceStyles: [],
        storedCards: [],

        selectedPaperSize: PAPER_SIZES[0],
        activeTab: TABS_CONFIG[0].value,
        richTextHighlightColor: '#ffd700',
        singleCardGeneratorSelectedTemplateId: null,

        pdfMarginMm: 5,
        pdfCardSpacingMm: 0,
        pdfIncludeCutLines: false,
        pdfDuplexLayout: 'separate-pages',
        exportMode: 'physical',
        exportDpi: 300,

        editingCardUniqueId: null,
        isEditDialogOpen: false,

        addOrUpdateTemplate: (template, source) => {
          let templateToSave = { ...template };
          if (!templateToSave.id || templateToSave.id.trim() === "" || templateToSave.id === null) { 
            templateToSave.id = nanoid();
          }
          templateToSave.templateSource = source || templateToSave.templateSource || 'user';
          const reconstructed = reconstructMinimalTemplateObject(templateToSave);
          
          let finalId = reconstructed.id!; 

          set((state) => {
            const targetKey = reconstructed.templateSource === 'default' ? 'defaultTemplates' : 'userTemplates';
            const newTemplates = [...state[targetKey]];
            const existingIndex = newTemplates.findIndex(t => t.id === finalId);
            if (existingIndex > -1) {
              newTemplates[existingIndex] = reconstructed;
            } else {
              newTemplates.push(reconstructed);
            }
            const canonicalTemplates = newTemplates.map(t => reconstructMinimalTemplateObject(t));
            if (JSON.stringify(state[targetKey]) === JSON.stringify(canonicalTemplates)) {
                return state; 
            }
            return { [targetKey]: canonicalTemplates } as Partial<AppState>;
          });
          return finalId;
        },
        setDefaultTemplatesFromFiles: (templates) => {
          const reconstructedTemplates = templates
            .map(template => reconstructMinimalTemplateObject({ ...template, templateSource: 'default' }))
            .filter(template => template.id && template.id.trim() !== '');

          if (reconstructedTemplates.length === 0) return 0;

          set((state) => {
            const allTemplates = [...reconstructedTemplates, ...state.userTemplates];

            const selectedStillExists = state.singleCardGeneratorSelectedTemplateId
              ? isDraftTemplateSelection(state.singleCardGeneratorSelectedTemplateId)
                || allTemplates.some(template => template.id === state.singleCardGeneratorSelectedTemplateId)
              : false;

            return {
              defaultTemplates: reconstructedTemplates,
              singleCardGeneratorSelectedTemplateId: selectedStillExists
                ? state.singleCardGeneratorSelectedTemplateId
                : (allTemplates[0]?.id ?? null),
            };
          });

          return reconstructedTemplates.length;
        },
        setUserTemplatesFromFiles: (templates) => {
          const reconstructedTemplates = templates
            .map(template => reconstructMinimalTemplateObject({ ...template, templateSource: 'user' }))
            .filter(template => template.id && template.id.trim() !== '');

          set((state) => {
            const allTemplates = [...state.defaultTemplates, ...reconstructedTemplates];
            const selectedStillExists = state.singleCardGeneratorSelectedTemplateId
              ? isDraftTemplateSelection(state.singleCardGeneratorSelectedTemplateId)
                || allTemplates.some(template => template.id === state.singleCardGeneratorSelectedTemplateId)
              : false;

            return {
              userTemplates: reconstructedTemplates,
              singleCardGeneratorSelectedTemplateId: selectedStillExists
                ? state.singleCardGeneratorSelectedTemplateId
                : (allTemplates[0]?.id ?? null),
            };
          });

          return reconstructedTemplates.length;
        },
        mergeUserTemplatesFromFiles: (templates) => {
          const reconstructedTemplates = templates
            .map(template => reconstructMinimalTemplateObject({ ...template, templateSource: 'user' }))
            .filter(template => template.id && template.id.trim() !== '');

          if (reconstructedTemplates.length === 0) return 0;

          set((state) => {
            const byId = new Map<string, TCGCardTemplate>();
            state.userTemplates.forEach(template => {
              if (template.id) byId.set(template.id, template);
            });
            reconstructedTemplates.forEach(template => {
              if (template.id) byId.set(template.id, template);
            });

            const nextUserTemplates = Array.from(byId.values());
            const allTemplates = [...state.defaultTemplates, ...nextUserTemplates];
            const selectedStillExists = state.singleCardGeneratorSelectedTemplateId
              ? isDraftTemplateSelection(state.singleCardGeneratorSelectedTemplateId)
                || allTemplates.some(template => template.id === state.singleCardGeneratorSelectedTemplateId)
              : false;

            return {
              userTemplates: nextUserTemplates,
              singleCardGeneratorSelectedTemplateId: selectedStillExists
                ? state.singleCardGeneratorSelectedTemplateId
                : (allTemplates[0]?.id ?? null),
            };
          });

          return reconstructedTemplates.length;
        },
        cloneTemplate: (templateId) => {
          const state = get();
          const source = selectAllTemplates(state).find(t => t.id === templateId);
          if (!source) return null;
          const cloned = reconstructMinimalTemplateObject({
            ...JSON.parse(JSON.stringify(source)),
            id: nanoid(),
            name: `Copy of ${source.name}`,
            templateSource: 'user',
          });
          set((s) => ({ userTemplates: [...s.userTemplates, cloned] }));
          return cloned.id!;
        },
        deleteTemplate: (templateId, source) => set((state) => {
          const targetSource = source || selectAllTemplates(state).find(template => template.id === templateId)?.templateSource || 'user';
          const defaultTemplates = targetSource === 'default'
            ? state.defaultTemplates.filter(t => t.id !== templateId)
            : state.defaultTemplates;
          const userTemplates = targetSource === 'user'
            ? state.userTemplates.filter(t => t.id !== templateId)
            : state.userTemplates;
          const allTemplates = [...defaultTemplates, ...userTemplates];
          const newStoredCards = state.storedCards.filter(card => card.templateId !== templateId);
          const newSingleSelectedId = state.singleCardGeneratorSelectedTemplateId === templateId ? 
            (allTemplates.length > 0 ? (allTemplates.find(t => t.id && t.id.trim() !== "")?.id || null) : null) 
            : state.singleCardGeneratorSelectedTemplateId;
          const newEditingCardUniqueId = state.editingCardUniqueId && state.storedCards.find(card => card.uniqueId === state.editingCardUniqueId)?.templateId === templateId
            ? null
            : state.editingCardUniqueId;

          if (
            JSON.stringify(state.defaultTemplates) === JSON.stringify(defaultTemplates) &&
            JSON.stringify(state.userTemplates) === JSON.stringify(userTemplates) &&
            JSON.stringify(state.storedCards) === JSON.stringify(newStoredCards) &&
            state.singleCardGeneratorSelectedTemplateId === newSingleSelectedId &&
            state.editingCardUniqueId === newEditingCardUniqueId
          ) {
            return state;
          }
          return {
            defaultTemplates,
            userTemplates,
            storedCards: newStoredCards,
            singleCardGeneratorSelectedTemplateId: newSingleSelectedId,
            editingCardUniqueId: newEditingCardUniqueId,
            isEditDialogOpen: newEditingCardUniqueId ? state.isEditDialogOpen : false,
          };
        }),
        setAppearanceStylesFromFiles: (styles) => set((state) => {
          const merged = dedupeAppearanceStyles([...state.appearanceStyles]);
          styles.forEach(style => {
            const index = merged.findIndex(existing => existing.id === style.id);
            if (index > -1) merged[index] = style;
            else merged.push(style);
          });
          return { appearanceStyles: dedupeAppearanceStyles(merged) };
        }),
        replaceAppearanceStylesFromFiles: (styles) => set({
          appearanceStyles: dedupeAppearanceStyles(styles),
        }),
        addOrUpdateAppearanceStyle: (style) => {
          set((state) => {
            const styles = dedupeAppearanceStyles(state.appearanceStyles);
            const index = styles.findIndex(existing => existing.id === style.id);
            if (index > -1) styles[index] = style;
            else styles.push(style);
            return { appearanceStyles: dedupeAppearanceStyles(styles) };
          });
          return style.id;
        },
        deleteAppearanceStyle: (styleId) => set((state) => ({
          appearanceStyles: state.appearanceStyles.filter(style => style.id !== styleId),
        })),
        
        addGeneratedCards: (newCards) => {
          const newStoredCards = newCards.map(card => ({
            uniqueId: card.uniqueId,
            templateId: card.template.id!,
            data: card.data,
          }));
          set((state) => ({
            storedCards: [...state.storedCards, ...newStoredCards],
          }));
        },
        clearGeneratedCards: () => set({ storedCards: [] }),
        updateGeneratedCard: (updatedCard) => set((state) => ({
          storedCards: state.storedCards.map(sc =>
            sc.uniqueId === updatedCard.uniqueId
              ? { uniqueId: updatedCard.uniqueId, templateId: updatedCard.template.id!, data: updatedCard.data }
              : sc
          ),
        })),
        retargetGeneratedCardsTemplate: (fromTemplateId, toTemplateId) => set((state) => {
          if (!fromTemplateId || !toTemplateId || fromTemplateId === toTemplateId) return state;
          let changed = false;
          const nextStoredCards = state.storedCards.map((card) => (
            card.templateId === fromTemplateId
              ? (changed = true, { ...card, templateId: toTemplateId })
              : card
          ));
          if (!changed) return state;
          return {
            storedCards: nextStoredCards,
            editingCardUniqueId: state.editingCardUniqueId,
          };
        }),
        setStoredCardsFromFile: (loadedCards) => {
            let successCount = 0;
            let skippedCount = 0;
            const currentTemplates = selectAllTemplates(get());

            const runtimeCards: StoredDisplayCard[] = [];
            loadedCards.forEach(storedCardFromFile => {
                const templateFound = currentTemplates.find(t => t.id === storedCardFromFile.templateId);
                if(templateFound){
                    runtimeCards.push({
                        uniqueId: storedCardFromFile.uniqueId || nanoid(),
                        templateId: templateFound.id!, 
                        data: storedCardFromFile.data || {}
                    });
                    successCount++;
                } else {
                    skippedCount++;
                }
            });
            set({ storedCards: runtimeCards });
            return { successCount, skippedCount };
        },
        mergeStoredCardsFromFile: (loadedCards) => {
            let successCount = 0;
            let skippedCount = 0;
            const currentTemplates = selectAllTemplates(get());
            const mergedCards = new Map<string, StoredDisplayCard>();

            get().storedCards.forEach(card => {
              mergedCards.set(card.uniqueId || nanoid(), card);
            });

            loadedCards.forEach(storedCardFromFile => {
                const templateFound = currentTemplates.find(t => t.id === storedCardFromFile.templateId);
                if (templateFound) {
                    const uniqueId = storedCardFromFile.uniqueId || nanoid();
                    mergedCards.set(uniqueId, {
                        uniqueId,
                        templateId: templateFound.id!,
                        data: storedCardFromFile.data || {}
                    });
                    successCount++;
                } else {
                    skippedCount++;
                }
            });

            set({ storedCards: Array.from(mergedCards.values()) });
            return { successCount, skippedCount };
        },

        setSelectedPaperSize: (size) => set({ selectedPaperSize: size }),
        setActiveTab: (tab) => set({ activeTab: normalizeActiveTab(tab) }),
        setRichTextHighlightColor: (color) => set({ richTextHighlightColor: color }),
        setSingleCardGeneratorSelectedTemplateId: (id) => set({ singleCardGeneratorSelectedTemplateId: id }),
        setPdfOptions: (options) => set((state) => ({
          pdfMarginMm: options.margin !== undefined ? Math.max(0, options.margin) : state.pdfMarginMm,
          pdfCardSpacingMm: options.spacing !== undefined ? Math.max(0, options.spacing) : state.pdfCardSpacingMm,
          pdfIncludeCutLines: options.cutLines !== undefined ? options.cutLines : state.pdfIncludeCutLines,
          pdfDuplexLayout: options.duplexLayout !== undefined ? options.duplexLayout : state.pdfDuplexLayout,
        })),
        setExportMode: (mode) => set({ exportMode: mode }),
        setExportDpi: (dpi) => set({ exportDpi: Math.min(1200, Math.max(72, Math.round(dpi))) }),

        openEditDialog: (cardUniqueId) => set({ editingCardUniqueId: cardUniqueId, isEditDialogOpen: true }),
        closeEditDialog: () => set({ editingCardUniqueId: null, isEditDialogOpen: false }),

        _rehydrateCallback: () => {
          const state = get();
          // After rehydration from localStorage, if the previously selected template
          // no longer exists, fall back to the first available template.
          const currentId = state.singleCardGeneratorSelectedTemplateId;
          const allTemplates = selectAllTemplates(state);
          if ((!currentId || !allTemplates.find(t => t.id === currentId)) && allTemplates.length > 0) {
            const firstValid = allTemplates.find(t => t.id && t.id.trim() !== "");
            if (firstValid) {
              set({ singleCardGeneratorSelectedTemplateId: firstValid.id });
            }
          }
          const normalizedActiveTab = normalizeActiveTab(state.activeTab);
          if (normalizedActiveTab !== state.activeTab) {
            set({ activeTab: normalizedActiveTab });
          }
          // Always dedupe appearance styles on rehydration.
          const dedupedStyles = dedupeAppearanceStyles(state.appearanceStyles);
          if (dedupedStyles.length !== state.appearanceStyles.length) {
            set({ appearanceStyles: dedupedStyles });
          }
        },
      }),
      {
        name: 'card-forge-app-storage-v3',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          userTemplates: state.userTemplates,
          appearanceStyles: dedupeAppearanceStyles(state.appearanceStyles),
          storedCards: state.storedCards,
          selectedPaperSize: state.selectedPaperSize,
          activeTab: normalizeActiveTab(state.activeTab),
          richTextHighlightColor: state.richTextHighlightColor,
          singleCardGeneratorSelectedTemplateId: state.singleCardGeneratorSelectedTemplateId,
          pdfMarginMm: state.pdfMarginMm,
          pdfCardSpacingMm: state.pdfCardSpacingMm,
          pdfIncludeCutLines: state.pdfIncludeCutLines,
          pdfDuplexLayout: state.pdfDuplexLayout,
          exportMode: state.exportMode,
          exportDpi: state.exportDpi,
        }),
        onRehydrateStorage: () => {
          return (state, error) => {
            if (error) {
              console.error("Error rehydrating from Zustand storage:", error);
            }
            if (state) {
              setTimeout(() => state._rehydrateCallback(), 0);
            }
          };
        },
        version: 1,
      }
    )
  )
);

export {
  createDefaultFreeformCanvas,
  reconstructFreeformCanvas,
  reconstructMinimalTemplateObject,
} from '@/lib/templateModel';
export {
  selectAllTemplates,
  selectEditingCard,
  selectGeneratedDisplayCards,
} from '@/store/selectors';
export type { AppState };
