"use client";

import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ColorField } from '@/components/card-forge/makerConstants';
import type { FreeformCardElement } from '@/types';

interface IconInspectorPanelProps {
  element: FreeformCardElement;
  iconOptions: string[];
  symbolStylePresets: Array<{ label: string; updates: Partial<FreeformCardElement> }>;
  controlClassName: string;
  buttonClassName: string;
  onUpdateElement: (updates: Partial<FreeformCardElement>, trackHistory?: boolean) => void;
  onHandleFileUpload: (event: ChangeEvent<HTMLInputElement>, apply: (dataUri: string) => void) => void;
}

export function IconInspectorPanel({
  element,
  iconOptions,
  symbolStylePresets,
  controlClassName,
  buttonClassName,
  onUpdateElement,
  onHandleFileUpload,
}: IconInspectorPanelProps) {
  const iconUploadInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-2">
      <Label htmlFor="icon-name">Icon Source</Label>
      <Select value={element.iconName || 'Sparkles'} onValueChange={(value) => onUpdateElement({ iconName: value, iconImageSource: undefined })}>
        <SelectTrigger id="icon-name"><SelectValue /></SelectTrigger>
        <SelectContent>{iconOptions.map((icon) => <SelectItem key={icon} value={icon}>{icon}</SelectItem>)}</SelectContent>
      </Select>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <Input
          className={controlClassName}
          placeholder="Custom icon URL or {{symbolUrl}}"
          value={element.iconImageSource || ''}
          onChange={(event) => onUpdateElement({ iconImageSource: event.target.value }, false)}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="outline" size="icon" className={buttonClassName} onClick={() => iconUploadInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Upload custom icon</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="outline" size="icon" className={buttonClassName} onClick={() => onUpdateElement({ iconImageSource: undefined })}>
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear custom icon</TooltipContent>
        </Tooltip>
        <input ref={iconUploadInputRef} type="file" accept="image/*" hidden onChange={(event) => onHandleFileUpload(event, (dataUri) => onUpdateElement({ iconImageSource: dataUri }))} />
      </div>

      <div>
        <Label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Symbol Presets</Label>
        <div className="grid grid-cols-3 gap-1">
          {symbolStylePresets.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-[4px] border-[#2d3340] bg-[#111720] px-1.5 text-[10px] text-[#d8d1c4] hover:border-[#d5ad54]"
              onClick={() => onUpdateElement(preset.updates)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="element-icon-stroke" className="text-xs">Stroke</Label>
          <ColorField id="element-icon-stroke" value={element.strokeColor || element.textColor || '#fbbf24'} onChange={(value) => onUpdateElement({ strokeColor: value, textColor: value }, false)} />
        </div>
        <div>
          <Label htmlFor="element-icon-fill" className="text-xs">Fill</Label>
          <ColorField id="element-icon-fill" value={element.fillColor || '#ffffff'} onChange={(value) => onUpdateElement({ fillColor: value }, false)} />
        </div>
        <div>
          <Label htmlFor="element-icon-bg" className="text-xs">Backplate</Label>
          <ColorField id="element-icon-bg" value={element.backgroundColor || '#000000'} onChange={(value) => onUpdateElement({ backgroundColor: value }, false)} />
        </div>
        <div>
          <Label htmlFor="element-icon-stroke-width" className="text-xs">Line Weight</Label>
          <Input id="element-icon-stroke-width" type="number" min="0" value={element.strokeWidth || 0} onChange={(event) => onUpdateElement({ strokeWidth: Number(event.target.value) }, false)} />
        </div>
      </div>
    </div>
  );
}
