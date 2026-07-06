"use client";

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { clamp } from '@/features/template-editor/lib/makerGeometry';
import { parseTextBinding } from '@/lib/textBindings';
import { shouldAutoFitTextElement } from '@/lib/textElementContracts';
import { textFontSizePx } from '@/lib/textTools';
import type { FreeformCardElement, TCGCardTemplate } from '@/types';

type FieldContract = NonNullable<TCGCardTemplate['fieldContracts']>[number];

interface TypographyInspectorPanelProps {
  element: FreeformCardElement;
  currentTemplate: TCGCardTemplate;
  availableFonts: Array<{ value: string; name: string }>;
  paddingOptions: Array<{ value: string; label: string }>;
  controlClassName: string;
  onUpdateElement: (updates: Partial<FreeformCardElement>, trackHistory?: boolean) => void;
  onUpsertFieldContract: (key: string, updates: Partial<FieldContract>) => void;
}

export function TypographyInspectorPanel({
  element,
  currentTemplate,
  availableFonts,
  paddingOptions,
  controlClassName,
  onUpdateElement,
  onUpsertFieldContract,
}: TypographyInspectorPanelProps) {
  return (
    <>
      <details className="rounded-[6px] border border-[#252b35] bg-[#0b0f15] p-2">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8f95a3]">Text Details</summary>
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="element-font">Font</Label>
              <Select value={element.fontFamily || 'font-sans'} onValueChange={(value) => onUpdateElement({ fontFamily: value })}>
                <SelectTrigger id="element-font" aria-label="Element font family"><SelectValue /></SelectTrigger>
                <SelectContent>{availableFonts.map((font) => <SelectItem key={font.value} value={font.value}>{font.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="element-padding">Padding</Label>
              <Select value={element.padding || 'p-1'} onValueChange={(value) => onUpdateElement({ padding: value })}>
                <SelectTrigger id="element-padding" aria-label="Element text padding"><SelectValue /></SelectTrigger>
                <SelectContent>{paddingOptions.map((padding) => <SelectItem key={padding.value} value={padding.value}>{padding.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="element-writing-mode" className="cursor-help">Direction</Label>
                </TooltipTrigger>
                <TooltipContent>Vertical modes stack each letter upright, like East Asian text</TooltipContent>
              </Tooltip>
              <Select value={element.writingMode || 'horizontal-tb'} onValueChange={(value) => onUpdateElement({ writingMode: value as FreeformCardElement['writingMode'] })}>
                <SelectTrigger id="element-writing-mode" aria-label="Element text direction"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="horizontal-tb">Horizontal</SelectItem>
                  <SelectItem value="vertical-rl">Vertical Up/Down (R to L)</SelectItem>
                  <SelectItem value="vertical-lr">Vertical Up/Down (L to R)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="element-text-transform">Transform</Label>
              <Select value={element.textTransform || 'none'} onValueChange={(value) => onUpdateElement({ textTransform: value as FreeformCardElement['textTransform'] })}>
                <SelectTrigger id="element-text-transform" aria-label="Element text transform"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="uppercase">UPPERCASE</SelectItem>
                  <SelectItem value="lowercase">lowercase</SelectItem>
                  <SelectItem value="capitalize">Capitalize</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="element-line-height" className="cursor-help">Line Height</Label>
                </TooltipTrigger>
                <TooltipContent>Spacing between lines. 1.0 = tight, 1.5 = normal, 2.0 = loose</TooltipContent>
              </Tooltip>
              <Input
                id="element-line-height"
                className={controlClassName}
                type="number"
                step="0.05"
                min="0.8"
                max="4"
                placeholder="1.4"
                value={element.lineHeight || ''}
                onChange={(event) => onUpdateElement({ lineHeight: event.target.value || undefined }, false)}
              />
            </div>
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="element-letter-spacing" className="cursor-help">Letter Spacing</Label>
                </TooltipTrigger>
                <TooltipContent>e.g. 0.05em (loose) or -0.02em (tight)</TooltipContent>
              </Tooltip>
              <Input
                id="element-letter-spacing"
                className={controlClassName}
                placeholder="0em"
                value={element.letterSpacing || ''}
                onChange={(event) => onUpdateElement({ letterSpacing: event.target.value || undefined }, false)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="element-text-autofit">Shrink to Fit</Label>
              <div className="flex h-10 items-center justify-between rounded-[6px] border border-[#252b35] bg-[#090d13] px-3">
                <span className="text-[11px] text-[#d8d1c4]">Reduce text size if it overflows</span>
                <Switch
                  id="element-text-autofit"
                  aria-label="Reduce text size if it overflows"
                  checked={shouldAutoFitTextElement(currentTemplate, element)}
                  onCheckedChange={(checked) => {
                    const boundField = parseTextBinding(element.content).field;
                    if (boundField) {
                      onUpsertFieldContract(boundField, {
                        elementId: element.id,
                        textAutoFit: checked,
                      });
                    }
                    onUpdateElement({ textAutoFit: checked }, false);
                  }}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="element-min-font-size">Min Size (px)</Label>
              <Input
                id="element-min-font-size"
                type="number"
                min="6"
                max={textFontSizePx(element)}
                value={element.textMinFontSizePx || 8}
                onChange={(event) => {
                  const nextMin = clamp(Number(event.target.value) || 8, 6, textFontSizePx(element));
                  const boundField = parseTextBinding(element.content).field;
                  if (boundField) {
                    onUpsertFieldContract(boundField, {
                      elementId: element.id,
                      minFontSizePx: nextMin,
                    });
                  }
                  onUpdateElement({ textMinFontSizePx: nextMin }, false);
                }}
              />
            </div>
          </div>
        </div>
      </details>
    </>
  );
}
