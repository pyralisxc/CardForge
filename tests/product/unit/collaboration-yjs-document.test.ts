import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import type { ProjectDocumentV1 } from '@/features/project/model/projectDocument';
import {
  applyCollaborationUpdate,
  createCollaborationAuthoredDocument,
  createYjsCollaborationDocument,
  encodeCollaborationDelta,
  encodeCollaborationState,
  encodeCollaborationStateVector,
  readCollaborationAuthoredDocument,
  syncCollaborationAuthoredDocument,
} from '@/features/collaboration/yjsAuthoredDocument';

const project = (): ProjectDocumentV1 => ({
  version: 1,
  cardSets: [{
    id: 'set-1',
    name: 'Shared Set',
    templateIds: ['template-1'],
    organization: {
      arrangement: 'manual',
      groupBy: 'none',
      sort: 'manual',
      tags: [],
      positions: {},
    },
    metadata: { workflow: 'card-set', tags: [] },
  }],
  activeCardSetId: 'set-1',
  storedCards: [
    { uniqueId: 'card-1', templateId: 'template-1', setId: 'set-1', setName: 'Shared Set', data: { title: 'Alpha', rules: 'Start' } },
    { uniqueId: 'card-2', templateId: 'template-1', setId: 'set-1', setName: 'Shared Set', data: { title: 'Beta' } },
  ],
  userTemplates: [{
    id: 'template-1',
    name: 'Shared Template',
    aspectRatio: '2.5/3.5',
    templateSource: 'user',
    fieldContracts: [{ key: 'title', label: 'Title', type: 'text' }],
    freeformCanvas: {
      width: 750,
      height: 1050,
      elements: [{
        id: 'title-element',
        type: 'text',
        name: 'Title',
        x: 10,
        y: 10,
        width: 200,
        height: 60,
        zIndex: 1,
        content: '{{title}}',
      }],
    },
  }],
  appearanceStyles: [],
  exportSettings: {},
  customAssets: {
    'cardforge-maker-custom-textures': [],
    'cardforge-maker-custom-dividers': [],
    'cardforge-maker-custom-icons': [],
    'cardforge-maker-custom-images': [],
  },
});

const replicas = () => {
  const authored = createCollaborationAuthoredDocument(project());
  const seed = createYjsCollaborationDocument(authored);
  const seedUpdate = encodeCollaborationState(seed);
  const left = new Y.Doc();
  const right = new Y.Doc();
  applyCollaborationUpdate(left, seedUpdate, 'seed');
  applyCollaborationUpdate(right, seedUpdate, 'seed');
  return { left, right };
};

describe('Yjs CardForge authored document', () => {
  it('keeps collaboration scoped to one Set and its referenced authored core', () => {
    const authored = createCollaborationAuthoredDocument(project());
    expect(authored.set.id).toBe('set-1');
    expect(authored.cards.map((card) => card.uniqueId)).toEqual(['card-1', 'card-2']);
    expect(authored.templates.map((template) => template.id)).toEqual(['template-1']);
    expect(Object.keys(authored)).toEqual(['version', 'set', 'cards', 'templates']);
  });

  it('converges concurrent edits to different cards without replacing either entity', () => {
    const { left, right } = replicas();
    const leftBase = encodeCollaborationStateVector(left);
    const rightBase = encodeCollaborationStateVector(right);

    const leftAuthored = readCollaborationAuthoredDocument(left);
    leftAuthored.cards[0]!.data.rules = 'Changed by left';
    syncCollaborationAuthoredDocument(left, leftAuthored, 'left');

    const rightAuthored = readCollaborationAuthoredDocument(right);
    rightAuthored.cards[1]!.data.title = 'Changed by right';
    syncCollaborationAuthoredDocument(right, rightAuthored, 'right');

    const leftDelta = encodeCollaborationDelta(left, leftBase);
    const rightDelta = encodeCollaborationDelta(right, rightBase);
    applyCollaborationUpdate(left, rightDelta);
    applyCollaborationUpdate(right, leftDelta);

    expect(readCollaborationAuthoredDocument(left)).toEqual(readCollaborationAuthoredDocument(right));
    const merged = readCollaborationAuthoredDocument(left);
    expect(merged.cards.find((card) => card.uniqueId === 'card-1')?.data.rules).toBe('Changed by left');
    expect(merged.cards.find((card) => card.uniqueId === 'card-2')?.data.title).toBe('Changed by right');
  });

  it('merges concurrent text insertion on the same card field instead of losing one writer', () => {
    const { left, right } = replicas();
    const leftBase = encodeCollaborationStateVector(left);
    const rightBase = encodeCollaborationStateVector(right);

    const leftAuthored = readCollaborationAuthoredDocument(left);
    leftAuthored.cards[0]!.data.title = 'Alpha L';
    syncCollaborationAuthoredDocument(left, leftAuthored, 'left');

    const rightAuthored = readCollaborationAuthoredDocument(right);
    rightAuthored.cards[0]!.data.title = 'Alpha R';
    syncCollaborationAuthoredDocument(right, rightAuthored, 'right');

    const leftDelta = encodeCollaborationDelta(left, leftBase);
    const rightDelta = encodeCollaborationDelta(right, rightBase);
    applyCollaborationUpdate(left, rightDelta);
    applyCollaborationUpdate(right, leftDelta);

    const leftTitle = String(readCollaborationAuthoredDocument(left).cards[0]!.data.title);
    const rightTitle = String(readCollaborationAuthoredDocument(right).cards[0]!.data.title);
    expect(leftTitle).toBe(rightTitle);
    expect(leftTitle).toContain('Alpha ');
    expect(leftTitle).toContain('L');
    expect(leftTitle).toContain('R');
  });

  it('keeps a deleted card deleted when another replica concurrently edits inside that card', () => {
    const { left, right } = replicas();
    const leftBase = encodeCollaborationStateVector(left);
    const rightBase = encodeCollaborationStateVector(right);

    const leftAuthored = readCollaborationAuthoredDocument(left);
    leftAuthored.cards = leftAuthored.cards.filter((card) => card.uniqueId !== 'card-2');
    syncCollaborationAuthoredDocument(left, leftAuthored, 'left');

    const rightAuthored = readCollaborationAuthoredDocument(right);
    rightAuthored.cards[1]!.data.title = 'Concurrent edit';
    syncCollaborationAuthoredDocument(right, rightAuthored, 'right');

    applyCollaborationUpdate(left, encodeCollaborationDelta(right, rightBase));
    applyCollaborationUpdate(right, encodeCollaborationDelta(left, leftBase));

    expect(readCollaborationAuthoredDocument(left).cards.some((card) => card.uniqueId === 'card-2')).toBe(false);
    expect(readCollaborationAuthoredDocument(right).cards.some((card) => card.uniqueId === 'card-2')).toBe(false);
  });

  it('produces idempotent state-vector deltas', () => {
    const { left, right } = replicas();
    const vector = encodeCollaborationStateVector(right);
    const authored = readCollaborationAuthoredDocument(left);
    authored.set.name = 'Renamed together';
    syncCollaborationAuthoredDocument(left, authored, 'left');
    const delta = encodeCollaborationDelta(left, vector);

    applyCollaborationUpdate(right, delta);
    const once = readCollaborationAuthoredDocument(right);
    applyCollaborationUpdate(right, delta);
    expect(readCollaborationAuthoredDocument(right)).toEqual(once);
  });
});
