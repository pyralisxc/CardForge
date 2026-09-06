import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { OwnPublishedDeskWorkspace } from '@/features/pipeline/components/OwnPublishedDeskWorkspace';

describe('own published Desk workspace', () => {
  it('keeps an owned published Set as an immutable container with an explicit independent-copy action', () => {
    const markup = renderToStaticMarkup(createElement(OwnPublishedDeskWorkspace, {
      work: {
        assetType: 'sets', description: 'A complete card set.', name: 'Night Market', previewUrl: null,
        publishedAt: '2026-09-06T12:00:00.000Z', revision: '4', sourceNotes: 'Rights cleared.',
      },
      onCreateWorkingCopy: () => undefined,
    }));

    expect(markup).toContain('Published Set container');
    expect(markup).toContain('Create editable Set copy');
    expect(markup).toContain('working copy remains independently visible in My work');
  });

  it('does not wrap a standalone published resource in a Set', () => {
    const markup = renderToStaticMarkup(createElement(OwnPublishedDeskWorkspace, {
      work: {
        assetType: 'imageAssets', description: '', name: 'Paper texture', previewUrl: null,
        publishedAt: null, revision: '2', sourceNotes: null,
      },
    }));

    expect(markup).toContain('Standalone Image');
    expect(markup).toContain('does not wrap it in a Set');
    expect(markup).not.toContain('Create editable Set copy');
  });
});
