import type { StateCreator } from 'zustand';

import { areTemplateFormatsCompatible } from '@/domain/card-formats';
import { PAPER_SIZES } from '@/domain/rendering';

import { resolveGeneratorFrontTemplateId, selectAllTemplates } from './selectors';
import type { ProjectState, SettingsSlice } from './types';
import { createDefaultActiveCardSet, normalizeActiveTab, WORKSPACE_TABS } from './workspaceDefaults';

const getCompatibleBackingId = (
  state: ProjectState,
  frontTemplateId: string | null,
  backingTemplateId: string | null,
): string | null => {
  if (!backingTemplateId) return null;
  const templates = selectAllTemplates(state);
  const front = templates.find((template) => template.id === frontTemplateId);
  const back = templates.find((template) => template.id === backingTemplateId && template.templateUsage === 'back-preset');
  return front && back && areTemplateFormatsCompatible(front, back) ? backingTemplateId : null;
};

export const createSettingsSlice: StateCreator<ProjectState, [], [], SettingsSlice> = (set) => ({
  selectedPaperSize: PAPER_SIZES[0],
  activeTab: WORKSPACE_TABS[0],
  richTextHighlightColor: '#ffd700',
  activeCardSet: createDefaultActiveCardSet(),
  singleCardGeneratorSelectedTemplateId: null,
  templateEditorSelectedTemplateId: null,
  pdfMarginMm: 5,
  pdfCardSpacingMm: 0,
  pdfIncludeCutLines: false,
  pdfDuplexLayout: 'separate-pages',
  exportMode: 'physical',
  exportDpi: 300,

  setSelectedPaperSize: (size) => set({ selectedPaperSize: size }),
  setActiveTab: (tab) => set({ activeTab: normalizeActiveTab(tab) }),
  setRichTextHighlightColor: (color) => set({ richTextHighlightColor: color }),
  setActiveCardSetName: (name) => set((state) => ({
    activeCardSet: { ...state.activeCardSet, name: name.trim() || 'Untitled Set' },
  })),
  setActiveCardSetFrontTemplateId: (id) => set((state) => ({
    activeCardSet: {
      ...state.activeCardSet,
      frontTemplateId: id,
      backingTemplateId: getCompatibleBackingId(state, id, state.activeCardSet.backingTemplateId),
    },
    singleCardGeneratorSelectedTemplateId: id,
  })),
  setActiveCardSetBackingTemplateId: (id) => set((state) => {
    const frontTemplateId = resolveGeneratorFrontTemplateId(
      selectAllTemplates(state),
      state.singleCardGeneratorSelectedTemplateId,
    );
    return {
      singleCardGeneratorSelectedTemplateId: frontTemplateId,
      activeCardSet: {
        ...state.activeCardSet,
        frontTemplateId,
        backingTemplateId: getCompatibleBackingId(state, frontTemplateId, id),
      },
    };
  }),
  setSingleCardGeneratorSelectedTemplateId: (id) => set((state) => ({
    singleCardGeneratorSelectedTemplateId: id,
    activeCardSet: {
      ...state.activeCardSet,
      frontTemplateId: id,
      backingTemplateId: getCompatibleBackingId(state, id, state.activeCardSet.backingTemplateId),
    },
  })),
  setTemplateEditorSelectedTemplateId: (id) => set({ templateEditorSelectedTemplateId: id }),
  setPdfOptions: (options) => set((state) => ({
    pdfMarginMm: options.margin !== undefined ? Math.max(0, options.margin) : state.pdfMarginMm,
    pdfCardSpacingMm: options.spacing !== undefined ? Math.max(0, options.spacing) : state.pdfCardSpacingMm,
    pdfIncludeCutLines: options.cutLines !== undefined ? options.cutLines : state.pdfIncludeCutLines,
    pdfDuplexLayout: options.duplexLayout ?? state.pdfDuplexLayout,
  })),
  setExportMode: (mode) => set({ exportMode: mode }),
  setExportDpi: (dpi) => set({ exportDpi: Math.min(1200, Math.max(72, Math.round(dpi))) }),
});
