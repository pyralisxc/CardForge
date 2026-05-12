
import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { TCGCardTemplate, PaperSize, DisplayCard, CardData, StoredDisplayCard, FreeformCanvas, FreeformCardElement, AppearanceStylePreset } from '@/types';
import { PAPER_SIZES, TABS_CONFIG, TCG_ASPECT_RATIO } from '@/lib/constants';
import { DEFAULT_APPEARANCE_LIBRARY, normalizeAppearanceForElement, normalizeTemplateAppearance } from '@/lib/appearance';


export const getFreshDefaultTemplateObject = (id?: string | null, nameProp?: string): TCGCardTemplate => {
  let newTemplateId: string | null;
  let newTemplateName: string;
  const isValidExistingId = id && id.trim() !== "";

  if (id === null) {
    newTemplateId = null;
    newTemplateName = nameProp || `New Unsaved Template`;
  } else if (isValidExistingId) {
    newTemplateId = id;
    newTemplateName = nameProp || `Template ${String(id).substring(0, 8)}`;
  } else {
    newTemplateId = nanoid();
    newTemplateName = nameProp || `Template ${newTemplateId.substring(0, 8)}`;
  }

  if (nameProp && nameProp !== "New Unsaved Template" && (id === null || !isValidExistingId)) {
    newTemplateName = nameProp;
  }

  return {
    id: newTemplateId,
    name: newTemplateName,
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard',
    cardBorderWidth: '4px',
    cardBorderStyle: 'solid',
    cardBorderRadius: '0.5rem',
    cardBorderImageSource: undefined,
    freeformCanvas: createDefaultFreeformCanvas(),
  };
};

export const reconstructMinimalTemplateObject = (t_loaded_partial: Partial<TCGCardTemplate>): TCGCardTemplate => {
  const t_loaded = { ...t_loaded_partial };

  const validatedId = (t_loaded.id && t_loaded.id.trim() !== "") ? t_loaded.id : nanoid();

  const base: Partial<TCGCardTemplate> = {
    id: validatedId,
    name: t_loaded.name || `Template ${validatedId.substring(0, 8)}`,
    aspectRatio: t_loaded.aspectRatio || TCG_ASPECT_RATIO,
    frameStyle: t_loaded.frameStyle || 'standard',
    cardBorderWidth: t_loaded.cardBorderWidth && t_loaded.cardBorderWidth.trim() !== "" ? t_loaded.cardBorderWidth : '4px',
    cardBorderStyle: t_loaded.cardBorderStyle && t_loaded.cardBorderStyle !== '_default_' ? t_loaded.cardBorderStyle : 'solid',
    cardBorderRadius: t_loaded.cardBorderRadius && t_loaded.cardBorderRadius.trim() !== "" ? t_loaded.cardBorderRadius : '0.5rem',
    appearance: normalizeTemplateAppearance(t_loaded),
  };

  const optionalStringFields: (keyof Pick<TCGCardTemplate, 'cardBackgroundImageUrl' | 'baseBackgroundColor' | 'baseTextColor' | 'defaultSectionBorderColor' | 'cardBorderColor' | 'cardBorderImageSource'>)[] = [
    'cardBackgroundImageUrl', 'baseBackgroundColor', 'baseTextColor', 'defaultSectionBorderColor', 'cardBorderColor', 'cardBorderImageSource'
  ];

  optionalStringFields.forEach(fieldKey => {
    const value = t_loaded[fieldKey];
    const baseRecord = base as Record<string, unknown>;
    if (value && String(value).trim() !== "") {
      baseRecord[fieldKey] = value;
    } else {
      delete baseRecord[fieldKey];
    }
  });

  const newT = base as TCGCardTemplate;
  newT.freeformCanvas = reconstructFreeformCanvas(t_loaded.freeformCanvas);

  return newT;
};

const dedupeAppearanceStyles = (styles: AppearanceStylePreset[]): AppearanceStylePreset[] => {
  const byId = new Map<string, AppearanceStylePreset>();
  styles.forEach(style => {
    if (style?.id) byId.set(style.id, style);
  });
  return Array.from(byId.values());
};

const DEFAULT_FREEFORM_CANVAS_WIDTH = 630;
const DEFAULT_FREEFORM_CANVAS_HEIGHT = 880;

const createDefaultFreeformElement = (type: FreeformCardElement['type'], overrides: Partial<FreeformCardElement> = {}): FreeformCardElement => {
  const id = overrides.id || nanoid();
  const base: FreeformCardElement = {
    id,
    type,
    name: type === 'text' ? 'Card Title' : type === 'image' ? 'Artwork' : type === 'icon' ? 'Icon' : 'Shape',
    x: 48,
    y: 48,
    width: type === 'text' ? 400 : type === 'icon' ? 64 : 300,
    height: type === 'text' ? 56 : type === 'icon' ? 64 : 180,
    rotation: 0,
    opacity: 1,
    zIndex: 1,
    locked: false,
    content: type === 'text' ? '{{cardName:"Card Name"}}' : type === 'image' ? 'artworkUrl' : '',
    iconName: type === 'icon' ? 'Sparkles' : undefined,
    shapeKind: type === 'shape' ? 'rectangle' : undefined,
    textColor: '#111827',
    backgroundColor: type === 'shape' ? 'rgba(255,255,255,0.16)' : 'transparent',
    fontFamily: 'font-sans',
    fontSize: type === 'text' ? 'text-xl' : 'text-sm',
    fontSizePx: type === 'text' ? 20 : 14,
    fontWeight: type === 'text' ? 'font-bold' : 'font-normal',
    textAlign: type === 'text' ? 'center' : 'left',
    fontStyle: 'normal',
    padding: type === 'text' ? 'p-2' : 'p-0',
    borderColor: type === 'image' || type === 'shape' ? '#d1d5db' : undefined,
    borderWidth: type === 'image' || type === 'shape' ? 'border' : '_none_',
    borderRadius: type === 'image' || type === 'shape' ? 'rounded-md' : 'rounded-none',
    minHeight: '_auto_',
    imageObjectFit: 'cover',
    fillColor: type === 'icon' ? 'transparent' : type === 'shape' ? 'rgba(255,255,255,0.16)' : undefined,
    strokeColor: type === 'icon' || type === 'shape' ? '#fbbf24' : undefined,
    strokeWidth: 2,
    ...overrides,
  };
  return {
    ...base,
    appearance: normalizeAppearanceForElement(base),
  };
};

export const createDefaultFreeformCanvas = (overrides: Partial<FreeformCanvas> = {}): FreeformCanvas => ({
  width: DEFAULT_FREEFORM_CANVAS_WIDTH,
  height: DEFAULT_FREEFORM_CANVAS_HEIGHT,
  gridSize: 20,
  ...overrides,
  elements: overrides.elements && overrides.elements.length > 0 ? overrides.elements : [
    createDefaultFreeformElement('shape', {
      id: nanoid(),
      name: 'Card Frame',
      x: 28,
      y: 28,
      width: 574,
      height: 824,
      zIndex: 0,
      backgroundColor: 'rgba(255,255,255,0.08)',
      fillColor: 'rgba(255,255,255,0.08)',
      borderColor: '#c89f42',
      strokeColor: '#c89f42',
      borderWidth: 'border-2',
      borderRadius: 'rounded-xl',
    }),
    createDefaultFreeformElement('text', {
      id: nanoid(),
      name: 'Card Name',
      x: 64,
      y: 58,
      width: 420,
      height: 54,
      zIndex: 2,
      content: '{{cardName:"Astral Relic"}}',
      textColor: '#2f2414',
    }),
    createDefaultFreeformElement('text', {
      id: nanoid(),
      name: 'Cost',
      x: 502,
      y: 58,
      width: 62,
      height: 54,
      zIndex: 3,
      content: '{{cost:"3"}}',
      textColor: '#111827',
      backgroundColor: 'rgba(255,255,255,0.76)',
      borderColor: '#c89f42',
      borderWidth: 'border',
      borderRadius: 'rounded-full',
    }),
    createDefaultFreeformElement('image', {
      id: nanoid(),
      name: 'Artwork',
      x: 64,
      y: 132,
      width: 502,
      height: 338,
      zIndex: 1,
      imageSource: 'artworkUrl',
      content: 'artworkUrl',
    }),
    createDefaultFreeformElement('text', {
      id: nanoid(),
      name: 'Rules Text',
      x: 64,
      y: 548,
      width: 502,
      height: 166,
      zIndex: 2,
      content: '{{rulesText:"When Astral Relic enters play, draw a card."}}',
      fontSize: 'text-sm',
      fontWeight: 'font-normal',
      textAlign: 'left',
      textColor: '#2f2414',
      backgroundColor: 'rgba(255,255,255,0.72)',
      borderColor: '#d7b86c',
      borderWidth: 'border',
      borderRadius: 'rounded-md',
    }),
  ],
});

export const reconstructFreeformCanvas = (canvas?: Partial<FreeformCanvas>): FreeformCanvas => {
  const defaults = createDefaultFreeformCanvas();
  const sourceElements = canvas?.elements && Array.isArray(canvas.elements) && canvas.elements.length > 0 ? canvas.elements : defaults.elements;
  return {
    width: Number(canvas?.width) > 0 ? Number(canvas?.width) : defaults.width,
    height: Number(canvas?.height) > 0 ? Number(canvas?.height) : defaults.height,
    gridSize: Number(canvas?.gridSize) > 0 ? Number(canvas?.gridSize) : defaults.gridSize,
    elements: sourceElements.map((element, index) => {
      const isLegacyDivider = element.type === 'shape' && (element.shapeKind === 'line' || element.shapeRole === 'divider' || element.appearance?.shapeRole === 'divider');
      const normalizedShapeKind = element.shapeKind === 'capsule' ? 'rectangle' : element.shapeKind;
      const normalizedAppearance = isLegacyDivider
        ? {
            ...element.appearance,
            dividerAsset: element.appearance?.dividerAsset || '/card-assets/dividers/gilded-filigree.svg',
            assetKind: 'divider' as const,
            shapeRole: 'divider' as const,
            material: { ...element.appearance?.material, baseColor: 'transparent', texture: { kind: 'none' as const } },
            border: { ...element.appearance?.border, kind: 'none' as const, width: 0 },
          }
        : element.appearance;

      return createDefaultFreeformElement(element.type || 'text', {
        ...element,
        id: element.id && element.id.trim() !== '' ? element.id : nanoid(),
        name: element.name || `${element.type || 'Element'} ${index + 1}`,
        x: Number.isFinite(Number(element.x)) ? Number(element.x) : 32,
        y: Number.isFinite(Number(element.y)) ? Number(element.y) : 32,
        width: Number(element.width) > 0 ? Number(element.width) : 120,
        height: Number(element.height) > 0 ? Number(element.height) : 60,
        zIndex: Number.isFinite(Number(element.zIndex)) ? Number(element.zIndex) : index,
        opacity: Number.isFinite(Number(element.opacity)) ? Math.min(1, Math.max(0, Number(element.opacity))) : 1,
        rotation: Number.isFinite(Number(element.rotation)) ? Number(element.rotation) : 0,
        shapeKind: isLegacyDivider ? 'line' : normalizedShapeKind,
        shapeRole: isLegacyDivider ? 'divider' : element.shapeRole,
        borderRadius: element.shapeKind === 'capsule' ? 'rounded-full' : element.borderRadius,
        appearance: normalizedAppearance,
      });
    }).sort((a, b) => a.zIndex - b.zIndex),
  };
};

interface AppState {
  templates: TCGCardTemplate[];
  appearanceStyles: AppearanceStylePreset[];
  storedCards: StoredDisplayCard[];

  selectedPaperSize: PaperSize;
  activeTab: string;
  hideEmptySections: boolean;
  richTextHighlightColor: string;
  singleCardGeneratorSelectedTemplateId: string | null;

  pdfMarginMm: number;
  pdfCardSpacingMm: number;
  pdfIncludeCutLines: boolean;

  editingCardUniqueId: string | null;
  isEditDialogOpen: boolean;
  
  // Actions
  addOrUpdateTemplate: (template: TCGCardTemplate) => string; 
  mergeTemplatesFromFiles: (templates: Partial<TCGCardTemplate>[]) => number;
  deleteTemplate: (templateId: string) => void;
  cloneTemplate: (templateId: string) => string | null;
  setAppearanceStylesFromFiles: (styles: AppearanceStylePreset[]) => void;
  addOrUpdateAppearanceStyle: (style: AppearanceStylePreset) => string;
  deleteAppearanceStyle: (styleId: string) => void;
  
  addGeneratedCards: (newCards: DisplayCard[]) => void;
  clearGeneratedCards: () => void;
  updateGeneratedCard: (updatedCard: DisplayCard) => void;
  setStoredCardsFromFile: (loadedCards: StoredDisplayCard[]) => { successCount: number, skippedCount: number };

  setSelectedPaperSize: (size: PaperSize) => void;
  setActiveTab: (tab: string) => void;
  setHideEmptySections: (hide: boolean) => void;
  setRichTextHighlightColor: (color: string) => void;
  setSingleCardGeneratorSelectedTemplateId: (id: string | null) => void;
  setPdfOptions: (options: { margin?: number; spacing?: number; cutLines?: boolean }) => void;

  openEditDialog: (cardUniqueId: string) => void;
  closeEditDialog: () => void;

  _rehydrateCallback: () => void; 
}

export const useAppStore = create<AppState>()(
  devtools( 
    persist(
      (set, get) => ({
        templates: [],
        appearanceStyles: DEFAULT_APPEARANCE_LIBRARY,
        storedCards: [],

        selectedPaperSize: PAPER_SIZES[0],
        activeTab: TABS_CONFIG[0].value,
        hideEmptySections: true,
        richTextHighlightColor: 'rgba(255,215,0,0.35)',
        singleCardGeneratorSelectedTemplateId: null,

        pdfMarginMm: 5,
        pdfCardSpacingMm: 0,
        pdfIncludeCutLines: false,

        editingCardUniqueId: null,
        isEditDialogOpen: false,

        addOrUpdateTemplate: (template) => {
          let templateToSave = { ...template };
          if (!templateToSave.id || templateToSave.id.trim() === "" || templateToSave.id === null) { 
            templateToSave.id = nanoid();
          }
          const reconstructed = reconstructMinimalTemplateObject(templateToSave);
          
          let finalId = reconstructed.id!; 

          set((state) => {
            const newTemplates = [...state.templates];
            const existingIndex = newTemplates.findIndex(t => t.id === finalId);
            if (existingIndex > -1) {
              newTemplates[existingIndex] = reconstructed;
            } else {
              newTemplates.push(reconstructed);
            }
            const canonicalTemplates = newTemplates.map(t => reconstructMinimalTemplateObject(t));
            if (JSON.stringify(state.templates) === JSON.stringify(canonicalTemplates)) {
                return state; 
            }
            return { templates: canonicalTemplates };
          });
          return finalId;
        },
        mergeTemplatesFromFiles: (templates) => {
          const reconstructedTemplates = templates
            .map(template => reconstructMinimalTemplateObject(template))
            .filter(template => template.id && template.id.trim() !== '');

          if (reconstructedTemplates.length === 0) return 0;

          set((state) => {
            const merged = [...state.templates];
            reconstructedTemplates.forEach(template => {
              const existingIndex = merged.findIndex(existing => existing.id === template.id);
              if (existingIndex > -1) {
                merged[existingIndex] = template;
              } else {
                merged.push(template);
              }
            });

            const selectedStillExists = state.singleCardGeneratorSelectedTemplateId
              ? merged.some(template => template.id === state.singleCardGeneratorSelectedTemplateId)
              : false;

            return {
              templates: merged.map(template => reconstructMinimalTemplateObject(template)),
              singleCardGeneratorSelectedTemplateId: selectedStillExists
                ? state.singleCardGeneratorSelectedTemplateId
                : (merged[0]?.id ?? null),
            };
          });

          return reconstructedTemplates.length;
        },
        cloneTemplate: (templateId) => {
          const state = get();
          const source = state.templates.find(t => t.id === templateId);
          if (!source) return null;
          const cloned = reconstructMinimalTemplateObject({
            ...JSON.parse(JSON.stringify(source)),
            id: nanoid(),
            name: `Copy of ${source.name}`,
          });
          set((s) => ({ templates: [...s.templates, cloned] }));
          return cloned.id!;
        },
        deleteTemplate: (templateId) => set((state) => {
          const newTemplates = state.templates.filter(t => t.id !== templateId);
          const newStoredCards = state.storedCards.filter(card => card.templateId !== templateId);
          const newSingleSelectedId = state.singleCardGeneratorSelectedTemplateId === templateId ? 
            (newTemplates.length > 0 ? (newTemplates.find(t => t.id && t.id.trim() !== "")?.id || null) : null) 
            : state.singleCardGeneratorSelectedTemplateId;
          const newEditingCardUniqueId = state.editingCardUniqueId && state.storedCards.find(card => card.uniqueId === state.editingCardUniqueId)?.templateId === templateId
            ? null
            : state.editingCardUniqueId;

          if (
            JSON.stringify(state.templates) === JSON.stringify(newTemplates) &&
            JSON.stringify(state.storedCards) === JSON.stringify(newStoredCards) &&
            state.singleCardGeneratorSelectedTemplateId === newSingleSelectedId &&
            state.editingCardUniqueId === newEditingCardUniqueId
          ) {
            return state;
          }
          return {
            templates: newTemplates,
            storedCards: newStoredCards,
            singleCardGeneratorSelectedTemplateId: newSingleSelectedId,
            editingCardUniqueId: newEditingCardUniqueId,
            isEditDialogOpen: newEditingCardUniqueId ? state.isEditDialogOpen : false,
          };
        }),
        setAppearanceStylesFromFiles: (styles) => set((state) => {
          const merged = dedupeAppearanceStyles([...DEFAULT_APPEARANCE_LIBRARY, ...state.appearanceStyles]);
          styles.forEach(style => {
            const index = merged.findIndex(existing => existing.id === style.id);
            if (index > -1) merged[index] = style;
            else merged.push(style);
          });
          return { appearanceStyles: dedupeAppearanceStyles(merged) };
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
        setStoredCardsFromFile: (loadedCards) => {
            let successCount = 0;
            let skippedCount = 0;
            const currentTemplates = get().templates;

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

        setSelectedPaperSize: (size) => set({ selectedPaperSize: size }),
        setActiveTab: (tab) => set({ activeTab: tab }),
        setHideEmptySections: (hide) => set({ hideEmptySections: hide }),
        setRichTextHighlightColor: (color) => set({ richTextHighlightColor: color }),
        setSingleCardGeneratorSelectedTemplateId: (id) => set({ singleCardGeneratorSelectedTemplateId: id }),
        setPdfOptions: (options) => set((state) => ({
          pdfMarginMm: options.margin !== undefined ? Math.max(0, options.margin) : state.pdfMarginMm,
          pdfCardSpacingMm: options.spacing !== undefined ? Math.max(0, options.spacing) : state.pdfCardSpacingMm,
          pdfIncludeCutLines: options.cutLines !== undefined ? options.cutLines : state.pdfIncludeCutLines,
        })),

        openEditDialog: (cardUniqueId) => set({ editingCardUniqueId: cardUniqueId, isEditDialogOpen: true }),
        closeEditDialog: () => set({ editingCardUniqueId: null, isEditDialogOpen: false }),

        _rehydrateCallback: () => {
          const state = get();
          // After rehydration from localStorage, if the previously selected template
          // no longer exists, fall back to the first available template.
          const currentId = state.singleCardGeneratorSelectedTemplateId;
          if ((!currentId || !state.templates.find(t => t.id === currentId)) && state.templates.length > 0) {
            const firstValid = state.templates.find(t => t.id && t.id.trim() !== "");
            if (firstValid) {
              set({ singleCardGeneratorSelectedTemplateId: firstValid.id });
            }
          }
          // Always dedupe appearance styles on rehydration.
          const dedupedStyles = dedupeAppearanceStyles([...DEFAULT_APPEARANCE_LIBRARY, ...state.appearanceStyles]);
          if (dedupedStyles.length !== state.appearanceStyles.length) {
            set({ appearanceStyles: dedupedStyles });
          }
        },
      }),
      {
        name: 'card-forge-app-storage-v2',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          templates: state.templates,
          appearanceStyles: dedupeAppearanceStyles(state.appearanceStyles),
          storedCards: state.storedCards,
          selectedPaperSize: state.selectedPaperSize,
          activeTab: state.activeTab,
          hideEmptySections: state.hideEmptySections,
          richTextHighlightColor: state.richTextHighlightColor,
          singleCardGeneratorSelectedTemplateId: state.singleCardGeneratorSelectedTemplateId,
          pdfMarginMm: state.pdfMarginMm,
          pdfCardSpacingMm: state.pdfCardSpacingMm,
          pdfIncludeCutLines: state.pdfIncludeCutLines,
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
        // Increment this version number whenever the persisted state shape changes.
        // Add a corresponding migration case below to keep existing user data intact.
        version: 5,
        migrate: (persistedState: unknown, fromVersion: number) => {
          const s = persistedState as Record<string, unknown>;

          // v2 → v3: storedCards used templateId/frontTemplateId inconsistently across early builds.
          // Normalise any cards that still carry the old `frontTemplateId` key.
          if (fromVersion < 3 && Array.isArray(s.storedCards)) {
            s.storedCards = (s.storedCards as Array<Record<string, unknown>>).map((card) => {
              if (!card.templateId && card.frontTemplateId) {
                return { ...card, templateId: card.frontTemplateId };
              }
              return card;
            });
          }

          // v3 → v4: removed hasSeededDefaultTemplates — templates are loaded from data/templates/
          // at app startup, not seeded from a hardcoded in-memory array.
          if (fromVersion < 4) {
            delete s.hasSeededDefaultTemplates;
          }

          if (fromVersion < 5 || typeof s.richTextHighlightColor !== 'string') {
            s.richTextHighlightColor = 'rgba(255,215,0,0.35)';
          }

          return s;
        },
      }
    )
  )
);

export const selectGeneratedDisplayCards = (state: AppState): DisplayCard[] => {
  return state.storedCards.reduce((acc: DisplayCard[], storedCard) => {
    const template = state.templates.find(t => t.id === storedCard.templateId);
    if (template) {
      acc.push({
        uniqueId: storedCard.uniqueId,
        template: template, 
        data: storedCard.data,
      });
    }
    return acc;
  }, []);
};

export const selectEditingCard = (state: AppState): DisplayCard | null => {
    if (!state.editingCardUniqueId || !state.isEditDialogOpen) return null;
    
    const allDisplayCards = selectGeneratedDisplayCards(state);
    const editingDisplayCard = allDisplayCards.find(card => card.uniqueId === state.editingCardUniqueId);
    
    return editingDisplayCard || null;
};

export { getFreshDefaultTemplateObject as getFreshDefaultTemplate, reconstructMinimalTemplateObject as reconstructMinimalTemplate };
