"use client";

import { Copy, Layers, Plus, Shapes, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { TCGCardTemplate } from '@/types';
import { TemplateThumbnail } from '@/components/card-forge/TemplateThumbnail';

interface TemplateLibraryPanelProps {
  currentTemplateId: string | null;
  defaultTemplates: TCGCardTemplate[];
  backFaceTemplates: TCGCardTemplate[];
  userTemplates: TCGCardTemplate[];
  onCreateNew: () => void;
  onClone: () => void;
  onDelete: () => void;
  onSelectTemplateId: (value: string) => void;
  onOpenTemplate: (template: TCGCardTemplate) => void;
  panelClassName: string;
  controlClassName: string;
  buttonClassName: string;
}

export function TemplateLibraryPanel({
  currentTemplateId,
  defaultTemplates,
  backFaceTemplates,
  userTemplates,
  onCreateNew,
  onClone,
  onDelete,
  onSelectTemplateId,
  onOpenTemplate,
  panelClassName,
  controlClassName,
  buttonClassName,
}: TemplateLibraryPanelProps) {
  return (
    <Card className={cn(panelClassName, 'rounded-[8px]')}>
      <CardHeader className="p-2.5">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b7bdc9]">
          <span className="flex items-center gap-2"><Layers className="h-3.5 w-3.5 text-[#d5ad54]" /> Templates</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-2.5 pt-0">
        <Select
          value={currentTemplateId || '__new__'}
          onValueChange={(value) => {
            if (value === '__new__') onCreateNew();
            else onSelectTemplateId(value);
          }}
        >
          <SelectTrigger className={controlClassName}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__new__">Unsaved Template</SelectItem>
            {defaultTemplates.map((template) => (
              <SelectItem key={template.id!} value={template.id!}>Default / {template.name}</SelectItem>
            ))}
            {userTemplates.map((template) => (
              <SelectItem key={template.id!} value={template.id!}>User / {template.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCreateNew} aria-label="Create new template" className={buttonClassName}><Plus className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="sm" onClick={onClone} disabled={!currentTemplateId} aria-label="Clone selected template" className={buttonClassName}><Copy className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="sm" onClick={onDelete} disabled={!currentTemplateId} aria-label="Delete selected template" className={buttonClassName}><Trash2 className="h-4 w-4 text-[#ff554a]" /></Button>
        </div>
        <div className="space-y-1.5 pt-1">
          {defaultTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              className="group flex w-full items-center gap-2 rounded-[5px] border border-[#2b2f39] bg-[#0b0f15] p-1.5 text-left transition hover:border-[#d5ad54]/70 hover:bg-[#131720]"
              onClick={() => onOpenTemplate(template)}
            >
              <TemplateThumbnail template={template} />
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-[#d8d1c4] group-hover:text-[#f5d27b]">{template.name}</span>
                <span className="block truncate text-[10px] uppercase tracking-[0.12em] text-[#757d8c]">{template.templateCategory || 'Default template'}</span>
              </span>
            </button>
          ))}
        </div>
        {backFaceTemplates.length > 0 ? (
          <div className="space-y-1.5 border-t border-[#1b2029] pt-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#757d8c]">
              Back Face Presets
            </p>
            {backFaceTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                className="group flex w-full items-center gap-2 rounded-[5px] border border-[#2b2f39] bg-[#0b0f15] p-1.5 text-left transition hover:border-[#7dd3fc]/70 hover:bg-[#131720]"
                onClick={() => onOpenTemplate(template)}
              >
                <TemplateThumbnail template={template} />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-[#d8d1c4] group-hover:text-[#b9f3ff]">{template.name}</span>
                  <span className="block truncate text-[10px] uppercase tracking-[0.12em] text-[#757d8c]">{template.templateCategory || 'Back face preset'}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
