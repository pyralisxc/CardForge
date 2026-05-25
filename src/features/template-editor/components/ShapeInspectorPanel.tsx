"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColorField } from '@/components/card-forge/makerConstants';
import { normalizeAppearanceForElement } from '@/lib/appearance';
import { isElementPresetApplicable, type BlankShapePrimitive, type ElementPresetRecipe } from '@/lib/elementPresetRecipes';
import type { FreeformCardElement } from '@/types';

interface ShapeInspectorPanelProps {
  element: FreeformCardElement;
  primitiveOptions: Array<{ value: string; label: string }>;
  blankPrimitives: BlankShapePrimitive[];
  rolePresets: ElementPresetRecipe[];
  onUpdateElement: (updates: Partial<FreeformCardElement>, trackHistory?: boolean) => void;
}

export function ShapeInspectorPanel({
  element,
  primitiveOptions,
  blankPrimitives,
  rolePresets,
  onUpdateElement,
}: ShapeInspectorPanelProps) {
  const compatibleRolePresets = rolePresets.filter((preset) => isElementPresetApplicable(preset, element));

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
        <Label className="block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Blank Primitives</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {blankPrimitives.map((primitive) => (
            <Button
              key={primitive.value}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-[4px] border-[#2d3340] bg-[#111720] px-2 text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
              onClick={() => onUpdateElement(primitive.updates)}
            >
              {primitive.label}
            </Button>
          ))}
        </div>
        <Label className="block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Pipeline Recipes</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {compatibleRolePresets.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant="outline"
              size="sm"
              title={`${preset.contributorName} - ${preset.status} - ${preset.tier}`}
              className="h-auto min-h-8 flex-col items-start rounded-[4px] border-[#2d3340] bg-[#111720] px-2 py-1.5 text-left text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
              onClick={() => {
                const next = { ...element, ...preset.updates } as FreeformCardElement;
                onUpdateElement({ ...preset.updates, appearance: normalizeAppearanceForElement(next) });
              }}
            >
              <span className="w-full truncate text-[#f1dfb4]">{preset.label}</span>
              <span className="mt-1 flex w-full flex-wrap gap-1 text-[8px] uppercase tracking-[0.12em] text-[#8f95a3]">
                <span>{preset.status}</span>
                <span>{preset.tier}</span>
              </span>
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
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
