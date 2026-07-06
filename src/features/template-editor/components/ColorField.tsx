"use client";

import { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ColorFieldProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

export function ColorField({ value, onChange, id }: ColorFieldProps) {
  const [open, setOpen] = useState(false);
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className="h-8 w-full rounded-[4px] border border-[#2d3340] focus:outline-none focus:ring-1 focus:ring-[#d5ad54]"
          style={{ backgroundColor: hex }}
          aria-label={`Color ${hex}`}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2 bg-[#0d1117] border-[#252b35]" side="left" align="start">
        <HexColorPicker color={hex} onChange={onChange} />
        <input
          type="text"
          defaultValue={hex}
          key={hex}
          title="Hex color value"
          onBlur={(event) => {
            if (/^#[0-9a-fA-F]{6}$/.test(event.target.value)) {
              onChange(event.target.value);
            }
          }}
          className="mt-2 h-7 w-full rounded-[4px] border border-[#2d3340] bg-[#080b10] px-2 text-center font-mono text-xs text-[#d8d1c4] focus:outline-none focus:ring-1 focus:ring-[#d5ad54]"
          maxLength={7}
        />
      </PopoverContent>
    </Popover>
  );
}
