"use client";

import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/shared/classNames';

interface TemplateEditorInspectorPanelProps {
  activeTab: string;
  onActiveTabChange: (value: string) => void;
  panelClassName: string;
  hasSelectedElement: boolean;
  selectedElementType?: string | null;
  selectedElementName?: string | null;
  templateContent?: ReactNode;
  elementContent: ReactNode;
}

export function TemplateEditorInspectorPanel({
  panelClassName,
  hasSelectedElement,
  selectedElementType,
  selectedElementName,
  elementContent,
}: TemplateEditorInspectorPanelProps) {
  const elementTypeLabel = selectedElementType
    ? `${selectedElementType.charAt(0).toUpperCase()}${selectedElementType.slice(1)}`
    : 'Element';

  return !hasSelectedElement ? (
    <Card className={cn(panelClassName, 'rounded-[8px]')}>
      <CardContent className="p-6 text-center text-sm text-muted-foreground">
        Select an element on the canvas or in Layers.
      </CardContent>
    </Card>
  ) : (
    <Card className={cn(panelClassName, 'rounded-[8px]')}>
      <CardHeader className="border-b border-[var(--cf-editor-border)] p-2.5">
        <CardTitle className="space-y-2">
          <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b7bdc9]">
            Inspector
            <span className="text-[10px] font-normal text-[#d5ad54]">{elementTypeLabel}</span>
          </span>
          <span className="block rounded-[6px] border border-[var(--cf-editor-border)] bg-[#0b0f15] px-2.5 py-2">
            <span className="block truncate text-sm font-semibold normal-case tracking-normal text-[var(--cf-text)]">
              {selectedElementName || 'Selected element'}
            </span>
            <span className="mt-1 block text-[11px] font-normal normal-case leading-4 tracking-normal text-[#8f95a3]">
              Edit content first, then style, frame, and align this layer.
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-2.5 pt-3">{elementContent}</CardContent>
    </Card>
  );
}
