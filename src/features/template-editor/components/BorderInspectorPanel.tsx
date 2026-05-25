"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColorField } from '@/components/card-forge/makerConstants';
import type { ElementPresetRecipe } from '@/lib/elementPresetRecipes';
import type { AppearanceBorderKind, FreeformAppearance, FreeformCardElement } from '@/types';

interface BorderInspectorPanelProps {
  element: FreeformCardElement;
  selectedAppearance?: FreeformAppearance;
  borderPresets: ElementPresetRecipe[];
  onApplyPreset: (preset: ElementPresetRecipe) => void;
  onUpdateAppearance: (updater: (appearance: FreeformAppearance) => FreeformAppearance, trackHistory?: boolean) => void;
}

export function BorderInspectorPanel({
  element,
  selectedAppearance,
  borderPresets,
  onApplyPreset,
  onUpdateAppearance,
}: BorderInspectorPanelProps) {
  const border = selectedAppearance?.border;
  const surface = getBorderSurfaceCopy(element);
  const borderKind = border?.kind || 'none';
  const borderWidth = border?.width ?? 0;
  const borderRadius = border?.radius ?? 0;
  const borderColor = border?.color || element.borderColor || element.strokeColor || '#d5ad54';

  const updateBorder = (updates: Partial<NonNullable<FreeformAppearance['border']>>, trackHistory = false) => {
    onUpdateAppearance((appearance) => {
      const current = appearance.border || { kind: 'none' as const, width: 0, radius: 0 };
      const nextKind = updates.kind ?? current.kind ?? 'solid';
      const nextWidth = updates.width ?? current.width ?? (nextKind === 'none' ? 0 : 1);

      return {
        ...appearance,
        border: {
          ...current,
          color: borderColor,
          radius: borderRadius,
          ...updates,
          kind: nextKind,
          width: nextKind === 'none' ? 0 : nextWidth,
        },
      };
    }, trackHistory);
  };

  return (
    <div className="space-y-2">
      <div>
        <Label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">{surface.title}</Label>
        <p className="text-[10px] leading-4 text-[#6f7785]">{surface.description}</p>
      </div>
      <Label className="block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Reviewed Edge Recipes</Label>
      <div className="grid grid-cols-2 gap-1">
        {borderPresets.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant="outline"
            size="sm"
            title={`${preset.description} - ${preset.contributorName} - ${preset.status} - ${preset.tier}`}
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
          <Label htmlFor="element-edge-style">{surface.styleLabel}</Label>
          <Select value={borderKind} onValueChange={(value) => updateBorder({ kind: value as AppearanceBorderKind }, true)}>
            <SelectTrigger id="element-edge-style"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="solid">Solid</SelectItem>
              <SelectItem value="double">Double</SelectItem>
              <SelectItem value="etched">Etched</SelectItem>
              <SelectItem value="relic">Relic</SelectItem>
              <SelectItem value="foil">Foil</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="element-edge-width">{surface.widthLabel}</Label>
          <Input
            id="element-edge-width"
            type="number"
            min="0"
            max="16"
            value={borderWidth}
            onChange={(event) => updateBorder({ width: Math.max(0, Number(event.target.value)), kind: Number(event.target.value) <= 0 ? 'none' : borderKind === 'none' ? 'solid' : borderKind })}
          />
        </div>
        <div>
          <Label htmlFor="element-edge-radius">{surface.radiusLabel}</Label>
          <Input
            id="element-edge-radius"
            type="number"
            min="0"
            max="999"
            value={borderRadius}
            onChange={(event) => updateBorder({ radius: Math.max(0, Number(event.target.value)) })}
          />
        </div>
        <div>
          <Label className="text-xs">{surface.colorLabel}</Label>
          <ColorField value={borderColor} onChange={(value) => updateBorder({ color: value })} />
        </div>
      </div>
    </div>
  );
}

function getBorderSurfaceCopy(element: FreeformCardElement) {
  if (element.type === 'image') {
    return {
      title: 'Image Frame Edge',
      description: 'Frames the image container. Image crop and source stay in Image & Overlay Source Assets.',
      styleLabel: 'Frame style',
      widthLabel: 'Frame width',
      radiusLabel: 'Corner radius',
      colorLabel: 'Frame color',
    };
  }

  if (element.type === 'icon') {
    return {
      title: 'Icon Backplate Edge',
      description: 'Frames the icon container without changing the glyph line art or uploaded symbol.',
      styleLabel: 'Backplate style',
      widthLabel: 'Edge width',
      radiusLabel: 'Backplate radius',
      colorLabel: 'Edge color',
    };
  }

  if (element.type === 'shape') {
    return {
      title: 'Shape Stroke',
      description: 'Controls the selected shape outline. Fill, texture, and role styling stay in the shape and material sections.',
      styleLabel: 'Stroke style',
      widthLabel: 'Stroke width',
      radiusLabel: 'Corner radius',
      colorLabel: 'Stroke color',
    };
  }

  return {
    title: 'Text Box Edge',
    description: 'Frames the text panel without changing the text characters, font, or variable content.',
    styleLabel: 'Box edge style',
    widthLabel: 'Edge width',
    radiusLabel: 'Corner radius',
    colorLabel: 'Edge color',
  };
}
