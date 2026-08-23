import sharp from 'sharp';

const CARD_WIDTH_PX = 360;
const GAP_PX = 24;
const PADDING_PX = 24;
const MAX_COLUMNS = 3;

export const composeCanonicalContactSheet = async (cards: Buffer[]): Promise<Buffer> => {
  if (cards.length < 1) throw new Error('A CardForge contact sheet requires at least one rendered card.');
  if (cards.length > 12) throw new Error('A CardForge preview contact sheet supports at most 12 cards.');

  const resized = await Promise.all(cards.map(async (bytes) => {
    const result = await sharp(bytes)
      .resize({ width: CARD_WIDTH_PX, withoutEnlargement: false })
      .png()
      .toBuffer({ resolveWithObject: true });
    return {
      bytes: result.data,
      width: result.info.width,
      height: result.info.height,
    };
  }));

  const columns = Math.min(MAX_COLUMNS, resized.length);
  const rows = Math.ceil(resized.length / columns);
  const cellWidth = Math.max(...resized.map((card) => card.width));
  const cellHeight = Math.max(...resized.map((card) => card.height));
  const width = PADDING_PX * 2 + columns * cellWidth + Math.max(0, columns - 1) * GAP_PX;
  const height = PADDING_PX * 2 + rows * cellHeight + Math.max(0, rows - 1) * GAP_PX;

  const composites = resized.map((card, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      input: card.bytes,
      left: PADDING_PX + column * (cellWidth + GAP_PX) + Math.floor((cellWidth - card.width) / 2),
      top: PADDING_PX + row * (cellHeight + GAP_PX) + Math.floor((cellHeight - card.height) / 2),
    };
  });

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 9, g: 11, b: 15, alpha: 1 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toBuffer();
};
