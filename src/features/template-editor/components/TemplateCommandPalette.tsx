"use client";

import type { ElementType } from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  BoxSelect,
  Clock3,
  Copy,
  Eye,
  Grid3X3,
  Image as ImageIcon,
  Layers,
  PanelRight,
  Save,
  Search,
  Sparkles,
  Square,
  Star,
  Trash2,
  Type,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { FreeformCardElement } from '@/types';

type PaletteAction = {
  id: string;
  title: string;
  description: string;
  group: 'Insert' | 'Layer' | 'Navigate' | 'Template' | 'View';
  keywords: string[];
  icon: ElementType;
  disabled?: boolean;
  run: () => void;
};

type PaletteActionGroup = {
  id: string;
  title: string;
  icon?: ElementType;
  actions: PaletteAction[];
};

interface TemplateCommandPaletteProps {
  open: boolean;
  selectedElement?: FreeformCardElement | null;
  showGrid: boolean;
  snapToGrid: boolean;
  previewMode: boolean;
  onOpenChange: (open: boolean) => void;
  onAddElement: (type: FreeformCardElement['type'], preset?: Partial<FreeformCardElement>) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onSave: () => void;
  onShowLibrary: () => void;
  onShowInspector: () => void;
  onShowTemplateSettings: () => void;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onTogglePreview: () => void;
}

const RECENT_COMMANDS_STORAGE_KEY = 'cardforge-layout-command-palette-recents-v1';
const FAVORITE_COMMANDS_STORAGE_KEY = 'cardforge-layout-command-palette-favorites-v1';
const MAX_RECENT_COMMANDS = 5;
const ACTION_GROUP_ORDER: PaletteAction['group'][] = ['Insert', 'Layer', 'Navigate', 'Template', 'View'];

const normalize = (value: string) => value.trim().toLowerCase();
const readStoredCommandIds = (storageKey: string) => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

const writeStoredCommandIds = (storageKey: string, ids: string[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(ids));
};

export function TemplateCommandPalette({
  open,
  selectedElement,
  showGrid,
  snapToGrid,
  previewMode,
  onOpenChange,
  onAddElement,
  onDuplicateSelected,
  onDeleteSelected,
  onSave,
  onShowLibrary,
  onShowInspector,
  onShowTemplateSettings,
  onToggleGrid,
  onToggleSnap,
  onTogglePreview,
}: TemplateCommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>(() => readStoredCommandIds(RECENT_COMMANDS_STORAGE_KEY));
  const [favoriteCommandIds, setFavoriteCommandIds] = useState<string[]>(() => readStoredCommandIds(FAVORITE_COMMANDS_STORAGE_KEY));

  const closeAfter = useCallback((action: () => void) => () => {
    action();
    onOpenChange(false);
    setQuery('');
  }, [onOpenChange]);

  const actions = useMemo<PaletteAction[]>(() => [
    {
      id: 'add-text',
      title: 'Add text layer',
      description: 'Insert editable card copy, rules text, titles, or stats.',
      group: 'Insert',
      keywords: ['copy', 'title', 'rules', 'field', 'variable'],
      icon: Type,
      run: closeAfter(() => onAddElement('text')),
    },
    {
      id: 'add-image',
      title: 'Add image slot',
      description: 'Insert artwork or a data-bound image field.',
      group: 'Insert',
      keywords: ['art', 'artwork', 'picture', 'media'],
      icon: ImageIcon,
      run: closeAfter(() => onAddElement('image')),
    },
    {
      id: 'add-icon',
      title: 'Add icon',
      description: 'Insert a scalable symbol with stroke and fill controls.',
      group: 'Insert',
      keywords: ['symbol', 'rune', 'glyph'],
      icon: Sparkles,
      run: closeAfter(() => onAddElement('icon')),
    },
    {
      id: 'add-shape',
      title: 'Add shape',
      description: 'Insert a rectangle, ellipse, line, or decorative foundation.',
      group: 'Insert',
      keywords: ['box', 'primitive', 'panel'],
      icon: Square,
      run: closeAfter(() => onAddElement('shape')),
    },
    {
      id: 'add-divider',
      title: 'Add divider rail',
      description: 'Insert a gilded horizontal ornament for type lines or footers.',
      group: 'Insert',
      keywords: ['line', 'rule', 'ornament', 'separator'],
      icon: BoxSelect,
      run: closeAfter(() => onAddElement('shape', {
        name: 'Gilded Divider',
        shapeKind: 'rectangle',
        shapeRole: 'divider',
        width: 460,
        height: 14,
        fillColor: '#d5ad54',
        strokeColor: '#d5ad54',
        strokeWidth: 0,
        borderWidth: '_none_',
        borderRadius: 'rounded-full',
        backgroundImageUrl: 'linear-gradient(90deg, transparent 0%, #7f5d1f 8%, #f5d27b 18%, #7f5d1f 28%, transparent 36%, #d5ad54 50%, transparent 64%, #7f5d1f 72%, #f5d27b 82%, #7f5d1f 92%, transparent 100%)',
      })),
    },
    {
      id: 'duplicate-selected',
      title: 'Duplicate selected layer',
      description: selectedElement ? `Duplicate ${selectedElement.name || selectedElement.type}.` : 'Select a layer first.',
      group: 'Layer',
      keywords: ['copy', 'clone'],
      icon: Copy,
      disabled: !selectedElement,
      run: closeAfter(onDuplicateSelected),
    },
    {
      id: 'delete-selected',
      title: 'Delete selected layer',
      description: selectedElement ? `Remove ${selectedElement.name || selectedElement.type}.` : 'Select a layer first.',
      group: 'Layer',
      keywords: ['remove'],
      icon: Trash2,
      disabled: !selectedElement,
      run: closeAfter(onDeleteSelected),
    },
    {
      id: 'save-template',
      title: 'Save template',
      description: 'Save the current freeform template.',
      group: 'Template',
      keywords: ['persist', 'store'],
      icon: Save,
      run: closeAfter(onSave),
    },
    {
      id: 'show-library',
      title: 'Show template library',
      description: 'Move focus to templates, element kits, and layers.',
      group: 'Navigate',
      keywords: ['left panel', 'templates', 'elements', 'layers'],
      icon: Layers,
      run: closeAfter(onShowLibrary),
    },
    {
      id: 'show-inspector',
      title: 'Show element inspector',
      description: 'Open the selected layer controls.',
      group: 'Navigate',
      keywords: ['right panel', 'properties', 'style'],
      icon: PanelRight,
      run: closeAfter(onShowInspector),
    },
    {
      id: 'show-template-settings',
      title: 'Show template settings',
      description: 'Edit card name, dimensions, frame, and base canvas style.',
      group: 'Navigate',
      keywords: ['canvas', 'dimensions', 'frame', 'setup'],
      icon: PanelRight,
      run: closeAfter(onShowTemplateSettings),
    },
    {
      id: 'toggle-grid',
      title: showGrid ? 'Hide grid' : 'Show grid',
      description: 'Toggle canvas grid visibility.',
      group: 'View',
      keywords: ['guides'],
      icon: Grid3X3,
      run: closeAfter(onToggleGrid),
    },
    {
      id: 'toggle-snap',
      title: snapToGrid ? 'Disable snapping' : 'Enable snapping',
      description: 'Toggle grid snapping for movement and drops.',
      group: 'View',
      keywords: ['align', 'precision'],
      icon: BoxSelect,
      run: closeAfter(onToggleSnap),
    },
    {
      id: 'toggle-preview',
      title: previewMode ? 'Exit preview mode' : 'Enter preview mode',
      description: 'Toggle interaction-free rendered preview.',
      group: 'View',
      keywords: ['view', 'render'],
      icon: Eye,
      run: closeAfter(onTogglePreview),
    },
  ], [
    onAddElement,
    closeAfter,
    onDeleteSelected,
    onDuplicateSelected,
    onSave,
    onShowInspector,
    onShowLibrary,
    onShowTemplateSettings,
    onToggleGrid,
    onTogglePreview,
    onToggleSnap,
    previewMode,
    selectedElement,
    showGrid,
    snapToGrid,
  ]);

  const actionById = useMemo(() => new Map(actions.map((action) => [action.id, action])), [actions]);
  const favoriteCommandIdSet = useMemo(() => new Set(favoriteCommandIds), [favoriteCommandIds]);

  const recordRecentCommand = useCallback((actionId: string) => {
    setRecentCommandIds((current) => {
      const next = [actionId, ...current.filter((id) => id !== actionId)].slice(0, MAX_RECENT_COMMANDS);
      writeStoredCommandIds(RECENT_COMMANDS_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const toggleFavoriteCommand = useCallback((actionId: string) => {
    setFavoriteCommandIds((current) => {
      const next = current.includes(actionId)
        ? current.filter((id) => id !== actionId)
        : [actionId, ...current];
      writeStoredCommandIds(FAVORITE_COMMANDS_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const runAction = useCallback((action: PaletteAction) => {
    if (action.disabled) return;
    recordRecentCommand(action.id);
    action.run();
  }, [recordRecentCommand]);

  const filteredActions = useMemo(() => {
    const search = normalize(query);
    if (!search) return actions;
    return actions.filter((action) => {
      const haystack = normalize([
        action.title,
        action.description,
        ...action.keywords,
      ].join(' '));
      return haystack.includes(search);
    });
  }, [actions, query]);

  const firstEnabledAction = filteredActions.find((action) => !action.disabled);
  const commandGroups = useMemo<PaletteActionGroup[]>(() => {
    const search = normalize(query);
    if (search) {
      return ACTION_GROUP_ORDER
        .map((group) => ({
          id: `search-${group}`,
          title: group,
          actions: filteredActions.filter((action) => action.group === group),
        }))
        .filter((group) => group.actions.length > 0);
    }

    const specialActionIds = new Set<string>();
    const favoriteActions = favoriteCommandIds
      .map((id) => actionById.get(id))
      .filter((action): action is PaletteAction => Boolean(action));
    favoriteActions.forEach((action) => specialActionIds.add(action.id));

    const recentActions = recentCommandIds
      .map((id) => actionById.get(id))
      .filter((action): action is PaletteAction => action !== undefined && !specialActionIds.has(action.id));
    recentActions.forEach((action) => specialActionIds.add(action.id));

    const groups: PaletteActionGroup[] = [];
    if (favoriteActions.length > 0) groups.push({ id: 'favorites', title: 'Favorites', icon: Star, actions: favoriteActions });
    if (recentActions.length > 0) groups.push({ id: 'recent', title: 'Recent', icon: Clock3, actions: recentActions });

    ACTION_GROUP_ORDER.forEach((group) => {
      const groupActions = actions.filter((action) => action.group === group && !specialActionIds.has(action.id));
      if (groupActions.length > 0) groups.push({ id: group, title: group, actions: groupActions });
    });

    return groups;
  }, [actionById, actions, favoriteCommandIds, filteredActions, query, recentCommandIds]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      onOpenChange(nextOpen);
      if (!nextOpen) setQuery('');
    }}>
      <DialogContent className="max-w-[680px] gap-3 border-[#46381b] bg-[#090d13] p-0 text-[#e8dcc1] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <DialogHeader className="border-b border-[#252b35] px-4 py-3">
          <DialogTitle className="text-sm text-[#f3ead7]">Command Palette</DialogTitle>
          <DialogDescription className="text-xs text-[#8f95a3]">
            Search layout actions, insert layers, and jump between dense studio panels.
          </DialogDescription>
        </DialogHeader>

        <div className="px-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8f95a3]" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && firstEnabledAction) {
                  event.preventDefault();
                  runAction(firstEnabledAction);
                }
              }}
              placeholder="Search commands..."
              className="h-11 rounded-[4px] border-[#2d3340] bg-[#0f1520] pl-9 text-sm text-[#f3ead7] placeholder:text-[#626b78]"
            />
          </div>
        </div>

        {selectedElement ? (
          <div className="mx-4 rounded-[4px] border border-[#252b35] bg-[#101722] px-3 py-2 text-xs text-[#aeb4c0]">
            Selected: <span className="font-semibold text-[#f1dfb4]">{selectedElement.name || selectedElement.type}</span>
            <span className="ml-2 uppercase tracking-[0.14em] text-[#6f7a89]">{selectedElement.type}</span>
          </div>
        ) : null}

        <div className="max-h-[52vh] overflow-y-auto px-4 pb-4">
          <div className="grid gap-3">
            {commandGroups.map((group) => (
              <section key={group.id} className="space-y-1.5" aria-label={`${group.title} commands`}>
                <div className="flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f7a89]">
                  {group.icon ? <group.icon className="h-3.5 w-3.5 text-[#d5ad54]" /> : null}
                  {group.title}
                </div>
                <div className="grid gap-1.5">
                  {group.actions.map((action) => {
                    const favorite = favoriteCommandIdSet.has(action.id);
                    return (
                      <div key={action.id} className="grid grid-cols-[minmax(0,1fr)_36px] gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={action.disabled}
                          onClick={() => runAction(action)}
                          className={cn(
                            'h-auto min-h-12 justify-start gap-3 rounded-[4px] border border-transparent px-3 py-2 text-left hover:border-[#4b3d20] hover:bg-[#171d29]',
                            action.disabled && 'opacity-45'
                          )}
                        >
                          <action.icon className="h-4 w-4 shrink-0 text-[#d5ad54]" />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-[#f3ead7]">{action.title}</span>
                            <span className="block truncate text-[11px] font-normal text-[#8f95a3]">{action.description}</span>
                          </span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={favorite ? `Remove ${action.title} from favorites` : `Favorite ${action.title}`}
                          aria-pressed={favorite}
                          onClick={() => toggleFavoriteCommand(action.id)}
                          className={cn(
                            'h-full min-h-12 rounded-[4px] border border-transparent text-[#626b78] hover:border-[#4b3d20] hover:bg-[#171d29] hover:text-[#f1dfb4]',
                            favorite && 'text-[#d5ad54]'
                          )}
                        >
                          <Star className={cn('h-4 w-4', favorite && 'fill-current')} />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
            {filteredActions.length === 0 ? (
              <div className="rounded-[4px] border border-dashed border-[#2d3340] px-3 py-8 text-center text-xs text-[#8f95a3]">
                No matching commands.
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
