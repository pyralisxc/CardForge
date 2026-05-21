import type { CardData, CardFace, FreeformCardElement, FreeformCanvas, TCGCardTemplate } from '@/types';
import { resolveTemplateTextSegments } from '@/lib/textBindings';
import { replacePlaceholdersLocal } from '@/lib/utils';

export type KonvaTemplateNodeKind = 'Group' | 'Rect' | 'Ellipse' | 'RegularPolygon' | 'Line' | 'Text' | 'ImagePlaceholder';

export interface KonvaTemplateNode {
  id: string;
  kind: KonvaTemplateNodeKind;
  attrs: Record<string, string | number | boolean | undefined>;
  children?: KonvaTemplateNode[];
}

export interface KonvaTemplateStageConfig {
  width: number;
  height: number;
  nodes: KonvaTemplateNode[];
}

const shapeKindToKonvaKind = (element: FreeformCardElement): KonvaTemplateNodeKind => {
  if (element.shapeKind === 'ellipse') return 'Ellipse';
  if (element.shapeKind === 'diamond' || element.shapeKind === 'hexagon') return 'RegularPolygon';
  if (element.shapeKind === 'line' || element.shapeRole === 'divider') return 'Line';
  return 'Rect';
};

const elementBaseAttrs = (
  element: FreeformCardElement,
  offsetX = 0,
  offsetY = 0,
) => ({
  x: element.x - offsetX,
  y: element.y - offsetY,
  width: element.width,
  height: element.height,
  rotation: element.rotation || 0,
  opacity: element.opacity ?? 1,
  visible: element.visible !== false,
  draggable: !element.locked,
  name: element.name,
  zIndex: element.zIndex,
});

const elementToKonvaNode = (
  template: TCGCardTemplate,
  element: FreeformCardElement,
  data: CardData,
  offsetX = 0,
  offsetY = 0,
): KonvaTemplateNode => {
  const baseAttrs = elementBaseAttrs(element, offsetX, offsetY);

  if (element.type === 'text') {
    return {
      id: element.id,
      kind: 'Text',
      attrs: {
        ...baseAttrs,
        text: resolveTemplateTextSegments(element.id, element.content, data, true),
        fill: element.textColor || template.baseTextColor,
        fontSize: element.fontSizePx,
        align: element.textAlign,
        fontStyle: element.fontStyle,
        fontFamily: element.fontFamily,
      },
    };
  }

  if (element.type === 'image') {
    const source = element.imageSource || element.content || '';
    return {
      id: element.id,
      kind: 'ImagePlaceholder',
      attrs: {
        ...baseAttrs,
        imageSource: replacePlaceholdersLocal(source, data, true),
        objectFit: element.imageObjectFit || 'cover',
        fill: element.backgroundColor,
        stroke: element.borderColor || template.defaultElementBorderColor,
      },
    };
  }

  if (element.type === 'icon') {
    return {
      id: element.id,
      kind: 'RegularPolygon',
      attrs: {
        ...baseAttrs,
        sides: 5,
        fill: element.fillColor || element.textColor || 'transparent',
        stroke: element.strokeColor || element.textColor,
        strokeWidth: element.strokeWidth,
        iconName: element.iconName,
        iconImageSource: element.iconImageSource,
      },
    };
  }

  const kind = shapeKindToKonvaKind(element);
  return {
    id: element.id,
    kind,
    attrs: {
      ...baseAttrs,
      sides: element.shapeKind === 'hexagon' ? 6 : element.shapeKind === 'diamond' ? 4 : undefined,
      fill: element.fillColor || element.backgroundColor,
      stroke: element.strokeColor || element.borderColor,
      strokeWidth: element.strokeWidth,
      radiusX: kind === 'Ellipse' ? element.width / 2 : undefined,
      radiusY: kind === 'Ellipse' ? element.height / 2 : undefined,
      points: kind === 'Line' ? [0, element.height / 2, element.width, element.height / 2].join(',') : undefined,
    },
  };
};

const groupElementWithChildren = (
  template: TCGCardTemplate,
  parent: FreeformCardElement,
  children: FreeformCardElement[],
  data: CardData,
): KonvaTemplateNode => ({
  id: parent.id,
  kind: 'Group',
  attrs: {
    ...elementBaseAttrs(parent),
    draggable: !parent.locked,
  },
  children: [
    elementToKonvaNode(template, { ...parent, id: `${parent.id}__visual`, x: parent.x, y: parent.y }, data, parent.x, parent.y),
    ...children
      .sort((left, right) => left.zIndex - right.zIndex)
      .map((child) => elementToKonvaNode(template, child, data, parent.x, parent.y)),
  ],
});

export const getCanvasForTemplateFace = (
  template: TCGCardTemplate,
  face: CardFace = 'front',
): FreeformCanvas | undefined => (
  face === 'back'
    ? (template.backCanvas || template.freeformCanvas)
    : template.freeformCanvas
);

export function buildKonvaTemplateStageConfig(
  template: TCGCardTemplate,
  data: CardData = {},
  face: CardFace = 'front',
): KonvaTemplateStageConfig {
  const canvas = getCanvasForTemplateFace(template, face);
  const elements = canvas?.elements || [];
  const childrenByParent = new Map<string, FreeformCardElement[]>();
  const childIds = new Set<string>();

  elements.forEach((element) => {
    if (!element.parentId) return;
    childIds.add(element.id);
    const siblings = childrenByParent.get(element.parentId) || [];
    siblings.push(element);
    childrenByParent.set(element.parentId, siblings);
  });

  const nodes = elements
    .filter((element) => !childIds.has(element.id))
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((element) => {
      const children = childrenByParent.get(element.id) || [];
      if (children.length > 0) {
        return groupElementWithChildren(template, element, children, data);
      }
      return elementToKonvaNode(template, element, data);
    });

  return {
    width: canvas?.width || 630,
    height: canvas?.height || 880,
    nodes,
  };
}
