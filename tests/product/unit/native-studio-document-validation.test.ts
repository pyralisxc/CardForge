import { describe, expect, it } from 'vitest';

import { parseProjectDocumentFile } from '@/features/project/client/package-document';

describe('native Studio document validation', () => {
  it('rejects a project file containing an element type CardForge cannot render', () => {
    const parsed = parseProjectDocumentFile(JSON.stringify({
      version: 1,
      userTemplates: [{
        id: 'bad-template',
        name: 'Generic design payload',
        aspectRatio: '16:9',
        freeformCanvas: {
          width: 1600,
          height: 900,
          elements: [{
            id: 'slot-1',
            type: 'image-slot',
            x: 100,
            y: 100,
            width: 300,
            height: 400,
          }],
        },
      }],
      storedCards: [],
      appearanceStyles: [],
      exportSettings: {},
      customAssets: {},
    }));

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error('Expected unsupported element type to fail');
    expect(parsed.error).toContain('cannot be opened safely');
    expect(parsed.error).toContain('unsupported CardForge element type "image-slot"');
  });

  it('continues to accept native CardForge image elements from project files', () => {
    const parsed = parseProjectDocumentFile(JSON.stringify({
      version: 1,
      userTemplates: [{
        id: 'native-template',
        name: 'Native design payload',
        aspectRatio: '16:9',
        freeformCanvas: {
          width: 1600,
          height: 900,
          elements: [{
            id: 'slot-1',
            type: 'image',
            name: 'Artwork',
            x: 100,
            y: 100,
            width: 300,
            height: 400,
            imageSource: 'artworkUrl',
          }],
        },
      }],
      storedCards: [],
      appearanceStyles: [],
      exportSettings: {},
      customAssets: {},
    }));

    expect(parsed.success).toBe(true);
  });
});
