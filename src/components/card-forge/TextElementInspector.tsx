"use client";

import type { MutableRefObject } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AVAILABLE_FONTS, FONT_STYLES, FONT_WEIGHTS, TEXT_ALIGNS } from '@/lib/constants';
import {
  columnsFromCommaSeparatedLabels,
  DEFAULT_STRUCTURED_LIST_COLUMN_SEPARATOR,
  DEFAULT_STRUCTURED_LIST_ROW_SEPARATOR,
  normalizeStructuredListColumns,
} from '@/lib/structuredList';
import type { FreeformCardElement, StructuredListPartStyle, TCGCardTemplate } from '@/types';
import type { TemplateFieldDefinition } from '@/lib/templateFields';
import { isStaticSegmentFieldKey } from '@/lib/textBindings';
import { textFontSizePx } from '@/lib/textTools';
import { cn } from '@/lib/utils';
import { CardForgeRichTextEditor } from '@/components/card-forge/CardForgeRichTextEditor';

import { ColorField, clamp, makerTheme } from './makerConstants';

type FieldContract = NonNullable<TCGCardTemplate['fieldContracts']>[number];
type TextContractKey = keyof Pick<
  FieldContract,
  'fontFamily' | 'fontSizePx' | 'fontWeight' | 'fontStyle' | 'textDecoration' | 'textAlign' | 'writingMode' | 'lineHeight' | 'letterSpacing' | 'textColor' | 'minFontSizePx'
>;

const INHERIT_VALUE = '__inherit__';
const TEXT_DECORATIONS: Array<NonNullable<FieldContract['textDecoration']>> = ['none', 'underline', 'line-through'];
const WRITING_MODES: Array<NonNullable<FieldContract['writingMode']>> = ['horizontal-tb', 'vertical-rl', 'vertical-lr'];
const FIELD_TYPE_OPTIONS: Array<{ value: NonNullable<FieldContract['type']>; label: string }> = [
  { value: 'text', label: 'Plain text' },
  { value: 'richText', label: 'Rich text' },
  { value: 'rules', label: 'Rules text' },
  { value: 'structuredList', label: 'Structured rows' },
];

const contractSelectValue = (value?: string): string => value || INHERIT_VALUE;
const cleanStructuredPartStyle = (style: StructuredListPartStyle): StructuredListPartStyle | undefined => {
  const cleaned = Object.fromEntries(
    Object.entries(style).filter(([, value]) => value !== undefined && value !== '')
  ) as StructuredListPartStyle;

  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
};
const updateOptionalContractValue = <K extends TextContractKey>(
  key: K,
  value: FieldContract[K] | typeof INHERIT_VALUE,
): Pick<FieldContract, K> => ({
  [key]: value === INHERIT_VALUE ? undefined : value,
}) as Pick<FieldContract, K>;

interface StructuredPartStyleControlsProps {
  title: string;
  description?: string;
  style?: StructuredListPartStyle;
  inheritedColor: string;
  onChange: (style: StructuredListPartStyle | undefined) => void;
}

function StructuredPartStyleControls({
  title,
  description,
  style,
  inheritedColor,
  onChange,
}: StructuredPartStyleControlsProps) {
  const updateStyle = (updates: StructuredListPartStyle) => {
    onChange(cleanStructuredPartStyle({ ...(style || {}), ...updates }));
  };

  return (
    <div className="space-y-2 rounded-[6px] border border-[#252b35] bg-[#090d13] p-2">
      <div>
        <Label className="text-[10px] uppercase tracking-[0.12em] text-[#d5ad54]">{title}</Label>
        {description && <p className="mt-0.5 text-[10px] text-[#757d8c]">{description}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-[#8f95a3]">Font</Label>
          <Select
            value={contractSelectValue(style?.fontFamily)}
            onValueChange={(value) => updateStyle({ fontFamily: value === INHERIT_VALUE ? undefined : value as StructuredListPartStyle['fontFamily'] })}
          >
            <SelectTrigger className={cn(makerTheme.control, 'h-8 text-xs')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INHERIT_VALUE}>Inherit</SelectItem>
              {AVAILABLE_FONTS.map((font) => (
                <SelectItem key={font.value} value={font.value}>{font.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-[#8f95a3]">Size</Label>
          <Input
            type="number"
            min="4"
            max="144"
            placeholder="Inherit"
            value={style?.fontSizePx ?? ''}
            onChange={(event) => updateStyle({
              fontSizePx: event.target.value === '' ? undefined : clamp(Number(event.target.value) || 12, 4, 144),
            })}
            className={cn(makerTheme.control, 'h-8 text-xs')}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-[#8f95a3]">Weight</Label>
          <Select
            value={contractSelectValue(style?.fontWeight)}
            onValueChange={(value) => updateStyle({ fontWeight: value === INHERIT_VALUE ? undefined : value as StructuredListPartStyle['fontWeight'] })}
          >
            <SelectTrigger className={cn(makerTheme.control, 'h-8 text-xs')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INHERIT_VALUE}>Inherit</SelectItem>
              {FONT_WEIGHTS.map((weight) => (
                <SelectItem key={weight} value={weight}>{weight.replace('font-', '')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-[#8f95a3]">Style</Label>
          <Select
            value={contractSelectValue(style?.fontStyle)}
            onValueChange={(value) => updateStyle({ fontStyle: value === INHERIT_VALUE ? undefined : value as StructuredListPartStyle['fontStyle'] })}
          >
            <SelectTrigger className={cn(makerTheme.control, 'h-8 text-xs')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INHERIT_VALUE}>Inherit</SelectItem>
              {FONT_STYLES.map((fontStyle) => (
                <SelectItem key={fontStyle} value={fontStyle}>{fontStyle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-[#8f95a3]">Color</Label>
          <ColorField
            value={style?.textColor || inheritedColor}
            onChange={(value) => updateStyle({ textColor: value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-[#8f95a3]">Decoration</Label>
          <Select
            value={contractSelectValue(style?.textDecoration)}
            onValueChange={(value) => updateStyle({ textDecoration: value === INHERIT_VALUE ? undefined : value as StructuredListPartStyle['textDecoration'] })}
          >
            <SelectTrigger className={cn(makerTheme.control, 'h-8 text-xs')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INHERIT_VALUE}>Inherit</SelectItem>
              {TEXT_DECORATIONS.map((decoration) => (
                <SelectItem key={decoration} value={decoration}>{decoration}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
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
            const fieldTypeValue = contract?.type
              || (field.contentModel === 'structuredList'
                ? 'structuredList'
                : field.contentModel === 'rulesBlocks'
                  ? 'rules'
                  : field.contentModel === 'richText'
                    ? 'richText'
                    : 'text');
            const structuredColumns = normalizeStructuredListColumns(contract?.structuredListColumns);
            const structuredColumnSeparator = contract?.structuredListColumnSeparator ?? DEFAULT_STRUCTURED_LIST_COLUMN_SEPARATOR;
            const structuredRowSeparatorText = contract?.structuredListRowSeparatorText ?? '';
            const inheritedStructuredColor = contract?.textColor || element.textColor || '#f5d27b';
            const updateStructuredColumnStyle = (columnKey: string, style: StructuredListPartStyle | undefined) => {
              const nextStyles = { ...(contract?.structuredListColumnStyles || {}) };
              if (style) {
                nextStyles[columnKey] = style;
              } else {
                delete nextStyles[columnKey];
              }
              onUpdateContract(field.key, {
                elementId: element.id,
                type: 'structuredList',
                structuredListColumnStyles: Object.keys(nextStyles).length > 0 ? nextStyles : undefined,
              });
            };

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

                <div className="mt-2 grid gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-[#8f95a3]">Generator Input Type</Label>
                    <Select
                      value={fieldTypeValue}
                      onValueChange={(value) => onUpdateContract(field.key, {
                        elementId: element.id,
                        type: value as FieldContract['type'],
                        structuredListColumns: value === 'structuredList'
                          ? structuredColumns
                          : undefined,
                      })}
                    >
                      <SelectTrigger className={cn(makerTheme.control, 'h-8 text-xs')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {fieldTypeValue === 'structuredList' && (
                    <div className="space-y-2 rounded-[6px] border border-[#252b35] bg-[#070a0f] p-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-[#8f95a3]">Row Columns</Label>
                        <Input
                          defaultValue={structuredColumns.map((column) => column.label).join(', ')}
                          placeholder="Position, Description"
                          className={cn(makerTheme.control, 'h-8 text-xs')}
                          onBlur={(event) => onUpdateContract(field.key, {
                            elementId: element.id,
                            type: 'structuredList',
                            structuredListColumns: columnsFromCommaSeparatedLabels(event.target.value),
                          })}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              event.currentTarget.blur();
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-[#8f95a3]">Between Columns</Label>
                        <Input
                          value={structuredColumnSeparator}
                          placeholder=" - "
                          className={cn(makerTheme.control, 'h-8 text-xs')}
                          onChange={(event) => onUpdateContract(field.key, {
                            elementId: element.id,
                            type: 'structuredList',
                            structuredListColumnSeparator: event.target.value,
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-[#8f95a3]">Between Rows Text</Label>
                        <Input
                          value={structuredRowSeparatorText}
                          placeholder="Leave blank for a clean line break"
                          className={cn(makerTheme.control, 'h-8 text-xs')}
                          onChange={(event) => onUpdateContract(field.key, {
                            elementId: element.id,
                            type: 'structuredList',
                            structuredListRowSeparatorText: event.target.value,
                          })}
                        />
                      </div>
                      <StructuredPartStyleControls
                        title="Between Rows Style"
                        description="Styles the optional text that appears between generated rows."
                        style={contract?.structuredListRowSeparatorStyle}
                        inheritedColor={inheritedStructuredColor}
                        onChange={(style) => onUpdateContract(field.key, {
                          elementId: element.id,
                          type: 'structuredList',
                          structuredListRowSeparatorStyle: style,
                        })}
                      />
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase tracking-[0.12em] text-[#d5ad54]">Column Styles</Label>
                        {structuredColumns.map((column) => (
                          <StructuredPartStyleControls
                            key={column.key}
                            title={column.label}
                            description={`Styles the ${column.label.toLowerCase()} sub-variable in every row.`}
                            style={contract?.structuredListColumnStyles?.[column.key]}
                            inheritedColor={inheritedStructuredColor}
                            onChange={(style) => updateStructuredColumnStyle(column.key, style)}
                          />
                        ))}
                      </div>
                      <details className="rounded-[6px] border border-[#252b35] bg-[#090d13] p-2">
                        <summary className="cursor-pointer text-[10px] uppercase tracking-[0.12em] text-[#8f95a3]">
                          Advanced raw format fallback
                        </summary>
                        <div className="mt-2 space-y-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-[#8f95a3]">Raw Row Format</Label>
                            <Input
                              defaultValue={contract?.structuredListRowTemplate || ''}
                              placeholder="Optional legacy token format"
                              className={cn(makerTheme.control, 'h-8 font-mono text-xs')}
                              onBlur={(event) => onUpdateContract(field.key, {
                                elementId: element.id,
                                type: 'structuredList',
                                structuredListRowTemplate: event.target.value.trim() || undefined,
                              })}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  event.currentTarget.blur();
                                }
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-[#8f95a3]">Raw Between Rows</Label>
                            <Input
                              defaultValue={contract?.structuredListRowSeparator || ''}
                              placeholder={DEFAULT_STRUCTURED_LIST_ROW_SEPARATOR.replace(/\n/g, '\\n')}
                              className={cn(makerTheme.control, 'h-8 font-mono text-xs')}
                              onBlur={(event) => onUpdateContract(field.key, {
                                elementId: element.id,
                                type: 'structuredList',
                                structuredListRowSeparator: event.target.value || undefined,
                              })}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  event.currentTarget.blur();
                                }
                              }}
                            />
                          </div>
                        </div>
                      </details>
                      <p className="text-[10px] leading-relaxed text-[#757d8c]">
                        These controls build the structured row format for users. Single Generator can add, remove, and reorder rows without anyone typing template tokens.
                      </p>
                    </div>
                  )}
                </div>

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

                <div className="mt-3 space-y-2 rounded-[6px] border border-[#252b35] bg-[#070a0f] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[10px] uppercase tracking-[0.14em] text-[#d5ad54]">Variable Typography</Label>
                    <span className="text-[10px] text-[#757d8c]">Inherits parent unless set</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-[#8f95a3]">Font</Label>
                      <Select
                        value={contractSelectValue(contract?.fontFamily)}
                        onValueChange={(value) => onUpdateContract(field.key, {
                          elementId: element.id,
                          ...updateOptionalContractValue('fontFamily', value as FieldContract['fontFamily'] | typeof INHERIT_VALUE),
                        })}
                      >
                        <SelectTrigger className={cn(makerTheme.control, 'h-8 text-xs')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={INHERIT_VALUE}>Inherit parent</SelectItem>
                          {AVAILABLE_FONTS.map((font) => (
                            <SelectItem key={font.value} value={font.value}>{font.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-[#8f95a3]">Size</Label>
                      <Input
                        type="number"
                        min="6"
                        max="144"
                        aria-label={`${field.label} variable font size`}
                        placeholder="Inherit"
                        value={contract?.fontSizePx ?? ''}
                        onChange={(event) => onUpdateContract(field.key, {
                          elementId: element.id,
                          fontSizePx: event.target.value === '' ? undefined : clamp(Number(event.target.value) || 14, 6, 144),
                        })}
                        className={cn(makerTheme.control, 'h-8 text-xs')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-[#8f95a3]">Weight</Label>
                      <Select
                        value={contractSelectValue(contract?.fontWeight)}
                        onValueChange={(value) => onUpdateContract(field.key, {
                          elementId: element.id,
                          ...updateOptionalContractValue('fontWeight', value as FieldContract['fontWeight'] | typeof INHERIT_VALUE),
                        })}
                      >
                        <SelectTrigger className={cn(makerTheme.control, 'h-8 text-xs')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={INHERIT_VALUE}>Inherit parent</SelectItem>
                          {FONT_WEIGHTS.map((weight) => (
                            <SelectItem key={weight} value={weight}>{weight.replace('font-', '')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-[#8f95a3]">Style</Label>
                      <Select
                        value={contractSelectValue(contract?.fontStyle)}
                        onValueChange={(value) => onUpdateContract(field.key, {
                          elementId: element.id,
                          ...updateOptionalContractValue('fontStyle', value as FieldContract['fontStyle'] | typeof INHERIT_VALUE),
                        })}
                      >
                        <SelectTrigger className={cn(makerTheme.control, 'h-8 text-xs')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={INHERIT_VALUE}>Inherit parent</SelectItem>
                          {FONT_STYLES.map((style) => (
                            <SelectItem key={style} value={style}>{style}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-[#8f95a3]">Color</Label>
                      <ColorField
                        value={contract?.textColor || element.textColor || '#f5d27b'}
                        onChange={(value) => onUpdateContract(field.key, {
                          elementId: element.id,
                          textColor: value,
                        })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-[#8f95a3]">Decoration</Label>
                      <Select
                        value={contractSelectValue(contract?.textDecoration)}
                        onValueChange={(value) => onUpdateContract(field.key, {
                          elementId: element.id,
                          ...updateOptionalContractValue('textDecoration', value as FieldContract['textDecoration'] | typeof INHERIT_VALUE),
                        })}
                      >
                        <SelectTrigger className={cn(makerTheme.control, 'h-8 text-xs')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={INHERIT_VALUE}>Inherit parent</SelectItem>
                          {TEXT_DECORATIONS.map((decoration) => (
                            <SelectItem key={decoration} value={decoration}>{decoration}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-[#8f95a3]">Alignment</Label>
                      <Select
                        value={contractSelectValue(contract?.textAlign)}
                        onValueChange={(value) => onUpdateContract(field.key, {
                          elementId: element.id,
                          ...updateOptionalContractValue('textAlign', value as FieldContract['textAlign'] | typeof INHERIT_VALUE),
                        })}
                      >
                        <SelectTrigger className={cn(makerTheme.control, 'h-8 text-xs')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={INHERIT_VALUE}>Inherit parent</SelectItem>
                          {TEXT_ALIGNS.map((align) => (
                            <SelectItem key={align} value={align}>{align}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-[#8f95a3]">Writing</Label>
                      <Select
                        value={contractSelectValue(contract?.writingMode)}
                        onValueChange={(value) => onUpdateContract(field.key, {
                          elementId: element.id,
                          ...updateOptionalContractValue('writingMode', value as FieldContract['writingMode'] | typeof INHERIT_VALUE),
                        })}
                      >
                        <SelectTrigger className={cn(makerTheme.control, 'h-8 text-xs')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={INHERIT_VALUE}>Inherit parent</SelectItem>
                          {WRITING_MODES.map((mode) => (
                            <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-[#8f95a3]">Line Height</Label>
                      <Input
                        aria-label={`${field.label} variable line height`}
                        placeholder={element.lineHeight || 'Inherit'}
                        value={contract?.lineHeight ?? ''}
                        onChange={(event) => onUpdateContract(field.key, {
                          elementId: element.id,
                          lineHeight: event.target.value || undefined,
                        })}
                        className={cn(makerTheme.control, 'h-8 text-xs')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-[#8f95a3]">Letter Space</Label>
                      <Input
                        aria-label={`${field.label} variable letter spacing`}
                        placeholder={element.letterSpacing || '0px'}
                        value={contract?.letterSpacing ?? ''}
                        onChange={(event) => onUpdateContract(field.key, {
                          elementId: element.id,
                          letterSpacing: event.target.value || undefined,
                        })}
                        className={cn(makerTheme.control, 'h-8 text-xs')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-[#8f95a3]">Min Auto-fit</Label>
                      <Input
                        type="number"
                        min="4"
                        max="96"
                        aria-label={`${field.label} variable minimum auto-fit size`}
                        placeholder="Inherit"
                        value={contract?.minFontSizePx ?? ''}
                        onChange={(event) => onUpdateContract(field.key, {
                          elementId: element.id,
                          minFontSizePx: event.target.value === '' ? undefined : clamp(Number(event.target.value) || 8, 4, 96),
                        })}
                        className={cn(makerTheme.control, 'h-8 text-xs')}
                      />
                    </div>
                  </div>

                  <p className="text-[10px] leading-relaxed text-[#757d8c]">
                    Variables stay in the parent text box flow. Move or resize the parent text layer for absolute placement; use these controls for per-variable styling.
                  </p>
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
