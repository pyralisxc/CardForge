"use client";

import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Image as ImageIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColorField } from '@/components/card-forge/makerConstants';
import type { FreeformCardElement } from '@/types';

interface ImageInspectorPanelProps {
  element: FreeformCardElement;
  canUseBackgroundTexture: boolean;
  onUpdateElement: (updates: Partial<FreeformCardElement>, trackHistory?: boolean) => void;
  onHandleFileUpload: (event: ChangeEvent<HTMLInputElement>, apply: (dataUri: string) => void) => void;
}

export function ImageInspectorPanel({
  element,
  canUseBackgroundTexture,
  onUpdateElement,
  onHandleFileUpload,
}: ImageInspectorPanelProps) {
  const elementBgInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <div>
        <Label htmlFor="element-image-border-color" className="text-xs">Frame Color</Label>
        <ColorField id="element-image-border-color" value={element.borderColor || '#c89f42'} onChange={(value) => onUpdateElement({ borderColor: value }, false)} />
      </div>

      {canUseBackgroundTexture && (
        <details className="rounded-[6px] border border-[#252b35] bg-[#0b0f15] p-2">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8f95a3]">Advanced Raw CSS</summary>
          <div className="mt-2">
            <Label htmlFor="element-bg-image">{element.type === 'text' ? 'Panel Texture / Gradient' : 'Shape Texture / Gradient'}</Label>
            <div className="flex gap-2">
              <Input id="element-bg-image" value={element.backgroundImageUrl || ''} onChange={(event) => onUpdateElement({ backgroundImageUrl: event.target.value }, false)} />
              <Button type="button" variant="outline" size="icon" onClick={() => elementBgInputRef.current?.click()}><ImageIcon className="h-4 w-4" /></Button>
              <input ref={elementBgInputRef} type="file" accept="image/*" hidden onChange={(event) => onHandleFileUpload(event, (dataUri) => onUpdateElement({ backgroundImageUrl: dataUri }))} />
            </div>
          </div>
        </details>
      )}

      <div>
        <Label htmlFor="element-fit">Image Fit</Label>
        <Select value={element.imageObjectFit || 'cover'} onValueChange={(value) => onUpdateElement({ imageObjectFit: value as FreeformCardElement['imageObjectFit'] })}>
          <SelectTrigger id="element-fit"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cover">Cover</SelectItem>
            <SelectItem value="contain">Contain</SelectItem>
            <SelectItem value="fill">Fill</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
