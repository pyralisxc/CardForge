"use client";

import {
  CARD_FORMATS,
  getCardFormatMeasurement,
  type CardFormatId,
  type CardMeasurementUnit,
} from '@/domain/card-formats';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/shared/classNames';

export function CardFormatSelect({
  value,
  unit,
  onValueChange,
  className,
  includeCustom = true,
}: {
  value: CardFormatId;
  unit: CardMeasurementUnit;
  onValueChange: (value: CardFormatId) => void;
  className?: string;
  includeCustom?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as CardFormatId)}>
      <SelectTrigger className={className} aria-label="Choose card format">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[min(520px,75vh)]">
        {CARD_FORMATS.map((format) => {
          const measurement = getCardFormatMeasurement(format, unit);
          const previewHeight = 34;
          const previewWidth = Math.max(18, Math.min(58, previewHeight * (format.widthMm / format.heightMm)));
          return (
            <SelectItem key={format.id} value={format.id} textValue={`${format.label} ${measurement.label}`}>
              <span className="flex min-w-[250px] items-center gap-3 py-1">
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid shrink-0 place-items-center rounded-[3px] border border-[#9b7937] bg-[radial-gradient(circle_at_center,#6841a7,#17131e_65%)] shadow-[inset_0_0_0_2px_rgba(220,177,79,0.14)]',
                  )}
                  style={{ width: previewWidth, height: previewHeight }}
                >
                  <span className="h-1.5 w-1.5 rotate-45 border border-[#e4b958] bg-[#7a52cc]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{format.label}</span>
                  <span className="block text-xs text-muted-foreground">{measurement.label} · {format.category}</span>
                </span>
              </span>
            </SelectItem>
          );
        })}
        {includeCustom ? (
          <SelectItem value="custom" textValue="Custom dimensions">
            <span className="flex min-w-[250px] items-center gap-3 py-1">
              <span className="grid h-[34px] w-[42px] shrink-0 place-items-center rounded-[3px] border border-dashed border-[#9b7937] bg-[#16131a] text-[10px] text-[#d5ad54]">W×H</span>
              <span>
                <span className="block text-sm font-medium">Custom dimensions</span>
                <span className="block text-xs text-muted-foreground">Set your own trim and canvas size</span>
              </span>
            </span>
          </SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  );
}
