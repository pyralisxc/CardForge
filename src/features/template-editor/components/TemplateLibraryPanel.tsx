"use client";

import type { ChangeEvent, RefObject } from 'react';
import { Copy, FolderDown, FolderUp, Layers, Lock, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CardPreview } from '@/components/card-forge/CardPreview';
import { getTemplateLibraryDescription, getTemplateLibraryLabel } from '@/lib/templateDisplay';
import { cn } from '@/lib/utils';
import type { TCGCardTemplate } from '@/types';

interface TemplateLibraryPanelProps {
  canUseProjectFiles: boolean;
  currentTemplate: TCGCardTemplate;
  currentTemplateId: string | null;
  defaultTemplates: TCGCardTemplate[];
  backFaceTemplates: TCGCardTemplate[];
  fileInputRef: RefObject<HTMLInputElement>;
  isCheckoutStarting: boolean;
  projectFileGateMessage?: string | null;
  userTemplates: TCGCardTemplate[];
  onCreateNew: () => void;
  onClone: () => void;
  onDelete: () => void;
  onExportProject: () => void;
  onImportProject: () => void;
  onLoadProject: (event: ChangeEvent<HTMLInputElement>) => void;
  onStartCheckout: () => void;
  onSelectTemplateId: (value: string) => void;
  onOpenTemplate: (template: TCGCardTemplate) => void;
  panelClassName: string;
  controlClassName: string;
  buttonClassName: string;
}

export function TemplateLibraryPanel({
  canUseProjectFiles,
  currentTemplate,
  currentTemplateId,
  defaultTemplates,
  backFaceTemplates,
  fileInputRef,
  isCheckoutStarting,
  projectFileGateMessage,
  userTemplates,
  onCreateNew,
  onClone,
  onDelete,
  onExportProject,
  onImportProject,
  onLoadProject,
  onStartCheckout,
  onSelectTemplateId,
  onOpenTemplate,
  panelClassName,
  controlClassName,
  buttonClassName,
}: TemplateLibraryPanelProps) {
  const allListedTemplates = [...defaultTemplates, ...userTemplates, ...backFaceTemplates];
  const shouldShowUnsavedCurrentTemplate = Boolean(
    currentTemplateId && !allListedTemplates.some((template) => template.id === currentTemplateId)
  );

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
          <SelectTrigger className={controlClassName} aria-label="Choose template"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__new__">New Blank Template</SelectItem>
            {shouldShowUnsavedCurrentTemplate ? (
              <SelectItem value={currentTemplateId!}>Unsaved / {currentTemplate.name || 'New Card Template'}</SelectItem>
            ) : null}
            {defaultTemplates.map((template) => (
              <SelectItem key={template.id!} value={template.id!}>{getTemplateLibraryLabel(template)} / {template.name}</SelectItem>
            ))}
            {userTemplates.map((template) => (
              <SelectItem key={template.id!} value={template.id!}>{getTemplateLibraryLabel(template)} / {template.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCreateNew} aria-label="Create new template" className={buttonClassName}><Plus className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="sm" onClick={onClone} disabled={!currentTemplateId} aria-label="Clone selected template" className={buttonClassName}><Copy className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="sm" onClick={onDelete} disabled={!currentTemplateId} aria-label="Delete selected template" className={buttonClassName}><Trash2 className="h-4 w-4 text-[#ff554a]" /></Button>
        </div>
        <div className="space-y-2 border-t border-[#1b2029] pt-2">
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <Button type="button" variant="outline" size="sm" onClick={onExportProject} className={cn(buttonClassName, 'min-w-0 gap-1 text-xs')}>
              <FolderDown className="h-4 w-4" /> Export Project
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onImportProject} className={cn(buttonClassName, 'min-w-0 gap-1 text-xs')}>
              <FolderUp className="h-4 w-4" /> Import Project
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={onLoadProject}
              aria-hidden="true"
              className="hidden"
            />
          </div>
          {!canUseProjectFiles ? (
            <div className="space-y-2 rounded-[6px] border border-[#6d4f2b] bg-[#15100a] p-2">
              <p className="flex items-start gap-2 text-[11px] leading-4 text-[#cbb58b]">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#e2aa4a]" />
                <span>{projectFileGateMessage || 'Available now: edit templates and keep work in this browser. Unlock portable project files with Creator Pass or dev access.'}</span>
              </p>
              <Button
                type="button"
                size="sm"
                onClick={onStartCheckout}
                disabled={isCheckoutStarting}
                className="h-8 w-full text-xs"
              >
                {isCheckoutStarting ? 'Checking access...' : 'Upgrade account'}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="space-y-1.5 pt-1">
          {defaultTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              className="group flex w-full items-center gap-2 rounded-[5px] border border-[#2b2f39] bg-[#0b0f15] p-1.5 text-left transition hover:border-[#d5ad54]/70 hover:bg-[#131720]"
              onClick={() => onOpenTemplate(template)}
            >
              <TemplateLibraryPreview template={template} />
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-[#d8d1c4] group-hover:text-[#f5d27b]">{template.name}</span>
                <span className="block truncate text-[10px] uppercase tracking-[0.12em] text-[#757d8c]">{template.templateCategory || getTemplateLibraryDescription(template)}</span>
              </span>
            </button>
          ))}
        </div>
        {backFaceTemplates.length > 0 ? (
          <div className="space-y-1.5 border-t border-[#1b2029] pt-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#757d8c]">
              Card Back Example
            </p>
            {backFaceTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                className="group flex w-full items-center gap-2 rounded-[5px] border border-[#2b2f39] bg-[#0b0f15] p-1.5 text-left transition hover:border-[#7dd3fc]/70 hover:bg-[#131720]"
                onClick={() => onOpenTemplate(template)}
              >
                <TemplateLibraryPreview template={template} />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-[#d8d1c4] group-hover:text-[#b9f3ff]">{template.name}</span>
                  <span className="block truncate text-[10px] uppercase tracking-[0.12em] text-[#757d8c]">{template.templateCategory || 'Card back example'}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TemplateLibraryPreview({ template }: { template: TCGCardTemplate }) {
  return (
    <span className="grid h-[84px] w-[64px] shrink-0 place-items-center overflow-hidden rounded-[5px] border border-[#2b2f39] bg-[#05070b]">
      <CardPreview
        card={{
          template,
          data: template.templatePreviewData ?? {},
          uniqueId: `template-library-${template.id ?? template.name}`,
        }}
        targetWidthPx={64}
        isEditorPreview
      />
    </span>
  );
}
