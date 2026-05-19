"use client";

import { useRef } from 'react';
import type { ChangeEvent, MutableRefObject } from 'react';
import { Image as ImageIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TextExpressionEditor, TextFieldSettingsList } from '@/components/card-forge/TextElementInspector';
import { inferTextElementContentModel } from '@/lib/textElementContracts';
import type { TemplateFieldDefinition } from '@/lib/templateFields';
import type { FreeformCardElement, TCGCardTemplate } from '@/types';

type FieldContract = NonNullable<TCGCardTemplate['fieldContracts']>[number];

interface ElementContentPanelProps {
  element: FreeformCardElement;
  currentTemplate: TCGCardTemplate;
  selectedElementTemplateFields: TemplateFieldDefinition[];
  activeVariableKey: string | null;
  richTextHighlightColor: string;
  variableKeyInputRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  variableCardRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  onSetActiveVariableKey: (key: string | null) => void;
  onSetRichTextHighlightColor: (color: string) => void;
  onUpdateElement: (updates: Partial<FreeformCardElement>, trackHistory?: boolean) => void;
  onCreateEditorVariableFromSelection: (text: string) => string | undefined;
  onFocusVariableCard: (key: string) => void;
  onRemoveSelectedElementVariableContract: (key: string) => void;
  onRenameSelectedElementVariable: (oldKey: string, nextKey: string) => void;
  onUpsertFieldContract: (key: string, updates: Partial<FieldContract>) => void;
  onHandleFileUpload: (event: ChangeEvent<HTMLInputElement>, apply: (dataUri: string) => void) => void;
}

export function ElementContentPanel({
  element,
  currentTemplate,
  selectedElementTemplateFields,
  activeVariableKey,
  richTextHighlightColor,
  variableKeyInputRefs,
  variableCardRefs,
  onSetActiveVariableKey,
  onSetRichTextHighlightColor,
  onUpdateElement,
  onCreateEditorVariableFromSelection,
  onFocusVariableCard,
  onRemoveSelectedElementVariableContract,
  onRenameSelectedElementVariable,
  onUpsertFieldContract,
  onHandleFileUpload,
}: ElementContentPanelProps) {
  const elementImageInputRef = useRef<HTMLInputElement | null>(null);

  if (element.type === 'text') {
    return (
      <>
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
          showRulesHint={inferTextElementContentModel(currentTemplate, element) === 'rulesBlocks'}
        />
        <TextFieldSettingsList
          fields={selectedElementTemplateFields}
          element={element}
          fieldContracts={currentTemplate.fieldContracts}
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

  return (
    <>
      <Label htmlFor="element-content">Image URL or Data Key</Label>
      <div className="flex gap-2">
        <Input
          id="element-content"
          value={element.imageSource || element.content || ''}
          onChange={(event) => onUpdateElement({ imageSource: event.target.value, content: event.target.value }, false)}
        />
        <Button type="button" variant="outline" size="icon" onClick={() => elementImageInputRef.current?.click()}>
          <ImageIcon className="h-4 w-4" />
        </Button>
        <input
          ref={elementImageInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => onHandleFileUpload(event, (dataUri) => onUpdateElement({ imageSource: dataUri, content: dataUri }))}
        />
      </div>
    </>
  );
}
