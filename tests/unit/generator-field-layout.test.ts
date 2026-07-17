import { describe, expect, it } from 'vitest';

import { shouldUseFullWidthGeneratorField } from '@/features/card-generator/components/GeneratorFieldGroups';

describe('single-output field layout', () => {
  it('pairs compact fields in the two-column form', () => {
    expect(shouldUseFullWidthGeneratorField({})).toBe(false);
    expect(shouldUseFullWidthGeneratorField({ control: 'input' })).toBe(false);
  });

  it('keeps editing-heavy fields at full width', () => {
    expect(shouldUseFullWidthGeneratorField({ isImage: true })).toBe(true);
    expect(shouldUseFullWidthGeneratorField({ isMultiline: true })).toBe(true);
    expect(shouldUseFullWidthGeneratorField({ control: 'textarea' })).toBe(true);
    expect(shouldUseFullWidthGeneratorField({ editor: 'text-editor', supportsRichText: true })).toBe(true);
  });
});
