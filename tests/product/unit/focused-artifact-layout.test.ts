import { describe, expect, it } from 'vitest';

import type { ArtifactIdentity } from '@/domain/artifacts';
import {
  buildFocusedArtifactLayout,
  getArtifactSelectionScope,
  moveFocusedArtifactSelection,
  projectVisibleArtifacts,
} from '@/features/home/model/focusedArtifactLayout';

const identity = (index: number): ArtifactIdentity => ({
  artifactId: `card-${index}`,
  artifactType: 'card',
  setId: 'set-scale',
});

const buildLayout = (count: number) => buildFocusedArtifactLayout({
  arrangement: 'grid',
  minimumWidth: 1_000,
  groups: [{
    label: 'All Artifacts',
    artifacts: Array.from({ length: count }, (_, index) => ({
      identity: identity(index),
      title: `Artifact ${index + 1}`,
      subtitle: 'Card',
      groupLabel: 'All Artifacts',
    })),
  }],
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
});
