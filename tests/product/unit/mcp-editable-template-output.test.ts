import { describe, expect, it } from 'vitest';

import {
  editableTemplateListOutputSchema,
  editableTemplateListStructuredContent,
} from '@/features/studio-documents/server/mcpToolOutputSchemas';

describe('editable Template list MCP public output', () => {
  it('validates populated pages with more results and excludes internal pagination fields', () => {
    const page = editableTemplateListStructuredContent({
      documents: [{
        id: 'doc-1',
        title: 'Bridge Back draft',
        creationSource: 'gpt',
        revision: 3,
        createdAt: '2026-10-22T00:00:00.000Z',
        updatedAt: '2026-10-22T00:01:00.000Z',
      }],
      hasMore: true,
    });

    expect(editableTemplateListOutputSchema.parse(page)).toEqual({
      documents: [{
        id: 'doc-1',
        title: 'Bridge Back draft',
        creationSource: 'gpt',
        revision: 3,
        createdAt: '2026-10-22T00:00:00.000Z',
        updatedAt: '2026-10-22T00:01:00.000Z',
      }],
      hasMore: true,
    });
    expect(Object.keys(page).sort()).toEqual(['documents', 'hasMore']);
    expect(page).not.toHaveProperty('nextCursor');
  });

  it('validates an empty final page with hasMore false', () => {
    const page = editableTemplateListStructuredContent({ documents: [], hasMore: false });

    expect(editableTemplateListOutputSchema.parse(page)).toEqual({ documents: [], hasMore: false });
    expect(Object.keys(page).sort()).toEqual(['documents', 'hasMore']);
  });

  it('rejects an internal nextCursor leaking into the strict public schema', () => {
    expect(() => editableTemplateListOutputSchema.parse({
      documents: [],
      hasMore: true,
      nextCursor: 100,
    })).toThrow();
  });
});
