"use client";

import type { ChangeEvent, RefObject } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import type { TCGCardTemplate } from '@/domain/templates';
import { ElementLibraryPanel } from '@/features/template-editor/components/ElementLibraryPanel';
import { LayerTreePanel } from '@/features/template-editor/components/LayerTreePanel';
import { TemplateLibraryPanel } from '@/features/template-editor/components/TemplateLibraryPanel';
import { TemplateSettingsPanel } from '@/features/template-editor/components/TemplateSettingsPanel';
import { WorkspaceSection } from '@/features/template-editor/components/WorkspaceSection';
import type { TemplateEditorCommands } from '@/features/template-editor/hooks/useTemplateEditorCommands';
import type { TemplateEditorController } from '@/features/template-editor/hooks/useTemplateEditorController';
import type { TemplateEditorElements } from '@/features/template-editor/hooks/useTemplateEditorElements';
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
}: TemplateEditorLibrarySidebarProps) {
  const { canvas, checkedLayerIds, clearCheckedLayers, currentTemplate, updateCanvas, updateTemplate } = controller;

  return (
    <aside className="cardforge-maker-side cardforge-maker-library min-w-0 border-b border-[#252b35] bg-[#0d1117] lg:border-b-0 lg:border-r">
      <ScrollArea className="cardforge-maker-scroll h-[calc(100vh-205px)] min-h-[760px]">
        <div className="space-y-3 p-2">
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
            onCreateNew={commands.createNewTemplate}
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

          <WorkspaceSection title="Card setup" defaultOpen={false} panelClassName={makerTheme.panel}>
            <TemplateSettingsPanel
              currentTemplate={currentTemplate}
              customWidthValue={commands.customWidthValue}
              customHeightValue={commands.customHeightValue}
              customUnit={commands.customUnit}
              gridSize={canvas.gridSize || 20}
              frameKitRecipes={commands.frameKitRecipes}
              backgroundImageInputRef={commands.backgroundImageInputRef}
              borderImageInputRef={commands.borderImageInputRef}
              controlClassName={makerTheme.control}
              buttonClassName={makerTheme.button}
              onCustomWidthValueChange={commands.setCustomWidthValue}
              onCustomHeightValueChange={commands.setCustomHeightValue}
              onCustomUnitChange={commands.setCustomUnit}
              onApplyCustomDimensions={commands.applyCustomDimensions}
              onResetGridToTemplateDefault={commands.resetGridToTemplateDefault}
              onApplyFrameStyle={commands.applyFrameStyle}
              onApplyElementPresetRecipe={elements.applyElementPresetRecipe}
              onFileUpload={commands.handleFileUpload}
              onUpdateCanvas={updateCanvas}
              onUpdateTemplate={updateTemplate}
            />
          </WorkspaceSection>

          <ElementLibraryPanel
            sections={elements.elementLibrarySections}
            onAddElement={(type, preset) => {
              elements.addElement(type, undefined, preset);
              onElementAdded();
            }}
            panelClassName={makerTheme.panel}
          />

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
        </div>
      </ScrollArea>
    </aside>
  );
}
