import type { CSSProperties, HTMLAttributes } from 'react';
import { splitBackgroundLayers, textureLayerMetadata } from '../model/appearance';

/** The canonical appearance's independent URL texture layer; no authored data changes. */
export function AppearanceSurface({ as: Tag = 'div', style, children, ...props }: HTMLAttributes<HTMLElement> & { as?: 'div' | 'span' }) {
  const metadata = textureLayerMetadata(style);
  const images = splitBackgroundLayers(String(style?.backgroundImage || ''));
  if (!metadata || !images[metadata.index]) return <Tag {...props} style={style}>{children}</Tag>;
  const property = (value: unknown, index: number, fallback: string) => {
    const values = splitBackgroundLayers(String(value || fallback));
    return values[index % values.length];
  };
  const borderWidth = style?.borderStyle === 'none' ? 0 : Number.parseFloat(String(style?.borderWidth || 0)) || 0;
  const shadows = splitBackgroundLayers(String(style?.boxShadow || ''));
  const insetShadows = shadows.filter(shadow => /\binset\b/.test(shadow)).join(', ');
  const layerBox: CSSProperties = { position: 'absolute', inset: -borderWidth, boxSizing: 'border-box', borderRadius: 'inherit',
    borderWidth, borderStyle: 'solid', borderColor: 'transparent', pointerEvents: 'none' };
  const radius = style?.borderRadius;
  const innerRadius = radius === undefined ? undefined : `max(0px, calc(${typeof radius === 'number' ? `${radius}px` : radius} - ${borderWidth}px))`;
  return <Tag {...props} style={{ ...style,
    ...(borderWidth ? { borderColor: 'transparent', borderImageSource: 'none', overflow: 'visible' } : {}),
    boxShadow: shadows.filter(shadow => !/\binset\b/.test(shadow)).join(', ') || undefined,
    position: style?.position || 'relative', isolation: 'isolate', backgroundImage: 'none' }}>
    {/* Equivalent border boxes preserve native background origin, clipping and
        tiling. The foreground edge is painted once, above every fill layer. */}
    {images.map((image, index) => <span aria-hidden="true" key={index} data-appearance-layer={index}
      data-vector-background-urls={props['data-vector-background-urls' as keyof typeof props] as string | undefined}
      style={{ ...layerBox, backgroundImage: image,
        backgroundSize: property(style?.backgroundSize, index, 'auto'),
        backgroundPosition: property(style?.backgroundPosition, index, '0% 0%'),
        backgroundRepeat: property(style?.backgroundRepeat, index, 'repeat'),
        backgroundOrigin: style?.backgroundOrigin, backgroundClip: style?.backgroundClip,
        mixBlendMode: property(style?.backgroundBlendMode, index, 'normal') as CSSProperties['mixBlendMode'],
        opacity: index === metadata.index ? metadata.opacity : 1, zIndex: -2 - index,
      }} />)}
    {(borderWidth > 0 || insetShadows) && <span aria-hidden="true" style={{ ...layerBox, zIndex: -1,
      borderStyle: style?.borderStyle, borderColor: style?.borderColor || 'currentColor',
      borderImageSource: style?.borderImageSource, borderImageSlice: style?.borderImageSlice,
      borderImageWidth: style?.borderImageWidth, borderImageOutset: style?.borderImageOutset, borderImageRepeat: style?.borderImageRepeat,
      boxShadow: insetShadows || undefined,
    }} />}
    {borderWidth && children ? <span style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', padding: 'inherit',
      display: 'inherit', flexDirection: 'inherit', alignItems: 'inherit', justifyContent: 'inherit', alignContent: 'inherit',
      justifyItems: 'inherit', gridTemplateColumns: 'inherit', gridTemplateRows: 'inherit', gap: 'inherit',
      overflow: style?.overflow, borderRadius: innerRadius,
    }}>{children}</span> : children}
  </Tag>;
}
