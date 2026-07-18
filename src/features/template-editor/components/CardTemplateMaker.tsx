"use client";

import type { ChangeEvent, RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppearanceStylePreset, FreeformCardElement, TCGCardTemplate } from '@/domain/templates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { replacePlaceholdersLocal } from '@/domain/rendering';
import { cn } from '@/shared/classNames';
import { useProjectStore } from '@/features/project/client';
import { useToast } from '@/components/ui/use-toast';
import { clamp } from '@/features/template-editor/lib/makerGeometry';
import { makerTheme } from '@/features/template-editor/lib/makerTheme';
import { TemplateEditorTopBar } from '@/features/template-editor/components/TemplateEditorTopBar';
import { TemplateCanvasStage } from '@/features/template-editor/components/TemplateCanvasStage';
import { TemplateEditableElement } from '@/features/template-editor/components/TemplateEditableElement';
import { TemplateCommandPalette } from '@/features/template-editor/components/TemplateCommandPalette';
import { TemplateEditorLibrarySidebar } from '@/features/template-editor/components/TemplateEditorLibrarySidebar';
import { TemplateEditorInspectorSidebar } from '@/features/template-editor/components/TemplateEditorInspectorSidebar';
import { useTemplateEditorSession } from '@/features/template-editor/hooks/useTemplateEditorSession';
import { useTemplateEditorVariables } from '@/features/template-editor/hooks/useTemplateEditorVariables';
import { useTemplateEditorElements } from '@/features/template-editor/hooks/useTemplateEditorElements';
import { useTemplateEditorViewport, type MobileMakerPanel } from '@/features/template-editor/hooks/useTemplateEditorViewport';
import { useTemplateEditorCommands } from '@/features/template-editor/hooks/useTemplateEditorCommands';
import { CANVAS_ZOOM } from '@/features/template-editor/lib/canvasViewportConfig';

interface CardTemplateMakerProps {
  canUseProjectFiles: boolean;
  showCardWatermark: boolean;
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
  selectedTemplateIdForEditing: string | null;
  onSelectTemplateForEditing: (templateId: string | null) => void;
  canSavePipelineTemplate: boolean;
  canUploadCustomAssets: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  isCheckoutStarting: boolean;
  isActive: boolean;
  onReturnToTemplateMaker: () => void;
  projectFileGateMessage?: string | null;
}

const MOBILE_MAKER_PANELS: Array<{ value: MobileMakerPanel; label: string }> = [
  { value: 'canvas', label: 'Canvas' },
  { value: 'library', label: 'Templates' },
  { value: 'inspector', label: 'Inspector' },
];

export function CardTemplateMaker({
  canUseProjectFiles,
  showCardWatermark,
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
  selectedTemplateIdForEditing,
  onSelectTemplateForEditing,
  canSavePipelineTemplate,
  canUploadCustomAssets,
  fileInputRef,
  isCheckoutStarting,
  isActive,
  onReturnToTemplateMaker,
  projectFileGateMessage,
}: CardTemplateMakerProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const {
    acceptTemplate,
    availableFonts,
    beginDraft,
    controller,
    developerFontFaceCss,
    isDirty,
    isHydrated: draftPersistenceHydrated,
  } = useTemplateEditorSession({
    isActive,
    selectedTemplateId: selectedTemplateIdForEditing,
    templates,
  });
  const {
    canvas,
    currentTemplate,
    future,
    history,
    redo,
    selectedElement,
    selectedElementId,
    selectElement: selectElementInController,
    setSelectedElementId,
    undo,
  } = controller;
  const variables = useTemplateEditorVariables({ controller, toast });
  const [activeInspectorTab, setActiveInspectorTab] = useState<string>('element');
  const [pendingTemplateChange, setPendingTemplateChange] = useState<(() => void) | null>(null);
  const [saveName, setSaveName] = useState('');
  const wasActiveRef = useRef(isActive);

  const selectElement = useCallback((id: string | null) => {
    selectElementInController(id);
    if (id !== null) {
      setActiveInspectorTab('element');
      requestAnimationFrame(() => {
        canvasRef.current?.focus();
      });
    }
  }, [selectElementInController]);
  const gridSize = canvas.gridSize || 20;
  const richTextHighlightColor = useProjectStore((state) => state.richTextHighlightColor);
  const setRichTextHighlightColorAction = useProjectStore((state) => state.setRichTextHighlightColor);
  const elements = useTemplateEditorElements({
    appearanceStyles,
    canUploadCustomAssets,
    controller,
    gridSize,
    onSaveAppearanceStyle,
    selectElement,
    toast,
  });
  const {
    addElement,
    deleteSelected,
    duplicateSelected,
  } = elements;
  const {
    clearDepthSelection,
    centerCanvasViewport,
    fitCanvasToViewport,
    handleCanvasKeyDown,
    handleDrop,
    handleElementPointerDown,
    handlePointerMove,
    handlePointerUp,
    handleResizePointerDown,
    handleStagePointerDownCapture,
    handleStagePointerMoveCapture,
    handleStagePointerUpCapture,
    handleStageWheel,
    mobilePanel,
    previewMode,
    resetCanvasZoom,
    setAutoFitCanvas,
    setMobilePanel,
    setPreviewMode,
    setShowGrid,
    setSnapToGrid,
    setZoom,
    showGrid,
    snapToGrid,
    stageRef,
    zoom,
  } = useTemplateEditorViewport({
    addElement,
    canvasRef,
    controller,
    deleteSelected,
    selectElement,
  });
  const requestTemplateChange = useCallback((action: () => void) => {
    if (!isDirty) {
      action();
      return;
    }
    setPendingTemplateChange(() => action);
  }, [isDirty]);

  const commands = useTemplateEditorCommands({
    acceptTemplate,
    beginDraft,
    controller,
    deleteSelected,
    duplicateSelected,
    isActive,
    onCloneTemplate,
    onSaveTemplate,
    onSelectTemplate: onSelectTemplateForEditing,
    setAutoFitCanvas,
    setPreviewMode,
    setShowGrid,
    setZoom,
    requestTemplateChange,
    toast,
  });
  const saveAndContinue = useCallback(() => {
    const templateToSave = { ...currentTemplate, name: saveName.trim() };
    if (!commands.saveTemplate(templateToSave)) return;
    const action = pendingTemplateChange;
    setPendingTemplateChange(null);
    action?.();
  }, [commands, currentTemplate, pendingTemplateChange, saveName]);

  const discardAndContinue = useCallback(() => {
    const action = pendingTemplateChange;
    setPendingTemplateChange(null);
    action?.();
  }, [pendingTemplateChange]);

  useEffect(() => {
    if (pendingTemplateChange !== null) setSaveName(currentTemplate.name ?? '');
  }, [currentTemplate.name, pendingTemplateChange]);

  useEffect(() => {
    if (wasActiveRef.current && !isActive && isDirty) {
      setPendingTemplateChange(() => () => undefined);
    }
    wasActiveRef.current = isActive;
  }, [isActive, isDirty]);

  const {
    commandPaletteOpen,
    saveTemplate: handleSave,
    setCommandPaletteOpen,
  } = commands;

  const livePreviewData = useMemo(() => ({
    cardName: 'Astral Relic',
    cost: '3',
    rulesText: 'When Astral Relic enters play, draw a card. If you control an icon, gain 2 focus.',
    artworkUrl: 'https://placehold.co/600x400.png?text=Astral+Relic',
    ...(currentTemplate.templatePreviewData || {}),
  }), [currentTemplate.templatePreviewData]);

  const renderEditableElement = useCallback((element: FreeformCardElement) => (
    <TemplateEditableElement
      key={element.id}
      currentTemplate={currentTemplate}
      element={element}
      livePreviewData={livePreviewData}
      previewMode={previewMode}
      richTextHighlightColor={richTextHighlightColor}
      selected={selectedElementId === element.id}
      zoom={zoom}
      onElementPointerDown={handleElementPointerDown}
      onResizePointerDown={handleResizePointerDown}
    />
  ), [currentTemplate, handleElementPointerDown, handleResizePointerDown, livePreviewData, previewMode, richTextHighlightColor, selectedElementId, zoom]);

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

  if (!draftPersistenceHydrated) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center rounded border border-[#252b35] bg-[#080b10] px-6 text-center font-mono text-xs uppercase tracking-[0.12em] text-[#aeb6c4]"
        role="status"
        aria-live="polite"
      >
        Loading editor workspace…
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div
        className={cn('cardforge-maker-shell min-h-[calc(100vh-145px)] overflow-hidden rounded-[10px] border', makerTheme.shell)}
        data-mobile-panel={mobilePanel}
      >
        <TemplateEditorTopBar
          canUndo={history.length > 0}
          canRedo={future.length > 0}
          showGrid={showGrid}
          snapToGrid={snapToGrid}
          previewMode={previewMode}
          isDirty={isDirty}
          onUndo={undo}
          onRedo={redo}
          onZoomOut={() => {
            setAutoFitCanvas(false);
            setZoom(value => clamp(Math.round((value - CANVAS_ZOOM.step) * 100) / 100, CANVAS_ZOOM.min, CANVAS_ZOOM.max));
          }}
          onZoomIn={() => {
            setAutoFitCanvas(false);
            setZoom(value => clamp(Math.round((value + CANVAS_ZOOM.step) * 100) / 100, CANVAS_ZOOM.min, CANVAS_ZOOM.max));
          }}
          onFitToScreen={fitCanvasToViewport}
          onActualSize={resetCanvasZoom}
          onCenterCanvas={centerCanvasViewport}
          onToggleGrid={() => setShowGrid(value => !value)}
          onToggleSnapToGrid={() => setSnapToGrid(value => !value)}
          onTogglePreviewMode={() => setPreviewMode(value => !value)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onSave={handleSave}
          toolButtonClassName={makerTheme.toolButton}
          activeButtonClassName={makerTheme.activeButton}
        />

        <TemplateCommandPalette
          open={commandPaletteOpen}
          selectedElement={selectedElement}
          showGrid={showGrid}
          snapToGrid={snapToGrid}
          previewMode={previewMode}
          onOpenChange={setCommandPaletteOpen}
          onAddElement={(type, preset) => {
            addElement(type, undefined, preset);
            setMobilePanel('canvas');
          }}
          onDuplicateSelected={duplicateSelected}
          onDeleteSelected={deleteSelected}
          onSave={handleSave}
          onShowLibrary={() => setMobilePanel('library')}
          onShowInspector={() => {
            setActiveInspectorTab('element');
            setMobilePanel('inspector');
          }}
          onShowTemplateSettings={() => {
            setActiveInspectorTab('template');
            setMobilePanel('inspector');
          }}
          onToggleGrid={() => setShowGrid(value => !value)}
          onToggleSnap={() => setSnapToGrid(value => !value)}
          onTogglePreview={() => setPreviewMode(value => !value)}
        />

        <div className="cardforge-maker-mobile-switcher no-print border-b border-[#252b35] bg-[#080c12] p-2 lg:hidden" role="group" aria-label="Layout Studio surface">
          {MOBILE_MAKER_PANELS.map((panel) => (
            <Button
              key={panel.value}
              type="button"
              size="sm"
              variant="ghost"
              aria-pressed={mobilePanel === panel.value}
              className={cn(
                'h-10 flex-1 rounded-[4px] border border-[#2d3340] text-xs font-semibold text-[#c8b07f]',
                mobilePanel === panel.value && 'border-[#d5ad54] bg-[#24180e] text-[#fff1c7]'
              )}
              onClick={() => setMobilePanel(panel.value)}
            >
              {panel.label}
            </Button>
          ))}
        </div>

        <div className="cardforge-maker-grid grid min-h-[calc(100vh-205px)] min-w-0 grid-cols-1 lg:grid-cols-[240px_minmax(320px,1fr)_300px] xl:grid-cols-[280px_minmax(420px,1fr)_330px] 2xl:grid-cols-[300px_minmax(520px,1fr)_360px]">
          {developerFontFaceCss && <style>{developerFontFaceCss}</style>}
          <TemplateEditorLibrarySidebar
            backFaceTemplates={backFaceTemplates}
            canUseProjectFiles={canUseProjectFiles}
            commands={commands}
            controller={controller}
            defaultTemplates={defaultTemplates}
            elements={elements}
            fileInputRef={fileInputRef}
            isCheckoutStarting={isCheckoutStarting}
            onDeleteTemplate={onDeleteTemplate}
            onElementAdded={() => setMobilePanel('canvas')}
            onExportProject={onExportProject}
            onImportProject={onImportProject}
            onLoadProject={onLoadProject}
            onSelectElement={selectElement}
            onSelectTemplateId={onSelectTemplateForEditing}
            onStartCheckout={onStartCheckout}
            projectFileGateMessage={projectFileGateMessage}
            richTextHighlightColor={richTextHighlightColor}
            showCardWatermark={showCardWatermark}
            templates={templates}
            userTemplates={userTemplates}
          />

          <TemplateCanvasStage
            canvas={canvas}
            canvasFrameStyle={canvasFrameStyle}
            canvasRef={canvasRef}
            canvasStyle={canvasStyle}
            currentTemplate={currentTemplate}
            gridSize={gridSize}
            livePreviewData={livePreviewData}
            previewMode={previewMode}
            richTextHighlightColor={richTextHighlightColor}
            selectedElement={selectedElement}
            showCardWatermark={showCardWatermark}
            showGrid={showGrid}
            stageRef={stageRef}
            zoom={zoom}
            onCanvasKeyDown={handleCanvasKeyDown}
            onClearDepthSelection={clearDepthSelection}
            onDeselectCanvas={() => setSelectedElementId(null)}
            onDrop={handleDrop}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onStagePointerDownCapture={handleStagePointerDownCapture}
            onStagePointerMoveCapture={handleStagePointerMoveCapture}
            onStagePointerUpCapture={handleStagePointerUpCapture}
            onStageWheel={handleStageWheel}
            renderEditableElement={renderEditableElement}
          />

          <TemplateEditorInspectorSidebar
            activeTab={activeInspectorTab}
            availableFonts={availableFonts}
            canUploadCustomAssets={canUploadCustomAssets}
            commands={commands}
            controller={controller}
            elements={elements}
            onActiveTabChange={setActiveInspectorTab}
            onRichTextHighlightColorChange={setRichTextHighlightColorAction}
            richTextHighlightColor={richTextHighlightColor}
            variables={variables}
          />
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
        <AlertDialog open={pendingTemplateChange !== null} onOpenChange={(open) => !open && setPendingTemplateChange(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Save changes to “{currentTemplate.name || 'Untitled template'}”?</AlertDialogTitle>
              <AlertDialogDescription>
                {currentTemplate.templateSource === 'default' && !canSavePipelineTemplate
                  ? 'This is a CardForge pipeline template. Saving creates a new personal copy and keeps the original unchanged.'
                  : 'Your changes are not saved yet.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <label htmlFor="template-save-name" className="text-sm font-medium text-foreground">Template name</label>
              <Input
                id="template-save-name"
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
                placeholder="Name this template"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => onReturnToTemplateMaker()}>Keep editing</AlertDialogCancel>
              <Button type="button" variant="outline" onClick={discardAndContinue}>Don’t save</Button>
              <AlertDialogAction onClick={saveAndContinue}>
                {currentTemplate.templateSource === 'default' && !canSavePipelineTemplate ? 'Save as new template' : 'Save changes'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
