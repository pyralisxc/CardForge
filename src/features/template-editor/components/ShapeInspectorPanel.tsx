"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColorField } from '@/components/card-forge/makerConstants';
import { normalizeAppearanceForElement } from '@/lib/appearance';
import type { FreeformCardElement } from '@/types';

interface ShapeInspectorPanelProps {
  element: FreeformCardElement;
  primitiveOptions: Array<{ value: string; label: string }>;
  rolePresets: Array<{ label: string; updates: Partial<FreeformCardElement> }>;
  shapePresets: Array<{ label: string; updates: Partial<FreeformCardElement> }>;
  onUpdateElement: (updates: Partial<FreeformCardElement>, trackHistory?: boolean) => void;
}

export function ShapeInspectorPanel({
  element,
  primitiveOptions,
  rolePresets,
  shapePresets,
  onUpdateElement,
}: ShapeInspectorPanelProps) {
  return (
    <>
      <div className="space-y-2 rounded-[6px] border border-[#252b35] bg-[#0b0f15] p-2">
        <Label className="text-[10px] uppercase tracking-[0.16em] text-[#d5ad54]">Shape Studio</Label>
        <Label htmlFor="shape-kind">Primitive</Label>
        <Select value={element.shapeKind || 'rectangle'} onValueChange={(value) => onUpdateElement({ shapeKind: value as FreeformCardElement['shapeKind'] })}>
          <SelectTrigger id="shape-kind"><SelectValue /></SelectTrigger>
          <SelectContent>
            {primitiveOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Label className="block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Role Presets</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {rolePresets.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-[4px] border-[#2d3340] bg-[#111720] px-2 text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
              onClick={() => {
                const next = { ...element, ...preset.updates } as FreeformCardElement;
                onUpdateElement({ ...preset.updates, appearance: normalizeAppearanceForElement(next) });
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <Label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Shape Presets</Label>
          <div className="grid grid-cols-2 gap-1">
            {shapePresets.map((preset) => (
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
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="element-shape-stroke" className="text-xs">Stroke</Label>
            <ColorField id="element-shape-stroke" value={element.strokeColor || element.borderColor || '#fbbf24'} onChange={(value) => onUpdateElement({ strokeColor: value, borderColor: value }, false)} />
          </div>
          <div>
            <Label htmlFor="element-shape-fill" className="text-xs">Fill</Label>
            <ColorField id="element-shape-fill" value={element.fillColor || element.backgroundColor || '#ffffff'} onChange={(value) => onUpdateElement({ fillColor: value, backgroundColor: value }, false)} />
          </div>
          <div>
            <Label htmlFor="element-shape-stroke-width" className="text-xs">Stroke Width</Label>
            <Input id="element-shape-stroke-width" type="number" min="0" value={element.strokeWidth || 0} onChange={(event) => onUpdateElement({ strokeWidth: Number(event.target.value) }, false)} />
          </div>
        </div>
      </div>
    </>
  );
}
