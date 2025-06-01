
"use client";

import type { PaperSize } from '@/types';
import { PAPER_SIZES } from '@/lib/constants'; //PAPER_SIZES is a static constant
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// No direct import of useAppStore here, uses props for selectedSize and onSelectSize (which calls Zustand action)

interface PaperSizeSelectorProps {
  selectedSize: PaperSize; // From Zustand store via props
  onSelectSize: (size: PaperSize) => void; // Calls Zustand action via props
}

export function PaperSizeSelector({ selectedSize, onSelectSize }: PaperSizeSelectorProps) {
  const handleSelect = (value: string) => {
    const size = PAPER_SIZES.find(s => s.name === value);
    if (size) {
      onSelectSize(size); // This prop function will call the Zustand action
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="paperSize">Paper Size</Label>
      <Select value={selectedSize.name} onValueChange={handleSelect}>
        <SelectTrigger id="paperSize" className="w-full">
          <SelectValue placeholder="Select paper size" />
        </SelectTrigger>
        <SelectContent>
          {PAPER_SIZES.map((size) => (
            <SelectItem key={size.name} value={size.name}>
              {size.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
