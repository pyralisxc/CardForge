"use client";

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { clamp } from '@/features/template-editor/lib/makerGeometry';
import type { ElementPresetRecipe } from '@/lib/elementPresetRecipes';
import { parseTextBinding } from '@/lib/textBindings';
import { shouldAutoFitTextElement } from '@/lib/textElementContracts';
import { textFontSizePx } from '@/lib/textTools';
import type { FreeformCardElement, TCGCardTemplate } from '@/types';
import { PipelineRecipeMeta, getPipelineRecipeTitle } from '@/features/template-editor/components/PipelineRecipeMeta';

type FieldContract = NonNullable<TCGCardTemplate['fieldContracts']>[number];

interface TypographyInspectorPanelProps {
  element: FreeformCardElement;
  currentTemplate: TCGCardTemplate;
  availableFonts: Array<{ value: string; name: string }>;
  paddingOptions: Array<{ value: string; label: string }>;
  framePresets: ElementPresetRecipe[];
  controlClassName: string;
  onApplyPreset: (preset: ElementPresetRecipe) => void;
  onUpdateElement: (updates: Partial<FreeformCardElement>, trackHistory?: boolean) => void;
  onUpsertFieldContract: (key: string, updates: Partial<FieldContract>) => void;
}

export function TypographyInspectorPanel({
  element,
  currentTemplate,
  availableFonts,
  paddingOptions,
  framePresets,
  controlClassName,
  onApplyPreset,
  onUpdateElement,
  onUpsertFieldContract,
}: TypographyInspectorPanelProps) {
  const [frameSearch, setFrameSearch] = useState('');
  const [showAllFramePresets, setShowAllFramePresets] = useState(false);
  const normalizedFrameSearch = frameSearch.trim().toLowerCase();
  const filteredFramePresets = useMemo(() => {
    if (!normalizedFrameSearch) return framePresets;
    return framePresets.filter((preset) => [
      preset.label,
      preset.description,
      preset.kind,
      preset.source,
      preset.status,
      preset.tier,
      preset.contributorName,
    ].filter(Boolean).join(' ').toLowerCase().includes(normalizedFrameSearch));
  }, [framePresets, normalizedFrameSearch]);
  const visibleFramePresets = showAllFramePresets ? filteredFramePresets : filteredFramePresets.slice(0, 6);

  return (
    <>
      <div className="space-y-2">
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <Label className="block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Reviewed Text Frames</Label>
            <span className="text-[10px] text-[#626b78]">{filteredFramePresets.length} styles</span>
          </div>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8f95a3]" />
            <Input
              value={frameSearch}
              onChange={(event) => {
                setFrameSearch(event.target.value);
                setShowAllFramePresets(false);
              }}
              placeholder="Search text frames..."
              className="h-8 rounded-[4px] border-[#2d3340] bg-[#0f1520] pl-8 text-[11px] text-[#f3ead7] placeholder:text-[#626b78]"
            />
          </div>
          <div className="grid grid-cols-2 gap-1">
            {visibleFramePresets.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant="outline"
                size="sm"
                title={getPipelineRecipeTitle(preset)}
                aria-label={`Apply ${preset.label} text frame recipe`}
                className="h-auto min-h-9 justify-start gap-1.5 rounded-[4px] border-[#2d3340] bg-[#111720] px-2 py-1.5 text-left text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
                onClick={() => onApplyPreset(preset)}
              >
                <span
                  className="h-5 w-4 shrink-0 rounded-[3px] border border-[#3a2e17]"
                  style={{ background: preset.preview?.background || preset.updates?.backgroundColor || '#222', borderColor: preset.preview?.borderColor || preset.updates?.borderColor || '#3a2e17' }}
                />
                <span className="min-w-0">
                  <span className="block truncate text-[#f1dfb4]">{preset.label}</span>
                  <PipelineRecipeMeta recipe={preset} />
                </span>
              </Button>
            ))}
          </div>
          {filteredFramePresets.length === 0 ? (
            <div className="mt-2 rounded-[4px] border border-dashed border-[#2d3340] px-2 py-3 text-center text-[11px] text-[#8f95a3]">
              No text frames match that search.
            </div>
          ) : null}
          {filteredFramePresets.length > 6 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 h-7 w-full rounded-[4px] border border-[#2d3340] text-[10px] text-[#c8b07f] hover:bg-[#171d29]"
              onClick={() => setShowAllFramePresets((value) => !value)}
            >
              {showAllFramePresets ? 'Show fewer text frames' : `Show ${filteredFramePresets.length - 6} more text frames`}
            </Button>
          ) : null}
        </div>
      </div>

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
