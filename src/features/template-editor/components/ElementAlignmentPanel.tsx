"use client";

import {
  AlignCenter,
  AlignHorizontalSpaceAround,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ElementAlignmentPanelProps {
  buttonClassName: string;
  onAlign: (alignment: 'left' | 'center' | 'right') => void;
  onArrange: (direction: 'front' | 'up' | 'back') => void;
}

export function ElementAlignmentPanel({
  buttonClassName,
  onAlign,
  onArrange,
}: ElementAlignmentPanelProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="icon" onClick={() => onAlign('left')} className={buttonClassName}>
            <AlignLeft className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Align left edge to canvas</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="icon" onClick={() => onAlign('center')} className={buttonClassName}>
            <AlignCenter className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Center horizontally on canvas</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="icon" onClick={() => onAlign('right')} className={buttonClassName}>
            <AlignRight className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Align right edge to canvas</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="icon" onClick={() => onArrange('front')} className={buttonClassName}>
            <ArrowUpToLine className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Bring to front (top layer)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="icon" onClick={() => onArrange('up')} className={buttonClassName}>
            <AlignHorizontalSpaceAround className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Move up one layer</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="icon" onClick={() => onArrange('back')} className={buttonClassName}>
            <ArrowDownToLine className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Send to back (bottom layer)</TooltipContent>
      </Tooltip>
    </div>
  );
}
