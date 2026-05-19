"use client";

import { Copy, Lock, Trash2, Unlock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { FreeformCardElement } from '@/types';

interface ElementTransformPanelProps {
  element: FreeformCardElement;
  controlClassName: string;
  buttonClassName: string;
  onDuplicate: () => void;
  onDelete: () => void;
  onUpdateElement: (updates: Partial<FreeformCardElement>, trackHistory?: boolean) => void;
}

export function ElementTransformPanel({
  element,
  controlClassName,
  buttonClassName,
  onDuplicate,
  onDelete,
  onUpdateElement,
}: ElementTransformPanelProps) {
  return (
    <>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDuplicate} className={cn(buttonClassName, 'flex-1 gap-1 text-xs')}>
          <Copy className="h-4 w-4" /> Duplicate
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDelete} className={cn(buttonClassName, 'flex-1 gap-1 text-xs')}>
          <Trash2 className="h-4 w-4 text-[#ff554a]" /> Delete
        </Button>
      </div>
      <div>
        <Label htmlFor="element-name" className="text-xs text-[#b7bdc9]">Layer Name</Label>
        <Input
          id="element-name"
          className={controlClassName}
          value={element.name}
          onChange={(event) => onUpdateElement({ name: event.target.value }, false)}
        />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {(['x', 'y', 'width', 'height'] as const).map((key) => (
          <div key={key}>
            <Label htmlFor={`element-${key}`} className="text-[10px] uppercase tracking-wide text-[#8f95a3]">{key}</Label>
            <Input
              id={`element-${key}`}
              className={controlClassName}
              type="number"
              value={Math.round(element[key])}
              onChange={(event) => onUpdateElement({ [key]: Number(event.target.value) } as Partial<FreeformCardElement>, false)}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label htmlFor="element-rotation" className="text-xs text-[#b7bdc9]">Rotation</Label>
          <Input
            id="element-rotation"
            className={controlClassName}
            type="number"
            value={element.rotation || 0}
            onChange={(event) => onUpdateElement({ rotation: Number(event.target.value) }, false)}
          />
        </div>
        <div>
          <Label htmlFor="element-z" className="text-xs text-[#b7bdc9]">Z</Label>
          <Input
            id="element-z"
            className={controlClassName}
            type="number"
            value={element.zIndex}
            onChange={(event) => onUpdateElement({ zIndex: Number(event.target.value) }, false)}
          />
        </div>
        <div className="flex items-end gap-2 pb-2">
          <Switch checked={!!element.locked} onCheckedChange={(checked) => onUpdateElement({ locked: checked })} aria-label="Lock element" />
          {element.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Opacity</Label>
          <span className="text-xs text-muted-foreground">{Math.round((element.opacity ?? 1) * 100)}%</span>
        </div>
        <Slider
          value={[Math.round((element.opacity ?? 1) * 100)]}
          min={0}
          max={100}
          step={1}
          onValueChange={(value) => onUpdateElement({ opacity: value[0] / 100 }, false)}
        />
      </div>
    </>
  );
}
