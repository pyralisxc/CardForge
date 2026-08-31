import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';

import type { TCGCardTemplate } from '@/domain/templates';
import { AuthoredObjectPreview } from '@/features/card-rendering/client';

const template = JSON.parse(readFileSync(
  join(process.cwd(), 'data/pipeline-bootstrap/templates/default-playing-card-theme.json'),
  'utf8',
)) as TCGCardTemplate;

describe('authored object preview', () => {
  it('keeps explicitly empty Sets neutral while still rendering Template objects', () => {
    const emptySet = renderToStaticMarkup(createElement(AuthoredObjectPreview, {
      template,
      label: 'Blank Set',
      emptyLabel: 'Empty Set',
    }));
    const templateObject = renderToStaticMarkup(createElement(AuthoredObjectPreview, {
      template,
      label: 'Playing Card Template',
    }));

    expect(emptySet).toContain('aria-label="Blank Set Empty Set"');
    expect(emptySet).toContain('Empty Set');
    expect(emptySet).not.toContain('The Night Sentinel');
    expect(templateObject).toContain('The Night Sentinel');
  });
});
