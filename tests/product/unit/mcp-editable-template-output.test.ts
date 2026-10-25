import { describe, expect, it } from 'vitest';

import { editableTemplateListOutputSchema } from '@/features/studio-documents/server/mcpToolOutputSchemas';
import { editableTemplateListStructuredContent } from '@/features/studio-documents/server/mcpTemplateToolResults';

type StandardSchema = {
  '~standard': {
    validate: (value: unknown) => PromiseLike<{ value?: unknown; issues?: Array<{ message: string }> }> | { value?: unknown; issues?: Array<{ message: string }> };
  };
};

const validate = async (value: unknown) => (
  (editableTemplateListOutputSchema as unknown as StandardSchema)['~standard'].validate(value)
);

describe('editable Template list MCP public output', () => {
  it('validates populated pages with more results and excludes internal pagination fields', async () => {
    const storePage = {
      documents: [{
        id: 'doc-1',
        title: 'Bridge Back draft',
        creationSource: 'gpt',
        revision: 3,
        createdAt: '2026-10-22T00:00:00.000Z',
        updatedAt: '2026-10-22T00:01:00.000Z',
      }],
      hasMore: true,
      nextCursor: 100,
    };
    const page = editableTemplateListStructuredContent(storePage);

    const result = await validate(page);
    expect(result.issues).toBeUndefined();
    expect(result.value).toEqual({
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

  it('validates an empty final page with hasMore false', async () => {
    const storePage = { documents: [], hasMore: false, nextCursor: null };
    const page = editableTemplateListStructuredContent(storePage);

    const result = await validate(page);
    expect(result.issues).toBeUndefined();
    expect(result.value).toEqual({ documents: [], hasMore: false });
    expect(Object.keys(page).sort()).toEqual(['documents', 'hasMore']);
    expect(page).not.toHaveProperty('nextCursor');
  });

  it('rejects an internal nextCursor leaking into the strict public schema', async () => {
    const result = await validate({ documents: [], hasMore: true, nextCursor: 100 });
    expect(result.issues).toBeDefined();
    expect(result.issues?.length).toBeGreaterThan(0);
  });
});
