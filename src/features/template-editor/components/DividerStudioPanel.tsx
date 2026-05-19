"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { normalizeAppearanceForElement } from '@/lib/appearance';
import type { FreeformAppearance, FreeformCardElement } from '@/types';

interface DividerStudioPanelProps {
  element: FreeformCardElement;
  selectedAppearance?: FreeformAppearance;
  dividerPresets: Array<{ label: string; updates: Partial<FreeformCardElement> }>;
  onUpdateElement: (updates: Partial<FreeformCardElement>, trackHistory?: boolean) => void;
  onUpdateAppearance: (updater: (appearance: FreeformAppearance) => FreeformAppearance, trackHistory?: boolean) => void;
}

export function DividerStudioPanel({
  element,
  selectedAppearance,
  dividerPresets,
  onUpdateElement,
  onUpdateAppearance,
}: DividerStudioPanelProps) {
  return (
    <div className="space-y-2 rounded-[6px] border border-[#252b35] bg-[#0b0f15] p-2">
      <Label className="text-[10px] uppercase tracking-[0.16em] text-[#d5ad54]">Divider Studio</Label>
      <div>
        <Label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Quick Presets</Label>
        <div className="grid grid-cols-2 gap-1">
          {dividerPresets.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-[4px] border-[#2d3340] bg-[#111720] px-2 text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
              onClick={() => onUpdateElement({ ...preset.updates, appearance: normalizeAppearanceForElement({ ...element, ...preset.updates } as FreeformCardElement) })}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="divider-height" className="text-xs">Height</Label>
          <Input id="divider-height" type="number" min="4" value={element.height || 36} onChange={(event) => onUpdateElement({ height: Number(event.target.value) || 36 }, false)} />
        </div>
        <div>
          <Label htmlFor="divider-opacity" className="text-xs">Opacity</Label>
          <Input id="divider-opacity" type="number" min="0" max="100" value={Math.round((element.opacity ?? 1) * 100)} onChange={(event) => onUpdateElement({ opacity: Math.max(0, Math.min(1, Number(event.target.value) / 100)) }, false)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="divider-mode" className="text-xs">Stretch Mode</Label>
          <Select value={selectedAppearance?.tileMode || 'stretch'} onValueChange={(value) => onUpdateAppearance((appearance) => ({ ...appearance, tileMode: value as FreeformAppearance['tileMode'] }))}>
            <SelectTrigger id="divider-mode"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="stretch">Stretch</SelectItem>
              <SelectItem value="contain">Contain</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end justify-between gap-2 rounded-[5px] border border-[#252b35] bg-[#111720] px-2 py-2">
          <Label htmlFor="divider-flip" className="text-xs">Flip</Label>
          <Switch id="divider-flip" checked={Boolean(selectedAppearance?.assetFlipX)} onCheckedChange={(checked) => onUpdateAppearance((appearance) => ({ ...appearance, assetFlipX: checked }))} />
        </div>
      </div>
    </div>
  );
}
