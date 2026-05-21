import sharp from 'sharp';

export interface SharpRasterResult {
  bytes: Uint8Array;
  widthPx: number;
  heightPx: number;
}

export async function rasterizeSvgToPng(
  svg: string,
  widthPx: number,
  heightPx: number
): Promise<SharpRasterResult> {
  const { data, info } = await sharp(Buffer.from(svg))
    .resize(widthPx, heightPx, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });

  return {
    bytes: new Uint8Array(data),
    widthPx: info.width,
    heightPx: info.height,
  };
}
