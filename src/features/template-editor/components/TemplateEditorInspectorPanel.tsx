"use client";

import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface TemplateEditorInspectorPanelProps {
  activeTab: string;
  onActiveTabChange: (value: string) => void;
  panelClassName: string;
  hasSelectedElement: boolean;
  selectedElementType?: string | null;
  templateContent: ReactNode;
  elementContent: ReactNode;
}

export function TemplateEditorInspectorPanel({
  activeTab,
  onActiveTabChange,
  panelClassName,
  hasSelectedElement,
  selectedElementType,
  templateContent,
  elementContent,
}: TemplateEditorInspectorPanelProps) {
  return (
    <Tabs value={activeTab} onValueChange={onActiveTabChange}>
      <TabsList className="grid h-9 w-full grid-cols-2 rounded-[5px] border border-[#2b2f39] bg-[#12161d] p-1">
        <TabsTrigger value="template" className="h-7 rounded-[3px] text-xs data-[state=active]:bg-[#0b0f15] data-[state=active]:text-[#f5d27b]">
          Template
        </TabsTrigger>
        <TabsTrigger value="element" className="h-7 rounded-[3px] text-xs data-[state=active]:bg-[#0b0f15] data-[state=active]:text-[#f5d27b]">
          Element
        </TabsTrigger>
      </TabsList>

      <TabsContent value="template" className="space-y-4 pt-3">
        <Card className={cn(panelClassName, 'rounded-[8px]')}>
          <CardHeader className="p-2.5">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b7bdc9]">
              Template Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-2.5 pt-0">{templateContent}</CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="element" className="space-y-4 pt-3">
        {!hasSelectedElement ? (
          <Card className={cn(panelClassName, 'rounded-[8px]')}>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Select an element on the canvas or in Layers.
            </CardContent>
          </Card>
        ) : (
          <Card className={cn(panelClassName, 'rounded-[8px]')}>
            <CardHeader className="border-b border-[#252b35] p-2.5">
              <CardTitle className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b7bdc9]">
                Inspector
                <span className="text-[10px] font-normal text-[#d5ad54]">{selectedElementType}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-2.5 pt-3">{elementContent}</CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
