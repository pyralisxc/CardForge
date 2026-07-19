"use client";

import type { Dispatch, SetStateAction } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
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
import { TemplateEditorInspectorPanel } from '@/features/template-editor/components/TemplateEditorInspectorPanel';
import { TypographyInspectorPanel } from '@/features/template-editor/components/TypographyInspectorPanel';
import type { TemplateEditorCommands } from '@/features/template-editor/hooks/useTemplateEditorCommands';
import type { TemplateEditorController } from '@/features/template-editor/hooks/useTemplateEditorController';
import type { TemplateEditorElements } from '@/features/template-editor/hooks/useTemplateEditorElements';
import type { TemplateEditorVariables } from '@/features/template-editor/hooks/useTemplateEditorVariables';
import { BLANK_SHAPE_PRIMITIVES } from '@/features/template-editor/lib/elementPresetRecipes';
import { ELEMENT_STYLE_PRESETS } from '@/features/template-editor/lib/elementStylePresets';
import { PADDING_OPTIONS } from '@/features/template-editor/lib/editorOptions';
import { ICON_OPTIONS } from '@/features/template-editor/lib/iconOptions';
import { makerTheme } from '@/features/template-editor/lib/makerTheme';

type AvailableFonts = ReturnType<typeof cardFontOptionsToSelectOptions>;

interface TemplateEditorInspectorSidebarProps {
  activeTab: string;
  availableFonts: AvailableFonts;
  canUploadCustomAssets: boolean;
  commands: TemplateEditorCommands;
  controller: TemplateEditorController;
  elements: TemplateEditorElements;
  onActiveTabChange: Dispatch<SetStateAction<string>>;
  onRichTextHighlightColorChange: (value: string) => void;
  richTextHighlightColor: string;
  variables: TemplateEditorVariables;
}

export function TemplateEditorInspectorSidebar({
  activeTab,
  availableFonts,
  canUploadCustomAssets,
  commands,
  controller,
  elements,
  onActiveTabChange,
  onRichTextHighlightColorChange,
  richTextHighlightColor,
  variables,
}: TemplateEditorInspectorSidebarProps) {
  const { currentTemplate, selectedElement, updateElement } = controller;

  return (
    <aside className="cardforge-maker-side cardforge-maker-inspector min-w-0 border-t border-[#252b35] bg-[#0d1117] lg:border-l lg:border-t-0">
      <ScrollArea className="cardforge-maker-scroll h-[calc(100vh-205px)] min-h-[760px]">
        <div className="space-y-3 p-2">
          <TemplateEditorInspectorPanel
            activeTab={activeTab}
            onActiveTabChange={onActiveTabChange}
            panelClassName={makerTheme.panel}
            hasSelectedElement={Boolean(selectedElement)}
            selectedElementType={selectedElement?.type}
            selectedElementName={selectedElement?.name}
            elementContent={selectedElement ? (
              <>
                {(elements.canUseTypography || elements.canUseImageSource) && (
                  <InspectorFlowSection
                    title={elements.canUseImageSource ? 'Image Source' : 'Source & Content'}
                    badge="Start here"
                    defaultOpen
                    description={elements.canUseImageSource
                      ? 'Choose the selected image or overlay source. Frame, crop, and edge controls stay in later sections.'
                      : 'Write the selected text and define which fields the generator will ask users to fill.'}
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
                    {elements.canUseImageSource && (
                      <ImageInspectorPanel
                        element={selectedElement}
                        imageAssets={elements.compatibleImageAssets}
                        assetSearch={elements.assetSearch}
                        onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                        onHandleFileUpload={commands.handleFileUpload}
                        onAssetSearchChange={elements.setAssetSearch}
                      />
                    )}
                  </InspectorFlowSection>
                )}

                {elements.canUseIconLibrary && (
                  <InspectorFlowSection
                    title="Source & Symbol"
                    badge="Start here"
                    defaultOpen
                    description="Pick a built-in icon, upload a symbol, or choose a reviewed icon asset before styling the glyph."
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
                )}

                {(elements.canUseShapeControls || elements.canUseDividerControls) && (
                  <InspectorFlowSection
                    title={elements.canUseDividerControls ? 'Divider Builder' : 'Shape Builder'}
                    badge="Shape"
                    defaultOpen
                    description={elements.canUseDividerControls
                      ? 'Build the divider rail itself; fill and edge controls stay below.'
                      : 'Choose the primitive geometry or apply a reviewed shape role recipe.'}
                  >
                    {elements.canUseShapeControls && (
                      <ShapeInspectorPanel
                        element={selectedElement}
                        primitiveOptions={SHAPE_PRIMITIVE_OPTIONS}
                        blankPrimitives={BLANK_SHAPE_PRIMITIVES}
                        rolePresets={elements.selectedElementPresetRecipeGroups.shapeRole}
                        onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                      />
                    )}
                    {elements.canUseDividerControls && (
                      <DividerStudioPanel
                        element={selectedElement}
                        selectedAppearance={elements.selectedAppearance}
                        dividerPresets={elements.selectedElementPresetRecipeGroups.divider}
                        onApplyPreset={elements.applyElementPresetRecipe}
                        onUpdateElement={(updates, trackHistory) => updateElement(selectedElement.id, updates, trackHistory)}
                        onUpdateAppearance={(updater, trackHistory) => elements.updateElementAppearance(selectedElement.id, updater, trackHistory)}
                      />
                    )}
                  </InspectorFlowSection>
                )}

                {elements.canUseTypography && (
                  <InspectorFlowSection title="Text Style" badge="Style" defaultOpen={false} description="Control characters, typography, spacing, and field behavior for this text element.">
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
                )}

                {elements.canUseAppearanceStudio && (
                  <InspectorFlowSection title="Fill & Effects" badge="Look" defaultOpen={false} description="Change fill, fill texture, gradient, and glow without touching Frame & Edge borders.">
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
                )}

                {elements.canUseElementBorder && (
                  <InspectorFlowSection title="Frame & Edge" badge="Frame" defaultOpen={false} description="Control the selected element container: text box edge, image frame, icon backplate, or shape stroke.">
                    <BorderInspectorPanel
                      element={selectedElement}
                      selectedAppearance={elements.selectedAppearance}
                      borderPresets={elements.selectedElementPresetRecipeGroups.border}
                      onApplyPreset={elements.applyElementPresetRecipe}
                      onUpdateAppearance={(updater, trackHistory) => elements.updateElementAppearance(selectedElement.id, updater, trackHistory)}
                    />
                  </InspectorFlowSection>
                )}

                <InspectorFlowSection title="Align To Canvas & Layer" badge="Layout" defaultOpen={false} description="Move, size, rotate, lock, duplicate, delete, and align the selected element against the card canvas.">
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
              </>
            ) : null}
          />
        </div>
      </ScrollArea>
    </aside>
  );
}
