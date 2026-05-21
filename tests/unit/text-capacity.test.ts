import { describe, expect, it } from 'vitest';

import { estimateTextBlockCapacity, measureRenderedTextFit, summarizeStructuredListPressure, summarizeTextValuePressure } from '@/lib/textCapacity';
import type { FreeformCardElement, TemplateFieldContract } from '@/types';

const baseElement: FreeformCardElement = {
  id: 'rules',
  type: 'text',
  name: 'Rules',
  content: '{{Rules:""}}',
  x: 0,
  y: 0,
  width: 240,
  height: 120,
  zIndex: 1,
  fontSizePx: 20,
  lineHeight: '1.2',
};

describe('text capacity estimates', () => {
  it('estimates base and shrink-to-fit character and row ceilings from text box geometry', () => {
    const estimate = estimateTextBlockCapacity(baseElement, {
      textAutoFit: true,
      minFontSizePx: 10,
    });

    expect(estimate.baseFontSizePx).toBe(20);
    expect(estimate.minFontSizePx).toBe(10);
    expect(estimate.maxRowsAtBaseFont).toBe(5);
    expect(estimate.maxRowsAtMinFont).toBe(10);
    expect(estimate.maxCharactersAtMinFont).toBeGreaterThan(estimate.maxCharactersAtBaseFont);
  });

  it('accepts legacy numeric line-height values from imported templates', () => {
    const estimate = estimateTextBlockCapacity({
      ...baseElement,
      lineHeight: 1.5 as unknown as string,
    });

    expect(estimate.lineHeightRatio).toBe(1.5);
    expect(estimate.maxRowsAtBaseFont).toBe(4);
  });

  it('summarizes structured row pressure using base and minimum auto-fit limits', () => {
    const contract: TemplateFieldContract = {
      key: 'Exits',
      type: 'structuredList',
      textAutoFit: true,
      minFontSizePx: 10,
    };
    const estimate = estimateTextBlockCapacity(baseElement, contract);

    const comfortable = summarizeStructuredListPressure(1, estimate);
    const tight = summarizeStructuredListPressure(6, estimate);
    const overflow = summarizeStructuredListPressure(30, estimate);

    expect(comfortable?.status).toBe('comfortable');
    expect(tight?.status).toBe('tight');
    expect(overflow?.status).toBe('overflow');
  });

  it('summarizes character pressure for normal text fields', () => {
    const estimate = estimateTextBlockCapacity(baseElement, {
      textAutoFit: true,
      minFontSizePx: 10,
    });

    expect(summarizeTextValuePressure('Short text', estimate)?.status).toBe('comfortable');
    expect(summarizeTextValuePressure('x'.repeat(estimate.maxCharactersAtBaseFont + 10), estimate)?.status).toBe('tight');
    expect(summarizeTextValuePressure('x'.repeat(estimate.maxCharactersAtMinFont + 10), estimate)?.status).toBe('overflow');
  });

  it('measures real rendered text overflow from DOM geometry', () => {
    expect(measureRenderedTextFit({
      clientWidth: 100,
      clientHeight: 80,
      scrollWidth: 100,
      scrollHeight: 80,
    })).toMatchObject({ fits: true, overflowsX: false, overflowsY: false });

    expect(measureRenderedTextFit({
      clientWidth: 100,
      clientHeight: 80,
      scrollWidth: 112,
      scrollHeight: 96,
    })).toMatchObject({ fits: false, overflowsX: true, overflowsY: true });
  });
});
