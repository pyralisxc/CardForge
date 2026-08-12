"use client";

import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Image as ImageIcon, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CardAssetOption } from '@/features/developer-assets/client/assets';
import { getAssetBadgeSummary } from '@/features/developer-assets/client/assets';
import type { FreeformCardElement } from '@/domain/templates';

interface ImageInspectorPanelProps {
  element: FreeformCardElement;
  imageAssets: CardAssetOption[];
  assetSearch: string;
  onUpdateElement: (updates: Partial<FreeformCardElement>, trackHistory?: boolean) => void;
  onHandleFileUpload: (event: ChangeEvent<HTMLInputElement>, apply: (dataUri: string) => void) => void;
  onAssetSearchChange: (value: string) => void;
}

export function ImageInspectorPanel({
  element,
  imageAssets,
  assetSearch,
  onUpdateElement,
  onHandleFileUpload,
  onAssetSearchChange,
}: ImageInspectorPanelProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <div className="space-y-2 rounded-[6px] border border-[#252b35] bg-[#0b0f15] p-2">
        <Label className="block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Image source</Label>
        <div>
          <Label htmlFor="element-image-source" className="text-xs">Image URL, card field, or uploaded file</Label>
          <div className="flex gap-2">
            <Input
              id="element-image-source"
              className="h-8 rounded-[4px] border-[#2d3340] bg-[#0d1117] text-xs text-[#d8d1c4]"
              value={element.imageSource || element.content || ''}
              onChange={(event) => onUpdateElement({ imageSource: event.target.value, content: event.target.value }, false)}
            />
            <Button type="button" variant="outline" size="icon" onClick={() => imageInputRef.current?.click()} aria-label="Upload image source">
              <ImageIcon className="h-4 w-4" />
            </Button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => onHandleFileUpload(event, (dataUri) => onUpdateElement({ imageSource: dataUri, content: dataUri }))}
            />
          </div>
        </div>
        <Label className="block text-[10px] uppercase tracking-[0.14em] text-[#8f95a3]">Library and personal images</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#757d8c]" />
          <Input
            className="h-8 rounded-[4px] border-[#2d3340] bg-[#0d1117] pl-7 text-xs text-[#d8d1c4]"
            placeholder="Search images and overlays..."
            value={assetSearch}
            onChange={(event) => onAssetSearchChange(event.target.value)}
          />
        </div>
        {imageAssets.length > 0 ? (
          <div className="grid max-h-44 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
            {imageAssets.map((asset) => (
              <Tooltip key={asset.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="group min-h-[78px] rounded-[5px] border border-[#2d3340] bg-[#0b0f15] p-1.5 text-left transition hover:border-[#d5ad54]/80 hover:bg-[#111720]"
                    onClick={() => onUpdateElement({
                      imageSource: asset.url,
                      content: asset.url,
                      imageObjectFit: asset.tileMode === 'contain' ? 'contain' : element.imageObjectFit || 'cover',
                    })}
                  >
                    <span className="block h-10 rounded-[4px] border border-[#1f2530] bg-[#07090d] bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${asset.url})` }} aria-hidden="true" />
                    <span className="mt-1 block truncate text-[9px] font-semibold text-[#d8d1c4] group-hover:text-[#f5d27b]">{asset.name}</span>
                    <span className="block truncate text-[8px] uppercase tracking-[0.12em] text-[#757d8c]">{getAssetBadgeSummary(asset).join(' - ')}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>{asset.name} - {getAssetBadgeSummary(asset).join(' - ')}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        ) : (
          <div className="rounded-[5px] border border-dashed border-[#2d3340] bg-[#090d13] p-2 text-[10px] text-[#8f95a3]">
            No compatible image assets found.
          </div>
        )}
      </div>

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
      <div className="grid grid-cols-2 gap-2">
        <ImageNumberField id="element-position-x" label="Position X" value={element.imageObjectPositionX || ''} placeholder="center / 50%" onChange={(value) => onUpdateElement({ imageObjectPositionX: value }, false)} />
        <ImageNumberField id="element-position-y" label="Position Y" value={element.imageObjectPositionY || ''} placeholder="center / 50%" onChange={(value) => onUpdateElement({ imageObjectPositionY: value }, false)} />
        <ImageNumberField id="element-image-scale" label="Image Scale" type="number" step="0.05" value={element.imageScale === undefined ? '' : String(element.imageScale)} placeholder="1" onChange={(value) => onUpdateElement({ imageScale: value ? Number(value) : undefined }, false)} />
        <ImageNumberField id="element-image-rotation" label="Image Rotation" type="number" value={element.imageRotation === undefined ? '' : String(element.imageRotation)} placeholder="0" onChange={(value) => onUpdateElement({ imageRotation: value ? Number(value) : undefined }, false)} />
        <ImageNumberField id="element-image-offset-x" label="Image Offset X" type="number" value={element.imageOffsetX === undefined ? '' : String(element.imageOffsetX)} placeholder="0" onChange={(value) => onUpdateElement({ imageOffsetX: value ? Number(value) : undefined }, false)} />
        <ImageNumberField id="element-image-offset-y" label="Image Offset Y" type="number" value={element.imageOffsetY === undefined ? '' : String(element.imageOffsetY)} placeholder="0" onChange={(value) => onUpdateElement({ imageOffsetY: value ? Number(value) : undefined }, false)} />
      </div>
    </>
  );
}

function ImageNumberField({
  id,
  label,
  value,
  placeholder,
  onChange,
  type = 'text',
  step,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
  step?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input
        id={id}
        type={type}
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
