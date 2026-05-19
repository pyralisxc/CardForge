"use client";

import type { MutableRefObject } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { FreeformCardElement, TCGCardTemplate } from '@/types';
import type { TemplateFieldDefinition } from '@/lib/templateFields';
import { isStaticSegmentFieldKey } from '@/lib/textBindings';
import { textFontSizePx } from '@/lib/textTools';
import { cn } from '@/lib/utils';
import { CardForgeRichTextEditor } from '@/components/card-forge/CardForgeRichTextEditor';

import { clamp, makerTheme } from './makerConstants';

type FieldContract = NonNullable<TCGCardTemplate['fieldContracts']>[number];

interface TextExpressionEditorProps {
  element: FreeformCardElement;
  fieldCount: number;
  highlightColor: string;
  onHighlightColorChange: (color: string) => void;
  onContentChange: (value: string) => void;
  onElementChange: (updates: Partial<FreeformCardElement>) => void;
  activeVariableKey: string | null;
  onActiveVariableChange: (key: string | null) => void;
  onCreateVariable: (selectedText: string) => string | undefined;
  onEditVariable: (key: string) => void;
  onRenameVariable: (key: string) => void;
  onRemoveVariable: (key: string) => void;
  showRulesHint: boolean;
}

export function TextExpressionEditor({
  element,
  fieldCount,
  highlightColor,
  onHighlightColorChange,
  onContentChange,
  onElementChange,
  activeVariableKey,
  onActiveVariableChange,
  onCreateVariable,
  onEditVariable,
  onRenameVariable,
  onRemoveVariable,
  showRulesHint,
}: TextExpressionEditorProps) {
  return (
    <div className="space-y-2 rounded-[6px] border border-[#252b35] bg-[#0b0f15] p-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] uppercase tracking-[0.16em] text-[#d5ad54]">Text Editor</Label>
        <span className="rounded-full border border-[#2d3340] px-2 py-0.5 text-[10px] text-[#8f95a3]">
          {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}
        </span>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <Label htmlFor="element-template-expression" className="text-xs">Text</Label>
          <span className="text-[10px] text-[#8f95a3]">Select text, then use variable or right-click a variable span</span>
        </div>

        <CardForgeRichTextEditor
          id="element-template-expression"
          value={element.content || ''}
          highlightColor={highlightColor}
          onHighlightColorChange={onHighlightColorChange}
          onChange={onContentChange}
          activeVariableKey={activeVariableKey}
          onActiveVariableChange={onActiveVariableChange}
          onCreateVariable={onCreateVariable}
          onEditVariable={onEditVariable}
          onRenameVariable={onRenameVariable}
          onRemoveVariable={onRemoveVariable}
          placeholder="Write card text here..."
        >
          <Input
            id="quick-font-size"
            type="number"
            min="6"
            max="96"
            aria-label="Text size"
            value={textFontSizePx(element)}
            onChange={event => onElementChange({ fontSizePx: clamp(Number(event.target.value) || 14, 6, 96) })}
            className="h-7 w-14 rounded-[4px] border-[#2d3340] bg-[#111720] px-1 text-center text-xs text-[#d8d1c4]"
          />
          <Button type="button" variant="outline" size="icon" title="Align left" className={cn(makerTheme.button, element.textAlign === 'left' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ textAlign: 'left' })}><AlignLeft className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="icon" title="Align center" className={cn(makerTheme.button, element.textAlign === 'center' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ textAlign: 'center' })}><AlignCenter className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="icon" title="Align right" className={cn(makerTheme.button, element.textAlign === 'right' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ textAlign: 'right' })}><AlignRight className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="sm" title="Justify" className={cn(makerTheme.button, element.textAlign === 'justify' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ textAlign: 'justify' })}>J</Button>
          <Button type="button" variant="outline" size="sm" title="Horizontal text" className={cn(makerTheme.button, (element.writingMode || 'horizontal-tb') === 'horizontal-tb' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ writingMode: 'horizontal-tb' })}>H</Button>
          <Button type="button" variant="outline" size="sm" title="Vertical right-to-left" className={cn(makerTheme.button, element.writingMode === 'vertical-rl' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ writingMode: 'vertical-rl' })}>V-RL</Button>
          <Button type="button" variant="outline" size="sm" title="Vertical left-to-right" className={cn(makerTheme.button, element.writingMode === 'vertical-lr' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ writingMode: 'vertical-lr' })}>V-LR</Button>
        </CardForgeRichTextEditor>
      </div>

      {showRulesHint && (
        <p className="text-[10px] text-[#8f95a3]">
          Keep one dynamic rules field. Prefix paragraphs with [ability], [effect], [reminder], [flavor], or [subtitle] to control rendering per block.
        </p>
      )}
    </div>
  );
}

interface TextFieldSettingsListProps {
  fields: TemplateFieldDefinition[];
  element: FreeformCardElement;
  fieldContracts?: FieldContract[];
  activeVariableKey: string | null;
  variableKeyInputRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  variableCardRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  onFocusField: (key: string) => void;
  onRenameField: (oldKey: string, nextKey: string) => void;
  onRemoveField: (key: string) => void;
  onUpdateContract: (key: string, updates: Partial<FieldContract>) => void;
}

export function TextFieldSettingsList({
  fields,
  element,
  fieldContracts,
  activeVariableKey,
  variableKeyInputRefs,
  variableCardRefs,
  onFocusField,
  onRenameField,
  onRemoveField,
  onUpdateContract,
}: TextFieldSettingsListProps) {
  return (
    <div className="mt-2 space-y-2 rounded-[6px] border border-[#252b35] bg-[#090d13] p-2">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] uppercase tracking-[0.16em] text-[#d5ad54]">Fields In This Element</Label>
        <span className="text-[10px] text-[#8f95a3]">{fields.length} fields</span>
      </div>

      {fields.length > 0 ? (
        <div className="space-y-2">
          {fields.map((field) => {
            const contract = fieldContracts?.find((item) => item.key === field.key && item.elementId === element.id)
              || fieldContracts?.find((item) => item.key === field.key);
            const isBaseTextField = isStaticSegmentFieldKey(field.key);

            return (
              <div
                key={`template-variable-${field.key}`}
                ref={(node) => {
                  variableCardRefs.current[field.key] = node;
                }}
                className={cn(
                  'rounded-[6px] border border-[#252b35] bg-[#0b0f15] p-2 transition',
                  activeVariableKey === field.key && 'border-[#d5ad54] shadow-[0_0_0_1px_rgba(213,173,84,0.28)]'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Label className="text-[10px] text-[#8f95a3]">{isBaseTextField ? 'Base Field' : 'Variable Name'}</Label>
                    <Input
                      ref={(node) => {
                        variableKeyInputRefs.current[field.key] = node;
                      }}
                      defaultValue={isBaseTextField ? field.label : field.key}
                      readOnly={isBaseTextField}
                      className={cn(makerTheme.control, 'mt-1 h-8 font-mono text-xs')}
                      onFocus={() => onFocusField(field.key)}
                      onKeyDown={(event) => {
                        if (!isBaseTextField && event.key === 'Enter') {
                          event.preventDefault();
                          onRenameField(field.key, event.currentTarget.value);
                          event.currentTarget.blur();
                        }
                      }}
                      onBlur={(event) => {
                        if (!isBaseTextField) onRenameField(field.key, event.target.value);
                      }}
                    />
                  </div>
                  {field.required && <span className="rounded-full border border-[#6d5323] px-2 py-0.5 text-[10px] text-[#d5ad54]">Required</span>}
                </div>

                {!isBaseTextField && (
                  <div className="mt-2 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-[11px] text-[#8f95a3] hover:bg-[#141b24] hover:text-[#ffb4ae]"
                      onClick={() => onRemoveField(field.key)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove Variable
                    </Button>
                  </div>
                )}

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-[#8f95a3]">Required</Label>
                    <div className="flex h-10 items-center justify-between rounded-[6px] border border-[#252b35] bg-[#090d13] px-3">
                      <span className="text-[11px] text-[#d8d1c4]">Prompt in generator</span>
                      <Switch
                        checked={Boolean(contract?.required ?? field.required)}
                        onCheckedChange={(checked) => onUpdateContract(field.key, {
                          elementId: element.id,
                          required: checked,
                        })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-[#8f95a3]">Auto Fit</Label>
                    <div className="flex h-10 items-center justify-between rounded-[6px] border border-[#252b35] bg-[#090d13] px-3">
                      <span className="text-[11px] text-[#d8d1c4]">Shrink overflow text</span>
                      <Switch
                        checked={Boolean(contract?.textAutoFit ?? (field.contentModel === 'rulesBlocks'))}
                        onCheckedChange={(checked) => onUpdateContract(field.key, {
                          elementId: element.id,
                          textAutoFit: checked,
                        })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-[#8f95a3]">
          Highlight part of the template expression, then right-click to turn that span into a variable for this element.
        </p>
      )}
    </div>
  );
}
