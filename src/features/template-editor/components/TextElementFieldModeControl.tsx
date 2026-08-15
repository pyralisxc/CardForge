"use client";

import { ListPlus, Plus, TextCursorInput } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { FreeformCardElement, TCGCardTemplate, TemplateFieldDefinition } from '@/domain/templates';
import { isStaticSegmentFieldKey, parseTemplateTextSegments } from '@/domain/rendering';
import { cn } from '@/shared/classNames';
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
    ? 'Use this text element as a repeatable list. In Make cards, each item fills these variables and uses a chosen separator.'
    : 'Use this text element as normal card text. Base copy and inline variables combine into one editable field.';
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
            Make cards field mode
          </Label>
          <p className="max-w-[360px] text-[11px] leading-4 text-[#aeb4c0]">{description}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Make cards field mode for this text element">
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
            Save the Template before moving to Make cards so these fields are available for single and bulk output.
          </p>
        )}
        {mode === 'structuredRows' && (
          <div className="rounded-[6px] border border-[#252b35] bg-[#090d13] p-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f3ead7]">Repeating Text</p>
                <p className="text-[10px] leading-4 text-[#8f95a3]">
                  Add variables for the pieces users fill in. In Make cards, users can add items and pick a separator like dash, slash, or line break.
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
