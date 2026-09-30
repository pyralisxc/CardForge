import { describe, expect, it } from 'vitest';

import { reconstructMinimalTemplateObject } from '@/domain/templates';
import { getDeskSetPresentationFootprint } from '@/features/desk/model/deskSetFootprint';

const card = (id: string, widthMm: number, heightMm: number) => ({
  uniqueId: id,
  data: {},
  template: reconstructMinimalTemplateObject({
    id: `template-${id}`,
    name: id,
    formatId: 'custom',
    trimWidthMm: widthMm,
    trimHeightMm: heightMm,
    freeformCanvas: { width: Math.round(widthMm * 10), height: Math.round(heightMm * 10), elements: [] },
  }),
});

describe('Desk Set physical footprint', () => {
  it('makes larger physical contents occupy a larger collapsed Desk footprint', () => {
    const poker = getDeskSetPresentationFootprint([card('poker', 63, 88)]);
    const letter = getDeskSetPresentationFootprint([card('letter', 215.9, 279.4)]);
    expect(letter.width / poker.width).toBeGreaterThan(2.5);
    expect(letter.height / poker.height).toBeGreaterThan(2);
  });

  it('adds modest stack depth without multiplying physical size by card count', () => {
    const one = getDeskSetPresentationFootprint([card('one', 63, 88)]);
    const five = getDeskSetPresentationFootprint(Array.from({ length: 5 }, (_, index) => card(`card-${index}`, 63, 88)));
    expect(five.width).toBeGreaterThan(one.width);
    expect(five.width).toBeLessThan(one.width * 1.5);
    expect(five.height).toBeLessThan(one.height * 1.5);
  });
});
