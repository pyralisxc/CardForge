"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Image as ImageIcon, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/shared/classNames';
import { trackCardForgeEvent } from '@/features/analytics/client/tracking';
import {
  createLibraryPickerResult,
  getCompatibleLibraryPickerResources,
  type LibraryPickerRequest,
  type LibraryPickerResource,
  type LibraryPickerResult,
} from '../model/libraryPicker';

interface LibraryPickerDialogProps {
  open: boolean;
  request: LibraryPickerRequest;
  resources: readonly LibraryPickerResource[];
  onOpenChange: (open: boolean) => void;
  onSelect: (result: LibraryPickerResult) => void;
  renderPreview?: (resource: LibraryPickerResource) => ReactNode;
}

export function LibraryPickerDialog({ open, request, resources, onOpenChange, onSelect, renderPreview }: LibraryPickerDialogProps) {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const wasOpen = useRef(false);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const compatible = useMemo(() => getCompatibleLibraryPickerResources(request, resources), [request, resources]);
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized ? compatible.filter((resource) => `${resource.name} ${resource.sourceLabel} ${resource.role ?? ''}`.toLocaleLowerCase().includes(normalized)) : compatible;
  }, [compatible, query]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, visible.length - 1)));
  }, [visible.length]);

  useEffect(() => {
    if (open && !wasOpen.current) {
      trackCardForgeEvent('library_picker_opened', {
        object_kind: request.acceptedKinds.length === 1 ? request.acceptedKinds[0] : 'mixed',
        selection_mode: request.selectionMode,
        count_bucket: compatible.length === 0 ? '0' : compatible.length <= 5 ? '1_5' : compatible.length <= 20 ? '6_20' : '21_plus',
      });
    }
    wasOpen.current = open;
    if (!open) {
      setQuery('');
      setSelectedIds([]);
    }
  }, [compatible.length, open, request.acceptedKinds, request.selectionMode]);

  const toggle = (id: string) => setSelectedIds((current) => request.selectionMode === 'single'
    ? (current.includes(id) ? [] : [id])
    : (current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]));

  const confirm = () => {
    onSelect(createLibraryPickerResult(request, resources, selectedIds));
    onOpenChange(false);
  };

  const moveActiveOption = (nextIndex: number) => {
    if (!visible.length) return;
    const bounded = Math.max(0, Math.min(visible.length - 1, nextIndex));
    setActiveIndex(bounded);
    optionRefs.current.get(visible[bounded]!.id)?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl border-[#2d3340] bg-[#0b0f15] text-[#d8d1c4]">
        <DialogHeader>
          <DialogTitle>{request.title}</DialogTitle>
          <DialogDescription>{request.description ?? `Choose ${request.selectionMode === 'single' ? 'one compatible object' : 'compatible objects'} for this work.`}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#757d8c]" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the Library..." className="border-[#2d3340] bg-[#0d1117] pl-9" autoFocus />
        </div>
        {visible.length ? (
          <div
            className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3"
            role="listbox"
            tabIndex={0}
            aria-label="Compatible Library objects"
            aria-activedescendant={`library-picker-option-${visible[activeIndex]!.id}`}
            aria-multiselectable={request.selectionMode === 'multiple'}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                event.preventDefault();
                moveActiveOption(activeIndex + 1);
              } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                event.preventDefault();
                moveActiveOption(activeIndex - 1);
              } else if (event.key === 'Home') {
                event.preventDefault();
                moveActiveOption(0);
              } else if (event.key === 'End') {
                event.preventDefault();
                moveActiveOption(visible.length - 1);
              } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle(visible[activeIndex]!.id);
              }
            }}
          >
            {visible.map((resource, index) => {
              const selected = selectedIds.includes(resource.id);
              return <button
                key={resource.id}
                id={`library-picker-option-${resource.id}`}
                ref={(node) => { if (node) optionRefs.current.set(resource.id, node); else optionRefs.current.delete(resource.id); }}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={selected}
                data-active={index === activeIndex}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => { setActiveIndex(index); toggle(resource.id); }}
                className={cn('relative min-h-28 rounded-md border bg-[#090d13] p-2 text-left transition', selected ? 'border-[#d5ad54] ring-1 ring-[#d5ad54]' : index === activeIndex ? 'border-[#757d8c]' : 'border-[#2d3340] hover:border-[#d5ad54]/70')}
              >
                {selected ? <Check className="absolute right-2 top-2 z-10 h-4 w-4 rounded-full bg-[#d5ad54] p-0.5 text-black" /> : null}
                {renderPreview ? renderPreview(resource) : <div className="flex h-16 items-center justify-center rounded bg-[#07090d]"><ImageIcon className="h-6 w-6 text-[#757d8c]" /></div>}
                <span className="mt-2 block truncate text-xs font-semibold">{resource.name}</span>
                <span className="block truncate text-[10px] uppercase tracking-[0.12em] text-[#757d8c]">{resource.sourceLabel}{resource.revision ? ` · Revision ${resource.revision}` : ''}</span>
              </button>;
            })}
          </div>
        ) : <div className="rounded-md border border-dashed border-[#2d3340] p-6 text-center text-sm text-[#8f95a3]">No compatible Library objects found.</div>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={!selectedIds.length} onClick={confirm}>Use selection</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
