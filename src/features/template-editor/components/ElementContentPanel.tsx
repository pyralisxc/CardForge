"use client";

import type { MutableRefObject } from 'react';

import { TextElementFieldModeControl, TextExpressionEditor, TextFieldSettingsList } from '@/features/template-editor/components/TextElementInspector';
import { inferTextElementContentModel } from '@/features/template-editor/lib/textElementContracts';
import type { TemplateFieldDefinition } from '@/features/template-editor/lib/templateFields';
import type { FreeformCardElement, TCGCardTemplate } from '@/domain/templates';

type FieldContract = NonNullable<TCGCardTemplate['fieldContracts']>[number];

interface ElementContentPanelProps {
  element: FreeformCardElement;
  currentTemplate: TCGCardTemplate;
  selectedElementTemplateFields: TemplateFieldDefinition[];
  activeVariableKey: string | null;
  richTextHighlightColor: string;
  availableFonts: Array<{ value: string; name: string }>;
  variableKeyInputRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  variableCardRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  onSetActiveVariableKey: (key: string | null) => void;
  onSetRichTextHighlightColor: (color: string) => void;
  onUpdateElement: (updates: Partial<FreeformCardElement>, trackHistory?: boolean) => void;
  onAddStructuredRowPattern: () => void;
  onCreateEditorVariableFromSelection: (text: string) => string | undefined;
  onFocusVariableCard: (key: string) => void;
  onRemoveSelectedElementVariableContract: (key: string) => void;
  onRenameSelectedElementVariable: (oldKey: string, nextKey: string) => void;
  onUpsertFieldContract: (key: string, updates: Partial<FieldContract>) => void;
}

export function ElementContentPanel({
  element,
  currentTemplate,
  selectedElementTemplateFields,
  activeVariableKey,
  richTextHighlightColor,
  availableFonts,
  variableKeyInputRefs,
  variableCardRefs,
  onSetActiveVariableKey,
  onSetRichTextHighlightColor,
  onUpdateElement,
  onAddStructuredRowPattern,
  onCreateEditorVariableFromSelection,
  onFocusVariableCard,
  onRemoveSelectedElementVariableContract,
  onRenameSelectedElementVariable,
  onUpsertFieldContract,
}: ElementContentPanelProps) {
  if (element.type === 'text') {
    return (
      <>
        <TextElementFieldModeControl
          fields={selectedElementTemplateFields}
          element={element}
          fieldContracts={currentTemplate.fieldContracts}
          onAddStructuredRowPattern={onAddStructuredRowPattern}
          onUpdateContract={onUpsertFieldContract}
        />
        <TextExpressionEditor
          element={element}
          fieldCount={selectedElementTemplateFields.length}
          highlightColor={richTextHighlightColor}
          onHighlightColorChange={onSetRichTextHighlightColor}
          onContentChange={(value) => onUpdateElement({ content: value }, false)}
          onElementChange={(updates) => onUpdateElement(updates, false)}
          activeVariableKey={activeVariableKey}
          onActiveVariableChange={onSetActiveVariableKey}
          onCreateVariable={onCreateEditorVariableFromSelection}
          onEditVariable={onFocusVariableCard}
          onRenameVariable={onFocusVariableCard}
          onRemoveVariable={onRemoveSelectedElementVariableContract}
          showTextMarkerHint={inferTextElementContentModel(currentTemplate, element) === 'text'}
          fieldContracts={currentTemplate.fieldContracts}
        />
        <TextFieldSettingsList
          fields={selectedElementTemplateFields}
          element={element}
          fieldContracts={currentTemplate.fieldContracts}
          availableFonts={availableFonts}
          activeVariableKey={activeVariableKey}
          variableKeyInputRefs={variableKeyInputRefs}
          variableCardRefs={variableCardRefs}
          onFocusField={onSetActiveVariableKey}
          onRenameField={onRenameSelectedElementVariable}
          onRemoveField={onRemoveSelectedElementVariableContract}
          onUpdateContract={onUpsertFieldContract}
        />
      </>
    );
  }

  return null;
}
