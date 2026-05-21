"use client";

import { Ellipse, Group, Layer, Line, Rect, RegularPolygon, Stage, Text } from 'react-konva';

import type { KonvaTemplateNode, KonvaTemplateStageConfig } from '@/lib/konvaTemplateAdapter';

interface KonvaTemplateStageProps {
  config: KonvaTemplateStageConfig;
  scale?: number;
}

const numberAttr = (node: KonvaTemplateNode, key: string, fallback = 0) => (
  typeof node.attrs[key] === 'number' ? node.attrs[key] as number : fallback
);

const stringAttr = (node: KonvaTemplateNode, key: string) => (
  typeof node.attrs[key] === 'string' ? node.attrs[key] as string : undefined
);

const booleanAttr = (node: KonvaTemplateNode, key: string, fallback = true) => (
  typeof node.attrs[key] === 'boolean' ? node.attrs[key] as boolean : fallback
);

function renderKonvaTemplateNode(node: KonvaTemplateNode) {
  const commonProps = {
    id: node.id,
    name: stringAttr(node, 'name'),
    x: numberAttr(node, 'x'),
    y: numberAttr(node, 'y'),
    width: numberAttr(node, 'width'),
    height: numberAttr(node, 'height'),
    rotation: numberAttr(node, 'rotation'),
    opacity: numberAttr(node, 'opacity', 1),
    visible: booleanAttr(node, 'visible'),
    draggable: booleanAttr(node, 'draggable', false),
  };

  if (node.kind === 'Group') {
    return (
      <Group key={node.id} {...commonProps}>
        {node.children?.map(renderKonvaTemplateNode)}
      </Group>
    );
  }

  if (node.kind === 'Text') {
    return (
      <Text
        key={node.id}
        {...commonProps}
        text={stringAttr(node, 'text') || ''}
        fill={stringAttr(node, 'fill')}
        fontSize={numberAttr(node, 'fontSize', 16)}
        align={stringAttr(node, 'align')}
        fontStyle={stringAttr(node, 'fontStyle')}
        fontFamily={stringAttr(node, 'fontFamily')}
      />
    );
  }

  if (node.kind === 'Ellipse') {
    return (
      <Ellipse
        key={node.id}
        {...commonProps}
        radiusX={numberAttr(node, 'radiusX', commonProps.width / 2)}
        radiusY={numberAttr(node, 'radiusY', commonProps.height / 2)}
        fill={stringAttr(node, 'fill')}
        stroke={stringAttr(node, 'stroke')}
        strokeWidth={numberAttr(node, 'strokeWidth')}
      />
    );
  }

  if (node.kind === 'RegularPolygon') {
    return (
      <RegularPolygon
        key={node.id}
        {...commonProps}
        sides={numberAttr(node, 'sides', 5)}
        radius={Math.max(commonProps.width, commonProps.height) / 2}
        fill={stringAttr(node, 'fill')}
        stroke={stringAttr(node, 'stroke')}
        strokeWidth={numberAttr(node, 'strokeWidth')}
      />
    );
  }

  if (node.kind === 'Line') {
    const pointText = stringAttr(node, 'points') || '';
    const points = pointText.split(',').map((value) => Number(value)).filter(Number.isFinite);
    return (
      <Line
        key={node.id}
        {...commonProps}
        points={points}
        stroke={stringAttr(node, 'stroke')}
        strokeWidth={numberAttr(node, 'strokeWidth', 1)}
      />
    );
  }

  return (
    <Rect
      key={node.id}
      {...commonProps}
      fill={stringAttr(node, 'fill') || (node.kind === 'ImagePlaceholder' ? 'rgba(15,23,42,0.65)' : undefined)}
      stroke={stringAttr(node, 'stroke')}
      strokeWidth={numberAttr(node, 'strokeWidth')}
    />
  );
}

export function KonvaTemplateStage({ config, scale = 1 }: KonvaTemplateStageProps) {
  return (
    <Stage width={config.width * scale} height={config.height * scale} scaleX={scale} scaleY={scale}>
      <Layer>
        {config.nodes.map(renderKonvaTemplateNode)}
      </Layer>
    </Stage>
  );
}
