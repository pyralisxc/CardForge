"use client";

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Layers, Minus, Navigation, Pencil, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { CardData, CardFace } from '@/domain/cards';
import { getCardFaceCanvas, getCardFaceTemplate, type DisplayCard } from '@/domain/rendering';
import { ArtifactSlot, useArtifactFace, useArtifactViewport } from '@/features/card-rendering/client';
import { buildArtifactFieldTargetMap, completeCardDataWithTemplateDefaults, GeneratorFieldGroups, getMissingRequiredFieldLabels, initializeCardDataFromTemplate, type ArtifactFieldTarget } from '@/features/card-generator/client';
import { optimizeLocalAssetFile, validateLocalAssetFile } from '@/features/project/client/persistence-storage';
import { useProjectStore } from '@/features/project/client/workspace';
import { useToast } from '@/components/ui/use-toast';
import type { ArtifactBrowseDirection } from '../model/focusedArtifactLayout';

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
  onEdit: () => void;
  editing: boolean;
  onCancelEdit: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (card: DisplayCard) => void;
  onDesign: (card: DisplayCard, face: CardFace) => void;
}

const directionForKey = (key: string): ArtifactBrowseDirection | null => (
  key === 'ArrowUp' ? 'up'
    : key === 'ArrowDown' ? 'down'
      : key === 'ArrowLeft' ? 'left'
        : key === 'ArrowRight' ? 'right'
          : null
);

const directionForSwipe = (deltaX: number, deltaY: number): ArtifactBrowseDirection | null => {
  if (Math.hypot(deltaX, deltaY) < 56) return null;
  return Math.abs(deltaX) >= Math.abs(deltaY)
    ? deltaX > 0 ? 'right' : 'left'
    : deltaY > 0 ? 'down' : 'up';
};

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
  onEdit,
  editing,
  onCancelEdit,
  onDirtyChange,
  onSave,
  onDesign,
}: FocusedArtifactWorkspaceProps) {
  const [face] = useArtifactFace(artifactId);
  const { toast } = useToast();
  const richTextHighlightColor = useProjectStore((state) => state.richTextHighlightColor);
  const setRichTextHighlightColor = useProjectStore((state) => state.setRichTextHighlightColor);
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
  const swipeRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);

  useEffect(() => {
    setFrontData(initialFront[1]);
    setBackData(initialBack[1]);
    setSelectedTargetId(null);
    setShowAllFields(false);
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
    && event.pointerType === 'touch'
    && event.isPrimary
    && event.target instanceof Node
    && event.currentTarget.contains(event.target)
  );
  const handlePointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (editing && event.target instanceof Element && event.target.closest('[data-artifact-field-target]')) return;
    viewport.gestures.onPointerDownCapture(event);
    if (event.pointerType === 'touch' && swipeRef.current?.pointerId !== event.pointerId) swipeRef.current = null;
    if (canStartSwipe(event)) swipeRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
  };
  const handlePointerUpCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    viewport.gestures.onPointerUpCapture(event);
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    swipeRef.current = null;
    const direction = directionForSwipe(event.clientX - swipe.startX, event.clientY - swipe.startY);
    if (direction) browse(direction);
  };
  const handlePointerCancelCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    viewport.gestures.onPointerCancelCapture(event);
    if (swipeRef.current?.pointerId === event.pointerId) swipeRef.current = null;
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

  return <div className={styles.artifactWorkspace} data-focused-artifact-workspace data-artifact-edit-workspace={editing ? '' : undefined} data-focus-dismissal="explicit" data-editing={editing ? 'true' : 'false'} data-zoom={viewport.zoom.toFixed(2)}>
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
      onPointerMoveCapture={viewport.gestures.onPointerMoveCapture}
      onPointerUpCapture={handlePointerUpCapture}
      onPointerCancelCapture={handlePointerCancelCapture}
      onClickCapture={viewport.gestures.onClickCapture}
      onContextMenu={viewport.gestures.onContextMenu}
      style={{ overflow: viewport.isAutoFit ? 'hidden' : 'auto', touchAction: 'none' }}
      aria-label={`${setName} focused Artifact viewport`}
      aria-describedby={`focused-artifact-browse-${artifactId}`}
    >
      <p id={`focused-artifact-browse-${artifactId}`} className="sr-only">{editing ? 'Artifact Edit is active. Choose a highlighted field on the card, or use All fields for a complete accessible list.' : 'When this card is fitted, swipe up, down, left, or right to browse the nearby cards in this Set. Arrow keys offer the same navigation while this card is focused. Use the Browse button for visible direction controls.'}</p>
      <div className={styles.focusedArtifactWorld} style={{ width: viewport.worldWidth, height: viewport.worldHeight }}>
        <div className={styles.focusedArtifactFrame} style={{ width: viewport.visualWidth, minHeight: viewport.visualHeight }} data-card-face={face}>
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
      {!editing ? <Popover>
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
      </Popover> : <>
        <span className={styles.artifactEditModeLabel}><Pencil aria-hidden="true" />Editing Artifact</span>
        <Button type="button" size="sm" variant="ghost" onClick={onCancelEdit}>Cancel</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => { setShowAllFields(true); setSelectedTargetId(null); }}>All fields</Button>
      </>}
      <Button type="button" size="icon" variant="ghost" onClick={() => viewport.changeZoom(viewport.zoom - 0.15)} aria-label="Zoom out"><Minus aria-hidden="true" /></Button>
      <span className={styles.artifactZoomValue} aria-live="polite">{Math.round(viewport.zoom * 100)}%</span>
      <Button type="button" size="icon" variant="ghost" onClick={() => viewport.changeZoom(viewport.zoom + 0.15)} aria-label="Zoom in"><Plus aria-hidden="true" /></Button>
      <Button type="button" size="sm" variant="ghost" onClick={viewport.fit}>Fit</Button>
      {editing ? <Button type="button" size="sm" onClick={() => { if (dirty) save(); else onCancelEdit(); }}><Check className="mr-1.5 h-4 w-4" aria-hidden="true" />{dirty ? 'Save & Done' : 'Done'}</Button> : <CardActions card={card} canExportClean={canExportClean} canUseProjectFiles={canUseProjectFiles} compact />}
    </div>
  </div>;
}
