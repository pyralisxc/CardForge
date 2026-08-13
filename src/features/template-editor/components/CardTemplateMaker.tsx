"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { X } from 'lucide-react';
import type { AppearanceStylePreset, FreeformCardElement, TCGCardTemplate } from '@/domain/templates';
import type { TemplateCardFormatSource } from '@/domain/card-formats';
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
import { MobileCanvasControls } from '@/features/template-editor/components/MobileCanvasControls';
import { MobileElementActions } from '@/features/template-editor/components/MobileElementActions';
import { NewCardDesignDialog } from '@/features/template-editor/components/NewCardDesignDialog';
import { useTemplateEditorSession } from '@/features/template-editor/hooks/useTemplateEditorSession';
import { useTemplateEditorVariables } from '@/features/template-editor/hooks/useTemplateEditorVariables';
import { useTemplateEditorElements } from '@/features/template-editor/hooks/useTemplateEditorElements';
import { useTemplateEditorViewport } from '@/features/template-editor/hooks/useTemplateEditorViewport';
import { useTemplateEditorCommands } from '@/features/template-editor/hooks/useTemplateEditorCommands';
import { CANVAS_ZOOM } from '@/features/template-editor/lib/canvasViewportConfig';
import { createTemplateEditorActions } from '@/features/template-editor/lib/templateEditorActions';
interface CardTemplateMakerProps {
  canUseProjectFiles: boolean;
  showCardWatermark: boolean;
  onSaveTemplate: (template: TCGCardTemplate) => Promise<string>;
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
  canSubmitBaseRevision: boolean;
  canUploadCustomAssets: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  isCheckoutStarting: boolean;
  isActive: boolean;
  onReturnToTemplateMaker: () => void;
  projectFileGateMessage?: string | null;
  requestedBackFormat?: { key: number; formatSource: TemplateCardFormatSource } | null;
  onRequestedBackFormatConsumed?: () => void;
}
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
  canSubmitBaseRevision,
  canUploadCustomAssets,
  fileInputRef,
  isCheckoutStarting,
  isActive,
  onReturnToTemplateMaker,
  projectFileGateMessage,
  requestedBackFormat,
  onRequestedBackFormatConsumed,
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
  const [contextElement, setContextElement] = useState<FreeformCardElement | null>(null);
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
  const openElementActions = useCallback((element: FreeformCardElement) => {
    selectElement(element.id);
    setContextElement(element);
  }, [selectElement]);
  const openElementInspector = useCallback((element: FreeformCardElement) => {
    selectElement(element.id);
    setActiveInspectorTab('element');
    setMobilePanel('inspector');
  }, [selectElement, setMobilePanel]);
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
    templates: defaultTemplates,
    toast,
  });
  const requestNewTemplate = commands.requestNewTemplate;
  useEffect(() => {
    if (!isActive || !requestedBackFormat) return;
    requestNewTemplate('back-preset', requestedBackFormat.formatSource);
    onRequestedBackFormatConsumed?.();
  }, [isActive, onRequestedBackFormatConsumed, requestNewTemplate, requestedBackFormat]);
  const saveAndContinue = useCallback(async () => {
    const templateToSave = { ...currentTemplate, name: saveName.trim() };
    if (!await commands.saveTemplate(templateToSave)) return;
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
  const editorActions = createTemplateEditorActions({
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    showGrid,
    snapToGrid,
    previewMode,
    onUndo: undo,
    onRedo: redo,
    onZoomOut: () => {
      setAutoFitCanvas(false);
      setZoom(value => clamp(Math.round((value - CANVAS_ZOOM.step) * 100) / 100, CANVAS_ZOOM.min, CANVAS_ZOOM.max));
    },
    onZoomIn: () => {
      setAutoFitCanvas(false);
      setZoom(value => clamp(Math.round((value + CANVAS_ZOOM.step) * 100) / 100, CANVAS_ZOOM.min, CANVAS_ZOOM.max));
    },
    onFitToScreen: fitCanvasToViewport,
    onActualSize: resetCanvasZoom,
    onCenterCanvas: centerCanvasViewport,
    onToggleGrid: () => setShowGrid(value => !value),
    onToggleSnapToGrid: () => setSnapToGrid(value => !value),
    onTogglePreviewMode: () => setPreviewMode(value => !value),
    onOpenCommandPalette: () => setCommandPaletteOpen(true),
    onSave: handleSave,
  });
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
      element={element}
      livePreviewData={livePreviewData}
      selected={selectedElementId === element.id}
      zoom={zoom}
      onElementContextAction={openElementActions}
      onElementEdit={openElementInspector}
      onElementPointerDown={handleElementPointerDown}
      onResizePointerDown={handleResizePointerDown}
    />
  ), [handleElementPointerDown, handleResizePointerDown, livePreviewData, openElementActions, openElementInspector, selectedElementId, zoom]);
  const canvasFrameStyle: React.CSSProperties = {
    width: canvas.width,
    height: canvas.height,
    transform: `scale(${zoom})`,
    transformOrigin: 'top left',
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
          actions={editorActions}
          isDirty={isDirty}
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
        <MobileCanvasControls
          actions={editorActions}
          isDirty={isDirty}
          templateName={currentTemplate.name}
          onOpenInspector={() => {
            setActiveInspectorTab('element');
            setMobilePanel('inspector');
          }}
          onOpenMenu={() => setMobilePanel('library')}
        />
        <div className="cardforge-maker-grid grid min-h-[calc(100vh-205px)] min-w-0 grid-cols-1 lg:grid-cols-[240px_minmax(320px,1fr)_300px] xl:grid-cols-[280px_minmax(420px,1fr)_330px] 2xl:grid-cols-[300px_minmax(520px,1fr)_360px]">
          {developerFontFaceCss && <style>{developerFontFaceCss}</style>}
          {mobilePanel !== 'canvas' ? (
            <button type="button" className="cardforge-mobile-overlay-backdrop lg:hidden" aria-label="Close open editor panel" onClick={() => setMobilePanel('canvas')} />
          ) : null}
          {mobilePanel === 'library' ? (
            <Button type="button" size="icon" variant="outline" aria-label="Close editor menu" className="cardforge-mobile-overlay-close cardforge-mobile-menu-close lg:hidden" onClick={() => setMobilePanel('canvas')}>
              <X className="h-5 w-5" />
            </Button>
          ) : null}
          {mobilePanel === 'inspector' ? (
            <Button type="button" size="icon" variant="outline" aria-label="Close inspector" className="cardforge-mobile-overlay-close cardforge-mobile-inspector-close lg:hidden" onClick={() => setMobilePanel('canvas')}>
              <X className="h-5 w-5" />
            </Button>
          ) : null}
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
        <MobileElementActions element={contextElement} onDelete={() => { deleteSelected(); setContextElement(null); }} onDuplicate={() => { duplicateSelected(); setContextElement(null); }} onEdit={() => { if (contextElement) openElementInspector(contextElement); setContextElement(null); }} onOpenChange={(open) => !open && setContextElement(null)} />
        <NewCardDesignDialog
          open={commands.newTemplateRequest !== null}
          usage={commands.newTemplateRequest?.usage ?? 'standard'}
          initialFormat={commands.newTemplateRequest?.formatSource ?? currentTemplate}
          canClone={Boolean(currentTemplate.id)}
          brandedBackFormatIds={defaultTemplates
            .filter((template) => template.templateUsage === 'back-preset' && template.templateRegistryStatus === 'published')
            .map((template) => template.formatId)
            .filter((formatId): formatId is NonNullable<typeof formatId> => Boolean(formatId))}
          onOpenChange={(open) => {
            if (!open) commands.setNewTemplateRequest(null);
          }}
          onCreate={commands.createNewTemplate}
        />
        <AlertDialog open={pendingTemplateChange !== null} onOpenChange={(open) => !open && setPendingTemplateChange(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Save changes to “{currentTemplate.name || 'Untitled card design'}”?</AlertDialogTitle>
              <AlertDialogDescription>
                {currentTemplate.templateSource === 'default'
                  ? canSubmitBaseRevision
                    ? 'Saving keeps this draft in your browser and submits a numbered base revision for owner review. The shared design changes only after publication.'
                    : 'This is a built-in CardForge card design. Saving creates a new personal copy and keeps the original unchanged.'
                  : 'Your changes are not saved in this browser yet.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <label htmlFor="template-save-name" className="text-sm font-medium text-foreground">Card design name</label>
              <Input
                id="template-save-name"
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
                placeholder="Name this card design"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => onReturnToTemplateMaker()}>Keep editing</AlertDialogCancel>
              <Button type="button" variant="outline" onClick={discardAndContinue}>Don’t save</Button>
              <AlertDialogAction onClick={() => void saveAndContinue()}>
                {currentTemplate.templateSource === 'default'
                  ? canSubmitBaseRevision ? 'Submit base revision' : 'Save as new card design'
                  : 'Save changes'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
