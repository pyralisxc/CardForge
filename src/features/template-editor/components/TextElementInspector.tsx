"use client";

import type { MutableRefObject } from 'react';
import { AlignCenter, AlignLeft, AlignRight, ListPlus, Plus, TextCursorInput, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { FreeformCardElement, TCGCardTemplate } from '@/types';
import type { TemplateFieldDefinition } from '@/lib/templateFields';
import { isStaticSegmentFieldKey, parseTemplateTextSegments } from '@/lib/textBindings';
import { textFontSizePx } from '@/lib/textTools';
import { cn } from '@/lib/utils';
import { CardForgeRichTextEditor } from '@/components/card-forge/CardForgeRichTextEditor';
import { AVAILABLE_FONTS } from '@/lib/constants';
import { clamp } from '@/features/template-editor/lib/makerGeometry';
import { makerTheme } from '@/features/template-editor/lib/makerTheme';

type FieldContract = NonNullable<TCGCardTemplate['fieldContracts']>[number];
type TextFieldContractType = 'text' | 'structuredRows';

const textContractTypeOptions: Array<{ value: TextFieldContractType; label: string; description: string }> = [
  {
    value: 'text',
    label: 'Text',
    description: 'One editable value with rich text controls and optional [ability] or [effect] markers.',
  },
  {
    value: 'structuredRows',
    label: 'Repeating Text',
    description: 'Repeat this text element as list items. Variables become the editable parts.',
  },
];

const fieldSelectClassName = 'h-8 rounded-md border border-[#252b35] bg-[#090d13] px-2 text-xs text-[#d8d1c4] outline-none focus:border-[#d5ad54]';

interface TextElementFieldModeControlProps {
  fields: TemplateFieldDefinition[];
  element: FreeformCardElement;
  fieldContracts?: FieldContract[];
  onAddStructuredRowPattern: () => void;
  onUpdateContract: (key: string, updates: Partial<FieldContract>) => void;
}

export function TextElementFieldModeControl({
  fields,
  element,
  fieldContracts,
  onAddStructuredRowPattern,
  onUpdateContract,
}: TextElementFieldModeControlProps) {
  const variableFields = fields.filter((field) => !isStaticSegmentFieldKey(field.key));
  const mode: TextFieldContractType = variableFields.some((field) => {
    const contract = fieldContracts?.find((item) => item.key === field.key && item.elementId === element.id)
      || fieldContracts?.find((item) => item.key === field.key);
    return contract?.type === 'structuredRows' || field.contentModel === 'structuredRows';
  }) ? 'structuredRows' : 'text';

  const description = mode === 'structuredRows'
    ? 'Use this text element as a repeatable list. In Generate, each item fills these variables and uses a chosen separator.'
    : 'Use this text element as normal generator text. Static/base copy and inline variables compose into one authored text area.';
  const baseTextCount = parseTemplateTextSegments(element.content)
    .filter((segment) => segment.type === 'text' && segment.text.trim().length > 0)
    .length;
  const variableCount = variableFields.length;

  const applyMode = (nextMode: TextFieldContractType) => {
    variableFields.forEach((field) => {
      onUpdateContract(field.key, {
        elementId: element.id,
        type: nextMode,
      });
    });
  };

  return (
    <div className="rounded-[6px] border border-[#3a3142] bg-[#111018] p-2 shadow-[0_0_0_1px_rgba(213,173,84,0.08)]">
      <div className="flex flex-col gap-3">
        <div className="space-y-1">
          <Label htmlFor="text-element-field-mode" className="text-[10px] uppercase tracking-[0.16em] text-[#d5ad54]">
            Text Element Generator Mode
          </Label>
          <p className="max-w-[360px] text-[11px] leading-4 text-[#aeb4c0]">{description}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Generator mode for this text element">
          {textContractTypeOptions.map((option) => {
            const selected = mode === option.value;
            const Icon = option.value === 'structuredRows' ? ListPlus : TextCursorInput;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={variableFields.length === 0}
                onClick={() => applyMode(option.value)}
                className={cn(
                  'min-h-[72px] rounded-[6px] border border-[#252b35] bg-[#090d13] p-2 text-left transition hover:border-[#6d5323] disabled:cursor-not-allowed disabled:opacity-50',
                  selected && 'border-[#d5ad54] bg-[#17120a] shadow-[0_0_0_1px_rgba(213,173,84,0.22)]'
                )}
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-[#f3ead7]">
                  <Icon className="h-4 w-4 text-[#d5ad54]" />
                  {option.label}
                </span>
                <span className="mt-1 block text-[11px] leading-4 text-[#aeb4c0]">{option.description}</span>
              </button>
            );
          })}
        </div>
        <div className="grid gap-2 text-[10px] text-[#8f95a3] sm:grid-cols-3">
          <span className="rounded border border-[#252b35] bg-[#090d13] px-2 py-1">Base text zones: {baseTextCount}</span>
          <span className="rounded border border-[#252b35] bg-[#090d13] px-2 py-1">Inline variables: {variableCount}</span>
          <span className="rounded border border-[#252b35] bg-[#090d13] px-2 py-1">
            {mode === 'structuredRows' ? `${variableCount} editable ${variableCount === 1 ? 'part' : 'parts'}` : 'One composed field'}
          </span>
        </div>
        {variableFields.length > 0 && (
          <p className="text-[10px] leading-4 text-[#8f95a3]">
            Save the template before moving to Generate so these field contracts are available for single and bulk output.
          </p>
        )}
        {mode === 'structuredRows' && (
          <div className="rounded-[6px] border border-[#252b35] bg-[#090d13] p-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f3ead7]">Repeating Text</p>
                <p className="text-[10px] leading-4 text-[#8f95a3]">
                  Add variables for the pieces users fill in. In Generate, users can add items and pick a separator like dash, slash, or line break.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(makerTheme.button, 'h-8 shrink-0 gap-1 px-2 text-[10px]')}
                onClick={onAddStructuredRowPattern}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Label + Value
              </Button>
            </div>
            <div className="mt-2 rounded-[4px] border border-[#1f2631] bg-[#0b0f15] px-2 py-1.5 font-mono text-[10px] text-[#aeb4c0]">
              Variables: {variableFields.length > 0 ? variableFields.map((field) => field.key).join(', ') : 'add label and value first'}
            </div>
          </div>
        )}
      </div>
      {variableFields.length === 0 && (
        <p className="mt-2 text-[10px] text-[#8f95a3]">
          Add at least one variable before this element can become generator text or structured rows.
        </p>
      )}
    </div>
  );
}

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
  showTextMarkerHint: boolean;
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
  showTextMarkerHint,
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
          <Label htmlFor="element-template-expression" className="text-xs">Template Text</Label>
          <span className="text-[10px] text-[#8f95a3]">Quoted variable values are preview/default text</span>
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
          <Button type="button" variant="outline" size="icon" aria-label="Align text left" title="Align left" className={cn(makerTheme.button, element.textAlign === 'left' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ textAlign: 'left' })}><AlignLeft className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="icon" aria-label="Align text center" title="Align center" className={cn(makerTheme.button, element.textAlign === 'center' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ textAlign: 'center' })}><AlignCenter className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="icon" aria-label="Align text right" title="Align right" className={cn(makerTheme.button, element.textAlign === 'right' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ textAlign: 'right' })}><AlignRight className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="sm" aria-label="Justify text" title="Justify" className={cn(makerTheme.button, element.textAlign === 'justify' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ textAlign: 'justify' })}>J</Button>
          <Button type="button" variant="outline" size="sm" aria-label="Use horizontal text direction" title="Horizontal text" className={cn(makerTheme.button, (element.writingMode || 'horizontal-tb') === 'horizontal-tb' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ writingMode: 'horizontal-tb' })}>H</Button>
          <Button type="button" variant="outline" size="sm" aria-label="Use vertical right-to-left text direction" title="Vertical right-to-left" className={cn(makerTheme.button, element.writingMode === 'vertical-rl' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ writingMode: 'vertical-rl' })}>V-RL</Button>
          <Button type="button" variant="outline" size="sm" aria-label="Use vertical left-to-right text direction" title="Vertical left-to-right" className={cn(makerTheme.button, element.writingMode === 'vertical-lr' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ writingMode: 'vertical-lr' })}>V-LR</Button>
        </CardForgeRichTextEditor>
      </div>

      {showTextMarkerHint && (
        <p className="text-[10px] text-[#8f95a3]">
          Prefix paragraphs with [ability], [effect], [reminder], [flavor], or [subtitle] to control semantic card-text rendering.
        </p>
      )}
      <p className="text-[10px] leading-4 text-[#8f95a3]">
        Example: {'{{name:"Aetherglass Vanguard"}}'} shows that value on the canvas and uses it as the generator fallback until a card row replaces it.
      </p>
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
                      aria-label={`${isBaseTextField ? 'Base field' : 'Variable name'} for ${field.label}`}
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
                        aria-label={`Prompt ${field.label} in generator`}
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
                        aria-label={`Shrink overflow text for ${field.label}`}
                        checked={Boolean(contract?.textAutoFit ?? (field.contentModel === 'text'))}
                        onCheckedChange={(checked) => onUpdateContract(field.key, {
                          elementId: element.id,
                          textAutoFit: checked,
                        })}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-[#8f95a3]">Preview Default</Label>
                    <Input
                      value={contract?.defaultValue || ''}
                      placeholder={field.defaultValue || 'No default'}
                      onChange={(event) => onUpdateContract(field.key, {
                        elementId: element.id,
                        defaultValue: event.target.value || undefined,
                      })}
                      className={cn(makerTheme.control, 'h-8 text-xs')}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-[#8f95a3]">CSV Example</Label>
                    <Input
                      value={contract?.example || ''}
                      placeholder="Sample value"
                      onChange={(event) => onUpdateContract(field.key, {
                        elementId: element.id,
                        example: event.target.value || undefined,
                      })}
                      className={cn(makerTheme.control, 'h-8 text-xs')}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-[#8f95a3]">Description</Label>
                    <Input
                      value={contract?.description || ''}
                      placeholder="Generator guidance"
                      onChange={(event) => onUpdateContract(field.key, {
                        elementId: element.id,
                        description: event.target.value || undefined,
                      })}
                      className={cn(makerTheme.control, 'h-8 text-xs')}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-[#8f95a3]">Max Length</Label>
                    <Input
                      type="number"
                      min="1"
                      value={contract?.maxLength ?? ''}
                      placeholder="Unlimited"
                      onChange={(event) => onUpdateContract(field.key, {
                        elementId: element.id,
                        maxLength: event.target.value === '' ? undefined : Math.max(1, Math.floor(Number(event.target.value) || 1)),
                      })}
                      className={cn(makerTheme.control, 'h-8 text-xs')}
                    />
                  </div>
                </div>

                <div className="mt-2 space-y-2 rounded-[6px] border border-[#252b35] bg-[#090d13] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Variable Typography</Label>
                    <span className="text-[10px] text-[#6f7684]">Applies only to this field</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-[#8f95a3]">Font Size</Label>
                      <Input
                        type="number"
                        min="6"
                        max="96"
                        value={contract?.fontSizePx ?? ''}
                        placeholder={`${textFontSizePx(element)}`}
                        onChange={(event) => onUpdateContract(field.key, {
                          elementId: element.id,
                          fontSizePx: event.target.value === '' ? undefined : clamp(Number(event.target.value) || textFontSizePx(element), 6, 96),
                        })}
                        className={cn(makerTheme.control, 'h-8 text-xs')}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] text-[#8f95a3]">Font Family</Label>
                      <select
                        value={contract?.fontFamily || ''}
                        onChange={(event) => onUpdateContract(field.key, {
                          elementId: element.id,
                          fontFamily: (event.target.value || undefined) as FieldContract['fontFamily'],
                        })}
                        className={fieldSelectClassName}
                      >
                        <option value="">Inherited</option>
                        {AVAILABLE_FONTS.map((font) => (
                          <option key={font.value} value={font.value}>{font.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] text-[#8f95a3]">Text Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={contract?.textColor || '#f3ead7'}
                          onChange={(event) => onUpdateContract(field.key, {
                            elementId: element.id,
                            textColor: event.target.value,
                          })}
                          className="h-8 w-10 shrink-0 rounded-md border-[#252b35] bg-[#090d13] p-1"
                          aria-label={`Text color for ${field.label}`}
                        />
                        <Input
                          value={contract?.textColor || ''}
                          placeholder="Inherited"
                          onChange={(event) => onUpdateContract(field.key, {
                            elementId: element.id,
                            textColor: event.target.value.trim() || undefined,
                          })}
                          className={cn(makerTheme.control, 'h-8 text-xs')}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] text-[#8f95a3]">Weight</Label>
                      <select
                        value={contract?.fontWeight || ''}
                        onChange={(event) => onUpdateContract(field.key, {
                          elementId: element.id,
                          fontWeight: (event.target.value || undefined) as FieldContract['fontWeight'],
                        })}
                        className={fieldSelectClassName}
                      >
                        <option value="">Inherited</option>
                        <option value="font-normal">Normal</option>
                        <option value="font-medium">Medium</option>
                        <option value="font-semibold">Semibold</option>
                        <option value="font-bold">Bold</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] text-[#8f95a3]">Line Height</Label>
                      <Input
                        value={contract?.lineHeight || ''}
                        placeholder="Inherited"
                        onChange={(event) => onUpdateContract(field.key, {
                          elementId: element.id,
                          lineHeight: event.target.value.trim() || undefined,
                        })}
                        className={cn(makerTheme.control, 'h-8 text-xs')}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] text-[#8f95a3]">Letter Space</Label>
                      <Input
                        value={contract?.letterSpacing || ''}
                        placeholder="Inherited"
                        onChange={(event) => onUpdateContract(field.key, {
                          elementId: element.id,
                          letterSpacing: event.target.value.trim() || undefined,
                        })}
                        className={cn(makerTheme.control, 'h-8 text-xs')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex h-9 items-center justify-between rounded-[6px] border border-[#252b35] bg-[#0b0f15] px-3">
                      <Label className="text-[11px] text-[#d8d1c4]">Italic</Label>
                      <Switch
                        aria-label={`Italic text for ${field.label}`}
                        checked={contract?.fontStyle === 'italic'}
                        onCheckedChange={(checked) => onUpdateContract(field.key, {
                          elementId: element.id,
                          fontStyle: checked ? 'italic' : 'normal',
                        })}
                      />
                    </div>
                    <div className="flex h-9 items-center justify-between rounded-[6px] border border-[#252b35] bg-[#0b0f15] px-3">
                      <Label className="text-[11px] text-[#d8d1c4]">Underline</Label>
                      <Switch
                        aria-label={`Underline text for ${field.label}`}
                        checked={contract?.textDecoration === 'underline'}
                        onCheckedChange={(checked) => onUpdateContract(field.key, {
                          elementId: element.id,
                          textDecoration: checked ? 'underline' : 'none',
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
