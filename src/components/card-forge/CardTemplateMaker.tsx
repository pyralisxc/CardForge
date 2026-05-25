"use client";

import type { ChangeEvent, RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import {
  BoxSelect,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  Eye,
  EyeOff,
  FolderPlus,
  GripVertical,
  Grid3X3,
  Image as ImageIcon,
  Layers,
  Lock,
  Maximize2,
  MousePointer2,
  PenTool,
  Redo2,
  Shapes,
  Sparkles,
  Square,
  Type,
  Undo2,
  Ungroup,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import type { AppearanceStylePreset, FreeformAppearance, FreeformCardElement, FreeformCanvas, TCGCardTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AVAILABLE_FONTS,
  CARD_BORDER_STYLES,
  DIMENSION_UNITS,
  FRAME_STYLES,
  PADDING_OPTIONS,
  TCG_ASPECT_RATIO,
} from '@/lib/constants';
import { cn, replacePlaceholdersLocal, toTitleCase } from '@/lib/utils';
import { appearanceToElementRenderFields, appearanceToStyle, normalizeAppearanceForElement } from '@/lib/appearance';
import { CARD_FRAME_KITS, getFrameKitForTemplate } from '@/lib/cardFrameKits';
import { hasElementCapability, isDividerElement, SHAPE_PRIMITIVE_OPTIONS } from '@/lib/elementCapabilities';
import {
  BLANK_SHAPE_PRIMITIVES,
  BORDER_PRESET_RECIPES,
  DIVIDER_PRESET_RECIPES,
  ICON_STYLE_PRESET_RECIPES,
  SHAPE_ROLE_PRESET_RECIPES,
  TEXT_FRAME_PRESET_RECIPES,
  buildElementPresetElementUpdates,
  createFrameKitPresetRecipes,
  createRecipesFromAppearanceStyles,
  isElementPresetApplicable,
  mergeElementPresetRecipes,
  type ElementPresetRecipe,
} from '@/lib/elementPresetRecipes';
import { buildTextElementStyle } from '@/lib/textTools';
import { CardTextContent } from '@/lib/cardTextRender';
import { useAppStore } from '@/store/appStore';
import { createDefaultFreeformCanvas, getDefaultGridSizeForCanvas, reconstructFreeformCanvas, reconstructMinimalTemplate, scaleCanvasToSize } from '@/lib/templateModel';
import { useToast } from '@/hooks/use-toast';
import {
  PREDEFINED_FRAME_VISUAL_PROPERTIES,
  ICON_OPTIONS,
  makerTheme,
  elementKits,
  CONSOLIDATED_ELEMENT_KITS,
  ELEMENT_STYLE_PRESETS,
  ColorField,
  makeNewFreeformTemplate,
  mmConversion,
  clamp,
} from './makerConstants';
import { borderWidthClassToPixels, borderWidthClassToStyle, radiusClassToCss, resolveFreeformImageUrl, shapeClipPath } from '@/lib/freeformElementRender';
import {
  escapeTemplateText,
  renamePlaceholderKeyInText,
  unescapeTemplateText,
} from '@/lib/textBindings';
import { withNextStep } from '@/lib/userFacingErrors';
import { extractTemplateFieldDefinitions } from '@/lib/templateFields';
import { inferTextElementContentModel } from '@/lib/textElementContracts';
import { TemplateThumbnail } from './TemplateThumbnail';
import { CardPreview } from './CardPreview';
import { TemplateEditorTopBar } from '@/features/template-editor/components/TemplateEditorTopBar';
import { TemplateLibraryPanel } from '@/features/template-editor/components/TemplateLibraryPanel';
import { ElementLibraryPanel } from '@/features/template-editor/components/ElementLibraryPanel';
import { TemplateEditorInspectorPanel } from '@/features/template-editor/components/TemplateEditorInspectorPanel';
import { InspectorFlowSection } from '@/features/template-editor/components/InspectorFlowSection';
import { ElementTransformPanel } from '@/features/template-editor/components/ElementTransformPanel';
import { AppearanceStudioPanel } from '@/features/template-editor/components/AppearanceStudioPanel';
import { ElementAlignmentPanel } from '@/features/template-editor/components/ElementAlignmentPanel';
import { ElementContentPanel } from '@/features/template-editor/components/ElementContentPanel';
import { IconInspectorPanel } from '@/features/template-editor/components/IconInspectorPanel';
import { ShapeInspectorPanel } from '@/features/template-editor/components/ShapeInspectorPanel';
import { DividerStudioPanel } from '@/features/template-editor/components/DividerStudioPanel';
import { TypographyInspectorPanel } from '@/features/template-editor/components/TypographyInspectorPanel';
import { ImageInspectorPanel } from '@/features/template-editor/components/ImageInspectorPanel';
import { BorderInspectorPanel } from '@/features/template-editor/components/BorderInspectorPanel';
import { LayerTreePanel } from '@/features/template-editor/components/LayerTreePanel';
import { useCanvasPointerInteractions, type ResizeHandle } from '@/features/template-editor/hooks/useCanvasPointerInteractions';
import { useTemplateEditorController } from '@/features/template-editor/hooks/useTemplateEditorController';
import { useTemplateAssetLibrary } from '@/features/template-editor/hooks/useTemplateAssetLibrary';
import { buildLayerTree } from '@/features/template-editor/lib/layerTree';

interface CardTemplateMakerProps {
  canUseProjectFiles: boolean;
  onSaveTemplate: (template: TCGCardTemplate) => string;
  templates: TCGCardTemplate[];
  defaultTemplates: TCGCardTemplate[];
  backFaceTemplates: TCGCardTemplate[];
  userTemplates: TCGCardTemplate[];
  onDeleteTemplate: (templateId: string) => void;
  onCloneTemplate: (templateId: string) => string | null;
  onExportProject: () => void;
  onImportProject: () => void;
  onLoadProject: (event: ChangeEvent<HTMLInputElement>) => void;
  onStartCheckout: () => void;
  appearanceStyles: AppearanceStylePreset[];
  onSaveAppearanceStyle: (style: AppearanceStylePreset) => string;
  onDeleteAppearanceStyle: (styleId: string) => void;
  selectedTemplateIdForEditing: string | null;
  onSelectTemplateForEditing: (templateId: string | null) => void;
  canUploadCustomAssets: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  isCheckoutStarting: boolean;
  projectFileGateMessage?: string | null;
}

const RESIZE_HANDLES: Array<{ handle: ResizeHandle; className: string; cursor: string; label: string }> = [
  { handle: 'n', className: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'ns-resize', label: 'Resize selected element vertically from center' },
  { handle: 's', className: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2', cursor: 'ns-resize', label: 'Resize selected element vertically from center' },
  { handle: 'e', className: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2', cursor: 'ew-resize', label: 'Resize selected element horizontally from center' },
  { handle: 'w', className: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize', label: 'Resize selected element horizontally from center' },
  { handle: 'nw', className: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'nwse-resize', label: 'Resize selected element from center' },
  { handle: 'ne', className: 'right-0 top-0 -translate-y-1/2 translate-x-1/2', cursor: 'nesw-resize', label: 'Resize selected element from center' },
  { handle: 'sw', className: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2', cursor: 'nesw-resize', label: 'Resize selected element from center' },
  { handle: 'se', className: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2', cursor: 'nwse-resize', label: 'Resize selected element from center' },
];

const DEFAULT_BACK_TEMPLATE_ID = 'default-obsidian-neon-card-back';

export function CardTemplateMaker({
  canUseProjectFiles,
  onSaveTemplate,
  templates,
  defaultTemplates,
  backFaceTemplates,
  userTemplates,
  onDeleteTemplate,
  onCloneTemplate,
  onExportProject,
  onImportProject,
  onLoadProject,
  onStartCheckout,
  appearanceStyles,
  onSaveAppearanceStyle,
  onDeleteAppearanceStyle,
  selectedTemplateIdForEditing,
  onSelectTemplateForEditing,
  canUploadCustomAssets,
  fileInputRef,
  isCheckoutStarting,
  projectFileGateMessage,
}: CardTemplateMakerProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const bgImageInputRef = useRef<HTMLInputElement | null>(null);
  const borderImageInputRef = useRef<HTMLInputElement | null>(null);
  const variableKeyInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const variableCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const freeformTemplates = templates;
  const initialTemplate = useMemo(() => {
    const selected = templates.find(template => template.id === selectedTemplateIdForEditing);
    return reconstructMinimalTemplate(selected || freeformTemplates[0] || makeNewFreeformTemplate());
  }, [freeformTemplates, selectedTemplateIdForEditing, templates]);

  const {
    activeFace,
    canvas,
    checkedLayerIds,
    clearCheckedLayers,
    commitTemplate,
    createBackFace: createBackFaceInController,
    currentTemplate,
    deleteSelected: deleteSelectedInController,
    duplicateSelected: duplicateSelectedInController,
    future,
    groupChecked: groupCheckedInController,
    history,
    moveSelectionByDelta,
    recordTemplateHistory,
    redo,
    reorderLayer,
    resetTemplate,
    selectedElement,
    selectedElementId,
    selectElement: selectElementInController,
    setActiveFace,
    setSelectedElementId,
    toggleCheckedLayer,
    undo,
    ungroupSelected: ungroupSelectedInController,
    updateCanvas,
    updateElement,
    updateTemplate,
    arrangeSelected: arrangeSelectedInController,
  } = useTemplateEditorController(initialTemplate);
  const [activeInspectorTab, setActiveInspectorTab] = useState<string>('element');
  const [activeVariableKey, setActiveVariableKey] = useState<string | null>(null);
  const frameKitsForCurrentTemplate = useMemo(() => {
    const recommendedKit = getFrameKitForTemplate(currentTemplate.id);
    return recommendedKit
      ? [recommendedKit, ...CARD_FRAME_KITS.filter((kit) => kit.id !== recommendedKit.id)]
      : CARD_FRAME_KITS;
  }, [currentTemplate.id]);

  const frameKitRecipesForCurrentTemplate = useMemo(
    () => createFrameKitPresetRecipes(frameKitsForCurrentTemplate),
    [frameKitsForCurrentTemplate]
  );

  const selectElement = useCallback((id: string | null) => {
    selectElementInController(id);
    if (id !== null) {
      setActiveInspectorTab('element');
      requestAnimationFrame(() => {
        canvasRef.current?.focus();
      });
    }
  }, [selectElementInController]);
  const [zoom, setZoom] = useState(0.62);
  const [autoFitCanvas, setAutoFitCanvas] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [customWidthValue, setCustomWidthValue] = useState('');
  const [customHeightValue, setCustomHeightValue] = useState('');
  const [customUnit, setCustomUnit] = useState('mm');
  // Layers panel state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [layerDragId, setLayerDragId] = useState<string | null>(null);
  const [layerDropTarget, setLayerDropTarget] = useState<{ id: string; pos: 'before' | 'after' | 'child' } | null>(null);
  const sortedElements = useMemo(() => [...(canvas.elements || [])].sort((a, b) => b.zIndex - a.zIndex), [canvas.elements]);
  const gridSize = canvas.gridSize || 20;
  const selectedElementIsDivider = isDividerElement(selectedElement);
  const richTextHighlightColor = useAppStore((state) => state.richTextHighlightColor);
  const setRichTextHighlightColorAction = useAppStore((state) => state.setRichTextHighlightColor);
  const canUseBackgroundTexture = hasElementCapability(selectedElement, 'texture');
  const canUseTypography = hasElementCapability(selectedElement, 'typography');
  const canUseIconLibrary = hasElementCapability(selectedElement, 'icon');
  const canUseShapeControls = hasElementCapability(selectedElement, 'shape');
  const canUseDividerControls = hasElementCapability(selectedElement, 'divider');
  const canUseImageSource = hasElementCapability(selectedElement, 'image');
  const canUseElementBorder = hasElementCapability(selectedElement, 'border') && !canUseDividerControls;
  const canUseAppearanceStudio = Boolean(selectedElement && selectedElement.type !== 'image');
  const {
    assetSearch,
    compatibleDividerAssets,
    compatibleIconAssets,
    compatibleImageAssets,
    compatibleTextureAssets,
    handleAssetUpload,
    setAssetSearch,
  } = useTemplateAssetLibrary({
    selectedElement,
    canUseBackgroundTexture,
    canUploadCustomAssets,
    toast,
  });
  const groupedElementKits = useMemo(() => {
    const groups: Record<string, typeof elementKits> = {
      Core: [],
      'Card Parts': [],
      Ornaments: [],
    };
    CONSOLIDATED_ELEMENT_KITS.forEach(item => groups[item.category].push(item));
    return groups;
  }, []);
  const elementLibrarySections = useMemo(() => (
    Object.keys(groupedElementKits).map((category) => ({
      category,
      items: groupedElementKits[category].map((item) => ({
        ...item,
        dragKitIndex: CONSOLIDATED_ELEMENT_KITS.findIndex((kit) => kit.label === item.label),
      })),
    }))
  ), [groupedElementKits]);
  const selectedAppearance = useMemo(
    () => selectedElement ? normalizeAppearanceForElement(selectedElement) : undefined,
    [selectedElement]
  );
  const compatibleAppearanceStyles = useMemo(() => {
    if (!selectedElement) return [];
    const elementTarget = isDividerElement(selectedElement) ? 'divider' : selectedElement.type;
    const byId = new Map<string, AppearanceStylePreset>();
    appearanceStyles.forEach(style => {
      if (style.targets.includes(elementTarget) && !byId.has(style.id)) {
        byId.set(style.id, style);
      }
    });
    return Array.from(byId.values());
  }, [appearanceStyles, selectedElement]);
  const registryElementPresetRecipes = useMemo(
    () => createRecipesFromAppearanceStyles(appearanceStyles),
    [appearanceStyles]
  );
  const selectedElementPresetRecipeGroups = useMemo(() => {
    if (!selectedElement) {
      return {
        border: [] as ElementPresetRecipe[],
        divider: [] as ElementPresetRecipe[],
        icon: [] as ElementPresetRecipe[],
        shapeRole: [] as ElementPresetRecipe[],
        textFrame: [] as ElementPresetRecipe[],
      };
    }
    const applicableRegistryRecipes = registryElementPresetRecipes.filter((preset) => isElementPresetApplicable(preset, selectedElement));
    return {
      border: mergeElementPresetRecipes(
        BORDER_PRESET_RECIPES,
        applicableRegistryRecipes.filter((preset) => preset.kind === 'borderTreatment'),
      ),
      divider: mergeElementPresetRecipes(
        DIVIDER_PRESET_RECIPES,
        applicableRegistryRecipes.filter((preset) => preset.kind === 'dividerRecipe'),
      ),
      icon: mergeElementPresetRecipes(
        ICON_STYLE_PRESET_RECIPES,
        applicableRegistryRecipes.filter((preset) => preset.kind === 'iconStyle'),
      ),
      shapeRole: mergeElementPresetRecipes(
        SHAPE_ROLE_PRESET_RECIPES,
        applicableRegistryRecipes.filter((preset) => preset.kind === 'shapeRole'),
      ),
      textFrame: mergeElementPresetRecipes(
        TEXT_FRAME_PRESET_RECIPES,
        applicableRegistryRecipes.filter((preset) => preset.kind === 'textFrame'),
      ),
    };
  }, [registryElementPresetRecipes, selectedElement]);
  const templateFieldDefinitions = useMemo(() => extractTemplateFieldDefinitions(currentTemplate), [currentTemplate]);
  const textTemplateFields = useMemo(() => templateFieldDefinitions.filter(field => !field.isImage), [templateFieldDefinitions]);
  const selectedElementTemplateFields = useMemo(
    () => selectedElement?.type === 'text'
      ? textTemplateFields.filter((field) => field.sourceElementId === selectedElement.id)
      : [],
    [selectedElement, textTemplateFields]
  );
  useEffect(() => {
    setActiveVariableKey(null);
  }, [selectedElement?.id]);

  useEffect(() => {
    if (!autoFitCanvas || !stageRef.current) return;
    const updateFit = () => {
      const width = stageRef.current?.clientWidth || 0;
      const height = stageRef.current?.clientHeight || 0;
      if (!width || !height) return;
      const fitted = Math.min((width - 72) / canvas.width, (height - 72) / canvas.height, 0.76);
      setZoom(clamp(Math.round(fitted * 100) / 100, 0.28, 0.76));
    };
    updateFit();
    const observer = new ResizeObserver(updateFit);
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [autoFitCanvas, canvas.height, canvas.width]);

  // ── Layer tree helpers ─────────────────────────────────────────────────────
  const layerTree = useMemo(() => buildLayerTree(canvas.elements), [canvas.elements]);

  const createBackFace = useCallback(() => {
    const sourceCanvas = currentTemplate.freeformCanvas || createDefaultFreeformCanvas();
    const presetTemplate = templates.find((template) => template.id === DEFAULT_BACK_TEMPLATE_ID);
    const presetCanvas = presetTemplate?.freeformCanvas || createDefaultFreeformCanvas({
      elements: [],
    });
    const nextBackCanvas = scaleCanvasToSize(presetCanvas, sourceCanvas.width, sourceCanvas.height);
    createBackFaceInController(nextBackCanvas);
    toast({
      title: 'Back face added',
      description: 'The optional back face starts from the dark fantasy default back template and can now be edited.',
    });
  }, [createBackFaceInController, currentTemplate.freeformCanvas, templates, toast]);

  // ── Group / ungroup ─────────────────────────────────────────────────────
  const livePreviewData = useMemo(() => ({
    cardName: 'Astral Relic',
    cost: '3',
    rulesText: 'When Astral Relic enters play, draw a card. If you control an icon, gain 2 focus.',
    artworkUrl: 'https://placehold.co/600x400.png?text=Astral+Relic',
    ...(currentTemplate.templatePreviewData || {}),
  }), [currentTemplate.templatePreviewData]);

  const updateElementAppearance = useCallback((elementId: string, updater: (appearance: FreeformAppearance) => FreeformAppearance, trackHistory = true) => {
    const element = canvas.elements.find(item => item.id === elementId);
    if (!element) return;
    const appearance = updater(normalizeAppearanceForElement(element));
    const nextElement = { ...element, appearance };
    updateElement(elementId, { appearance, ...appearanceToElementRenderFields(nextElement) }, trackHistory);
  }, [canvas.elements, updateElement]);

  const upsertFieldContract = useCallback((
    key: string,
    updates: Partial<NonNullable<TCGCardTemplate['fieldContracts']>[number]>
  ) => {
    const cleanKey = key.trim();
    if (!cleanKey) return;
    commitTemplate((template) => {
      const contracts = [...(template.fieldContracts || [])];
      const scopedElementId = typeof updates.elementId === 'string' && updates.elementId.trim() !== ''
        ? updates.elementId.trim()
        : undefined;
      const index = contracts.findIndex((contract) =>
        contract.key === cleanKey && (!scopedElementId || contract.elementId === scopedElementId)
      );
      const nextContract = {
        key: cleanKey,
        ...(index >= 0 ? contracts[index] : {}),
        ...updates,
      };
      if (index >= 0) contracts[index] = nextContract;
      else contracts.push(nextContract);
      return {
        ...template,
        fieldContracts: contracts,
      };
    }, false);
  }, [commitTemplate]);

  const focusVariableCard = useCallback((key: string) => {
    setActiveVariableKey(key);
    requestAnimationFrame(() => {
      variableCardRefs.current[key]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      variableKeyInputRefs.current[key]?.focus();
      variableKeyInputRefs.current[key]?.select();
    });
  }, []);

  const renameSelectedElementVariable = useCallback((oldKey: string, nextKeyRaw: string) => {
    if (!selectedElement || selectedElement.type !== 'text') return;
    const nextKey = nextKeyRaw.trim().replace(/[^\w.-]/g, '');
    if (!nextKey || oldKey === nextKey) return;

    const hasConflict = (currentTemplate.fieldContracts || []).some((contract) =>
      contract.elementId === selectedElement.id && contract.key === nextKey && contract.key !== oldKey
    );
    if (hasConflict) {
      toast({
        title: 'Variable name already used',
        description: `This element already has a variable named "${nextKey}". Choose a different name.`,
        variant: 'destructive',
      });
      focusVariableCard(oldKey);
      return;
    }

    commitTemplate((template) => {
      const nextContracts = (template.fieldContracts || []).map((contract) =>
        contract.elementId === selectedElement.id && contract.key === oldKey
          ? { ...contract, key: nextKey, label: toTitleCase(nextKey) }
          : contract
      );
      const activeCanvas = (activeFace === 'back' ? template.backCanvas : template.freeformCanvas) || canvas;
      const nextElements = (activeCanvas.elements || []).map((element) =>
        element.id === selectedElement.id
          ? { ...element, content: renamePlaceholderKeyInText(element.content || '', oldKey, nextKey) }
          : element
      );
      return {
        ...template,
        fieldContracts: nextContracts,
        [activeFace === 'back' ? 'backCanvas' : 'freeformCanvas']: reconstructFreeformCanvas({
          ...activeCanvas,
          elements: nextElements,
        }),
      };
    }, false);

    focusVariableCard(nextKey);
  }, [canvas, commitTemplate, currentTemplate.fieldContracts, focusVariableCard, selectedElement, toast]);

  const removeSelectedElementVariableContract = useCallback((key: string) => {
    if (!selectedElement) return;
    commitTemplate((template) => ({
      ...template,
      fieldContracts: (template.fieldContracts || []).filter((contract) =>
        !(contract.key === key && contract.elementId === selectedElement.id)
      ),
    }), false);
    setActiveVariableKey(null);
  }, [commitTemplate, selectedElement]);

  const getNextScopedVariableKey = useCallback((existingKey?: string) => {
    if (!selectedElement) return '';
    const elementSlug = (selectedElement.name || 'text')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 20) || 'text';
    const existingContractsForElement = (currentTemplate.fieldContracts || []).filter(
      (contract) => contract.elementId === selectedElement.id
    );
    return existingKey || `${elementSlug}_var_${existingContractsForElement.length + 1}`;
  }, [currentTemplate.fieldContracts, selectedElement]);

  const createEditorVariableFromSelection = useCallback((selectedText: string, existingKey?: string): string | undefined => {
    if (!selectedElement || selectedElement.type !== 'text') return;
    const cleanSelectedText = selectedText.trim();
    if (!cleanSelectedText) {
      toast({
        title: 'Select text first',
        description: 'Highlight the text you want to turn into a variable, then use the variable button.',
      });
      return;
    }

    const nextKey = getNextScopedVariableKey(existingKey);
    if (!nextKey) return;

    const inferredType = inferTextElementContentModel(currentTemplate, selectedElement);
    upsertFieldContract(nextKey, {
      key: nextKey,
      elementId: selectedElement.id,
      label: toTitleCase(nextKey),
      type: inferredType === 'rulesBlocks' ? 'rules' : 'richText',
      required: false,
      multiline: cleanSelectedText.includes('\n'),
      example: cleanSelectedText,
    });
    toast({
      title: 'Variable created',
      description: `"${nextKey}" was added to this text element. You can adjust its rich text behavior below.`,
    });
    focusVariableCard(nextKey);
    return nextKey;
  }, [currentTemplate, focusVariableCard, getNextScopedVariableKey, selectedElement, toast, upsertFieldContract]);

  const applyAppearancePreset = useCallback((style: AppearanceStylePreset) => {
    if (!selectedElement) return;
    const nextElement = { ...selectedElement, appearance: style.appearance };
    updateElement(selectedElement.id, { appearance: style.appearance, ...appearanceToElementRenderFields(nextElement) });
  }, [selectedElement, updateElement]);

  const applyElementPresetRecipe = useCallback((recipe: ElementPresetRecipe) => {
    if (recipe.templateUpdates) {
      updateTemplate(recipe.templateUpdates);
      return;
    }
    if (!selectedElement) return;

    updateElement(selectedElement.id, buildElementPresetElementUpdates(recipe, selectedElement));
  }, [selectedElement, updateElement, updateTemplate]);

  // ── Group / ungroup ───────────────────────────────────────────────────────
  const groupChecked = useCallback(() => {
    const result = groupCheckedInController(nanoid);
    if (!result.changed) return;
    selectElement(result.selectedElementId);
  }, [groupCheckedInController, selectElement]);

  const ungroupSelected = useCallback(() => {
    ungroupSelectedInController();
  }, [ungroupSelectedInController]);

  const isGroupElement = selectedElement?.type === 'shape' &&
    canvas.elements.some(e => e.parentId === selectedElement?.id);

  const saveSelectedAppearanceStyle = useCallback(() => {
    if (!selectedElement) return;
    onSaveAppearanceStyle({
      id: `style-${nanoid()}`,
      name: `${selectedElement.name || 'Element'} Style`,
      kind: isDividerElement(selectedElement) ? 'divider' : selectedElement.type === 'icon' ? 'icon' : 'material',
      targets: [isDividerElement(selectedElement) ? 'divider' : selectedElement.type],
      appearance: normalizeAppearanceForElement(selectedElement),
    });
  }, [onSaveAppearanceStyle, selectedElement]);

  const addElement = useCallback((type: FreeformCardElement['type'], placement?: { x: number; y: number }, preset: Partial<FreeformCardElement> = {}) => {
    const maxZ = Math.max(0, ...canvas.elements.map(element => element.zIndex));
    const id = nanoid();
    const base: FreeformCardElement = {
      id,
      type,
      name: type === 'text' ? 'Text Layer' : type === 'image' ? 'Image Layer' : type === 'icon' ? 'Icon Layer' : 'Shape Layer',
      x: placement?.x ?? 82,
      y: placement?.y ?? 82,
      width: type === 'text' ? 260 : type === 'icon' ? 72 : 220,
      height: type === 'text' ? 72 : type === 'icon' ? 72 : type === 'shape' ? 120 : 160,
      rotation: 0,
      opacity: 1,
      zIndex: maxZ + 1,
      locked: false,
      content: type === 'text' ? '{{newText:"New Text"}}' : type === 'image' ? 'artworkUrl' : '',
      imageSource: type === 'image' ? 'artworkUrl' : undefined,
      iconName: type === 'icon' ? 'Sparkles' : undefined,
      shapeKind: type === 'shape' ? 'rectangle' : undefined,
      textColor: '#21180d',
      backgroundColor: type === 'shape' ? 'rgba(255,255,255,0.2)' : 'transparent',
      fontFamily: 'font-sans',
      fontSize: type === 'text' ? 'text-base' : 'text-sm',
      fontSizePx: type === 'text' ? 16 : 14,
      fontWeight: type === 'text' ? 'font-semibold' : 'font-normal',
      textAlign: type === 'text' ? 'center' : 'left',
      fontStyle: 'normal',
      padding: type === 'text' ? 'p-2' : 'p-0',
      borderColor: type === 'shape' || type === 'image' ? '#c89f42' : undefined,
      borderWidth: type === 'shape' || type === 'image' ? 'border' : '_none_',
      borderRadius: type === 'shape' || type === 'image' ? 'rounded-md' : 'rounded-none',
      minHeight: '_auto_',
      imageObjectFit: 'cover',
      fillColor: type === 'icon' ? 'transparent' : type === 'shape' ? 'rgba(255,255,255,0.2)' : undefined,
      strokeColor: type === 'icon' || type === 'shape' ? '#fbbf24' : undefined,
      strokeWidth: 2,
    };
    const mergedElement: FreeformCardElement = {
      ...base,
      ...preset,
      id,
      type,
      x: placement?.x ?? preset.x ?? 82,
      y: placement?.y ?? preset.y ?? 82,
      zIndex: maxZ + 1,
    };
    const newElement: FreeformCardElement = {
      ...mergedElement,
      appearance: normalizeAppearanceForElement(mergedElement),
    };
    updateCanvas({ elements: [...canvas.elements, newElement] });
    selectElement(id);
  }, [canvas.elements, selectElement, updateCanvas]);

  const duplicateSelected = useCallback(() => {
    const result = duplicateSelectedInController(nanoid, gridSize);
    if (!result.changed) return;
    selectElement(result.selectedElementId);
  }, [duplicateSelectedInController, gridSize, selectElement]);

  const handleLayerDragOver = useCallback((elementId: string, clientY: number, rect: DOMRect) => {
    if (layerDragId === elementId) return;
    const relY = clientY - rect.top;
    const zone = rect.height / 3;
    if (relY < zone) setLayerDropTarget({ id: elementId, pos: 'before' });
    else if (relY > rect.height - zone) setLayerDropTarget({ id: elementId, pos: 'after' });
    else setLayerDropTarget({ id: elementId, pos: 'child' });
  }, [layerDragId]);

  const handleLayerDrop = useCallback(() => {
    const srcId = layerDragId;
    const tgt = layerDropTarget;
    setLayerDragId(null);
    setLayerDropTarget(null);
    if (!srcId || !tgt || srcId === tgt.id) return;
    reorderLayer(srcId, tgt.id, tgt.pos);
  }, [layerDragId, layerDropTarget, reorderLayer]);

  const deleteSelected = useCallback(() => {
    const result = deleteSelectedInController();
    if (!result.changed) {
      if (result.reason === 'locked-selection' || result.reason === 'locked-descendant') {
        toast({
          title: 'Layer locked',
          description: result.reason === 'locked-descendant'
            ? 'Unlock child layers before deleting this group.'
            : 'Unlock this layer before deleting it.',
        });
      }
      return;
    }
  }, [deleteSelectedInController, toast]);

  const arrangeSelected = useCallback((direction: 'front' | 'back' | 'up' | 'down') => {
    arrangeSelectedInController(direction);
  }, [arrangeSelectedInController]);

  const alignSelected = useCallback((alignment: 'left' | 'center' | 'right') => {
    if (!selectedElement) return;
    const nextX = alignment === 'left' ? 32 : alignment === 'center' ? (canvas.width - selectedElement.width) / 2 : canvas.width - selectedElement.width - 32;
    updateElement(selectedElement.id, { x: Math.round(nextX) });
  }, [canvas.width, selectedElement, updateElement]);

  const snapValue = useCallback((value: number) => snapToGrid ? Math.round(value / gridSize) * gridSize : Math.round(value), [gridSize, snapToGrid]);
  const {
    clearDepthSelection,
    getCanvasPoint,
    handleElementPointerDown,
    handlePointerMove,
    handlePointerUp,
    handleResizePointerDown,
  } = useCanvasPointerInteractions({
    canvas,
    canvasRef,
    currentTemplate,
    previewMode,
    recordTemplateHistory,
    selectedElementId,
    selectElement,
    snapValue,
    updateCanvas,
    zoom,
  });

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/cardforge-element') as FreeformCardElement['type'];
    if (!type) return;
    const kitIndex = Number(event.dataTransfer.getData('application/cardforge-kit-index'));
    const serializedPreset = event.dataTransfer.getData('application/cardforge-preset');
    const preset = serializedPreset
      ? JSON.parse(serializedPreset) as Partial<FreeformCardElement>
      : Number.isFinite(kitIndex) ? CONSOLIDATED_ELEMENT_KITS[kitIndex]?.preset : undefined;
    const point = getCanvasPoint(event);
    addElement(type, { x: snapValue(point.x), y: snapValue(point.y) }, preset);
  }, [addElement, getCanvasPoint, snapValue]);

  const handleCanvasKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selectedElement) return;
    const step = event.shiftKey ? gridSize : 1;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      deleteSelected();
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      moveSelectionByDelta(dx, dy);
    }
  }, [deleteSelected, gridSize, moveSelectionByDelta, selectedElement]);

  const handleSave = useCallback(() => {
    if (!currentTemplate.name?.trim() || currentTemplate.name === 'New Card Template') {
      toast({
        title: 'Template name is required',
        description: withNextStep('Template name must be set before saving.', 'Enter a template name in Template Settings, then save again.'),
        variant: 'destructive',
      });
      return;
    }
    const parts = currentTemplate.aspectRatio.split(':').map(Number);
    if (parts.length !== 2 || parts.some(part => !part || part <= 0 || Number.isNaN(part))) {
      toast({
        title: 'Aspect ratio format is invalid',
        description: withNextStep('Aspect Ratio must use W:H with positive numbers (example: 63:88).', 'Correct the Aspect Ratio field, then save again.'),
        variant: 'destructive',
      });
      return;
    }
    const savedId = onSaveTemplate({
      ...currentTemplate,
      freeformCanvas: reconstructFreeformCanvas(currentTemplate.freeformCanvas),
      backCanvas: currentTemplate.backCanvas ? reconstructFreeformCanvas(currentTemplate.backCanvas) : undefined,
    });
    onSelectTemplateForEditing(savedId);
  }, [currentTemplate, onSaveTemplate, onSelectTemplateForEditing, toast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const isTyping = !!target && (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
        || target.isContentEditable
        || Boolean(target.closest('[contenteditable="true"], .ProseMirror, [role="textbox"]'))
      );
      const mod = event.ctrlKey || event.metaKey;

      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSave();
        return;
      }
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      if (isTyping) return;
      if (event.key === 'Escape') setSelectedElementId(null);
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedElementId) {
        event.preventDefault();
        deleteSelected();
      }
      if (event.key.toLowerCase() === 'g') setShowGrid(value => !value);
      if (event.key.toLowerCase() === 'p') setPreviewMode(value => !value);
      if (event.key === '+' || event.key === '=') {
        setAutoFitCanvas(false);
        setZoom(value => clamp(Math.round((value + 0.08) * 100) / 100, 0.28, 1.2));
      }
      if (event.key === '-' || event.key === '_') {
        setAutoFitCanvas(false);
        setZoom(value => clamp(Math.round((value - 0.08) * 100) / 100, 0.28, 1.2));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteSelected, duplicateSelected, handleSave, redo, selectedElementId, undo]);

  const handleNewTemplate = useCallback(() => {
    const fresh = makeNewFreeformTemplate();
    resetTemplate(fresh);
    onSelectTemplateForEditing(null);
  }, [onSelectTemplateForEditing, resetTemplate]);

  const openTemplate = useCallback((template: TCGCardTemplate) => {
    if (!template.id) return;
    onSelectTemplateForEditing(template.id);
    resetTemplate(template);
  }, [onSelectTemplateForEditing, resetTemplate]);

  const handleClone = useCallback(() => {
    if (!currentTemplate.id) return;
    const newId = onCloneTemplate(currentTemplate.id);
    if (newId) onSelectTemplateForEditing(newId);
  }, [currentTemplate.id, onCloneTemplate, onSelectTemplateForEditing]);

  const handleApplyFrameStyle = useCallback((frameStyle: string) => {
    updateTemplate({
      ...(PREDEFINED_FRAME_VISUAL_PROPERTIES[frameStyle] || {}),
      frameStyle,
    });
  }, [updateTemplate]);

  const handleApplyCustomDimensions = useCallback(() => {
    const width = parseFloat(customWidthValue);
    const height = parseFloat(customHeightValue);
    if (!width || !height || width <= 0 || height <= 0) {
      toast({
        title: 'Dimensions are invalid',
        description: withNextStep('Width and height must be positive numbers.', 'Update Width and Height values, then apply dimensions again.'),
        variant: 'destructive',
      });
      return;
    }
    const factor = mmConversion[customUnit] ?? 1;
    const widthMm = Math.round(width * factor * 100) / 100;
    const heightMm = Math.round(height * factor * 100) / 100;
    const nextCanvasWidth = Math.round(widthMm * 10);
    const nextCanvasHeight = Math.round(heightMm * 10);
    const nextGridSize = getDefaultGridSizeForCanvas(nextCanvasWidth, nextCanvasHeight);
    updateTemplate({
      aspectRatio: `${widthMm}:${heightMm}`,
      freeformCanvas: reconstructFreeformCanvas({
        ...(currentTemplate.freeformCanvas || createDefaultFreeformCanvas()),
        width: nextCanvasWidth,
        height: nextCanvasHeight,
        gridSize: nextGridSize,
      }),
      backCanvas: currentTemplate.backCanvas
        ? reconstructFreeformCanvas({
            ...currentTemplate.backCanvas,
            width: nextCanvasWidth,
            height: nextCanvasHeight,
            gridSize: nextGridSize,
          })
        : undefined,
    });
  }, [currentTemplate.backCanvas, currentTemplate.freeformCanvas, customHeightValue, customUnit, customWidthValue, toast, updateTemplate]);

  const resetGridToTemplateDefault = useCallback(() => {
    const nextGridSize = getDefaultGridSizeForCanvas(canvas.width, canvas.height);
    updateCanvas({ gridSize: nextGridSize });
  }, [canvas.height, canvas.width, updateCanvas]);

  const handleFileUpload = useCallback((event: ChangeEvent<HTMLInputElement>, apply: (dataUri: string) => void) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      apply(loadEvent.target?.result as string);
      toast({ title: 'Image Uploaded', description: `${file.name} loaded.` });
    };
    reader.onerror = () => toast({ title: 'Upload Error', description: 'Failed to read the selected image.', variant: 'destructive' });
    reader.readAsDataURL(file);
    event.target.value = '';
  }, [toast]);

  const renderEditableElement = (element: FreeformCardElement) => {
    if (element.visible === false) return null;
    const selected = selectedElementId === element.id;
    const borderWidth = borderWidthClassToPixels(element.borderWidth);
    const resolvedBg = element.backgroundImageUrl ? replacePlaceholdersLocal(element.backgroundImageUrl, livePreviewData, false) : '';
    const structuredAppearanceStyle = appearanceToStyle(normalizeAppearanceForElement(element));
    const elementIsDivider = isDividerElement(element);
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: element.x,
      top: element.y,
      width: element.width,
      height: element.height,
      transform: `rotate(${element.rotation || 0}deg)${element.appearance?.assetFlipX ? ' scaleX(-1)' : ''}`,
      transformOrigin: 'center',
      opacity: element.opacity ?? 1,
      zIndex: element.zIndex,
      color: element.textColor || currentTemplate.baseTextColor || undefined,
      backgroundColor: element.backgroundColor || 'transparent',
      backgroundImage: resolvedBg && (resolvedBg.startsWith('linear-gradient') || resolvedBg.startsWith('radial-gradient'))
        ? resolvedBg
        : resolvedBg && (resolvedBg.startsWith('http') || resolvedBg.startsWith('data:'))
          ? `url(${resolvedBg})`
          : undefined,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      borderStyle: borderWidth > 0 ? 'solid' : undefined,
      borderColor: element.borderColor || currentTemplate.defaultElementBorderColor || undefined,
      borderRadius: radiusClassToCss(element.borderRadius) || element.borderRadius || undefined,
      ...borderWidthClassToStyle(element.borderWidth),
      boxSizing: 'border-box',
      overflow: 'hidden',
      cursor: previewMode || element.locked ? 'default' : 'move',
      ...structuredAppearanceStyle,
    };

    let body;
    if (element.type === 'image') {
      const imageUrl = resolveFreeformImageUrl(element, livePreviewData, 'Artwork');
      body = <img src={imageUrl} alt={element.name} className="block h-full w-full max-h-full max-w-full" style={{ minWidth: 0, minHeight: 0, objectFit: element.imageObjectFit || 'cover', objectPosition: 'center', borderRadius: 'inherit' }} draggable={false} />;
    } else if (element.type === 'icon') {
      const iconImageUrl = element.iconImageSource ? replacePlaceholdersLocal(element.iconImageSource, livePreviewData, false) : '';
      if (iconImageUrl && (iconImageUrl.startsWith('http') || iconImageUrl.startsWith('data:') || iconImageUrl.startsWith('/'))) {
        body = <img src={iconImageUrl} alt={element.name} className="block h-full w-full max-h-full max-w-full" style={{ minWidth: 0, minHeight: 0, objectFit: 'contain', objectPosition: 'center', borderRadius: 'inherit' }} draggable={false} />;
      } else {
        const IconComponent = (LucideIcons as unknown as Record<string, React.ElementType>)[element.iconName || 'Sparkles'] || Sparkles;
        body = <IconComponent size="78%" color={element.strokeColor || element.textColor || 'currentColor'} fill={element.fillColor || 'none'} strokeWidth={element.strokeWidth || 2} />;
      }
    } else if (element.type === 'shape') {
      body = null;
      baseStyle.backgroundColor = element.fillColor || element.backgroundColor || 'transparent';
      baseStyle.borderColor = element.strokeColor || element.borderColor || undefined;
      baseStyle.borderWidth = element.strokeWidth !== undefined ? element.strokeWidth : baseStyle.borderWidth;
      baseStyle.borderRadius = (element.shapeKind === 'ellipse' || element.shapeKind === 'capsule') ? '9999px' : baseStyle.borderRadius;
      baseStyle.clipPath = elementIsDivider ? undefined : shapeClipPath(element.shapeKind);
      if (elementIsDivider) {
        baseStyle.height = Math.max(element.height || 0, element.strokeWidth || 2, 2);
        baseStyle.backgroundColor = 'transparent';
        baseStyle.borderWidth = 0;
      }
      Object.assign(baseStyle, structuredAppearanceStyle);
    } else {
      body = (
        <CardTextContent
          template={currentTemplate}
          element={element}
          data={livePreviewData}
          highlightColor={richTextHighlightColor}
          style={{ lineHeight: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', textDecoration: 'inherit', fontStyle: 'inherit' }}
        />
      );
    }

    const textElementStyle = element.type === 'text' ? buildTextElementStyle(element) : null;
    const renderedTextStyle = element.type === 'text' && textElementStyle
      ? { ...textElementStyle, fontSize: undefined as unknown as React.CSSProperties['fontSize'] }
      : null;

    return (
      <div
        key={element.id}
        data-freeform-element-id={element.id}
        data-selected={selected ? 'true' : 'false'}
        data-element-locked={element.locked ? 'true' : 'false'}
        className={cn(
          element.type === 'text' && [element.padding || 'p-1', element.fontFamily || 'font-sans', element.fontWeight || 'font-normal'],
          element.type === 'text' && 'whitespace-pre-wrap break-words',
          element.type === 'icon' && 'flex items-center justify-center',
          selected && !previewMode && 'outline outline-2 outline-offset-2 outline-[#d5ad54]',
          element.locked && 'cursor-not-allowed'
        )}
        style={{
          ...baseStyle,
          ...renderedTextStyle,
        }}
        onPointerDown={(event) => handleElementPointerDown(event, element)}
      >
        {body}
        {selected && !previewMode && !element.locked && (
          <>
            {RESIZE_HANDLES.map((resizeHandle) => (
              <button
                key={resizeHandle.handle}
                type="button"
                aria-label={resizeHandle.label}
                className={cn(
                  'absolute h-3.5 w-3.5 rounded-[2px] border border-[#d5ad54] bg-[#090b0f] shadow-[0_0_12px_rgba(213,173,84,0.45)]',
                  resizeHandle.className
                )}
                style={{ cursor: resizeHandle.cursor }}
                onPointerDown={(event) => handleResizePointerDown(event, element, resizeHandle.handle)}
              />
            ))}
          </>
        )}
      </div>
    );
  };

  const canvasFrameStyle: React.CSSProperties = {
    width: canvas.width,
    height: canvas.height,
    transform: `scale(${zoom})`,
    transformOrigin: 'top left',
  };

  const canvasStyle: React.CSSProperties = {
    ...canvasFrameStyle,
    width: canvas.width,
    height: canvas.height,
    backgroundColor: currentTemplate.baseBackgroundColor || '#ffffff',
    color: currentTemplate.baseTextColor || '#000000',
    borderColor: currentTemplate.cardBorderColor || 'hsl(var(--border))',
    borderWidth: currentTemplate.cardBorderWidth || '4px',
    borderStyle: currentTemplate.cardBorderStyle && currentTemplate.cardBorderStyle !== '_default_' ? currentTemplate.cardBorderStyle : 'solid',
    borderRadius: currentTemplate.cardBorderRadius || '0.5rem',
    backgroundImage: currentTemplate.cardBackgroundImageUrl ? `url(${replacePlaceholdersLocal(currentTemplate.cardBackgroundImageUrl, livePreviewData, false)})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
  };

  return (
    <TooltipProvider>
      <div className={cn('min-h-[calc(100vh-145px)] overflow-hidden rounded-[10px] border', makerTheme.shell)}>
        <TemplateEditorTopBar
          activeFace={activeFace}
          hasBackFace={Boolean(currentTemplate.backCanvas)}
          canUndo={history.length > 0}
          canRedo={future.length > 0}
          showGrid={showGrid}
          snapToGrid={snapToGrid}
          previewMode={previewMode}
          onUndo={undo}
          onRedo={redo}
          onZoomOut={() => {
            setAutoFitCanvas(false);
            setZoom(value => clamp(Math.round((value - 0.08) * 100) / 100, 0.28, 1.2));
          }}
          onZoomIn={() => {
            setAutoFitCanvas(false);
            setZoom(value => clamp(Math.round((value + 0.08) * 100) / 100, 0.28, 1.2));
          }}
          onFitToScreen={() => setAutoFitCanvas(true)}
          onCreateBackFace={createBackFace}
          onSetActiveFace={setActiveFace}
          onToggleGrid={() => setShowGrid(value => !value)}
          onToggleSnapToGrid={() => setSnapToGrid(value => !value)}
          onTogglePreviewMode={() => setPreviewMode(value => !value)}
          onSave={handleSave}
          toolButtonClassName={makerTheme.toolButton}
          activeButtonClassName={makerTheme.activeButton}
        />

        <div className="grid min-h-[calc(100vh-205px)] min-w-0 grid-cols-1 lg:grid-cols-[240px_minmax(320px,1fr)_300px] xl:grid-cols-[280px_minmax(420px,1fr)_330px] 2xl:grid-cols-[300px_minmax(520px,1fr)_360px]">
          <aside className="min-w-0 border-b border-[#252b35] bg-[#0d1117] lg:border-b-0 lg:border-r">
            <ScrollArea className="h-[calc(100vh-205px)] min-h-[760px]">
              <div className="space-y-3 p-2">
                <TemplateLibraryPanel
                  canUseProjectFiles={canUseProjectFiles}
                  currentTemplateId={currentTemplate.id}
                  defaultTemplates={defaultTemplates}
                  backFaceTemplates={backFaceTemplates}
                  fileInputRef={fileInputRef}
                  isCheckoutStarting={isCheckoutStarting}
                  projectFileGateMessage={projectFileGateMessage}
                  userTemplates={userTemplates}
                  onCreateNew={handleNewTemplate}
                  onClone={handleClone}
                  onDelete={() => currentTemplate.id && onDeleteTemplate(currentTemplate.id)}
                  onExportProject={onExportProject}
                  onImportProject={onImportProject}
                  onLoadProject={onLoadProject}
                  onStartCheckout={onStartCheckout}
                  onSelectTemplateId={onSelectTemplateForEditing}
                  onOpenTemplate={openTemplate}
                  panelClassName={makerTheme.panel}
                  controlClassName={makerTheme.control}
                  buttonClassName={makerTheme.button}
                />

                <ElementLibraryPanel
                  sections={elementLibrarySections}
                  onAddElement={(type, preset) => addElement(type, undefined, preset)}
                  panelClassName={makerTheme.panel}
                />

                <LayerTreePanel
                  panelClassName={makerTheme.panel}
                  elementsCount={canvas.elements.length}
                  layerTree={layerTree}
                  checkedLayerIds={checkedLayerIds}
                  collapsedGroups={collapsedGroups}
                  selectedElementId={selectedElementId}
                  layerDropTarget={layerDropTarget}
                  canUngroupSelected={isGroupElement}
                  onGroupChecked={groupChecked}
                  onUngroupSelected={ungroupSelected}
                  onClearChecked={clearCheckedLayers}
                  onSelectElement={selectElement}
                  onToggleGroupCollapsed={(elementId) => {
                    setCollapsedGroups(prev => {
                      const next = new Set(prev);
                      if (next.has(elementId)) next.delete(elementId);
                      else next.add(elementId);
                      return next;
                    });
                  }}
                  onToggleChecked={toggleCheckedLayer}
                  onDragStart={setLayerDragId}
                  onDragEnd={() => {
                    setLayerDragId(null);
                    setLayerDropTarget(null);
                  }}
                  onDragOver={handleLayerDragOver}
                  onDrop={handleLayerDrop}
                  onToggleVisibility={(element) => updateElement(element.id, { visible: element.visible === false ? true : false })}
                  onToggleLock={(element) => updateElement(element.id, { locked: !element.locked })}
                  onDuplicateSelected={duplicateSelected}
                  onDeleteSelected={deleteSelected}
                />
              </div>
            </ScrollArea>
          </aside>

          <section className="min-w-0 overflow-hidden bg-[#05080c] lg:min-h-[760px]">
            <div className="flex items-center justify-between border-b border-[#252b35] bg-[#080c12] px-3 py-1.5 text-[11px] text-[#8f95a3]">
              <span className="flex items-center gap-2"><MousePointer2 className="h-3.5 w-3.5 text-[#d5ad54]" /> Drag, snap, resize, layer, and tune every card surface.</span>
              <span className="font-mono text-[#d5ad54]">{Math.round(zoom * 100)}% / {canvas.width} x {canvas.height}</span>
            </div>
            <div
              ref={stageRef}
              data-cardforge-stage="true"
              className="relative flex h-[calc(100vh-238px)] min-h-[720px] justify-center overflow-auto bg-[#05080c] p-8"
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              {/* RULER_W=28px, GUTTER=96px of grid space around the card on all sides */}
              {(() => {
                const RULER_W = 28;
                const GUTTER = 96;
                const rulerTickBg = (axis: 'x' | 'y') => ({
                  backgroundImage: axis === 'x'
                    ? 'repeating-linear-gradient(90deg, transparent 0 19px, rgba(213,173,84,0.48) 19px 20px), repeating-linear-gradient(90deg, transparent 0 99px, rgba(213,173,84,0.9) 99px 100px)'
                    : 'repeating-linear-gradient(0deg, transparent 0 19px, rgba(213,173,84,0.48) 19px 20px), repeating-linear-gradient(0deg, transparent 0 99px, rgba(213,173,84,0.9) 99px 100px)',
                  backgroundSize: axis === 'x'
                    ? `${gridSize * zoom}px 100%, ${gridSize * 5 * zoom}px 100%`
                    : `100% ${gridSize * zoom}px, 100% ${gridSize * 5 * zoom}px`,
                });
                return (
                  <div
                    className="relative"
                    style={{
                      paddingLeft: RULER_W + GUTTER,
                      paddingTop: RULER_W + GUTTER,
                      width: RULER_W + GUTTER + canvas.width * zoom + GUTTER,
                      height: RULER_W + GUTTER + canvas.height * zoom + GUTTER,
                    }}
                  >
                    {/* Corner box */}
                    <div aria-hidden="true" className="absolute left-0 top-0 border-b border-r border-[#3b3324] bg-[#090d13]" style={{ width: RULER_W, height: RULER_W }} />

                    {/* Top ruler — extends full width including gutter on both sides */}
                    <div
                      aria-hidden="true"
                      className="absolute top-0 border-b border-[#3b3324] bg-[#090d13] shadow-[inset_0_-1px_0_rgba(213,173,84,0.18)]"
                      style={{
                        left: RULER_W,
                        height: RULER_W,
                        width: GUTTER + canvas.width * zoom + GUTTER,
                        overflow: 'visible',
                        ...rulerTickBg('x'),
                      }}
                    >
                      {(() => {
                        const labelStep = gridSize * 5;
                        const rawStep = labelStep * zoom;
                        let screenStep = rawStep;
                        while (screenStep < 24) screenStep *= 2;
                        const totalW = GUTTER + canvas.width * zoom + GUTTER;
                        const minN = Math.floor(-GUTTER / screenStep);
                        const maxN = Math.ceil((canvas.width * zoom + GUTTER) / screenStep);
                        const out: React.ReactNode[] = [];
                        for (let n = minN; n <= maxN; n++) {
                          const sx = GUTTER + n * screenStep;
                          if (sx < 0 || sx > totalW) continue;
                          const px = Math.round(n * screenStep / zoom);
                          out.push(<span key={n} style={{ position: 'absolute', left: sx + 2, top: 14, fontSize: 7, lineHeight: 1, color: n === 0 ? 'rgba(213,173,84,0.9)' : n < 0 ? 'rgba(213,173,84,0.4)' : 'rgba(213,173,84,0.65)', userSelect: 'none', pointerEvents: 'none', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{px}</span>);
                        }
                        return out;
                      })()}
                    </div>
                    {/* Card-start marker on top ruler */}
                    <div aria-hidden="true" style={{ position: 'absolute', left: RULER_W + GUTTER, top: 0, width: 1, height: RULER_W, background: 'rgba(213,173,84,0.9)' }} />
                    {/* Card-end marker on top ruler */}
                    <div aria-hidden="true" style={{ position: 'absolute', left: RULER_W + GUTTER + canvas.width * zoom, top: 0, width: 1, height: RULER_W, background: 'rgba(213,173,84,0.5)' }} />

                    {/* Left ruler — extends full height including gutter on both sides */}
                    <div
                      aria-hidden="true"
                      className="absolute left-0 border-r border-[#3b3324] bg-[#090d13] shadow-[inset_-1px_0_0_rgba(213,173,84,0.18)]"
                      style={{
                        top: RULER_W,
                        width: RULER_W,
                        height: GUTTER + canvas.height * zoom + GUTTER,
                        overflow: 'visible',
                        ...rulerTickBg('y'),
                      }}
                    >
                      {(() => {
                        const labelStep = gridSize * 5;
                        const rawStep = labelStep * zoom;
                        let screenStep = rawStep;
                        while (screenStep < 24) screenStep *= 2;
                        const totalH = GUTTER + canvas.height * zoom + GUTTER;
                        const minN = Math.floor(-GUTTER / screenStep);
                        const maxN = Math.ceil((canvas.height * zoom + GUTTER) / screenStep);
                        const out: React.ReactNode[] = [];
                        for (let n = minN; n <= maxN; n++) {
                          const sy = GUTTER + n * screenStep;
                          if (sy < 0 || sy > totalH) continue;
                          const py = Math.round(n * screenStep / zoom);
                          out.push(<span key={n} style={{ position: 'absolute', top: sy - 5, right: 3, fontSize: 7, lineHeight: 1, color: n === 0 ? 'rgba(213,173,84,0.9)' : n < 0 ? 'rgba(213,173,84,0.4)' : 'rgba(213,173,84,0.65)', userSelect: 'none', pointerEvents: 'none', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{py}</span>);
                        }
                        return out;
                      })()}
                    </div>
                    {/* Card-start marker on left ruler */}
                    <div aria-hidden="true" style={{ position: 'absolute', top: RULER_W + GUTTER, left: 0, height: 1, width: RULER_W, background: 'rgba(213,173,84,0.9)' }} />
                    {/* Card-end marker on left ruler */}
                    <div aria-hidden="true" style={{ position: 'absolute', top: RULER_W + GUTTER + canvas.height * zoom, left: 0, height: 1, width: RULER_W, background: 'rgba(213,173,84,0.5)' }} />

                    {/* Gutter grid overlay — faint grid continues into the gutter zone around the card */}
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: RULER_W,
                        top: RULER_W,
                        width: GUTTER + canvas.width * zoom + GUTTER,
                        height: GUTTER + canvas.height * zoom + GUTTER,
                        backgroundImage: showGrid
                          ? [
                              'linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
                              'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)',
                              'linear-gradient(90deg, rgba(213,173,84,0.12) 1px, transparent 1px)',
                              'linear-gradient(rgba(213,173,84,0.12) 1px, transparent 1px)',
                            ].join(', ')
                          : undefined,
                        backgroundSize: [
                          `${gridSize * zoom}px ${gridSize * zoom}px`,
                          `${gridSize * zoom}px ${gridSize * zoom}px`,
                          `${gridSize * 5 * zoom}px ${gridSize * 5 * zoom}px`,
                          `${gridSize * 5 * zoom}px ${gridSize * 5 * zoom}px`,
                        ].join(', '),
                        backgroundPosition: `${GUTTER}px ${GUTTER}px`,
                        pointerEvents: 'none',
                      }}
                    />

                    {/* Card canvas */}
                    <p id="maker-canvas-help" className="sr-only">
                      Template canvas editor. Select an element, then use arrow keys to move it. Hold Shift to move by grid size. Use Delete or Backspace to remove the selected element.
                    </p>
                    <p id="maker-selection-status" className="sr-only" role="status" aria-live="polite">
                      {selectedElement ? `Selected ${selectedElement.name || selectedElement.type} element.` : 'No element selected.'}
                    </p>
                    <div
                      ref={canvasRef}
                      data-cardforge-canvas="true"
                      tabIndex={0}
                      role="region"
                      aria-label="Template canvas"
                      aria-describedby="maker-canvas-help maker-selection-status maker-shortcuts-help"
                      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Delete Backspace Escape"
                      className="relative shadow-[0_24px_70px_rgba(0,0,0,0.75),0_0_0_1px_rgba(213,173,84,0.2)] focus:outline-none focus:ring-2 focus:ring-[#d5ad54]"
                      style={previewMode ? canvasFrameStyle : canvasStyle}
                      onKeyDown={handleCanvasKeyDown}
                      onPointerDown={() => {
                        if (previewMode) return;
                        clearDepthSelection();
                        setSelectedElementId(null);
                      }}
                    >
                      {previewMode ? (
                        <CardPreview
                          card={{ template: currentTemplate, data: livePreviewData, uniqueId: `${currentTemplate.id || 'unsaved'}-${activeFace}-editor-preview` }}
                          face={activeFace}
                          isEditorPreview
                          targetWidthPx={canvas.width}
                        />
                      ) : (
                        [...canvas.elements].sort((a, b) => a.zIndex - b.zIndex).map(renderEditableElement)
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>

          <aside className="min-w-0 border-t border-[#252b35] bg-[#0d1117] lg:border-l lg:border-t-0">
            <ScrollArea className="h-[calc(100vh-205px)] min-h-[760px]">
              <div className="space-y-3 p-2">
                <TemplateEditorInspectorPanel
                  activeTab={activeInspectorTab}
                  onActiveTabChange={setActiveInspectorTab}
                  panelClassName={makerTheme.panel}
                  hasSelectedElement={Boolean(selectedElement)}
                  selectedElementType={selectedElement?.type}
                  templateContent={
                    <>
                        <div>
                          <Label htmlFor="maker-name" className="text-xs text-[#b7bdc9]">Template Name</Label>
                          <Input id="maker-name" className={makerTheme.control} value={currentTemplate.name || ''} onChange={event => updateTemplate({ name: event.target.value }, false)} />
                        </div>
                        <div>
                          <Label htmlFor="maker-ratio" className="text-xs text-[#b7bdc9]">Aspect Ratio</Label>
                          <Input id="maker-ratio" className={makerTheme.control} value={currentTemplate.aspectRatio || TCG_ASPECT_RATIO} onChange={event => updateTemplate({ aspectRatio: event.target.value }, false)} />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label htmlFor="maker-width" className="text-xs text-[#b7bdc9]">Width</Label>
                            <Input id="maker-width" className={makerTheme.control} type="number" value={customWidthValue} onChange={event => setCustomWidthValue(event.target.value)} />
                          </div>
                          <div>
                            <Label htmlFor="maker-height" className="text-xs text-[#b7bdc9]">Height</Label>
                            <Input id="maker-height" className={makerTheme.control} type="number" value={customHeightValue} onChange={event => setCustomHeightValue(event.target.value)} />
                          </div>
                          <div>
                            <Label htmlFor="maker-unit" className="text-xs text-[#b7bdc9]">Unit</Label>
                            <Select value={customUnit} onValueChange={setCustomUnit}>
                              <SelectTrigger id="maker-unit" className={makerTheme.control}><SelectValue /></SelectTrigger>
                              <SelectContent>{DIMENSION_UNITS.map(unit => <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={handleApplyCustomDimensions} className={cn(makerTheme.button, 'w-full text-xs')}>Apply Dimensions</Button>
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <Label htmlFor="maker-grid-size" className="text-xs text-[#b7bdc9]">Grid Size (px)</Label>
                            <Button type="button" variant="outline" size="sm" onClick={resetGridToTemplateDefault} className={cn(makerTheme.button, 'h-7 px-2 text-[10px]')}>
                              Reset Grid
                            </Button>
                          </div>
                          <Input id="maker-grid-size" className={makerTheme.control} type="number" min={1} max={200} value={gridSize} onChange={event => { const v = Math.round(Number(event.target.value)); if (v >= 1 && v <= 200) updateCanvas({ gridSize: v }); }} />
                        </div>
                        <div>
                          <Label htmlFor="maker-frame" className="text-xs text-[#b7bdc9]">Frame Style</Label>
                          <Select value={currentTemplate.frameStyle || 'custom'} onValueChange={handleApplyFrameStyle}>
                            <SelectTrigger id="maker-frame" className={makerTheme.control}><SelectValue /></SelectTrigger>
                            <SelectContent>{FRAME_STYLES.map(style => <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="maker-bg" className="text-xs">Base Background</Label>
                            <ColorField id="maker-bg" value={currentTemplate.baseBackgroundColor || '#ffffff'} onChange={value => updateTemplate({ baseBackgroundColor: value }, false)} />
                          </div>
                          <div>
                            <Label htmlFor="maker-text" className="text-xs">Base Text</Label>
                            <ColorField id="maker-text" value={currentTemplate.baseTextColor || '#000000'} onChange={value => updateTemplate({ baseTextColor: value }, false)} />
                          </div>
                          <div>
                            <Label htmlFor="maker-border-color" className="text-xs">Border Color</Label>
                            <ColorField id="maker-border-color" value={currentTemplate.cardBorderColor || '#c89f42'} onChange={value => updateTemplate({ cardBorderColor: value }, false)} />
                          </div>
                          <div>
                            <Label htmlFor="maker-element-border" className="text-xs">Default Element Border</Label>
                            <ColorField id="maker-element-border" value={currentTemplate.defaultElementBorderColor || '#c89f42'} onChange={value => updateTemplate({ defaultElementBorderColor: value }, false)} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="maker-border-width" className="text-xs">Border Width</Label>
                            <Input id="maker-border-width" value={currentTemplate.cardBorderWidth || ''} onChange={event => updateTemplate({ cardBorderWidth: event.target.value }, false)} />
                          </div>
                          <div>
                            <Label htmlFor="maker-border-radius" className="text-xs">Corner Radius</Label>
                            <Input id="maker-border-radius" value={currentTemplate.cardBorderRadius || ''} onChange={event => updateTemplate({ cardBorderRadius: event.target.value }, false)} />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="maker-border-style">Border Style</Label>
                          <Select value={currentTemplate.cardBorderStyle || '_default_'} onValueChange={value => updateTemplate({ cardBorderStyle: value === '_default_' ? undefined : value as TCGCardTemplate['cardBorderStyle'] })}>
                            <SelectTrigger id="maker-border-style"><SelectValue /></SelectTrigger>
                            <SelectContent>{CARD_BORDER_STYLES.map(style => <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5 rounded-[6px] border border-[#302819] bg-[#0b0f15] p-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] uppercase tracking-[0.14em] text-[#d5ad54]">Frame Kits</Label>
                            <Sparkles className="h-3.5 w-3.5 text-[#7a52cc]" />
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {frameKitRecipesForCurrentTemplate.map((recipe) => (
                              <Tooltip key={recipe.id}>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                      makerTheme.button,
                                      'h-16 justify-start gap-2 overflow-hidden px-2 text-left text-[10px]',
                                      currentTemplate.cardBackgroundImageUrl === recipe.preview?.imageUrl && 'border-[#d5ad54] text-[#f5d27b]'
                                    )}
                                    onClick={() => applyElementPresetRecipe(recipe)}
                                  >
                                    <span
                                      className="h-12 w-9 shrink-0 rounded-[3px] border border-[#3a2e17] bg-cover bg-center"
                                      style={{ backgroundImage: recipe.preview?.imageUrl ? `url(${recipe.preview.imageUrl})` : undefined, backgroundColor: recipe.preview?.background }}
                                      aria-hidden="true"
                                    />
                                    <span className="min-w-0">
                                      <span className="block truncate text-[#f1dfb4]">{recipe.label}</span>
                                      <span className="block truncate text-[8px] uppercase tracking-[0.12em] text-[#8f95a3]">{recipe.status} - {recipe.tier}</span>
                                    </span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{recipe.contributorName} - {recipe.description}</TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="maker-bg-image">Card Background Image</Label>
                          <div className="flex gap-2">
                            <Input id="maker-bg-image" value={currentTemplate.cardBackgroundImageUrl || ''} onChange={event => updateTemplate({ cardBackgroundImageUrl: event.target.value }, false)} />
                            <Button type="button" variant="outline" size="icon" onClick={() => bgImageInputRef.current?.click()}><ImageIcon className="h-4 w-4" /></Button>
                            <input ref={bgImageInputRef} type="file" accept="image/*" hidden onChange={event => handleFileUpload(event, dataUri => updateTemplate({ cardBackgroundImageUrl: dataUri }))} />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="maker-border-image">Border Image/Gradient</Label>
                          <div className="flex gap-2">
                            <Input id="maker-border-image" value={currentTemplate.cardBorderImageSource || ''} onChange={event => updateTemplate({ cardBorderImageSource: event.target.value }, false)} />
                            <Button type="button" variant="outline" size="icon" onClick={() => borderImageInputRef.current?.click()}><ImageIcon className="h-4 w-4" /></Button>
                            <input ref={borderImageInputRef} type="file" accept="image/*" hidden onChange={event => handleFileUpload(event, dataUri => updateTemplate({ cardBorderImageSource: dataUri }))} />
                          </div>
                        </div>
                    </>
                  }
                  elementContent={selectedElement ? (
                    <>
                        {(canUseTypography || canUseImageSource) && (
                          <InspectorFlowSection title="Source & Content">
                            <ElementContentPanel
                              element={selectedElement}
                              currentTemplate={currentTemplate}
                              selectedElementTemplateFields={selectedElementTemplateFields}
                              activeVariableKey={activeVariableKey}
                              richTextHighlightColor={richTextHighlightColor}
                              variableKeyInputRefs={variableKeyInputRefs}
                              variableCardRefs={variableCardRefs}
                              onSetActiveVariableKey={setActiveVariableKey}
                              onSetRichTextHighlightColor={setRichTextHighlightColorAction}
                              onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                              onCreateEditorVariableFromSelection={createEditorVariableFromSelection}
                              onFocusVariableCard={focusVariableCard}
                              onRemoveSelectedElementVariableContract={removeSelectedElementVariableContract}
                              onRenameSelectedElementVariable={renameSelectedElementVariable}
                              onUpsertFieldContract={upsertFieldContract}
                              onHandleFileUpload={handleFileUpload}
                            />
                            {canUseImageSource && (
                              <ImageInspectorPanel
                                element={selectedElement}
                                canUseBackgroundTexture={canUseBackgroundTexture}
                                imageAssets={compatibleImageAssets}
                                assetSearch={assetSearch}
                                onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                                onHandleFileUpload={handleFileUpload}
                                onAssetSearchChange={setAssetSearch}
                              />
                            )}
                          </InspectorFlowSection>
                        )}

                        {canUseIconLibrary && (
                          <InspectorFlowSection title="Source & Symbol">
                            <IconInspectorPanel
                              element={selectedElement}
                              iconOptions={ICON_OPTIONS}
                              iconAssets={compatibleIconAssets}
                              assetSearch={assetSearch}
                              canUploadCustomAssets={canUploadCustomAssets}
                              symbolStylePresets={selectedElementPresetRecipeGroups.icon}
                              controlClassName={makerTheme.control}
                              buttonClassName={makerTheme.button}
                              onApplyPreset={applyElementPresetRecipe}
                              onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                              onHandleFileUpload={handleFileUpload}
                              onHandleAssetUpload={handleAssetUpload}
                              onAssetSearchChange={setAssetSearch}
                            />
                          </InspectorFlowSection>
                        )}

                        {(canUseShapeControls || canUseDividerControls) && (
                          <InspectorFlowSection title={canUseDividerControls ? 'Divider Builder' : 'Shape Builder'}>
                            {canUseShapeControls && (
                              <ShapeInspectorPanel
                                element={selectedElement}
                                primitiveOptions={SHAPE_PRIMITIVE_OPTIONS}
                                blankPrimitives={BLANK_SHAPE_PRIMITIVES}
                                rolePresets={selectedElementPresetRecipeGroups.shapeRole}
                                onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                              />
                            )}

                            {canUseDividerControls && (
                              <DividerStudioPanel
                                element={selectedElement}
                                selectedAppearance={selectedAppearance}
                                dividerPresets={selectedElementPresetRecipeGroups.divider}
                                onApplyPreset={applyElementPresetRecipe}
                                onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                                onUpdateAppearance={(updater, trackHistory) => updateElementAppearance(selectedElement.id, updater, trackHistory)}
                              />
                            )}
                          </InspectorFlowSection>
                        )}

                        {canUseTypography && (
                          <InspectorFlowSection title="Text Style">
                            <TypographyInspectorPanel
                              element={selectedElement}
                              currentTemplate={currentTemplate}
                              availableFonts={AVAILABLE_FONTS}
                              paddingOptions={PADDING_OPTIONS}
                              framePresets={selectedElementPresetRecipeGroups.textFrame}
                              controlClassName={makerTheme.control}
                              onApplyPreset={applyElementPresetRecipe}
                              onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                              onUpsertFieldContract={upsertFieldContract}
                            />
                          </InspectorFlowSection>
                        )}

                        {canUseAppearanceStudio && (
                          <InspectorFlowSection title="Material & Effects">
                            <AppearanceStudioPanel
                              element={selectedElement}
                              selectedAppearance={selectedAppearance}
                              compatibleAppearanceStyles={compatibleAppearanceStyles}
                              compatibleTextureAssets={compatibleTextureAssets}
                              compatibleDividerAssets={compatibleDividerAssets}
                              elementStylePresets={ELEMENT_STYLE_PRESETS}
                              canUseImageSource={canUseImageSource}
                              canUseDividerControls={canUseDividerControls}
                              canUseBackgroundTexture={canUseBackgroundTexture}
                              controlClassName={makerTheme.control}
                              buttonClassName={makerTheme.button}
                              assetSearch={assetSearch}
                              canUploadCustomAssets={canUploadCustomAssets}
                              onAssetSearchChange={setAssetSearch}
                              onHandleAssetUpload={handleAssetUpload}
                              onSaveStyle={saveSelectedAppearanceStyle}
                              onApplyAppearancePreset={applyAppearancePreset}
                              onUpdateElement={(updates) => updateElement(selectedElement.id, updates)}
                              onUpdateAppearance={(updater, trackHistory) => updateElementAppearance(selectedElement.id, updater, trackHistory)}
                            />
                          </InspectorFlowSection>
                        )}

                        {canUseElementBorder && (
                          <InspectorFlowSection title="Frame & Edge">
                            <BorderInspectorPanel
                              element={selectedElement}
                              selectedAppearance={selectedAppearance}
                              borderPresets={selectedElementPresetRecipeGroups.border}
                              onApplyPreset={applyElementPresetRecipe}
                              onUpdateAppearance={(updater, trackHistory) => updateElementAppearance(selectedElement.id, updater, trackHistory)}
                            />
                          </InspectorFlowSection>
                        )}

                        <InspectorFlowSection title="Layout & Layer">
                          <ElementTransformPanel
                            element={selectedElement}
                            controlClassName={makerTheme.control}
                            buttonClassName={makerTheme.button}
                            onDuplicate={duplicateSelected}
                            onDelete={deleteSelected}
                            onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                          />
                          <ElementAlignmentPanel
                            buttonClassName={makerTheme.button}
                            onAlign={alignSelected}
                            onArrange={arrangeSelected}
                          />
                        </InspectorFlowSection>
                    </>
                  ) : null}
                />
              </div>
            </ScrollArea>
          </aside>
        </div>
        <div id="maker-shortcuts-help" role="note" aria-label="Keyboard shortcuts" className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#252b35] bg-[#080b10] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#757d8c]">
          <span className="text-[#d5ad54]">Shortcuts</span>
          <span>Ctrl+S Save</span>
          <span>Ctrl+Z Undo</span>
          <span>Ctrl+D Duplicate</span>
          <span>Del Remove</span>
          <span>G Grid</span>
          <span>P Preview</span>
          <span>+/- Zoom</span>
          <span>Esc Deselect</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

