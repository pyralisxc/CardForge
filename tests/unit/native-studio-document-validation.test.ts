import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseProjectDocumentFile } from '@/features/project/client';

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

  it('keeps the MCP authoring schema closed over native CardForge vocabulary', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/mcp/route.ts'), 'utf8');
    const schema = readFileSync(
      resolve(process.cwd(), 'src/features/studio-documents/server/mcpToolInputSchemas.ts'),
      'utf8',
    );

    expect(route).toContain('CARDFORGE_FREEFORM_ELEMENT_TYPES');
    expect(route).toContain('elementTypes: [...CARDFORGE_FREEFORM_ELEMENT_TYPES]');
    expect(schema).toContain('additionalProperties: false');
    expect(schema).toContain("type: { type: 'string', enum: [...CARDFORGE_FREEFORM_ELEMENT_TYPES] }");
    expect(schema).not.toContain("items: { type: 'object', additionalProperties: true }");
  });
});
