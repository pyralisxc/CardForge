import { describe, expect, it } from 'vitest';

import type { ArtifactIdentity } from '@/domain/artifacts';
import {
  buildFocusedArtifactLayout,
  getDirectionalArtifactNeighbor,
  getArtifactSelectionScope,
  getFocusedArtifactFrame,
  getFocusedArtifactFitZoom,
  getFocusedArtifactPresentation,
  moveFocusedArtifactSelection,
  moveFocusedArtifactSelectionWithRebase,
  projectVisibleArtifacts,
} from '@/features/desk/model/focusedArtifactLayout';

const identity = (index: number): ArtifactIdentity => ({
  artifactId: `card-${index}`,
  artifactType: 'card',
  setId: 'set-scale',
});

const artifacts = (count: number) => Array.from({ length: count }, (_, index) => ({
  identity: identity(index),
  title: `Artifact ${index + 1}`,
  subtitle: 'Card',
  groupLabel: 'All Artifacts',
}));

const buildLayout = (count: number) => buildFocusedArtifactLayout({
  arrangement: 'grid',
  minimumWidth: 1_000,
  groups: [{ label: 'All Artifacts', artifacts: artifacts(count) }],
});

describe('focused Artifact spatial layout', () => {
  it.each([100, 500, 1_000])('retains all %i Artifacts while culling the mounted visual projection', (count) => {
    const layout = buildLayout(count);
    const firstViewport = projectVisibleArtifacts(layout, { x: 0, y: 0, width: 900, height: 520 });
    const last = layout.entries.at(-1);

    expect(layout.entries).toHaveLength(count);
    expect(firstViewport.length).toBeGreaterThan(0);
    expect(firstViewport.length).toBeLessThan(count);
    expect(last?.identity.artifactId).toBe(`card-${count - 1}`);
    expect(projectVisibleArtifacts(layout, {
      x: last?.position.x ?? 0,
      y: last?.position.y ?? 0,
      width: 900,
      height: 520,
    }).some((entry) => entry.identity.artifactId === last?.identity.artifactId)).toBe(true);
  });

  it('uses discrete presentation density instead of one hard-coded Artifact size', () => {
    expect(getFocusedArtifactPresentation({ arrangement: 'grid', artifactCount: 8, availableWidth: 1_920 })).toMatchObject({
      density: 'comfortable', width: 63, height: 88,
    });
    expect(getFocusedArtifactPresentation({ arrangement: 'grid', artifactCount: 30, availableWidth: 1_000 })).toMatchObject({
      density: 'compact', width: 63, height: 88,
    });
    expect(getFocusedArtifactPresentation({ arrangement: 'grid', artifactCount: 100, availableWidth: 1_000 })).toMatchObject({
      density: 'dense', width: 63, height: 88,
    });
  });

  it('preserves real relative physical size for mixed-format Artifacts', () => {
    const layout = buildFocusedArtifactLayout({
      arrangement: 'manual',
      minimumWidth: 960,
      groups: [{
        label: 'Mixed formats',
        artifacts: [
          { ...artifacts(1)[0]!, physicalSizeMm: { widthMm: 63, heightMm: 88 }, position: { x: 20, y: 20 } },
          { ...artifacts(1)[0]!, identity: identity(2), physicalSizeMm: { widthMm: 215.9, heightMm: 279.4 }, position: { x: 500, y: 20 } },
        ],
      }],
    });
    const poker = layout.entries[0]!;
    const letter = layout.entries[1]!;

    expect(letter.contentWidth / poker.contentWidth).toBeCloseTo(215.9 / 63, 8);
    expect(letter.contentHeight / poker.contentHeight).toBeCloseTo(279.4 / 88, 8);
    expect(letter.width).toBeGreaterThan(poker.width * 3);
    expect(letter.height).toBeGreaterThan(poker.height * 2.5);
  });

  it('fits every Artifact inside the bounded Set overview without changing the world bounds', () => {
    const layout = buildFocusedArtifactLayout({
      arrangement: 'grid',
      minimumWidth: 960,
      minimumHeight: 640,
      groups: [{ label: 'All Artifacts', artifacts: artifacts(100) }],
    });
    const fitZoom = getFocusedArtifactFitZoom({
      layout,
      viewportWidth: 320,
      viewportHeight: 640,
    });

    expect(layout.density).toBe('dense');
    expect(layout.artifactWidth * fitZoom).toBeGreaterThan(0);
    expect(layout.width * fitZoom).toBeLessThanOrEqual(320);
    expect(layout.height * fitZoom).toBeLessThanOrEqual(640);
  });

  it('compacts stacks one density step and consolidates them by overlap', () => {
    const grid = buildFocusedArtifactLayout({
      arrangement: 'grid',
      minimumWidth: 1_920,
      groups: [{ label: 'All Artifacts', artifacts: artifacts(12) }],
    });
    const stack = buildFocusedArtifactLayout({
      arrangement: 'stack',
      minimumWidth: 1_920,
      groups: [{ label: 'All Artifacts', artifacts: artifacts(12) }],
    });

    expect(grid.density).toBe('comfortable');
    expect(stack.density).toBe('compact');
    expect(stack.artifactWidth).toBe(grid.artifactWidth);
    expect((stack.entries[1]?.position.x ?? 0) - (stack.entries[0]?.position.x ?? 0)).toBeLessThan(stack.artifactWidth);
  });

  it('keeps Grid and Stack arrangements deterministic across viewport widths', () => {
    const groups = Array.from({ length: 4 }, (_, groupIndex) => ({
      label: `Group ${groupIndex + 1}`,
      artifacts: artifacts(13).map((artifact, artifactIndex) => ({
        ...artifact,
        identity: identity(groupIndex * 13 + artifactIndex),
        groupLabel: `Group ${groupIndex + 1}`,
      })),
    }));
    const narrow = buildFocusedArtifactLayout({ arrangement: 'grid', minimumWidth: 390, groups });
    const wide = buildFocusedArtifactLayout({ arrangement: 'grid', minimumWidth: 1_920, groups });

    expect(wide.entries.map((entry) => entry.position)).toEqual(narrow.entries.map((entry) => entry.position));
    expect(wide.groups).toEqual(narrow.groups);
    expect(wide.width).toBe(narrow.width);
    expect(wide.height).toBe(narrow.height);
    expect(wide.width).toBeGreaterThan(wide.height);
  });

  it('frames selected Artifacts above the Whole Set floor without moving them', () => {
    const layout = buildLayout(30);
    const before = layout.entries.map((entry) => ({ ...entry.position }));
    const whole = getFocusedArtifactFitZoom({ layout, viewportWidth: 390, viewportHeight: 640 });
    const frame = getFocusedArtifactFrame({
      layout,
      entries: layout.entries.slice(10, 12),
      viewportWidth: 390,
      viewportHeight: 640,
    });

    expect(frame.zoom).toBeGreaterThan(whole);
    expect(Number.isFinite(frame.x)).toBe(true);
    expect(Number.isFinite(frame.y)).toBe(true);
    expect(layout.entries.map((entry) => entry.position)).toEqual(before);
    const wholeFrame = getFocusedArtifactFrame({
      layout,
      entries: [],
      viewportWidth: 390,
      viewportHeight: 640,
    });
    expect(wholeFrame.zoom).toBe(whole);
    expect(wholeFrame.x).toBeCloseTo(layout.bounds.x + layout.bounds.width / 2);
    expect(wholeFrame.y).toBeCloseTo(layout.bounds.y + layout.bounds.height / 2);
  });

  it('moves a manual multi-selection together using camera-independent world coordinates', () => {
    const layout = buildFocusedArtifactLayout({
      arrangement: 'manual',
      minimumWidth: 1_000,
      groups: [{
        label: 'All Artifacts',
        artifacts: [
          { identity: identity(1), title: 'One', subtitle: 'Card', groupLabel: 'All Artifacts', position: { x: 11, y: 17 } },
          { identity: identity(2), title: 'Two', subtitle: 'Card', groupLabel: 'All Artifacts', position: { x: 35, y: 41 } },
          { identity: identity(3), title: 'Three', subtitle: 'Card', groupLabel: 'All Artifacts', position: { x: 70, y: 80 } },
        ],
      }],
    });

    expect(moveFocusedArtifactSelection({
      entries: layout.entries,
      selectedIds: ['card-1', 'card-2'],
      delta: { x: 14, y: 10 },
      snapToGrid: false,
    })).toEqual({
      'card-1': { x: 25, y: 27 },
      'card-2': { x: 49, y: 51 },
    });
  });

  it('reports when selection includes Artifacts hidden by the current lens', () => {
    expect(getArtifactSelectionScope(
      ['card-visible', 'card-hidden-1', 'card-hidden-2'],
      ['card-visible', 'card-other'],
    )).toEqual({ visible: 1, hidden: 2, total: 3 });
  });

  it('moves selected Artifacts through signed Set space without rebasing siblings', () => {
    const layout = buildFocusedArtifactLayout({
      arrangement: 'manual',
      minimumWidth: 960,
      groups: [{
        label: 'All Artifacts',
        artifacts: [
          { identity: identity(1), title: 'One', subtitle: 'Card', groupLabel: 'All Artifacts', position: { x: 10, y: 12 } },
          { identity: identity(2), title: 'Two', subtitle: 'Card', groupLabel: 'All Artifacts', position: { x: 180, y: 120 } },
        ],
      }],
    });
    const moved = moveFocusedArtifactSelectionWithRebase({
      entries: layout.entries,
      selectedIds: ['card-1'],
      delta: { x: -40, y: -50 },
      snapToGrid: false,
    });
    expect(moved.originShift).toEqual({ x: 0, y: 0 });
    expect(moved.affectedIds).toEqual(['card-1']);
    expect(moved.positions['card-1']).toEqual({ x: -30, y: -38 });
    expect(moved.positions['card-2']).toBeUndefined();
    expect(layout.entries[1]?.position).toEqual({ x: 180, y: 120 });

    const signedLayout = buildFocusedArtifactLayout({
      arrangement: 'manual',
      minimumWidth: 960,
      groups: [{
        label: 'All Artifacts',
        artifacts: [
          { identity: identity(1), title: 'One', subtitle: 'Card', groupLabel: 'All Artifacts', position: { x: -300, y: -220 } },
          { identity: identity(2), title: 'Two', subtitle: 'Card', groupLabel: 'All Artifacts', position: { x: 180, y: 120 } },
        ],
      }],
    });
    expect(signedLayout.entries[0]?.position).toEqual({ x: -300, y: -220 });
    expect(signedLayout.bounds.x).toBeLessThan(-300);
    expect(signedLayout.bounds.y).toBeLessThan(-220);
  });

  it('migrates legacy Set positions once into physical millimeters', async () => {
    const { LEGACY_SET_UNITS_PER_MM, migrateLegacySetPositionsToMm } = await import('@/features/desk/model/focusedArtifactLayout');
    const migrated = migrateLegacySetPositionsToMm({
      one: { x: LEGACY_SET_UNITS_PER_MM * 63, y: LEGACY_SET_UNITS_PER_MM * 88 },
    });
    expect(migrated.one).toEqual({ x: 63, y: 88 });
  });

  it('snaps manual Artifact movement in the Set physical lattice', () => {
    const layout = buildFocusedArtifactLayout({
      arrangement: 'manual',
      minimumWidth: 160,
      groups: [{
        label: 'All Artifacts',
        artifacts: [
          { identity: identity(1), title: 'One', subtitle: 'Card', groupLabel: 'All Artifacts', position: { x: 2, y: 3 } },
        ],
      }],
    });
    expect(moveFocusedArtifactSelection({
      entries: layout.entries,
      selectedIds: ['card-1'],
      delta: { x: 5.2, y: 6.8 },
      snapToGrid: true,
      gridStep: 5,
    })).toEqual({ 'card-1': { x: 5, y: 10 } });
  });

  it('browses focused Artifacts by displayed geometry rather than collection order', () => {
    const layout = buildFocusedArtifactLayout({
      arrangement: 'manual',
      minimumWidth: 1_000,
      groups: [{
        label: 'All Artifacts',
        artifacts: [
          { identity: identity(1), title: 'Center', subtitle: 'Card', groupLabel: 'All Artifacts', position: { x: 300, y: 300 } },
          { identity: identity(2), title: 'Right', subtitle: 'Card', groupLabel: 'All Artifacts', position: { x: 560, y: 300 } },
          { identity: identity(3), title: 'Down', subtitle: 'Card', groupLabel: 'All Artifacts', position: { x: 300, y: 620 } },
          { identity: identity(4), title: 'Left', subtitle: 'Card', groupLabel: 'All Artifacts', position: { x: 40, y: 300 } },
          { identity: identity(5), title: 'Up', subtitle: 'Card', groupLabel: 'All Artifacts', position: { x: 300, y: 40 } },
        ],
      }],
    });

    expect(getDirectionalArtifactNeighbor({ entries: layout.entries, artifactId: 'card-1', direction: 'right' })?.identity.artifactId).toBe('card-2');
    expect(getDirectionalArtifactNeighbor({ entries: layout.entries, artifactId: 'card-1', direction: 'down' })?.identity.artifactId).toBe('card-3');
    expect(getDirectionalArtifactNeighbor({ entries: layout.entries, artifactId: 'card-1', direction: 'left' })?.identity.artifactId).toBe('card-4');
    expect(getDirectionalArtifactNeighbor({ entries: layout.entries, artifactId: 'card-1', direction: 'up' })?.identity.artifactId).toBe('card-5');
  });

  it('prefers an aligned neighbor and leaves an empty spatial edge empty', () => {
    const layout = buildFocusedArtifactLayout({
      arrangement: 'manual',
      minimumWidth: 1_000,
      groups: [{
        label: 'All Artifacts',
        artifacts: [
          { identity: identity(1), title: 'Center', subtitle: 'Card', groupLabel: 'All Artifacts', position: { x: 300, y: 300 } },
          { identity: identity(2), title: 'Aligned right', subtitle: 'Card', groupLabel: 'All Artifacts', position: { x: 580, y: 300 } },
          { identity: identity(3), title: 'Diagonal right', subtitle: 'Card', groupLabel: 'All Artifacts', position: { x: 470, y: 470 } },
          { identity: identity(4), title: 'Below only', subtitle: 'Card', groupLabel: 'All Artifacts', position: { x: 310, y: 680 } },
        ],
      }],
    });

    expect(getDirectionalArtifactNeighbor({ entries: layout.entries, artifactId: 'card-1', direction: 'right' })?.identity.artifactId).toBe('card-2');
    expect(getDirectionalArtifactNeighbor({ entries: layout.entries, artifactId: 'card-1', direction: 'left' })).toBeNull();
    expect(getDirectionalArtifactNeighbor({ entries: layout.entries, artifactId: 'card-1', direction: 'up' })).toBeNull();
  });

  it('uses the current layout slice only and resolves equal geometry deterministically', () => {
    const layout = buildFocusedArtifactLayout({
      arrangement: 'manual',
      minimumWidth: 1_000,
      groups: [{
        label: 'Shown Artifacts',
        artifacts: [
          { identity: identity(1), title: 'Center', subtitle: 'Card', groupLabel: 'Shown Artifacts', position: { x: 300, y: 300 } },
          { identity: identity(2), title: 'First right', subtitle: 'Card', groupLabel: 'Shown Artifacts', position: { x: 560, y: 300 } },
          { identity: identity(3), title: 'Second right', subtitle: 'Card', groupLabel: 'Shown Artifacts', position: { x: 560, y: 300 } },
        ],
      }],
    });

    expect(getDirectionalArtifactNeighbor({ entries: layout.entries, artifactId: 'card-1', direction: 'right' })?.identity.artifactId).toBe('card-2');
    expect(getDirectionalArtifactNeighbor({ entries: layout.entries.slice(0, 1), artifactId: 'card-1', direction: 'right' })).toBeNull();
    expect(getDirectionalArtifactNeighbor({ entries: layout.entries, artifactId: 'missing', direction: 'right' })).toBeNull();
  });
});
