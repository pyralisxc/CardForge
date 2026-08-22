"use client";

import { cardFontOptionsToSelectOptions } from '@/domain/rendering';
import { SHAPE_PRIMITIVE_OPTIONS } from '@/domain/templates';
import { AppearanceStudioPanel } from '@/features/template-editor/components/AppearanceStudioPanel';
import { BorderInspectorPanel } from '@/features/template-editor/components/BorderInspectorPanel';
import { DividerStudioPanel } from '@/features/template-editor/components/DividerStudioPanel';
import { ElementAlignmentPanel } from '@/features/template-editor/components/ElementAlignmentPanel';
import { ElementContentPanel } from '@/features/template-editor/components/ElementContentPanel';
import { ElementTransformPanel } from '@/features/template-editor/components/ElementTransformPanel';
import { IconInspectorPanel } from '@/features/template-editor/components/IconInspectorPanel';
import { ImageInspectorPanel } from '@/features/template-editor/components/ImageInspectorPanel';
import { InspectorFlowSection } from '@/features/template-editor/components/InspectorFlowSection';
import { ShapeInspectorPanel } from '@/features/template-editor/components/ShapeInspectorPanel';
import { TemplatePanelWorkspace, type TemplatePanelWorkspaceSection } from '@/features/template-editor/components/TemplatePanelWorkspace';
import { TypographyInspectorPanel } from '@/features/template-editor/components/TypographyInspectorPanel';
import type { TemplateEditorCommands } from '@/features/template-editor/hooks/useTemplateEditorCommands';
import type { TemplateEditorController } from '@/features/template-editor/hooks/useTemplateEditorController';
import type { TemplateEditorElements } from '@/features/template-editor/hooks/useTemplateEditorElements';
import { useTemplatePanelSectionMemory } from '@/features/template-editor/hooks/useTemplatePanelSectionMemory';
import type { TemplateEditorVariables } from '@/features/template-editor/hooks/useTemplateEditorVariables';
import { BLANK_SHAPE_PRIMITIVES } from '@/features/template-editor/lib/elementPresetRecipes';
import { ELEMENT_STYLE_PRESETS } from '@/features/template-editor/lib/elementStylePresets';
import { PADDING_OPTIONS } from '@/features/template-editor/lib/editorOptions';
import { ICON_OPTIONS } from '@/features/template-editor/lib/iconOptions';
import { makerTheme } from '@/features/template-editor/lib/makerTheme';

type AvailableFonts = ReturnType<typeof cardFontOptionsToSelectOptions>;

interface TemplateEditorInspectorSidebarProps {
  availableFonts: AvailableFonts;
  canUploadCustomAssets: boolean;
  commands: TemplateEditorCommands;
  controller: TemplateEditorController;
  elements: TemplateEditorElements;
  onRichTextHighlightColorChange: (value: string) => void;
  richTextHighlightColor: string;
  variables: TemplateEditorVariables;
  onClose?: () => void;
}

export function TemplateEditorInspectorSidebar({
  availableFonts,
  canUploadCustomAssets,
  commands,
  controller,
  elements,
  onRichTextHighlightColorChange,
  richTextHighlightColor,
  variables,
  onClose,
}: TemplateEditorInspectorSidebarProps) {
  const { currentTemplate, selectedElement, updateElement } = controller;
  const sections: TemplatePanelWorkspaceSection[] = [];

  if (selectedElement) {
    if (elements.canUseTypography || elements.canUseImageSource) {
      sections.push({
        id: 'source',
        label: elements.canUseImageSource ? 'Image' : 'Content',
        content: (
          <InspectorFlowSection
            title={elements.canUseImageSource ? 'Image Source' : 'Source & Content'}
            badge="Start here"
            description={elements.canUseImageSource
              ? 'Choose the selected image or overlay source and control its framing.'
              : 'Write the selected text and define which fields the generator will ask users to fill.'}
            collapsible={false}
          >
            <ElementContentPanel
              element={selectedElement}
              currentTemplate={currentTemplate}
              selectedElementTemplateFields={variables.selectedElementTemplateFields}
              activeVariableKey={variables.activeVariableKey}
              richTextHighlightColor={richTextHighlightColor}
              availableFonts={availableFonts}
              variableKeyInputRefs={variables.variableKeyInputRefs}
              variableCardRefs={variables.variableCardRefs}
              onSetActiveVariableKey={variables.setActiveVariableKey}
              onSetRichTextHighlightColor={onRichTextHighlightColorChange}
              onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
              onAddStructuredRowPattern={variables.addStructuredRowPattern}
              onCreateEditorVariableFromSelection={variables.createVariableFromSelection}
              onFocusVariableCard={variables.focusVariableCard}
              onRemoveSelectedElementVariableContract={variables.removeVariable}
              onRenameSelectedElementVariable={variables.renameVariable}
              onUpsertFieldContract={variables.upsertFieldContract}
            />
            {elements.canUseImageSource ? (
              <ImageInspectorPanel
                element={selectedElement}
                imageAssets={elements.compatibleImageAssets}
                assetSearch={elements.assetSearch}
                onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                onHandleFileUpload={commands.handleFileUpload}
                onAssetSearchChange={elements.setAssetSearch}
              />
            ) : null}
          </InspectorFlowSection>
        ),
      });
    }

    if (elements.canUseIconLibrary) {
      sections.push({
        id: 'symbol',
        label: 'Symbol',
        content: (
          <InspectorFlowSection
            title="Source & Symbol"
            badge="Start here"
            description="Pick a built-in icon, upload a symbol, or choose a reviewed icon asset before styling the glyph."
            collapsible={false}
          >
            <IconInspectorPanel
              element={selectedElement}
              iconOptions={ICON_OPTIONS}
              iconAssets={elements.compatibleIconAssets}
              assetSearch={elements.assetSearch}
              canUploadCustomAssets={canUploadCustomAssets}
              symbolStylePresets={elements.selectedElementPresetRecipeGroups.icon}
              controlClassName={makerTheme.control}
              buttonClassName={makerTheme.button}
              onApplyPreset={elements.applyElementPresetRecipe}
              onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
              onHandleFileUpload={commands.handleFileUpload}
              onHandleAssetUpload={elements.handleAssetUpload}
              onAssetSearchChange={elements.setAssetSearch}
            />
          </InspectorFlowSection>
        ),
      });
    }

    if (elements.canUseShapeControls || elements.canUseDividerControls) {
      sections.push({
        id: 'shape',
        label: elements.canUseDividerControls ? 'Divider' : 'Shape',
        content: (
          <InspectorFlowSection
            title={elements.canUseDividerControls ? 'Divider Builder' : 'Shape Builder'}
            badge="Shape"
            description={elements.canUseDividerControls
              ? 'Build the divider rail itself; fill and edge controls stay in their own sections.'
              : 'Choose the primitive geometry or apply a reviewed shape role recipe.'}
            collapsible={false}
          >
            {elements.canUseShapeControls ? (
              <ShapeInspectorPanel
                element={selectedElement}
                primitiveOptions={SHAPE_PRIMITIVE_OPTIONS}
                blankPrimitives={BLANK_SHAPE_PRIMITIVES}
                rolePresets={elements.selectedElementPresetRecipeGroups.shapeRole}
                onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
              />
            ) : null}
            {elements.canUseDividerControls ? (
              <DividerStudioPanel
                element={selectedElement}
                selectedAppearance={elements.selectedAppearance}
                dividerPresets={elements.selectedElementPresetRecipeGroups.divider}
                onApplyPreset={elements.applyElementPresetRecipe}
                onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                onUpdateAppearance={(updater, trackHistory) => elements.updateElementAppearance(selectedElement.id, updater, trackHistory)}
              />
            ) : null}
          </InspectorFlowSection>
        ),
      });
    }

    if (elements.canUseTypography) {
      sections.push({
        id: 'typography',
        label: 'Text',
        content: (
          <InspectorFlowSection
            title="Text Style"
            badge="Style"
            description="Control characters, typography, spacing, and field behavior for this text element."
            collapsible={false}
          >
            <TypographyInspectorPanel
              element={selectedElement}
              currentTemplate={currentTemplate}
              availableFonts={availableFonts}
              paddingOptions={PADDING_OPTIONS}
              controlClassName={makerTheme.control}
              onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
              onUpsertFieldContract={variables.upsertFieldContract}
            />
          </InspectorFlowSection>
        ),
      });
    }

    if (elements.canUseAppearanceStudio) {
      sections.push({
        id: 'appearance',
        label: 'Look',
        content: (
          <InspectorFlowSection
            title="Fill & Effects"
            badge="Look"
            description="Change fill, texture, gradient, and glow without touching Border & Edge controls."
            collapsible={false}
          >
            <AppearanceStudioPanel
              element={selectedElement}
              selectedAppearance={elements.selectedAppearance}
              compatibleAppearanceStyles={elements.compatibleAppearanceStyles}
              compatibleTextureAssets={elements.compatibleTextureAssets}
              compatibleDividerAssets={elements.compatibleDividerAssets}
              elementStylePresets={ELEMENT_STYLE_PRESETS}
              canUseImageSource={elements.canUseImageSource}
              canUseDividerControls={elements.canUseDividerControls}
              canUseBackgroundTexture={elements.canUseBackgroundTexture}
              controlClassName={makerTheme.control}
              buttonClassName={makerTheme.button}
              assetSearch={elements.assetSearch}
              canUploadCustomAssets={canUploadCustomAssets}
              onAssetSearchChange={elements.setAssetSearch}
              onHandleAssetUpload={elements.handleAssetUpload}
              onSaveStyle={elements.saveSelectedAppearanceStyle}
              onApplyAppearancePreset={elements.applyAppearancePreset}
              onUpdateAppearance={(updater, trackHistory) => elements.updateElementAppearance(selectedElement.id, updater, trackHistory)}
            />
          </InspectorFlowSection>
        ),
      });
    }

    if (elements.canUseElementBorder) {
      sections.push({
        id: 'border',
        label: 'Border',
        content: (
          <InspectorFlowSection
            title="Border & Edge"
            badge="Border"
            description="Control the selected element container: text box edge, picture border, icon backplate, or shape stroke."
            collapsible={false}
          >
            <BorderInspectorPanel
              element={selectedElement}
              selectedAppearance={elements.selectedAppearance}
              borderPresets={elements.selectedElementPresetRecipeGroups.border}
              onApplyPreset={elements.applyElementPresetRecipe}
              onUpdateAppearance={(updater, trackHistory) => elements.updateElementAppearance(selectedElement.id, updater, trackHistory)}
            />
          </InspectorFlowSection>
        ),
      });
    }

    sections.push({
      id: 'layout',
      label: 'Layout',
      content: (
        <InspectorFlowSection
          title="Align To Canvas & Layer"
          badge="Layout"
          description="Move, size, rotate, lock, duplicate, delete, and align the selected element against the card canvas."
          collapsible={false}
        >
          <ElementTransformPanel
            element={selectedElement}
            controlClassName={makerTheme.control}
            buttonClassName={makerTheme.button}
            onDuplicate={elements.duplicateSelected}
            onDelete={elements.deleteSelected}
            onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
          />
          <ElementAlignmentPanel
            buttonClassName={makerTheme.button}
            onAlign={elements.alignSelected}
            onArrange={elements.arrangeSelected}
            onFlip={elements.flipSelected}
          />
        </InspectorFlowSection>
      ),
    });
  }

  const sectionIds = sections.map((section) => section.id);
  const memoryContextKey = selectedElement?.id ?? '__no-selection__';
  const memory = useTemplatePanelSectionMemory({
    contextKey: memoryContextKey,
    sectionIds,
    defaultSectionId: sectionIds[0] ?? '',
    maxContexts: 10,
  });
  const elementTypeLabel = selectedElement?.type
    ? `${selectedElement.type.charAt(0).toUpperCase()}${selectedElement.type.slice(1)}`
    : null;

  return (
    <aside className="cardforge-maker-side cardforge-maker-inspector min-w-0 border-t border-[var(--cf-editor-border)] bg-[#0d1117] lg:border-l lg:border-t-0">
      <TemplatePanelWorkspace
        title="Inspector"
        description={selectedElement ? `${selectedElement.name || 'Selected element'} · ${elementTypeLabel}` : 'Select a layer to edit it'}
        sections={sections}
        activeSectionId={memory.activeSectionId}
        pinnedSectionIds={memory.pinnedSectionIds}
        memoryKey={memoryContextKey}
        onActiveSectionChange={memory.setActiveSection}
        onTogglePinnedSection={memory.togglePinnedSection}
        onClose={onClose}
        closeLabel="Close inspector"
        emptyState={(
          <div className="rounded-[8px] border border-[var(--cf-editor-border)] bg-[var(--cf-editor-panel)] p-6 text-center text-sm text-muted-foreground">
            Select an element on the canvas or in Layers.
          </div>
        )}
      />
    </aside>
  );
}
