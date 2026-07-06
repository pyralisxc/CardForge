"use client";

import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, Circle, Copy, Eye, EyeOff, FolderPlus, GripVertical, Image as ImageIcon, Layers, Lock, Sparkles, Square, Trash2, Type, Ungroup, Unlock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { FreeformCardElement } from '@/types';
import type { LayerDropTarget, LayerTreeNode } from '@/features/template-editor/lib/layerTree';

interface LayerTreePanelProps {
  panelClassName: string;
  elementsCount: number;
  layerTree: LayerTreeNode[];
  checkedLayerIds: string[];
  collapsedGroups: Set<string>;
  selectedElementId: string | null;
  layerDropTarget: LayerDropTarget | null;
  canUngroupSelected: boolean;
  onGroupChecked: () => void;
  onUngroupSelected: () => void;
  onClearChecked: () => void;
  onSelectElement: (elementId: string) => void;
  onToggleGroupCollapsed: (elementId: string) => void;
  onToggleChecked: (elementId: string, checked: boolean) => void;
  onDragStart: (elementId: string) => void;
  onDragEnd: () => void;
  onDragOver: (elementId: string, clientY: number, rect: DOMRect) => void;
  onDrop: () => void;
  onToggleVisibility: (element: FreeformCardElement) => void;
  onToggleLock: (element: FreeformCardElement) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
}

export function LayerTreePanel({
  panelClassName,
  elementsCount,
  layerTree,
  checkedLayerIds,
  collapsedGroups,
  selectedElementId,
  layerDropTarget,
  canUngroupSelected,
  onGroupChecked,
  onUngroupSelected,
  onClearChecked,
  onSelectElement,
  onToggleGroupCollapsed,
  onToggleChecked,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onToggleVisibility,
  onToggleLock,
  onDuplicateSelected,
  onDeleteSelected,
}: LayerTreePanelProps) {
  const renderNode = (node: LayerTreeNode, depth: number): ReactNode => {
    const el = node.element;
    const Icon = el.type === 'text' ? Type : el.type === 'image' ? ImageIcon : el.type === 'icon' ? Sparkles : el.shapeKind === 'ellipse' ? Circle : Square;
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsedGroups.has(el.id);
    const isChecked = checkedLayerIds.includes(el.id);
    const isSelected = selectedElementId === el.id;
    const isDropTarget = layerDropTarget?.id === el.id;

    return (
      <div key={el.id}>
        {isDropTarget && layerDropTarget?.pos === 'before' && (
          <div className="mx-1 h-0.5 rounded bg-[#d5ad54]" />
        )}
        <div
          className={cn(
            'group flex w-full items-center gap-0.5 rounded-[4px] border px-1 py-1 text-[11px] transition-colors',
            isSelected ? 'border-[#d5ad54] bg-[#211a0d] text-[#f5d27b]' : 'border-transparent bg-[#0c1016] text-[#b7bdc9] hover:border-[#252b35] hover:bg-[#111720]',
            isDropTarget && layerDropTarget?.pos === 'child' && 'border-[#6d55b8] bg-[#1a1433]',
          )}
          style={{ paddingLeft: `${depth * 14 + 4}px` }}
          draggable
          onDragStart={(event) => {
            event.stopPropagation();
            onDragStart(el.id);
            event.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={onDragEnd}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDragOver(el.id, event.clientY, event.currentTarget.getBoundingClientRect());
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDrop();
          }}
        >
          <GripVertical className="h-3 w-3 shrink-0 cursor-grab text-[#454d5c] opacity-0 group-hover:opacity-100" />
          {hasChildren ? (
            <button
              type="button"
              className="shrink-0 text-[#757d8c] hover:text-[#d5ad54]"
              onClick={(event) => {
                event.stopPropagation();
                onToggleGroupCollapsed(el.id);
              }}
            >
              {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <input
            type="checkbox"
            aria-label={`Select layer ${el.name}`}
            checked={isChecked}
            onChange={(event) => {
              event.stopPropagation();
              onToggleChecked(el.id, event.target.checked);
            }}
            className="h-3 w-3 shrink-0 cursor-pointer accent-[#d5ad54]"
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
            onClick={() => onSelectElement(el.id)}
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="flex-1 truncate">{el.name}</span>
            {hasChildren && (
              <span className="shrink-0 rounded-full border border-[#3b3324] bg-[#141b24] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[#d5ad54]">
                Group {node.children.length}
              </span>
            )}
            <span className="shrink-0 font-mono text-[10px] text-[#454d5c]">{el.zIndex}</span>
          </button>
          <button
            type="button"
            title={el.visible === false ? 'Show element' : 'Hide element'}
            aria-label={el.visible === false ? `Show layer ${el.name}` : `Hide layer ${el.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleVisibility(el);
            }}
            className="shrink-0 text-[#454d5c] hover:text-[#d5ad54]"
          >
            {el.visible === false ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
          <button
            type="button"
            title={el.locked ? 'Unlock element' : 'Lock element'}
            aria-label={el.locked ? `Unlock layer ${el.name}` : `Lock layer ${el.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleLock(el);
            }}
            className="shrink-0 text-[#454d5c] hover:text-[#d5ad54]"
          >
            {el.locked ? <Lock className="h-3 w-3 text-[#d5ad54]" /> : <Unlock className="h-3 w-3" />}
          </button>
        </div>
        {isDropTarget && layerDropTarget?.pos === 'after' && (
          <div className="mx-1 h-0.5 rounded bg-[#d5ad54]" />
        )}
        {hasChildren && !isCollapsed && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <Card className={cn(panelClassName, 'rounded-[8px]')}>
      <CardHeader className="p-2.5 pb-1.5">
        <CardTitle className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b7bdc9]">
          <span className="flex items-center gap-2"><Layers className="h-3.5 w-3.5 text-[#d5ad54]" /> Layers</span>
          <span className="text-[10px] font-normal text-[#757d8c]">{elementsCount}</span>
        </CardTitle>
        <div className="mt-1.5 flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                disabled={checkedLayerIds.length < 2}
                onClick={onGroupChecked}
                className="h-6 gap-1 px-1.5 text-[10px] text-[#b7bdc9] hover:bg-[#1a1f29] hover:text-[#f5d27b] disabled:opacity-40"
              >
                <FolderPlus className="h-3 w-3" /> Group
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Group checked elements (select 2+)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                disabled={!canUngroupSelected}
                onClick={onUngroupSelected}
                className="h-6 gap-1 px-1.5 text-[10px] text-[#b7bdc9] hover:bg-[#1a1f29] hover:text-[#f5d27b] disabled:opacity-40"
              >
                <Ungroup className="h-3 w-3" /> Ungroup
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Ungroup children of selected group</TooltipContent>
          </Tooltip>
          {checkedLayerIds.length > 0 && (
            <button
              type="button"
              onClick={onClearChecked}
              className="ml-auto text-[10px] text-[#757d8c] hover:text-[#b7bdc9]"
            >
              Clear ({checkedLayerIds.length})
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-2.5 pt-0">
        <div className="space-y-0.5">
          {layerTree.map((node) => renderNode(node, 0))}
          {elementsCount === 0 && (
            <p className="py-3 text-center text-[10px] text-[#454d5c]">No elements. Add one above.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onDuplicateSelected} className="flex-1 gap-1 text-xs">
            <Copy className="h-4 w-4" /> Duplicate
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onDeleteSelected} className="flex-1 gap-1 text-xs text-[#ff554a]">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
