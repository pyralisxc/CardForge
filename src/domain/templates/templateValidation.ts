export const CARDFORGE_FREEFORM_ELEMENT_TYPES = ['text', 'image', 'icon', 'shape'] as const;
export const CARDFORGE_FREEFORM_SHAPE_KINDS = [
  'rectangle',
  'ellipse',
  'diamond',
  'hexagon',
  'capsule',
  'banner',
  'notch-panel',
  'bracket-frame',
  'corner-frame',
  'line',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOneOf = <T extends readonly string[]>(values: T, value: unknown): value is T[number] =>
  typeof value === 'string' && values.includes(value as T[number]);

export const validateNativeTemplateStructure = (value: unknown): string | null => {
  if (!isRecord(value)) return null;
  const canvas = value.freeformCanvas;
  if (!isRecord(canvas) || !Array.isArray(canvas.elements)) return null;

  for (let index = 0; index < canvas.elements.length; index += 1) {
    const element = canvas.elements[index];
    if (!isRecord(element)) {
      return `Template element ${index + 1} is not a valid CardForge element.`;
    }

    if (element.type !== undefined && !isOneOf(CARDFORGE_FREEFORM_ELEMENT_TYPES, element.type)) {
      return `Template element ${index + 1} uses unsupported CardForge element type "${String(element.type)}".`;
    }

    if (
      element.type === 'shape'
      && element.shapeKind !== undefined
      && !isOneOf(CARDFORGE_FREEFORM_SHAPE_KINDS, element.shapeKind)
    ) {
      return `Template element ${index + 1} uses unsupported CardForge shape kind "${String(element.shapeKind)}".`;
    }
  }

  return null;
};
