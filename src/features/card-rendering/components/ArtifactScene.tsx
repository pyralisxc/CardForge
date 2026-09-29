"use client";

import { createContext, memo, useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useIsPresent, usePresenceData, useReducedMotion } from 'motion/react';
import { RefreshCcw } from 'lucide-react';
import { getCardFaceCanvas, getCardFaceTemplate, getCardPreviewLayout, hasCardBacking, type DisplayCard } from '@/domain/rendering';
import type { CardFace } from '@/domain/cards';
import { CardPreview } from './CardPreview';
import { CardWatermarkOverlay } from './CardWatermarkOverlay';
import { getTemplateAccent } from '../model/templateAccent';

type Depth = 'stack' | 'board' | 'focus' | 'edit';
const priority: Record<Depth, number> = { stack: 0, board: 1, focus: 2, edit: 3 };
const RENDER_WIDTH = 560;
const INLINE_FLIP_MIN_SCREEN_WIDTH = 128;
const CONTEXT_ARTIFACT_OPACITY = 0.28;

interface SceneSlot {
  node: HTMLElement;
  card: DisplayCard;
  face: CardFace;
  depth: Depth;
  setId: string;
  rotation: number;
  order: number;
  watermark: boolean;
  flipLabel?: string;
  interactionOverlay?: ReactNode;
}
interface Projection extends SceneSlot {
  x: number;
  y: number;
  width: number;
  opacity: number;
  clip: string;
  travelClip: string;
}
interface SceneRegistry {
  register: (id: string, slot: SceneSlot) => () => void;
  refresh: () => void;
  activeSetId: string | null;
  settledDepths: Record<string, Depth>;
}
const RegistryContext = createContext<SceneRegistry | null>(null);
const FaceContext = createContext<{
  faces: Record<string, CardFace>;
  setFace: (id: string, face: CardFace) => void;
} | null>(null);
const SceneCardContent = memo(function SceneCardContent({ card, face, watermark, interactionOverlay }: Pick<SceneSlot, 'card' | 'face' | 'watermark' | 'interactionOverlay'>) {
  return <><CardPreview card={card} face={face} targetWidthPx={RENDER_WIDTH} interactionOverlay={interactionOverlay} />{watermark ? <CardWatermarkOverlay /> : null}</>;
});

function SceneArtifactFrame({ item, origin, immediate, inlineSettled, onFlip, onSettled }: {
  item: Projection;
  origin: Projection;
  immediate: boolean;
  inlineSettled: boolean;
  onFlip: (id: string, face: CardFace) => void;
  onSettled: (id: string, depth: Depth) => void;
}) {
  const [settledDepth, setSettledDepth] = useState<Depth | null>(null);
  const present = useIsPresent();
  const activeSetId = usePresenceData();
  const culled = !present && activeSetId === item.setId;
  const travelling = !immediate && (!present || settledDepth !== item.depth);
  const template = getCardFaceTemplate(item.card, item.face);
  const screenScale = RENDER_WIDTH / item.width;
  const previewScale = getCardPreviewLayout({
    targetWidthPx: RENDER_WIDTH,
    aspectRatio: template.aspectRatio,
    canvas: getCardFaceCanvas(item.card, item.face),
    isPrintMode: false,
  }).visualScale;
  const canOwnInlineFlip = item.width >= INLINE_FLIP_MIN_SCREEN_WIDTH;
  return <motion.div style={{ position: 'absolute', inset: 0, clipPath: travelling ? item.travelClip : item.clip, zIndex: priority[item.depth] * 100 + item.order }}>
    <motion.div
      data-scene-artifact={item.card.uniqueId}
      data-scene-depth={item.depth}
      data-scene-face={item.face}
      data-scene-template={template.id}
      data-scene-moving={travelling}
      initial={{ x: origin.x, y: origin.y, scale: origin.width / RENDER_WIDTH, rotate: origin.rotation, opacity: 0 }}
      animate={{ x: item.x, y: item.y, scale: item.width / RENDER_WIDTH, rotate: item.rotation, opacity: inlineSettled ? 0 : item.opacity }}
      exit={culled || immediate ? { opacity: 0, transition: { duration: 0 } } : { x: origin.x, y: origin.y, scale: origin.width / RENDER_WIDTH, rotate: origin.rotation, opacity: 0, transition: { opacity: { delay: 0.3, duration: 0.15 } } }}
      onAnimationComplete={() => {
        setSettledDepth(item.depth);
        onSettled(item.card.uniqueId, item.depth);
      }}
      transition={inlineSettled ? { duration: 0 } : immediate ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 32, mass: 0.9, opacity: { duration: 0.18 } }}
      style={{ position: 'absolute', left: 0, top: 0, width: RENDER_WIDTH, visibility: inlineSettled ? 'hidden' : 'visible', transformOrigin: '0 0', filter: 'drop-shadow(0 12px 18px rgb(0 0 0 / 24%))', '--artifact-hit-scale': screenScale / Math.max(previewScale, 0.001) } as React.CSSProperties}
    >
      {item.interactionOverlay && !inlineSettled
        ? <SceneCardContent card={item.card} face={item.face} watermark={item.watermark} interactionOverlay={item.interactionOverlay} />
        : <div aria-hidden="true" inert><SceneCardContent card={item.card} face={item.face} watermark={item.watermark} /></div>}
      {item.depth !== 'stack' ? <span data-artifact-template-border aria-hidden="true" style={{ position: 'absolute', inset: -3 * screenScale, border: `${2 * screenScale}px dashed ${getTemplateAccent(template.id ?? template.name)}`, borderRadius: 4 * screenScale, pointerEvents: 'none' }} /> : null}
      {!inlineSettled && canOwnInlineFlip && item.flipLabel && item.opacity === 1 && hasCardBacking(item.card) ? <button
        type="button"
        onClick={() => onFlip(item.card.uniqueId, item.face === 'front' ? 'back' : 'front')}
        aria-label={`Show ${item.face === 'front' ? 'back' : 'front'} of ${item.flipLabel}`}
        style={{ position: 'absolute', bottom: 12, right: 12, width: 40, height: 40, display: 'grid', placeItems: 'center', pointerEvents: 'auto', transform: `scale(${RENDER_WIDTH / item.width})`, transformOrigin: 'bottom right', borderRadius: 8, background: 'var(--cf-surface)', color: 'var(--cf-text)', border: '1px solid var(--cf-border-strong)' }}
      ><RefreshCcw size={18} aria-hidden="true" /></button> : null}
    </motion.div>
  </motion.div>;
}

/** The scene owns travelling pixels; settled slots own visible pixels in place.
 * A card keeps stable Artifact identity while its highest-depth slot supplies
 * transition geometry. Native scrolling is measured in one viewport coordinate
 * system, not copied into another navigation or persistence store.
 */
export function ArtifactScene({ children, activeSetId }: { children: ReactNode; activeSetId: string | null }) {
  const slots = useRef(new Map<string, SceneSlot>());
  const origins = useRef(new Map<string, Projection>());
  const inlineOrigins = useRef(new Map<string, Projection>());
  const frame = useRef<number | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const [projections, setProjections] = useState<Projection[]>([]);
  const [directMotion, setDirectMotion] = useState(false);
  const [faces, setFaces] = useState<Record<string, CardFace>>({});
  const [settledDepths, setSettledDepths] = useState<Record<string, Depth>>({});
  const reducedMotion = useReducedMotion();
  const directUntil = useRef(0);
  const dragging = useRef(false);
  const previousDepth = useRef(new Map<string, Depth>());
  const pendingSettled = useRef(new Map<string, Depth>());
  const settledFrame = useRef<number | null>(null);

  const measure = useCallback(() => {
    frame.current = null;
    const selected = new Map<string, Projection>();
    const bounds = new Map<Element, DOMRect>();
    const rectOf = (node: Element) => {
      let rect = bounds.get(node);
      if (!rect) { rect = node.getBoundingClientRect(); bounds.set(node, rect); }
      return rect;
    };
    for (const slot of slots.current.values()) {
      if (!slot.node.isConnected || slot.node.closest('[data-scene-hidden="true"]')) continue;
      const rect = rectOf(slot.node);
      if (!rect.width || !rect.height || getComputedStyle(slot.node).visibility === 'hidden') continue;
      const existing = selected.get(slot.card.uniqueId);
      if (existing && priority[existing.depth] > priority[slot.depth]) continue;
      let top = 0, left = 0, right = window.innerWidth, bottom = window.innerHeight;
      let travelClip = 'inset(0px)';
      // Explicit viewport boundaries keep artifacts out of toolbars and panels.
      for (let parent = slot.node.parentElement; parent; parent = parent.parentElement) {
        if (!parent.hasAttribute('data-scene-viewport')) continue;
        const clip = rectOf(parent);
        travelClip = `inset(${clip.top}px ${Math.max(0, window.innerWidth - clip.right)}px ${Math.max(0, window.innerHeight - clip.bottom)}px ${clip.left}px)`;
        top = Math.max(top, clip.top); left = Math.max(left, clip.left);
        right = Math.min(right, clip.right); bottom = Math.min(bottom, clip.bottom);
      }
      const projection: Projection = {
        ...slot, travelClip, x: rect.left, y: rect.top, width: rect.width,
        opacity: slot.node.closest('[data-surface-authority="context"]') ? CONTEXT_ARTIFACT_OPACITY : 1,
        clip: `inset(${top}px ${Math.max(0, window.innerWidth - right)}px ${Math.max(0, window.innerHeight - bottom)}px ${left}px)`,
      };
      if (slot.depth !== 'board') {
        const inlineNode = Array.from(document.querySelectorAll<HTMLElement>('[data-scene-inline-board="true"]'))
          .find((candidate) => candidate.dataset.sceneSlot === slot.card.uniqueId);
        if (inlineNode?.isConnected) {
          const inlineRect = rectOf(inlineNode);
          if (inlineRect.width && inlineRect.height) {
            inlineOrigins.current.set(slot.card.uniqueId, {
              ...slot,
              node: inlineNode,
              depth: 'board',
              x: inlineRect.left,
              y: inlineRect.top,
              width: inlineRect.width,
              opacity: 1,
              clip: 'inset(0px)',
              travelClip: 'inset(0px)',
            });
          }
        }
      }
      selected.set(slot.card.uniqueId, projection);
      if (slot.depth === 'stack') origins.current.set(slot.setId, projection);
    }
    setDirectMotion(performance.now() < directUntil.current || dragging.current);
    setProjections([...selected.values()]);
  }, []);
  const refresh = useCallback(() => {
    if (frame.current === null) frame.current = requestAnimationFrame(measure);
  }, [measure]);
  const register = useCallback((id: string, slot: SceneSlot) => {
    slots.current.set(id, slot);
    observer.current?.observe(slot.node);
    refresh();
    return () => {
      observer.current?.unobserve(slot.node);
      slots.current.delete(id);
      refresh();
    };
  }, [refresh]);
  useLayoutEffect(() => {
    observer.current = new ResizeObserver(refresh);
    for (const slot of slots.current.values()) observer.current.observe(slot.node);
    const onScroll = () => { directUntil.current = performance.now() + 180; refresh(); };
    const onWheel = () => { directUntil.current = performance.now() + 180; };
    const onPointerDown = () => { dragging.current = true; };
    const onPointerUp = () => { dragging.current = false; };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('resize', refresh);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
    refresh();
    return () => {
      observer.current?.disconnect();
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', refresh);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerUp, true);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (settledFrame.current !== null) cancelAnimationFrame(settledFrame.current);
      frame.current = null;
      settledFrame.current = null;
    };
  }, [refresh]);
  // Every parent commit can change layout without resizing the card itself.
  useLayoutEffect(refresh, [children, refresh]);
  const markSettled = useCallback((id: string, depth: Depth) => {
    pendingSettled.current.set(id, depth);
    if (settledFrame.current !== null) return;
    settledFrame.current = requestAnimationFrame(() => {
      settledFrame.current = null;
      const pending = new Map(pendingSettled.current);
      pendingSettled.current.clear();
      setSettledDepths((current) => {
        let changed = false;
        const next = { ...current };
        for (const [artifactId, settledDepth] of pending) {
          if (next[artifactId] === settledDepth) continue;
          next[artifactId] = settledDepth;
          changed = true;
        }
        return changed ? next : current;
      });
    });
  }, []);
  const registry = useMemo(() => ({ register, refresh, activeSetId, settledDepths }), [activeSetId, refresh, register, settledDepths]);
  const setFace = useCallback((id: string, face: CardFace) => setFaces((current) => ({ ...current, [id]: face })), []);
  const faceState = useMemo(() => ({ faces, setFace }), [faces, setFace]);
  const immediate = Boolean(reducedMotion) || directMotion;
  useLayoutEffect(() => {
    previousDepth.current = new Map(projections.map((item) => [item.card.uniqueId, item.depth]));
  }, [projections]);

  return <RegistryContext.Provider value={registry}>
    <FaceContext.Provider value={faceState}>{children}</FaceContext.Provider>
    <div data-artifact-scene style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 21 }}>
      <AnimatePresence custom={activeSetId}>
        {projections.map((item) => {
          const origin = inlineOrigins.current.get(item.card.uniqueId) ?? origins.current.get(item.setId) ?? item;
          const settledDepth = settledDepths[item.card.uniqueId];
          // A Desk stack has no previous travelling destination on first load,
          // so its truthful preview can render inline immediately. After a real
          // board/focus/edit journey, stack waits for the reverse travel to
          // settle before taking pixels back.
          const inlineSettled = settledDepth === item.depth
            || (item.depth === 'stack' && settledDepth === undefined);
          return <SceneArtifactFrame
            key={item.card.uniqueId}
            item={item}
            origin={origin}
            immediate={Boolean(reducedMotion) || (immediate && previousDepth.current.get(item.card.uniqueId) === item.depth)}
            inlineSettled={inlineSettled}
            onFlip={setFace}
            onSettled={markSettled}
          />;
        })}
      </AnimatePresence>
    </div>
  </RegistryContext.Provider>;
}

export function useArtifactFace(artifactId: string, initialFace: CardFace = 'front') {
  const scene = useContext(FaceContext);
  const [localFace, setLocalFace] = useState(initialFace);
  const face = scene ? scene.faces[artifactId] ?? initialFace : localFace;
  const updateFace = scene?.setFace;
  const setFace = useCallback((next: CardFace) => updateFace ? updateFace(artifactId, next) : setLocalFace(next), [artifactId, updateFace]);
  return [face, setFace] as const;
}

export function useArtifactFaces() {
  const scene = useContext(FaceContext);
  const [faces, setFaces] = useState<Record<string, CardFace>>({});
  const setFace = useCallback((id: string, face: CardFace) => setFaces((current) => ({ ...current, [id]: face })), []);
  return [scene?.faces ?? faces, scene?.setFace ?? setFace] as const;
}

export function ArtifactSlot({ card, face = 'front', depth, setId = card.setId ?? '', width, rotation = 0, order = 0, watermark = false, flipLabel, interactionOverlay }: {
  card: DisplayCard;
  face?: CardFace;
  depth: Depth;
  setId?: string;
  width: number;
  rotation?: number;
  order?: number;
  watermark?: boolean;
  flipLabel?: string;
  interactionOverlay?: ReactNode;
}) {
  const scene = useContext(RegistryContext);
  const id = useId();
  const node = useRef<HTMLSpanElement>(null);
  const [persistentFace] = useArtifactFace(card.uniqueId, face);
  const resolvedSetId = setId || scene?.activeSetId || '';
  const template = getCardFaceTemplate(card, persistentFace);
  const geometry = getCardPreviewLayout({ targetWidthPx: width, aspectRatio: template.aspectRatio, canvas: getCardFaceCanvas(card, persistentFace), isPrintMode: false });
  const settledDepth = scene?.settledDepths[card.uniqueId];
  const inlineSettled = Boolean(scene && (
    settledDepth === depth
    || (depth === 'stack' && settledDepth === undefined)
  ));
  const inlineBoard = inlineSettled && depth === 'board';
  const register = scene?.register;
  const refresh = scene?.refresh;
  useLayoutEffect(() => {
    // Board has many nodes, so once settled it unregisters completely. The one
    // active focus/edit destination remains registered for exact reverse travel.
    if (!register || !node.current || inlineBoard) return;
    return register(id, { node: node.current, card, face: persistentFace, depth, setId: resolvedSetId, rotation, order, watermark, flipLabel, interactionOverlay });
  }, [card, depth, flipLabel, id, inlineBoard, interactionOverlay, order, persistentFace, register, resolvedSetId, rotation, watermark]);
  useLayoutEffect(() => {
    if (!inlineSettled) refresh?.();
  });
  if (!scene) return <CardPreview card={card} face={face} targetWidthPx={width} isEditorPreview interactionOverlay={interactionOverlay} />;
  return <span
    ref={node}
    data-scene-slot={card.uniqueId}
    data-scene-slot-depth={depth}
    data-scene-inline-board={inlineBoard ? 'true' : 'false'}
    data-scene-inline-settled={inlineSettled ? depth : undefined}
    style={{
      position: 'relative',
      display: 'block',
      width,
      height: geometry.visualHeightPx,
      ...(inlineSettled && interactionOverlay
        ? { '--artifact-hit-scale': 1 / Math.max(geometry.visualScale, 0.001) }
        : {}),
    } as React.CSSProperties}
  >
    {inlineSettled ? depth === 'stack' ? <span
      data-scene-inline-stack-pixels
      style={{
        position: 'relative',
        display: 'block',
        width,
        height: geometry.visualHeightPx,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: '50% 80%',
      }}
    >
      <CardPreview card={card} face={persistentFace} targetWidthPx={width} isEditorPreview interactionOverlay={interactionOverlay} />
      {watermark ? <CardWatermarkOverlay /> : null}
    </span> : <>
      <CardPreview card={card} face={persistentFace} targetWidthPx={width} isEditorPreview interactionOverlay={interactionOverlay} />
      {watermark ? <CardWatermarkOverlay /> : null}
      <span
        data-artifact-template-border
        aria-hidden="true"
        style={{ position: 'absolute', inset: -3, border: `2px dashed ${getTemplateAccent(template.id ?? template.name)}`, borderRadius: 4, pointerEvents: 'none' }}
      />
    </> : null}
  </span>;
}
