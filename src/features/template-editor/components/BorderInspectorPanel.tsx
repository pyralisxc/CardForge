"use client";

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FreeformCardElement } from '@/types';

interface BorderInspectorPanelProps {
  element: FreeformCardElement;
  borderPresets: Array<{ label: string; updates: Partial<FreeformCardElement> }>;
  borderWidthOptions: Array<{ value: string; label: string }>;
  borderRadiusOptions: Array<{ value: string; label: string }>;
  onUpdateElement: (updates: Partial<FreeformCardElement>, trackHistory?: boolean) => void;
}

export function BorderInspectorPanel({
  element,
  borderPresets,
  borderWidthOptions,
  borderRadiusOptions,
  onUpdateElement,
}: BorderInspectorPanelProps) {
  return (
    <div className="space-y-2">
      <Label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Border Presets</Label>
      <div className="grid grid-cols-2 gap-1">
        {borderPresets.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-[4px] border-[#2d3340] bg-[#111720] px-2 text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
            onClick={() => onUpdateElement(preset.updates)}
          >
            {preset.label}
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
