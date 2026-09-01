import type { ProjectDocumentV1 } from '@/features/project/client';

const uniqueSvgDataUri = (index: number) => {
  const color = index.toString(16).padStart(6, '0').slice(-6);
  const marks = Array.from({ length: 36 }, (_, mark) => {
    const x = (mark * 83 + index * 17) % 512;
    const y = (mark * 137 + index * 29) % 720;
    return `<circle cx="${x}" cy="${y}" r="${12 + (mark % 22)}" fill="#${color}" fill-opacity="${(0.18 + (mark % 7) * 0.08).toFixed(2)}"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="720" viewBox="0 0 512 720"><rect width="512" height="720" fill="#101723"/>${marks}<text x="24" y="680" fill="white" font-size="42">Artifact ${index}</text></svg>`;
  return `data:image/svg+xml;base64,${globalThis.btoa(svg)}`;
};

export const createProjectScaleFixture = (
  cardCount: 100 | 500 | 1000,
  { uniqueArtwork = false }: { uniqueArtwork?: boolean } = {},
): ProjectDocumentV1 => {
  const setId = `scale-set-${cardCount}`;
  const templateId = 'scale-template';
  const storedCards = Array.from({ length: cardCount }, (_, index) => ({
    uniqueId: `scale-card-${index + 1}`,
    templateId,
    setId,
    setName: `${cardCount} Card Scale Set`,
    tagIds: [`scale-tag-${index % 10}`],
    updatedAt: new Date(Date.UTC(2026, 7, 1, 0, 0, index % 60)).toISOString(),
    data: {
      cardName: `Scale Card ${String(index + 1).padStart(4, '0')}`,
      rules: `Deterministic rules text for card ${index + 1}.`,
      cost: index % 12,
      ...(uniqueArtwork ? { artwork: uniqueSvgDataUri(index + 1) } : {}),
    },
  }));

  return {
    version: 1,
    userTemplates: [{
      id: templateId,
      name: 'Scale Fixture Template',
      aspectRatio: '63:88',
      templateSource: 'user',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [{
          id: 'scale-artwork',
          name: 'Artwork',
          type: 'image',
          x: 20,
          y: 20,
          width: 590,
          height: 500,
          zIndex: 1,
          imageSource: 'artwork',
        }],
      },
    }],
    cardSets: [{
      id: setId,
      name: `${cardCount} Card Scale Set`,
      organization: {
        arrangement: 'manual',
        groupBy: 'tag',
        sort: 'manual',
        tags: Array.from({ length: 10 }, (_, index) => ({ id: `scale-tag-${index}`, label: `Group ${index + 1}` })),
        positions: Object.fromEntries(storedCards.map((card, index) => [
          card.uniqueId,
          { x: (index % 25) * 148, y: Math.floor(index / 25) * 205 },
        ])),
      },
    }],
    activeCardSetId: setId,
    storedCards,
    appearanceStyles: [],
    exportSettings: { exportMode: 'virtual', exportDpi: 300 },
    customAssets: {
      'cardforge-maker-custom-textures': [],
      'cardforge-maker-custom-dividers': [],
      'cardforge-maker-custom-icons': [],
      'cardforge-maker-custom-images': [],
    },
  };
};
