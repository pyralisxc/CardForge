"use client";

import { useEffect } from 'react';
import type { ChangeEvent, RefObject } from 'react';

import { Button } from '@/components/ui/button';
import { getCompatibleCardBacks, getTemplateCardMeasurement } from '@/domain/card-formats';
import type { TCGCardTemplate } from '@/domain/templates';
import { ElementLibraryPanel } from '@/features/template-editor/components/ElementLibraryPanel';
import { LayerTreePanel } from '@/features/template-editor/components/LayerTreePanel';
import { TemplateLibraryPanel } from '@/features/template-editor/components/TemplateLibraryPanel';
import { TemplatePanelWorkspace, type TemplatePanelWorkspaceSection } from '@/features/template-editor/components/TemplatePanelWorkspace';
import { TemplateSettingsPanel } from '@/features/template-editor/components/TemplateSettingsPanel';
import { WorkspaceSection } from '@/features/template-editor/components/WorkspaceSection';
import type { TemplateEditorCommands } from '@/features/template-editor/hooks/useTemplateEditorCommands';
import type { TemplateEditorController } from '@/features/template-editor/hooks/useTemplateEditorController';
import type { TemplateEditorElements } from '@/features/template-editor/hooks/useTemplateEditorElements';
import { useTemplatePanelSectionMemory } from '@/features/template-editor/hooks/useTemplatePanelSectionMemory';
import { makerTheme } from '@/features/template-editor/lib/makerTheme';

interface TemplateEditorLibrarySidebarProps {
  backFaceTemplates: TCGCardTemplate[];
  canUseProjectFiles: boolean;
  commands: TemplateEditorCommands;
  controller: TemplateEditorController;
  defaultTemplates: TCGCardTemplate[];
  elements: TemplateEditorElements;
  fileInputRef: RefObject<HTMLInputElement>;
  isCheckoutStarting: boolean;
  onDeleteTemplate: (templateId: string) => void;
  onElementAdded: () => void;
  onExportProject: () => void;
  onImportProject: () => void;
  onLoadProject: (event: ChangeEvent<HTMLInputElement>) => void;
  onSelectTemplateId: (templateId: string | null) => void;
  onSelectElement: (elementId: string | null) => void;
  onStartCheckout: () => void;
  projectFileGateMessage?: string | null;
  richTextHighlightColor: string;
  showCardWatermark: boolean;
  templates: TCGCardTemplate[];
  userTemplates: TCGCardTemplate[];
  requestedSectionId?: string | null;
  onRequestedSectionHandled?: () => void;
  onClose?: () => void;
}

export function TemplateEditorLibrarySidebar({
  backFaceTemplates,
  canUseProjectFiles,
  commands,
  controller,
  defaultTemplates,
  elements,
  fileInputRef,
  isCheckoutStarting,
  onDeleteTemplate,
  onElementAdded,
  onExportProject,
  onImportProject,
  onLoadProject,
  onSelectTemplateId,
  onSelectElement,
  onStartCheckout,
  projectFileGateMessage,
  richTextHighlightColor,
  showCardWatermark,
  templates,
  userTemplates,
  requestedSectionId,
  onRequestedSectionHandled,
  onClose,
}: TemplateEditorLibrarySidebarProps) {
  const { canvas, checkedLayerIds, clearCheckedLayers, currentTemplate, updateCanvas, updateTemplate } = controller;
  const matchingBacks = currentTemplate.templateUsage === 'back-preset'
    ? []
    : getCompatibleCardBacks(currentTemplate, backFaceTemplates);

  const sections: TemplatePanelWorkspaceSection[] = [
    {
      id: 'templates',
      label: 'Templates',
      content: (
        <TemplateLibraryPanel
          canUseProjectFiles={canUseProjectFiles}
          showCardWatermark={showCardWatermark}
          currentTemplate={currentTemplate}
          currentTemplateId={currentTemplate.id}
          defaultTemplates={defaultTemplates}
          backFaceTemplates={backFaceTemplates}
          fileInputRef={fileInputRef}
          isCheckoutStarting={isCheckoutStarting}
          projectFileGateMessage={projectFileGateMessage}
          richTextHighlightColor={richTextHighlightColor}
          userTemplates={userTemplates}
          onCreateNew={commands.requestNewTemplate}
          onClone={commands.cloneTemplate}
          onDelete={() => currentTemplate.id && onDeleteTemplate(currentTemplate.id)}
          onExportProject={onExportProject}
          onImportProject={onImportProject}
          onLoadProject={onLoadProject}
          onStartCheckout={onStartCheckout}
          onSelectTemplateId={(templateId) => {
            const template = templates.find((candidate) => candidate.id === templateId);
            if (template) commands.openTemplate(template);
            else onSelectTemplateId(templateId);
          }}
          onOpenTemplate={commands.openTemplate}
          panelClassName={makerTheme.panel}
          controlClassName={makerTheme.control}
          buttonClassName={makerTheme.button}
        />
      ),
    },
    {
      id: 'setup',
      label: 'Card Setup',
      content: (
        <WorkspaceSection title="Card setup" defaultOpen panelClassName={makerTheme.panel}>
          <TemplateSettingsPanel
            currentTemplate={currentTemplate}
            customWidthValue={commands.customWidthValue}
            customHeightValue={commands.customHeightValue}
            customUnit={commands.customUnit}
            resizeStrategy={commands.resizeStrategy}
            gridSize={canvas.gridSize || 20}
            frameKitRecipes={commands.frameKitRecipes}
            frameAssets={currentTemplate.templateUsage === 'back-preset'
              ? elements.backFrameAssets
              : elements.frontFrameAssets}
            borderAssets={currentTemplate.templateUsage === 'back-preset'
              ? elements.backBorderAssets
              : elements.frontBorderAssets}
            backgroundImageInputRef={commands.backgroundImageInputRef}
            borderImageInputRef={commands.borderImageInputRef}
            controlClassName={makerTheme.control}
            buttonClassName={makerTheme.button}
            onCustomWidthValueChange={commands.setCustomWidthValue}
            onCustomHeightValueChange={commands.setCustomHeightValue}
            onCustomUnitChange={commands.setCustomUnit}
            onResizeStrategyChange={commands.setResizeStrategy}
            onApplyCardFormat={commands.applyCardFormat}
            onApplyCustomDimensions={commands.applyCustomDimensions}
            onResetGridToTemplateDefault={commands.resetGridToTemplateDefault}
            onApplyFrameStyle={commands.applyFrameStyle}
            onApplyElementPresetRecipe={elements.applyElementPresetRecipe}
            onFileUpload={commands.handleFileUpload}
            onUpdateCanvas={updateCanvas}
            onUpdateTemplate={updateTemplate}
            personalItems={elements.connectedLibraryItems}
            onAddFromProvider={elements.addConnectedLibraryItems}
            onMaterializePersonal={elements.importConnectedLibraryItem}
          />
          {currentTemplate.templateUsage !== 'back-preset' && matchingBacks.length === 0 ? (
            <div className="mt-3 space-y-2 rounded-[6px] border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-2">
              <p className="text-[11px] font-semibold text-[#f1dfb4]">This design has no matching card back</p>
              <p className="text-[10px] leading-4 text-[#a99b82]">
                Its current size is {getTemplateCardMeasurement(currentTemplate, 'mm').label}. You can create a back with the same format now or continue designing the front.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-full text-xs"
                onClick={() => commands.requestNewTemplate('back-preset', currentTemplate)}
              >
                Create matching card back
              </Button>
            </div>
          ) : null}
        </WorkspaceSection>
      ),
    },
    {
      id: 'elements',
      label: 'Elements',
      content: (
        <ElementLibraryPanel
          sections={elements.elementLibrarySections}
          onAddElement={(type, preset) => {
            elements.addElement(type, undefined, preset);
            onElementAdded();
          }}
          panelClassName={makerTheme.panel}
        />
      ),
    },
    {
      id: 'layers',
      label: 'Layers',
      content: (
        <LayerTreePanel
          panelClassName={makerTheme.panel}
          elementsCount={canvas.elements.length}
          layerTree={elements.layerTree}
          checkedLayerIds={checkedLayerIds}
          collapsedGroups={elements.collapsedGroups}
          selectedElementId={controller.selectedElementId}
          layerDropTarget={elements.layerDropTarget}
          canUngroupSelected={elements.isGroupElement}
          onGroupChecked={elements.groupChecked}
          onUngroupSelected={elements.ungroupSelected}
          onClearChecked={clearCheckedLayers}
          onSelectElement={onSelectElement}
          onToggleGroupCollapsed={elements.toggleGroupCollapsed}
          onToggleChecked={controller.toggleCheckedLayer}
          onDragStart={elements.startLayerDrag}
          onDragEnd={elements.endLayerDrag}
          onDragOver={elements.handleLayerDragOver}
          onDrop={elements.handleLayerDrop}
          onToggleVisibility={(element) => controller.updateElement(
            element.id,
            { visible: element.visible === false },
          )}
          onToggleLock={(element) => controller.updateElement(element.id, { locked: !element.locked })}
          onDuplicateSelected={elements.duplicateSelected}
          onDeleteSelected={elements.deleteSelected}
        />
      ),
    },
  ];
  const sectionIds = sections.map((section) => section.id);
  const memory = useTemplatePanelSectionMemory({
    contextKey: 'library',
    sectionIds,
    defaultSectionId: 'templates',
    maxContexts: 1,
  });

  useEffect(() => {
    if (!requestedSectionId || !sectionIds.includes(requestedSectionId)) return;
    memory.setActiveSection(requestedSectionId);
    onRequestedSectionHandled?.();
  }, [memory, onRequestedSectionHandled, requestedSectionId, sectionIds]);

  return (
    <aside className="cardforge-maker-side cardforge-maker-library min-w-0 border-b border-[var(--cf-editor-border)] bg-[#0d1117] lg:border-b-0 lg:border-r">
      <TemplatePanelWorkspace
        title="Library"
        description="Templates, setup, elements, and layer structure"
        sections={sections}
        activeSectionId={memory.activeSectionId}
        pinnedSectionIds={memory.pinnedSectionIds}
        onActiveSectionChange={memory.setActiveSection}
        onTogglePinnedSection={memory.togglePinnedSection}
        onClose={onClose}
        closeLabel="Close library"
      />
    </aside>
  );
}
