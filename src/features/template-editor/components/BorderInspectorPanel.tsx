"use client";

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ElementPresetRecipe } from '@/lib/elementPresetRecipes';
import type { FreeformCardElement } from '@/types';

interface BorderInspectorPanelProps {
  element: FreeformCardElement;
  borderPresets: ElementPresetRecipe[];
  borderWidthOptions: Array<{ value: string; label: string }>;
  borderRadiusOptions: Array<{ value: string; label: string }>;
  onApplyPreset: (preset: ElementPresetRecipe) => void;
  onUpdateElement: (updates: Partial<FreeformCardElement>, trackHistory?: boolean) => void;
}

export function BorderInspectorPanel({
  element,
  borderPresets,
  borderWidthOptions,
  borderRadiusOptions,
  onApplyPreset,
  onUpdateElement,
}: BorderInspectorPanelProps) {
  return (
    <div className="space-y-2">
      <Label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Pipeline Border Recipes</Label>
      <div className="grid grid-cols-2 gap-1">
        {borderPresets.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant="outline"
            size="sm"
            title={`${preset.contributorName} - ${preset.status} - ${preset.tier}`}
            className="h-auto min-h-8 justify-start gap-1.5 rounded-[4px] border-[#2d3340] bg-[#111720] px-2 py-1.5 text-left text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
            onClick={() => onApplyPreset(preset)}
          >
            <span
              className="h-4 w-4 shrink-0 rounded-[3px] border"
              style={{
                background: preset.preview?.background || preset.updates?.backgroundColor || '#111720',
                borderColor: preset.preview?.borderColor || preset.updates?.borderColor || '#2d3340',
              }}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="block truncate text-[#f1dfb4]">{preset.label}</span>
              <span className="block truncate text-[8px] uppercase tracking-[0.12em] text-[#8f95a3]">{preset.status} - {preset.tier}</span>
            </span>
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="element-border-width">Border Width</Label>
          <Select value={element.borderWidth || '_none_'} onValueChange={(value) => onUpdateElement({ borderWidth: value })}>
            <SelectTrigger id="element-border-width"><SelectValue /></SelectTrigger>
            <SelectContent>{borderWidthOptions.map((width) => <SelectItem key={width.value} value={width.value}>{width.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="element-radius">Radius</Label>
          <Select value={element.borderRadius || 'rounded-none'} onValueChange={(value) => onUpdateElement({ borderRadius: value })}>
            <SelectTrigger id="element-radius"><SelectValue /></SelectTrigger>
            <SelectContent>{borderRadiusOptions.map((radius) => <SelectItem key={radius.value} value={radius.value}>{radius.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
