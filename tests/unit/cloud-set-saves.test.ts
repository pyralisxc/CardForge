import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getCloudSetLimit } from '@/domain/entitlements';
import { prepareCloudSetTransfer } from '@/features/project/client/cloudSetTransfer';
import {
  getCloudSetAssetIdFromReference,
  getCloudSetAssetReference,
  MAX_CLOUD_SET_BYTES,
} from '@/features/project/model/cloudSet';
import type { CardForgeTransferV1 } from '@/features/project/model/cardTransfer';

const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2ZxQAAAAASUVORK5CYII=';

describe('cloud set saves', () => {
  it('gives Free one cloud set and Creator Pass/developer access five', () => {
    expect(getCloudSetLimit('free')).toBe(1);
    expect(getCloudSetLimit('paid')).toBe(5);
    expect(getCloudSetLimit('dev')).toBe(5);
  });

  it('externalizes duplicate embedded artwork once and leaves a small editable manifest', async () => {
    const transfer: CardForgeTransferV1 = {
      cardforgeTransfer: 1,
      kind: 'set',
      sets: [{ id: 'set-1', name: '52 Card Set', frontTemplateId: 'template-1', backingTemplateId: null }],
      cards: [{
        templateId: 'template-1',
        setId: 'set-1',
        setName: '52 Card Set',
        uniqueId: 'card-1',
        data: { name: 'Card One', artwork: onePixelPng },
      }],
      templates: [{
        id: 'template-1',
        name: 'Template One',
        aspectRatio: '63:88',
        templateSource: 'user',
        templateLibrarySource: 'personal',
        freeformCanvas: {
          width: 630,
          height: 880,
          elements: [{
            id: 'art',
            name: 'Artwork',
            type: 'image',
            x: 0,
            y: 0,
            width: 630,
            height: 500,
            zIndex: 1,
            imageSource: onePixelPng,
          }],
        },
      }],
      customAssets: {
        'cardforge-maker-custom-textures': [],
        'cardforge-maker-custom-dividers': [],
        'cardforge-maker-custom-icons': [],
        'cardforge-maker-custom-images': [],
      },
    };

    const prepared = await prepareCloudSetTransfer(transfer);
    expect(prepared.assets).toHaveLength(1);
    const reference = getCloudSetAssetReference(prepared.assets[0]!.id);
    expect(getCloudSetAssetIdFromReference(reference)).toBe(prepared.assets[0]!.id);
    expect(prepared.payload.cards[0]!.data.artwork).toBe(reference);
    expect(prepared.payload.templates[0]!.freeformCanvas?.elements[0]?.imageSource).toBe(reference);
    expect(prepared.storageBytes).toBeLessThan(MAX_CLOUD_SET_BYTES);
  });

  it('creates a private object-storage lane and bounded manifest table', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260820151000_cloud_set_saves.sql'),
      'utf8',
    );
    expect(migration).toContain('create table if not exists public.cardforge_cloud_sets');
    expect(migration).toContain("'cardforge-cloud-set-assets'");
    expect(migration).toContain('false,');
    expect(migration).toContain('8388608');
    expect(migration).toContain('storage_bytes between 0 and 134217728');
    expect(migration).not.toContain("status = 'shipped'");
  });

  it('keeps large artwork off Vercel function bodies by using signed Storage uploads', () => {
    const hook = readFileSync(
      resolve(process.cwd(), 'src/features/project/hooks/useCloudSetActions.ts'),
      'utf8',
    );
    const store = readFileSync(
      resolve(process.cwd(), 'src/features/project/server/cloudSetStore.ts'),
      'utf8',
    );
    expect(hook).toContain("fetch('/api/cloud-sets/prepare'");
    expect(hook).toContain('uploadPreparedCloudSetAssets');
    expect(store).toContain('createSignedUploadUrl');
    expect(store).toContain('createSignedUrls');
  });
});
