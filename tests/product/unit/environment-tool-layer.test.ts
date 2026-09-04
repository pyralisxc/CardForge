import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EnvironmentToolLayer } from '@/features/app-shell/environment/components/EnvironmentToolLayer';

const renderLayer = (railOwned: boolean, presentation: 'sheet' | 'provider-handoff' = 'sheet') => {
  const props = {
    id: 'test-tool', eyebrow: 'Desk tool', title: 'Generate', summary: 'Generate into this Set',
    closeLabel: 'Close Generate', onClose: () => {}, railOwned, presentation, children: 'Card setup',
  };
  return renderToStaticMarkup(createElement(EnvironmentToolLayer, props));
};

describe('tool-layer keyboard ownership', () => {
  it('retains the accessible title without a hidden duplicate close control when the rail owns closing', () => {
    const markup = renderLayer(true);
    expect(markup).toContain('aria-labelledby="test-tool"');
    expect(markup).toContain('id="test-tool"');
    expect(markup).not.toContain('aria-label="Close Generate"');
  });

  it('retains a visible close control for standalone and modal provider tools', () => {
    expect(renderLayer(false)).toContain('aria-label="Close Generate"');
    const modal = renderLayer(true, 'provider-handoff');
    expect(modal).toContain('aria-label="Close Generate"');
    expect(modal).not.toContain('toolHeaderRailOwned');
  });
});
