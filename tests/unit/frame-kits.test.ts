import { describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

import { CARD_FRAME_KITS, getFrameKitTemplateUpdates } from '@/lib/cardFrameKits';

describe('premium card frame kits', () => {
  it('ships every frame kit as a reusable local asset', async () => {
    expect(CARD_FRAME_KITS).toHaveLength(4);

    await Promise.all(CARD_FRAME_KITS.map(async (kit) => {
      const assetPath = path.join(process.cwd(), 'public', kit.assetUrl.replace('/card-assets/', 'card-assets/'));
      const sidecarPath = path.join(
        process.cwd(),
        'data/assets/textures',
        kit.assetUrl.replace('/card-assets/textures/', '').replace(/\.[^.]+$/, '.json'),
      );

      await expect(fs.stat(assetPath), `${kit.name} image should exist`).resolves.toBeTruthy();
      await expect(fs.stat(sidecarPath), `${kit.name} metadata should exist`).resolves.toBeTruthy();
    }));
  });

  it('applies full-frame backgrounds without legacy template borders', () => {
    for (const kit of CARD_FRAME_KITS) {
      const updates = getFrameKitTemplateUpdates(kit);

      expect(updates.cardBackgroundImageUrl).toBe(kit.assetUrl);
      expect(updates.cardBorderWidth).toBe('0px');
      expect(updates.cardBorderStyle).toBe('none');
      expect(updates.cardBorderImageSource).toBeUndefined();
    }
  });

});
