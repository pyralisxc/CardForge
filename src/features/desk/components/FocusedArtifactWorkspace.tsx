"use client";

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Layers, Minus, MoreHorizontal, Navigation, Pencil, Plus, RefreshCcw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { CardData, CardFace } from '@/domain/cards';
import { getCardFaceCanvas, getCardFaceTemplate, hasCardBacking, type DisplayCard } from '@/domain/rendering';
import { ArtifactSlot, useArtifactFace, useArtifactViewport } from '@/features/card-rendering/client';
import { buildArtifactFieldTargetMap, completeCardDataWithTemplateDefaults, GeneratorFieldGroups, getMissingRequiredFieldLabels, initializeCardDataFromTemplate, type ArtifactFieldTarget } from '@/features/card-generator/client';
import { optimizeLocalAssetFile, validateLocalAssetFile } from '@/features/project/client/persistence-storage';
import { useEditorPreferences } from '@/features/editor-preferences/client';
import { useToast } from '@/components/ui/use-toast';
import type { ArtifactBrowseDirection } from '../model/focusedArtifactLayout';
import {
  isFocusedArtifactDirectPointer,
  isFocusedArtifactDoubleTap,
  resolveFocusedArtifactSwipe,
  type FocusedArtifactTap,
} from '../model/focusedArtifactInteraction';

import styles from './Desk.module.css';

const CardActions = dynamic(() => import('@/features/card-generator/client/card-actions').then((module) => module.CardActions), { ssr: false });

interface FocusedArtifactWorkspaceProps {
  artifactId: string;
  card: DisplayCard;
  canExportClean: boolean;
  canUseProjectFiles: boolean;
  setName: string;
  title: string;
  subtitle: string;
  availableDirections: Readonly<Record<ArtifactBrowseDirection, boolean>>;
  onBrowse: (direction: ArtifactBrowseDirection) => void;
  onExitFocus: () => void;
  onEdit: () => void;
  editing: boolean;
  onCancelEdit: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (card: DisplayCard) => void;
  onDesign: (card: DisplayCard, face: CardFace) => void;
}

const directionForKey = (key: string): ArtifactBrowseDirection | null => (
  key === 'ArrowUp' || key.toLocaleLowerCase() === 'w' ? 'up'
    : key === 'ArrowDown' || key.toLocaleLowerCase() === 's' ? 'down'
      : key === 'ArrowLeft' || key.toLocaleLowerCase() === 'a' ? 'left'
        : key === 'ArrowRight' || key.toLocaleLowerCase() === 'd' ? 'right'
          : null
);

const targetStyle = (target: ArtifactFieldTarget, canvas: NonNullable<ReturnType<typeof getCardFaceCanvas>>): React.CSSProperties => ({
  left: `${((target.element.x + target.element.width / 2) / Math.max(1, canvas.width)) * 100}%`,
  top: `${((target.element.y + target.element.height / 2) / Math.max(1, canvas.height)) * 100}%`,
  width: `${(target.element.width / Math.max(1, canvas.width)) * 100}%`,
  height: `${(target.element.height / Math.max(1, canvas.height)) * 100}%`,
  transform: `translate(-50%, -50%) rotate(${target.element.rotation || 0}deg)`,
  zIndex: target.element.zIndex + 1,
});

const isSameData = (left: CardData, right: CardData) => JSON.stringify(left) === JSON.stringify(right);

export function FocusedArtifactWorkspace({
  artifactId,
  card,
  canExportClean,
  canUseProjectFiles,
  setName,
  title,
  subtitle,
  availableDirections,
  onBrowse,
  onExitFocus,
  onEdit,
  editing,
  onCancelEdit,
  onDirtyChange,
  onSave,
  onDesign,
}: FocusedArtifactWorkspaceProps) {
  const [face, setFace] = useArtifactFace(artifactId);
  const { toast } = useToast();
  const { richTextHighlightColor, setRichTextHighlightColor } = useEditorPreferences();
  const initialFront = useMemo(() => initializeCardDataFromTemplate(card.template, card.data, true), [card.data, card.template]);
  const initialBack = useMemo(() => initializeCardDataFromTemplate(card.backingTemplate, card.backingData, true), [card.backingData, card.backingTemplate]);
  const [frontData, setFrontData] = useState<CardData>(initialFront[1]);
  const [backData, setBackData] = useState<CardData>(initialBack[1]);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [showAllFields, setShowAllFields] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const template = getCardFaceTemplate(card, face);
  const data = face === 'back' ? backData : frontData;
  const setData = face === 'back' ? setBackData : setFrontData;
  const fieldMap = useMemo(() => buildArtifactFieldTargetMap(template), [template]);
  const selectedTarget = selectedTargetId ? fieldMap.targets.find((target) => target.element.id === selectedTargetId) ?? null : null;
  const inspectorFields = showAllFields ? fieldMap.fields : selectedTarget?.fields ?? [];
  const dirty = !isSameData(frontData, initialFront[1]) || !isSameData(backData, initialBack[1]);
  const previewCard = useMemo<DisplayCard>(() => ({
    ...card,
    data: frontData,
    backingData: card.backingTemplate ? backData : undefined,
  }), [backData, card, frontData]);
  const canvas = getCardFaceCanvas(card, face);
  const viewport = useArtifactViewport({
    aspectRatio: canvas ? `${canvas.width}:${canvas.height}` : (face === 'back' ? card.backingTemplate : card.template)?.aspectRatio,
    horizontalPadding: 72,
    maxWidth: 520,
    verticalPadding: 144,
  });
  const swipeRef = useRef<{
    pointerId: number;
    pointerType: string;
    startX: number;
    startY: number;
    startTime: number;
    artifactTargetId: string | null;
  } | null>(null);
  const activeDirectPointersRef = useRef(new Set<number>());
  const tapRef = useRef<FocusedArtifactTap | null>(null);
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0, active: false });

  useEffect(() => {
    setFrontData(initialFront[1]);
    setBackData(initialBack[1]);
    setSelectedTargetId(null);
    setShowAllFields(false);
    swipeRef.current = null;
    tapRef.current = null;
    activeDirectPointersRef.current.clear();
    setSwipeOffset({ x: 0, y: 0, active: false });
  }, [card.uniqueId, initialBack, initialFront]);
  useEffect(() => onDirtyChange(editing && dirty), [dirty, editing, onDirtyChange]);
  useEffect(() => {
    if (!editing || !dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, editing]);
  useEffect(() => {
    setSelectedTargetId(null);
    setShowAllFields(false);
  }, [face]);

  const browse = (direction: ArtifactBrowseDirection) => {
    if (!editing && availableDirections[direction]) onBrowse(direction);
  };
  const canStartSwipe = (event: ReactPointerEvent<HTMLDivElement>) => (
    !editing
    && viewport.isAutoFit
    && isFocusedArtifactDirectPointer(event.pointerType)
    && event.isPrimary
    && event.target instanceof Node
    && event.currentTarget.contains(event.target)
  );
  const resetSwipeFeedback = () => setSwipeOffset({ x: 0, y: 0, active: false });
  const handlePointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (editing && event.target instanceof Element && event.target.closest('[data-artifact-field-target]')) return;
    viewport.gestures.onPointerDownCapture(event);
    if (!isFocusedArtifactDirectPointer(event.pointerType)) return;

    activeDirectPointersRef.current.add(event.pointerId);
    if (activeDirectPointersRef.current.size > 1) {
      swipeRef.current = null;
      tapRef.current = null;
      resetSwipeFeedback();
      return;
    }

    if (swipeRef.current?.pointerId !== event.pointerId) swipeRef.current = null;
    if (!canStartSwipe(event)) return;
    const artifactTarget = event.target instanceof Element
      ? event.target.closest<HTMLElement>('button[data-focused="true"][data-artifact-id]')
      : null;
    swipeRef.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
      artifactTargetId: artifactTarget?.dataset.artifactId ?? null,
    };
  };
  const handlePointerMoveCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    viewport.gestures.onPointerMoveCapture(event);
    const swipe = swipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId || activeDirectPointersRef.current.size !== 1) return;
    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;
    if (Math.hypot(deltaX, deltaY) < 6) return;
    const damp = (value: number) => Math.max(-72, Math.min(72, value * 0.34));
    setSwipeOffset({ x: damp(deltaX), y: damp(deltaY), active: true });
  };
  const handlePointerUpCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    viewport.gestures.onPointerUpCapture(event);
    if (isFocusedArtifactDirectPointer(event.pointerType)) activeDirectPointersRef.current.delete(event.pointerId);
    if (!swipe || swipe.pointerId !== event.pointerId) return;

    swipeRef.current = null;
    resetSwipeFeedback();
    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;
    const durationMs = Math.max(1, event.timeStamp - swipe.startTime);
    const direction = resolveFocusedArtifactSwipe({ deltaX, deltaY, durationMs });
    if (direction) {
      tapRef.current = null;
      browse(direction);
      return;
    }

    const movement = Math.hypot(deltaX, deltaY);
    if (!swipe.artifactTargetId || movement > 12 || durationMs > 320) {
      tapRef.current = null;
      return;
    }
    const nextTap: FocusedArtifactTap = {
      artifactId: swipe.artifactTargetId,
      pointerType: swipe.pointerType,
      x: event.clientX,
      y: event.clientY,
      at: event.timeStamp,
    };
    if (isFocusedArtifactDoubleTap(tapRef.current, nextTap)) {
      tapRef.current = null;
      onEdit();
      return;
    }
    tapRef.current = nextTap;
  };
  const handlePointerCancelCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    viewport.gestures.onPointerCancelCapture(event);
    activeDirectPointersRef.current.delete(event.pointerId);
    if (swipeRef.current?.pointerId === event.pointerId) swipeRef.current = null;
    tapRef.current = null;
    resetSwipeFeedback();
  };
  const handleFocusedArtifactKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (editing) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const direction = directionForKey(event.key);
    if (!direction || !availableDirections[direction]) return;
    event.preventDefault();
    browse(direction);
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>, fieldKey: string) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const validation = validateLocalAssetFile(file);
    if (!validation.ok) {
      toast({ title: 'Image not added', description: validation.message, variant: 'destructive' });
      return;
    }
    try {
      const storedFile = await optimizeLocalAssetFile(file);
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(storedFile);
      });
      setData((current) => ({ ...current, [fieldKey]: dataUri }));
    } catch (error) {
      toast({ title: 'Image not added', description: error instanceof Error ? error.message : 'Unable to validate the image.', variant: 'destructive' });
    }
  };

  const save = (): DisplayCard | null => {
    const missingFields = [
      ...getMissingRequiredFieldLabels(initialFront[0].filter((field) => !(field.isImage && frontData[field.key] === undefined)), frontData).map((label) => `Front: ${label}`),
      ...(card.backingTemplate
        ? getMissingRequiredFieldLabels(initialBack[0].filter((field) => !(field.isImage && backData[field.key] === undefined)), backData).map((label) => `Back: ${label}`)
        : []),
    ];
    if (missingFields.length) {
      toast({
        title: 'Required fields are missing',
        description: `Fill in ${missingFields.slice(0, 3).join(', ')}${missingFields.length > 3 ? ', ...' : ''} before saving.`,
        variant: 'destructive',
      });
      return null;
    }
    const updatedCard: DisplayCard = {
      ...card,
      data: completeCardDataWithTemplateDefaults(initialFront[0], frontData, true),
      backingData: card.backingTemplate ? completeCardDataWithTemplateDefaults(initialBack[0], backData, true) : undefined,
      updatedAt: new Date().toISOString(),
    };
    onDirtyChange(false);
    onSave(updatedCard);
    return updatedCard;
  };
  const designTemplate = () => {
    if (dirty) {
      const saved = save();
      if (saved) onDesign(saved, face);
      return;
    }
    onDesign(card, face);
  };

  const interactionOverlay = editing && canvas ? <div className={styles.artifactFieldOverlay} aria-label={`${face} Artifact fields`}>
    {fieldMap.targets.map((target) => <button
      key={target.element.id}
      type="button"
      className={styles.artifactFieldTarget}
      style={targetStyle(target, canvas)}
      data-artifact-field-target={target.kind}
      data-field-element-id={target.element.id}
      data-selected={selectedTargetId === target.element.id ? 'true' : 'false'}
      aria-label={target.kind === 'artifact-field' ? `Edit ${target.label}` : `${target.label}. Open Template design options`}
      title={target.label}
      onClick={() => { setSelectedTargetId(target.element.id); setShowAllFields(false); }}
    />)}
  </div> : undefined;

  return <div className={styles.artifactWorkspace} data-focused-artifact-workspace data-surface-authority="primary" data-artifact-edit-workspace={editing ? '' : undefined} data-focus-dismissal={editing ? 'explicit' : 'background'} data-editing={editing ? 'true' : 'false'} data-zoom={viewport.zoom.toFixed(2)}>
    <div
      ref={viewport.viewportRef}
      tabIndex={-1}
      className={styles.contentStage}
      data-desk-artifact-stage
      data-scene-viewport
      data-artifact-focus-exclusive="false"
      data-artifact-scroll-contained
      data-auto-fit={viewport.isAutoFit ? 'true' : 'false'}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMoveCapture={handlePointerMoveCapture}
      onPointerUpCapture={handlePointerUpCapture}
      onPointerCancelCapture={handlePointerCancelCapture}
      onClickCapture={viewport.gestures.onClickCapture}
      onClick={(event) => {
        if (editing || event.defaultPrevented) return;
        if (event.target instanceof Element && event.target.closest('[data-focused-artifact-frame]')) return;
        onExitFocus();
      }}
      onContextMenu={viewport.gestures.onContextMenu}
      style={{ overflow: viewport.isAutoFit ? 'hidden' : 'auto', touchAction: 'none' }}
      aria-label={`${setName} focused Artifact viewport`}
      aria-describedby={`focused-artifact-browse-${artifactId}`}
    >
      <p id={`focused-artifact-browse-${artifactId}`} className="sr-only">{editing ? 'Artifact Edit is active. Choose a highlighted field on the card, or use All fields for a complete accessible list.' : 'When this card is fitted, swipe up, down, left, or right to browse the nearby cards in this Set. Arrow keys offer the same navigation while this card is focused. Use the Browse button for visible direction controls. Tap or click open space outside the card to return to the Set.'}</p>
      <div className={styles.focusedArtifactWorld} style={{ width: viewport.worldWidth, height: viewport.worldHeight }}>
        <div
          className={styles.focusedArtifactFrame}
          data-focused-artifact-frame
          style={{
            width: viewport.visualWidth,
            minHeight: viewport.visualHeight,
            '--artifact-swipe-x': `${swipeOffset.x}px`,
            '--artifact-swipe-y': `${swipeOffset.y}px`,
          } as React.CSSProperties}
          data-card-face={face}
          data-swipe-active={swipeOffset.active ? 'true' : 'false'}
        >
          {editing ? <div className={styles.focusedArtifactEditFrame} data-artifact-edit-frame>
            <ArtifactSlot card={previewCard} face={face} width={viewport.visualWidth} depth="edit" flipLabel={title} watermark={!canExportClean} interactionOverlay={interactionOverlay} />
          </div> : <button
            id={`spatial-artifact-${artifactId}`}
            type="button"
            className={styles.focusedArtifactButton}
            data-artifact-id={artifactId}
            data-artifact-type="card"
            data-focused="true"
            aria-label={`${title}. ${subtitle}`}
            onDoubleClick={onEdit}
            onKeyDown={handleFocusedArtifactKey}
          >
            <ArtifactSlot card={card} face={face} width={viewport.visualWidth} depth="focus" flipLabel={title} watermark={!canExportClean} />
            <span className="sr-only">{title}</span>
          </button>}
        </div>
      </div>
    </div>

    {editing ? <aside className={styles.artifactFieldInspector} aria-label="Artifact field inspector">
      <header className={styles.artifactInspectorHeader}>
        <div>
          <p>Artifact Edit · {face === 'front' ? 'Front' : 'Back'}</p>
          <h3>{showAllFields ? 'All fields' : selectedTarget?.label ?? 'Choose a field'}</h3>
        </div>
        <div className={styles.artifactInspectorActions}>
          <Button type="button" size="sm" variant="ghost" onClick={designTemplate}><Layers className="mr-1.5 h-4 w-4" aria-hidden="true" />{dirty ? 'Save & Design Template' : 'Design Template'}</Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => { setSelectedTargetId(null); setShowAllFields(false); }} aria-label="Close field inspector"><X aria-hidden="true" /></Button>
        </div>
      </header>
      <div className={styles.artifactInspectorBody}>
        {showAllFields || selectedTarget?.kind === 'artifact-field' ? <GeneratorFieldGroups
          fields={inspectorFields}
          data={data}
          onFieldChange={(fieldKey, value) => setData((current) => ({ ...current, [fieldKey]: value }))}
          highlightColor={richTextHighlightColor}
          onHighlightColorChange={setRichTextHighlightColor}
          fileInputRefs={fileInputRefs}
          onImageUpload={handleImageUpload}
          emptyMessage="This face has no editable Artifact fields."
          singleColumn
        /> : selectedTarget?.kind === 'template-element' ? <div className={styles.templateOwnedNotice}>
          <Layers aria-hidden="true" />
          <strong>This belongs to the Template</strong>
          <p>Its position, appearance, and structure are shared by every linked Artifact. Artifact Edit changes only this card&apos;s variable content.</p>
          <Button type="button" variant="outline" onClick={designTemplate}><Pencil className="mr-2 h-4 w-4" aria-hidden="true" />{dirty ? 'Save & Design Template' : 'Design Template'}</Button>
        </div> : <div className={styles.artifactInspectorPrompt}>
          <Pencil aria-hidden="true" />
          <strong>Edit where you are looking</strong>
          <p>Tap a highlighted region on the Artifact. Use All fields when you prefer a complete form or keyboard path.</p>
          <Button type="button" variant="outline" onClick={() => setShowAllFields(true)}>Show all fields</Button>
        </div>}
      </div>
    </aside> : null}

    <div className={styles.artifactWorkspaceControls} aria-label="Focused Artifact tools">
      {hasCardBacking(card) ? <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setFace(face === 'front' ? 'back' : 'front')}
        aria-label={`Show ${face === 'front' ? 'back' : 'front'} of ${title}`}
        title={`Show ${face === 'front' ? 'back' : 'front'}`}
      ><RefreshCcw className="h-4 w-4" aria-hidden="true" /><span>{face === 'front' ? 'Back' : 'Front'}</span></Button> : null}
      {editing ? <Button className={styles.artifactPrimaryAction} type="button" size="sm" onClick={() => { if (dirty) save(); else onCancelEdit(); }}><Check className="mr-1.5 h-4 w-4" aria-hidden="true" />{dirty ? 'Save & Done' : 'Done'}</Button> : <Popover>
        <PopoverTrigger asChild>
          <Button type="button" size="sm" variant="ghost" data-artifact-browse aria-label="Browse this Set" title="Browse this Set"><Navigation className="h-4 w-4" aria-hidden="true" /><span className={styles.artifactBrowseLabel}>Browse</span></Button>
        </PopoverTrigger>
        <PopoverContent align="end" className={styles.artifactBrowseMenu} aria-label="Browse this Set">
          <strong>Browse Set</strong>
          <p>Swipe the fitted card or use these directions.</p>
          <div className={styles.artifactBrowseGrid}>
            <Button type="button" size="icon" variant="outline" className={styles.artifactBrowseUp} disabled={!availableDirections.up} onClick={() => browse('up')} aria-label="Open Artifact above"><ArrowUp aria-hidden="true" /></Button>
            <Button type="button" size="icon" variant="outline" className={styles.artifactBrowseLeft} disabled={!availableDirections.left} onClick={() => browse('left')} aria-label="Open Artifact to the left"><ArrowLeft aria-hidden="true" /></Button>
            <Button type="button" size="icon" variant="outline" className={styles.artifactBrowseRight} disabled={!availableDirections.right} onClick={() => browse('right')} aria-label="Open Artifact to the right"><ArrowRight aria-hidden="true" /></Button>
            <Button type="button" size="icon" variant="outline" className={styles.artifactBrowseDown} disabled={!availableDirections.down} onClick={() => browse('down')} aria-label="Open Artifact below"><ArrowDown aria-hidden="true" /></Button>
          </div>
        </PopoverContent>
      </Popover>}
      {editing ? <>
        <span className={styles.artifactEditModeLabel}><Pencil aria-hidden="true" />Editing Artifact</span>
        <Button type="button" size="sm" variant="ghost" onClick={onCancelEdit}>Cancel</Button>
      </> : null}
      <span className="max-[600px]:hidden contents">
        {editing ? <Button type="button" size="sm" variant="outline" onClick={() => { setShowAllFields(true); setSelectedTargetId(null); }}>All fields</Button> : null}
        <Button type="button" size="icon" variant="ghost" onClick={() => viewport.changeZoom(viewport.zoom - 0.15)} aria-label="Zoom out"><Minus aria-hidden="true" /></Button>
        <span className={styles.artifactZoomValue} aria-live="polite">{Math.round(viewport.zoom * 100)}%</span>
        <Button type="button" size="icon" variant="ghost" onClick={() => viewport.changeZoom(viewport.zoom + 0.15)} aria-label="Zoom in"><Plus aria-hidden="true" /></Button>
        <Button type="button" size="sm" variant="ghost" onClick={viewport.fit}>Fit</Button>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button type="button" size="sm" variant="ghost" className="min-[601px]:hidden" aria-label="More focused Artifact actions"><MoreHorizontal aria-hidden="true" />More</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {editing ? <DropdownMenuItem onSelect={() => { setShowAllFields(true); setSelectedTargetId(null); }}>All fields</DropdownMenuItem> : null}
          <DropdownMenuItem onSelect={() => viewport.changeZoom(viewport.zoom - 0.15)}><Minus aria-hidden="true" />Zoom out · {Math.round(viewport.zoom * 100)}%</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => viewport.changeZoom(viewport.zoom + 0.15)}><Plus aria-hidden="true" />Zoom in</DropdownMenuItem>
          <DropdownMenuItem onSelect={viewport.fit}>Fit Artifact</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {!editing ? <CardActions card={card} canExportClean={canExportClean} canUseProjectFiles={canUseProjectFiles} compact /> : null}
    </div>
  </div>;
}

