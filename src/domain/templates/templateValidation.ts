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
  if (value.templateOriginAncestors !== undefined && (!Array.isArray(value.templateOriginAncestors)
    || value.templateOriginAncestors.some((pin) => !isRecord(pin) || typeof pin.lineageId !== 'string' || !pin.lineageId.trim()
      || (pin.revisionId !== undefined && (typeof pin.revisionId !== 'string' || !pin.revisionId.trim()))))) {
    return 'The design contains unsupported source ancestry. Its original source must be kept rather than discarded.';
  }
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

  const parentById = new Map<string, string>();
  for (const element of canvas.elements) {
    if (isRecord(element) && typeof element.id === 'string' && element.id.trim()
      && typeof element.parentId === 'string' && element.parentId.trim()) {
      parentById.set(element.id, element.parentId);
    }
  }
  const completed = new Set<string>();
  const cycleMessage = 'The design contains a cyclic element hierarchy. Its original structure must be kept rather than discarded.';
  for (const start of parentById.keys()) {
    const path = new Set<string>();
    let current: string | undefined = start;
    let steps = 0;
    while (current && parentById.has(current) && !completed.has(current)) {
      if (path.has(current) || steps >= parentById.size) return cycleMessage;
      path.add(current);
      current = parentById.get(current);
      steps += 1;
    }
    for (const id of path) completed.add(id);
  }

  return null;
};
