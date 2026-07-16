import { describe, expect, it } from 'vitest';

import {
  buildImageFieldOverrideDataKey,
  IMAGE_FIELD_OVERRIDE_PROPERTIES,
  parseImageFieldOverrideColumnHeader,
  resolveImageElementOverrides,
} from '@/features/card-generator/lib/imageFieldOverrides';
import type { CardData } from '@/domain/cards';
import type { FreeformCardElement } from '@/domain/templates';

const imageElement: FreeformCardElement = {
  id: 'art-layer',
  type: 'image',
  name: 'Art',
  x: 10,
  y: 20,
  width: 300,
  height: 180,
  zIndex: 1,
  imageSource: '{{Portrait}}',
  imageObjectFit: 'cover',
};

describe('image field overrides', () => {
  it('builds and parses image override columns distinctly from text style columns', () => {
    expect(buildImageFieldOverrideDataKey('Portrait', 'fit')).toBe('__cardforgeImageField.Portrait.fit');
    expect(parseImageFieldOverrideColumnHeader('Portrait.image.fit', ['Portrait'])).toEqual({
      fieldKey: 'Portrait',
      property: 'fit',
    });
    expect(parseImageFieldOverrideColumnHeader('Portrait.image.scale', ['Portrait'])).toEqual({
      fieldKey: 'Portrait',
      property: 'scale',
    });
    expect(parseImageFieldOverrideColumnHeader('Name.style.fontWeight', ['Portrait'])).toBeNull();
    expect(IMAGE_FIELD_OVERRIDE_PROPERTIES).toContain('frameWidth');
  });

  it('resolves fit, position, flip, crop, rotation, and frame geometry for an image field', () => {
    const data: CardData = {
      Portrait: 'https://example.test/portrait.png',
      [buildImageFieldOverrideDataKey('Portrait', 'fit')]: 'contain',
      [buildImageFieldOverrideDataKey('Portrait', 'positionX')]: '35%',
      [buildImageFieldOverrideDataKey('Portrait', 'positionY')]: 'top',
      [buildImageFieldOverrideDataKey('Portrait', 'flipX')]: 'true',
      [buildImageFieldOverrideDataKey('Portrait', 'flipY')]: '1',
      [buildImageFieldOverrideDataKey('Portrait', 'scale')]: '1.35',
      [buildImageFieldOverrideDataKey('Portrait', 'offsetX')]: '12',
      [buildImageFieldOverrideDataKey('Portrait', 'offsetY')]: '-8',
      [buildImageFieldOverrideDataKey('Portrait', 'rotation')]: '7',
      [buildImageFieldOverrideDataKey('Portrait', 'frameX')]: '22',
      [buildImageFieldOverrideDataKey('Portrait', 'frameY')]: '33',
      [buildImageFieldOverrideDataKey('Portrait', 'frameWidth')]: '240',
      [buildImageFieldOverrideDataKey('Portrait', 'frameHeight')]: '320',
    };

    const resolved = resolveImageElementOverrides(imageElement, data, 'Portrait');

    expect(resolved.element).toMatchObject({
      x: 22,
      y: 33,
      width: 240,
      height: 320,
    });
    expect(resolved.imageStyle).toMatchObject({
      objectFit: 'contain',
      objectPosition: '35% top',
      transform: 'translate(12px, -8px) rotate(7deg) scale(1.35) scaleX(-1) scaleY(-1)',
    });
  });
});
