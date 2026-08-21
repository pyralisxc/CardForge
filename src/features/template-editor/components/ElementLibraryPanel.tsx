"use client";

import type { DragEvent as ReactDragEvent, ElementType } from 'react';
import { Shapes } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { WorkspaceSection } from '@/features/template-editor/components/WorkspaceSection';
import type { FreeformCardElement } from '@/domain/templates';

interface ElementLibraryItem {
  label: string;
  description: string;
  icon: ElementType;
  type: FreeformCardElement['type'];
  preset?: Partial<FreeformCardElement>;
  dragKitIndex: number;
}

interface ElementLibrarySection {
  category: string;
  items: ElementLibraryItem[];
}

interface ElementLibraryPanelProps {
  sections: ElementLibrarySection[];
  onAddElement: (type: FreeformCardElement['type'], preset?: Partial<FreeformCardElement>) => void;
  panelClassName: string;
}

export function ElementLibraryPanel({
  sections,
  onAddElement,
  panelClassName,
}: ElementLibraryPanelProps) {
  const visibleSections = sections.filter((section) => section.items.length > 0);

  const handleDragStart = (event: ReactDragEvent<HTMLButtonElement>, item: ElementLibraryItem) => {
    event.dataTransfer.setData('application/cardforge-element', item.type);
    event.dataTransfer.setData('application/cardforge-kit-index', String(item.dragKitIndex));
    if (item.preset) {
      event.dataTransfer.setData('application/cardforge-preset', JSON.stringify(item.preset));
    }
  };

  return (
    <WorkspaceSection title="Add to card" icon={Shapes} defaultOpen panelClassName={panelClassName}>
      <div className="space-y-2">
        {visibleSections.map((section) => (
          <div key={section.category} className="space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#757d8c]">{section.category}</div>
            <div className="grid grid-cols-2 gap-1.5 2xl:grid-cols-3">
              {section.items.map((item) => (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      draggable
                      onDragStart={(event) => handleDragStart(event, item)}
                      onClick={() => onAddElement(item.type, item.preset)}
                      className="h-[54px] flex-col gap-1 rounded-[5px] border-[#2d3340] bg-[var(--cf-editor-control)] px-1 text-[#d8d1c4] hover:border-[#d5ad54]/80 hover:bg-[#171b24]"
                    >
                      <item.icon className="h-4 w-4 text-[#d5ad54]" />
                      <span className="max-w-full truncate text-[10px] leading-none">{item.label}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-56">
                    <div className="space-y-1">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </WorkspaceSection>
  );
}
