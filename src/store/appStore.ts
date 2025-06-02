
import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { TCGCardTemplate, PaperSize, DisplayCard, CardData, StoredDisplayCard, CardRow, CardSection } from '@/types';
import { PAPER_SIZES, TABS_CONFIG, TCG_ASPECT_RATIO, createDefaultRow as utilCreateDefaultRow, createDefaultSection as utilCreateDefaultSection } from '@/lib/constants';

// Moved from constants to prevent circular dependencies if constants need store types
export const DEFAULT_TEMPLATES_DATA: Partial<TCGCardTemplate>[] = [
  {
    id: 'default-fantasy-classic',
    name: 'Fantasy Classic',
    aspectRatio: '63:88',
    frameStyle: 'classic-gold',
    baseBackgroundColor: '#FDF5E6', // Parchment
    baseTextColor: '#5D4037', // Dark Brown
    cardBorderRadius: '0.75rem',
    rows: [
      {
        id: `dfr1-${'default-fantasy-classic'}`,
        alignItems: 'center',
        columns: [
          { id: `dfc1s1-${'default-fantasy-classic'}`, sectionContentType: 'placeholder', contentPlaceholder: '{{cardName:"Dragon Hoard"}}', flexGrow: 1, textAlign: 'center', fontFamily: 'font-cinzel', fontSize: 'text-xl', fontWeight: 'font-bold', padding: 'p-2', minHeight: 'min-h-[40px]' }
        ]
      },
      {
        id: `dfr2-${'default-fantasy-classic'}`,
        columns: [
          { id: `dfc2s1-${'default-fantasy-classic'}`, sectionContentType: 'image', contentPlaceholder: 'artworkUrl', flexGrow: 1, customHeight: '200px', imageWidthPx: '280', imageHeightPx: '200', padding: 'p-1' }
        ]
      },
      {
        id: `dfr3-${'default-fantasy-classic'}`,
        customHeight: '30px',
        columns: [
          { id: `dfc3s1-${'default-fantasy-classic'}`, sectionContentType: 'placeholder', contentPlaceholder: '{{cardType:"Artifact"}}', flexGrow: 1, textAlign: 'center', fontFamily: 'font-lato', fontSize: 'text-sm', padding: 'p-1', backgroundColor: 'rgba(180, 140, 50, 0.1)' }
        ]
      },
      {
        id: `dfr4-${'default-fantasy-classic'}`,
        columns: [
          { id: `dfc4s1-${'default-fantasy-classic'}`, sectionContentType: 'placeholder', contentPlaceholder: '{{rulesText:"Tap: Add one gold to your treasury."}}', flexGrow: 1, fontFamily: 'font-lato', fontSize: 'text-xs', padding: 'p-2', customHeight: '60px', backgroundColor: 'rgba(253, 244, 216, 0.7)' }
        ]
      },
      {
        id: `dfr5-${'default-fantasy-classic'}`,
        columns: [
          { id: `dfc5s1-${'default-fantasy-classic'}`, sectionContentType: 'placeholder', contentPlaceholder: '{{flavorText:"Gold glitters, but true treasure is power."}}', flexGrow: 1, fontStyle: 'italic', fontFamily: 'font-lato', fontSize: 'text-xs', padding: 'p-2', customHeight: '40px', backgroundColor: 'rgba(253, 244, 216, 0.7)', textAlign: 'center' }
        ]
      },
    ]
  },
  {
    id: 'default-modern-minimal',
    name: 'Modern Minimal Dark',
    aspectRatio: '63:88',
    frameStyle: 'minimal-dark',
    baseBackgroundColor: '#282828',
    baseTextColor: '#c0c0c0',
    rows: [
       { id: `dmmr1-${'default-modern-minimal'}`, columns: [ { id: `dmms1-${'default-modern-minimal'}`, sectionContentType: 'placeholder', contentPlaceholder: '{{title:"Phase Shift"}}', flexGrow: 1, textAlign: 'left', fontSize: 'text-lg', fontWeight: 'font-semibold', padding: 'p-2', textColor: '#e0e0e0', minHeight: 'min-h-[35px]' }] },
       { id: `dmmr2-${'default-modern-minimal'}`, customHeight: '220px', columns: [ { id: `dmms2-${'default-modern-minimal'}`, sectionContentType: 'image', contentPlaceholder: 'mainImage', flexGrow: 1, imageWidthPx: '290', imageHeightPx: '220', padding: 'p-0' }] },
       { id: `dmmr3-${'default-modern-minimal'}`, customHeight: '50px', alignItems: 'center', columns: [
            { id: `dmms3a-${'default-modern-minimal'}`, sectionContentType: 'placeholder', contentPlaceholder: '{{cost:"3E"}}', flexGrow: 0, customWidth: '50px', textAlign: 'center', fontSize: 'text-xl', fontWeight: 'font-bold', padding: 'p-1', backgroundColor: '#333' },
            { id: `dmms3b-${'default-modern-minimal'}`, sectionContentType: 'placeholder', contentPlaceholder: '{{typeLine:"Instant - Tech"}}', flexGrow: 1, textAlign: 'right', fontSize: 'text-sm', padding: 'p-1', backgroundColor: '#333' },
       ]},
       { id: `dmmr4-${'default-modern-minimal'}`, columns: [ { id: `dmms4-${'default-modern-minimal'}`, sectionContentType: 'placeholder', contentPlaceholder: '{{effect:"Target device becomes intangible until your next cycle."}}', flexGrow: 1, fontSize: 'text-xs', padding: 'p-2', customHeight: '80px' }] },
    ]
  }
];


const MAX_DATA_URI_LENGTH_FOR_PERSISTENCE = 150 * 1024; // This limit might be reconsidered for persisted state if needed.

export const getFreshDefaultTemplateObject = (id?: string | null, nameProp?: string): TCGCardTemplate => {
  let newTemplateId: string | null;
  let newTemplateName: string;
  const isValidExistingId = id && id.trim() !== "";

  if (id === null) {
    newTemplateId = null; // Indicates an unsaved new template
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

  const defaultRowId1 = nanoid();
  const defaultSectionId1 = nanoid();
  const defaultRowId2 = nanoid();
  const defaultSectionId2 = nanoid();
  const defaultRowId3 = nanoid();
  const defaultSectionId3A = nanoid();
  const defaultSectionId3B = nanoid();

  return {
    id: newTemplateId,
    name: newTemplateName,
    aspectRatio: TCG_ASPECT_RATIO,
    frameStyle: 'standard',
    cardBorderWidth: '4px',
    cardBorderStyle: 'solid',
    cardBorderRadius: '0.5rem',
    rows: [
      utilCreateDefaultRow(defaultRowId1, [
        utilCreateDefaultSection(defaultSectionId1, { contentPlaceholder: `{{cardName:"Card Name"}}`, flexGrow: 1, sectionContentType: 'placeholder', textAlign:'center', fontSize:'text-lg', fontWeight: 'font-bold' }),
      ]),
      utilCreateDefaultRow(defaultRowId2, [
        utilCreateDefaultSection(defaultSectionId2, { contentPlaceholder: '{{artworkUrl:"https://placehold.co/260x180.png?text=Artwork"}}', sectionContentType:'image', flexGrow:1, customHeight: '180px', imageWidthPx: '260', imageHeightPx:'180' }),
      ]),
       utilCreateDefaultRow(defaultRowId3, [
        utilCreateDefaultSection(defaultSectionId3A, { contentPlaceholder: `{{description:"Effect Text"}}`, flexGrow: 2, sectionContentType: 'placeholder', customHeight: '80px' }),
        utilCreateDefaultSection(defaultSectionId3B, { contentPlaceholder: `{{stats:"P/T"}}`, flexGrow: 1, sectionContentType: 'placeholder', textAlign: 'center', customHeight: '80px' }),
      ]),
    ],
  };
};

export const reconstructMinimalTemplateObject = (t_loaded_partial: Partial<TCGCardTemplate>): TCGCardTemplate => {
  const t_loaded = { ...t_loaded_partial }; // Work with a copy

  const validatedId = (t_loaded.id && t_loaded.id.trim() !== "") ? t_loaded.id : nanoid();

  const base: Partial<TCGCardTemplate> = {
      id: validatedId,
      name: t_loaded.name || `Template ${validatedId.substring(0, 8)}`,
      aspectRatio: t_loaded.aspectRatio || TCG_ASPECT_RATIO,
      frameStyle: t_loaded.frameStyle || 'standard',
      cardBorderWidth: t_loaded.cardBorderWidth && t_loaded.cardBorderWidth.trim() !== "" ? t_loaded.cardBorderWidth : '4px',
      cardBorderStyle: t_loaded.cardBorderStyle && t_loaded.cardBorderStyle !== '_default_' ? t_loaded.cardBorderStyle : 'solid',
      cardBorderRadius: t_loaded.cardBorderRadius && t_loaded.cardBorderRadius.trim() !== "" ? t_loaded.cardBorderRadius : '0.5rem',
      rows: [],
  };

  const optionalStringFieldsForBase: (keyof Pick<TCGCardTemplate, 'cardBackgroundImageUrl' | 'baseBackgroundColor' | 'baseTextColor' | 'defaultSectionBorderColor' | 'cardBorderColor'>)[] = [
      'cardBackgroundImageUrl', 'baseBackgroundColor', 'baseTextColor', 'defaultSectionBorderColor', 'cardBorderColor'
  ];

  optionalStringFieldsForBase.forEach(fieldKey => {
      const value = t_loaded[fieldKey];
      if (value && String(value).trim() !== "") {
          // Removed MAX_DATA_URI_LENGTH_FOR_PERSISTENCE check for cardBackgroundImageUrl
          (base as any)[fieldKey] = value;
      } else {
          delete (base as any)[fieldKey];
      }
  });
  
  const newT = base as TCGCardTemplate;

  const sourceRows = t_loaded.rows && Array.isArray(t_loaded.rows) && t_loaded.rows.length > 0 ? t_loaded.rows : [];

  newT.rows = sourceRows.map((r_source_partial: Partial<CardRow>) => {
      const r_source = { ...r_source_partial };
      const rowId = (r_source.id && r_source.id.trim() !== "") ? r_source.id : nanoid();
      
      const rowBase: Partial<CardRow> = {
          id: rowId,
          alignItems: r_source.alignItems || 'flex-start',
          columns: []
      };
      if (r_source.customHeight && r_source.customHeight.trim() !== "") rowBase.customHeight = r_source.customHeight;
      else delete rowBase.customHeight;
      
      const newR = rowBase as CardRow;

      // Ensure createDefaultSection is using the util version
      const sectionDefaultsForCompare = utilCreateDefaultSection(nanoid()); // For comparison of default values
      const sourceColumns = r_source.columns && Array.isArray(r_source.columns) && r_source.columns.length > 0 ? r_source.columns : [utilCreateDefaultSection(`default-col-for-row-${rowId}`)];

      newR.columns = sourceColumns.map((c_source_partial: Partial<CardSection>) => {
          const c_source = { ...c_source_partial };
          const sectionId = (c_source.id && c_source.id.trim() !== "") ? c_source.id : nanoid();
          const sectionDefaults = utilCreateDefaultSection(sectionId); // Use util version
          
          const sectionBase: Partial<CardSection> = {
              id: sectionId,
              sectionContentType: c_source.sectionContentType || sectionDefaults.sectionContentType,
              contentPlaceholder: c_source.contentPlaceholder !== undefined ? c_source.contentPlaceholder : sectionDefaults.contentPlaceholder,
              flexGrow: c_source.flexGrow !== undefined ? c_source.flexGrow : sectionDefaults.flexGrow,
          };

          const optionalFields: (keyof Omit<CardSection, 'id' | 'sectionContentType' | 'contentPlaceholder' | 'flexGrow'>)[] = [
              'backgroundImageUrl', 'textColor', 'backgroundColor', 'fontFamily', 
              'fontSize', 'fontWeight', 'textAlign', 'fontStyle', 'padding', 
              'borderColor', 'borderWidth', 'borderRadius', 'minHeight', 
              'customHeight', 'customWidth', 'imageWidthPx', 'imageHeightPx'
          ];

          optionalFields.forEach(fieldKey => {
              const value = c_source[fieldKey];
              const defaultValueFromDefaults = sectionDefaults[fieldKey as keyof CardSection];

              if (value !== undefined && String(value).trim() !== "") {
                   // Removed MAX_DATA_URI_LENGTH_FOR_PERSISTENCE check for section backgroundImageUrl
                  (sectionBase as any)[fieldKey] = value;
              } else if (defaultValueFromDefaults !== undefined && String(defaultValueFromDefaults) !== "" && String(value).trim() === "" && String(defaultValueFromDefaults) !== String(sectionDefaultsForCompare[fieldKey as keyof CardSection])) {
                  // If loaded value is empty string, but default is not, keep the default
                  (sectionBase as any)[fieldKey] = defaultValueFromDefaults;
              }
              else {
                   delete (sectionBase as any)[fieldKey];
              }
          });
          
          // Ensure essential defaults that should always exist if not overridden (even if to empty string by user)
          const essentialDefaultFields = ['fontFamily', 'fontSize', 'fontWeight', 'textAlign', 'fontStyle', 'padding', 'borderWidth', 'borderRadius', 'minHeight'];
          essentialDefaultFields.forEach(key => {
            if (sectionBase[key as keyof CardSection] === undefined) {
                 (sectionBase as any)[key] = sectionDefaults[key as keyof CardSection];
            }
          });


          if ((sectionBase.contentPlaceholder === undefined || String(sectionBase.contentPlaceholder).trim() === "") && sectionDefaults.contentPlaceholder) {
               sectionBase.contentPlaceholder = sectionDefaults.contentPlaceholder;
          }

          if (sectionBase.sectionContentType === 'image') {
              if ((sectionBase.imageWidthPx === undefined || String(sectionBase.imageWidthPx).trim() === '') && sectionDefaults.imageWidthPx) sectionBase.imageWidthPx = sectionDefaults.imageWidthPx;
              if ((sectionBase.imageHeightPx === undefined || String(sectionBase.imageHeightPx).trim() === '') && sectionDefaults.imageHeightPx) sectionBase.imageHeightPx = sectionDefaults.imageHeightPx;
          }
          return sectionBase as CardSection;
      });
      if (newR.columns.length === 0) newR.columns = [utilCreateDefaultSection(`default-col-for-row-${rowId}`)]; 

      return newR;
  });

  // If after all reconstruction, rows are empty for a *new* template (id was null originally or generated for first time)
  // then populate with default structure.
  // For existing templates (t_loaded.id was present), if rows are empty, they stay empty.
  if (newT.rows.length === 0 && (!t_loaded_partial.id || t_loaded_partial.id.trim() === "")) {
      const defaultStructure = getFreshDefaultTemplateObject(null, newT.name); // Use the store's getFresh
      newT.rows = defaultStructure.rows.map(r => ({
          ...r,
          id:nanoid(), 
          columns: r.columns.map(c => ({...c, id:nanoid()})) 
      }));
  }
  return newT;
};

interface AppState {
  templates: TCGCardTemplate[];
  storedCards: StoredDisplayCard[];

  selectedPaperSize: PaperSize;
  activeTab: string;
  hideEmptySections: boolean;
  singleCardGeneratorSelectedTemplateId: string | null;

  pdfMarginMm: number;
  pdfCardSpacingMm: number;
  pdfIncludeCutLines: boolean;

  editingCardUniqueId: string | null;
  isEditDialogOpen: boolean;
  
  // Actions
  addOrUpdateTemplate: (template: TCGCardTemplate) => string; // Returns ID of saved template
  deleteTemplate: (templateId: string) => void;
  
  addGeneratedCards: (newCards: DisplayCard[]) => void;
  clearGeneratedCards: () => void;
  updateGeneratedCard: (updatedCard: DisplayCard) => void;
  setStoredCardsFromFile: (loadedCards: StoredDisplayCard[]) => { successCount: number, skippedCount: number };

  setSelectedPaperSize: (size: PaperSize) => void;
  setActiveTab: (tab: string) => void;
  setHideEmptySections: (hide: boolean) => void;
  setSingleCardGeneratorSelectedTemplateId: (id: string | null) => void;
  setPdfOptions: (options: { margin?: number; spacing?: number; cutLines?: boolean }) => void;

  openEditDialog: (cardUniqueId: string) => void;
  closeEditDialog: () => void;

  _rehydrateCallback: () => void; 
}

export const useAppStore = create<AppState>()(
  devtools( // Using devtools for easier debugging
    persist(
      (set, get) => ({
        templates: [],
        storedCards: [],

        selectedPaperSize: PAPER_SIZES[0],
        activeTab: TABS_CONFIG[0].value,
        hideEmptySections: true,
        singleCardGeneratorSelectedTemplateId: null,

        pdfMarginMm: 5,
        pdfCardSpacingMm: 0,
        pdfIncludeCutLines: false,

        editingCardUniqueId: null,
        isEditDialogOpen: false,

        addOrUpdateTemplate: (template) => {
          let templateToSave = { ...template };
          if (!templateToSave.id || templateToSave.id.trim() === "" || templateToSave.id === null) { // Check for null explicitly
            templateToSave.id = nanoid();
          }
          const reconstructed = reconstructMinimalTemplateObject(templateToSave);
          
          let finalId = reconstructed.id!; // id is guaranteed by reconstruction

          set((state) => {
            const newTemplates = [...state.templates];
            const existingIndex = newTemplates.findIndex(t => t.id === finalId);
            if (existingIndex > -1) {
              newTemplates[existingIndex] = reconstructed;
            } else {
              newTemplates.push(reconstructed);
            }
            // Ensure all templates in the list are in canonical form for comparison by persist middleware
            const canonicalTemplates = newTemplates.map(t => reconstructMinimalTemplateObject(t));
            if (JSON.stringify(state.templates) === JSON.stringify(canonicalTemplates)) {
                return state; // Avoid update if no actual change
            }
            return { templates: canonicalTemplates };
          });
          return finalId;
        },
        deleteTemplate: (templateId) => set((state) => {
          const newTemplates = state.templates.filter(t => t.id !== templateId);
          const newSingleSelectedId = state.singleCardGeneratorSelectedTemplateId === templateId ? 
            (newTemplates.length > 0 ? (newTemplates.find(t => t.id && t.id.trim() !== "")?.id || null) : null) 
            : state.singleCardGeneratorSelectedTemplateId;

          if (JSON.stringify(state.templates) === JSON.stringify(newTemplates) && state.singleCardGeneratorSelectedTemplateId === newSingleSelectedId) {
            return state;
          }
          return {
            templates: newTemplates,
            singleCardGeneratorSelectedTemplateId: newSingleSelectedId,
          };
        }),
        
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
                        templateId: templateFound.id!, // Use the ID from the found template
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
          let changed = false;
          let newTemplates = state.templates;
          let newSingleCardGeneratorSelectedTemplateId = state.singleCardGeneratorSelectedTemplateId;

          if (state.templates.length === 0 && DEFAULT_TEMPLATES_DATA.length > 0) {
            newTemplates = DEFAULT_TEMPLATES_DATA.map(t => reconstructMinimalTemplateObject(JSON.parse(JSON.stringify(t))));
            changed = true;
          }
          
          if ((!newSingleCardGeneratorSelectedTemplateId || !newTemplates.find(t => t.id === newSingleCardGeneratorSelectedTemplateId)) && newTemplates.length > 0) {
            const firstValidTemplate = newTemplates.find(t => t.id && t.id.trim() !== "");
            if (firstValidTemplate) {
              newSingleCardGeneratorSelectedTemplateId = firstValidTemplate.id;
              changed = true;
            }
          }
          if(changed){
            set({ templates: newTemplates, singleCardGeneratorSelectedTemplateId: newSingleCardGeneratorSelectedTemplateId });
          }
        },
      }),
      {
        name: 'card-forge-app-storage-v2',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          templates: state.templates,
          storedCards: state.storedCards,
          selectedPaperSize: state.selectedPaperSize,
          activeTab: state.activeTab,
          hideEmptySections: state.hideEmptySections,
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
              // Call the rehydration callback after the state has been set
              // Timeout ensures it runs after the current tick where Zustand finalizes rehydration
              setTimeout(() => state._rehydrateCallback(), 0);
            }
          };
        },
        version: 2, // version number for migrations if needed
      }
    )
  )
);

// Selector to get DisplayCard[] from StoredDisplayCard[] and templates[]
export const selectGeneratedDisplayCards = (state: AppState): DisplayCard[] => {
  return state.storedCards.reduce((acc: DisplayCard[], storedCard) => {
    const template = state.templates.find(t => t.id === storedCard.templateId);
    if (template) {
      acc.push({
        uniqueId: storedCard.uniqueId,
        template: template, // Already reconstructed in store
        data: storedCard.data,
      });
    }
    return acc;
  }, []);
};

// Selector for the card currently being edited
export const selectEditingCard = (state: AppState): DisplayCard | null => {
    if (!state.editingCardUniqueId || !state.isEditDialogOpen) return null;
    
    // Use the selectGeneratedDisplayCards selector to get the full card object
    const allDisplayCards = selectGeneratedDisplayCards(state);
    const editingDisplayCard = allDisplayCards.find(card => card.uniqueId === state.editingCardUniqueId);
    
    return editingDisplayCard || null;
};

// Call the rehydration callback once manually after store creation for initial setup if not persisted yet.
// This might be too early if persist isn't done. `onRehydrateStorage` is better.
// setTimeout(() => useAppStore.getState()._rehydrateCallback(), 0);

// Expose getFreshDefaultTemplate and reconstructMinimalTemplate for use outside the store if needed
// (e.g. in TemplateEditor for new template state before saving to store)
export { getFreshDefaultTemplateObject as getFreshDefaultTemplate, reconstructMinimalTemplateObject as reconstructMinimalTemplate };
