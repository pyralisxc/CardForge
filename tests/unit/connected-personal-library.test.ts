import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  isPersonalLibraryMimeTypeAllowedForRole,
  MAX_PERSONAL_LIBRARY_ITEMS_PER_ACCOUNT,
  MAX_PERSONAL_LIBRARY_REGISTER_BATCH,
} from '@/features/personal-library/model';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('connected personal library', () => {
  it('uses explicit semantic roles instead of guessing arbitrary image purpose', () => {
    expect(isPersonalLibraryMimeTypeAllowedForRole('artwork', 'image/png')).toBe(true);
    expect(isPersonalLibraryMimeTypeAllowedForRole('frame', 'image/svg+xml')).toBe(true);
    expect(isPersonalLibraryMimeTypeAllowedForRole('font', 'font/woff2')).toBe(true);
    expect(isPersonalLibraryMimeTypeAllowedForRole('font', 'image/png')).toBe(false);
    expect(MAX_PERSONAL_LIBRARY_ITEMS_PER_ACCOUNT).toBe(2_000);
    expect(MAX_PERSONAL_LIBRARY_REGISTER_BATCH).toBe(100);
  });

  it('keeps the personal-library database as a server-only metadata index', () => {
    const migration = read('supabase/migrations/20260823163000_connected_personal_library.sql');
    expect(migration).toContain('create table if not exists public.cardforge_personal_library_items');
    expect(migration).toContain('unique (owner_user_id, provider, provider_file_id)');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all privileges on table public.cardforge_personal_library_items');
    expect(migration).toContain('to service_role');
    expect(migration).not.toContain(' bytea');
    expect(migration).not.toContain('storage.objects');
  });

  it('downloads provider bytes only when an authorized item is materialized', () => {
    const store = read('src/features/personal-library/server/personalLibraryStore.ts');
    const materializeIndex = store.indexOf('export const materializePersonalLibraryItem');
    const downloadIndex = store.indexOf('?alt=media');
    expect(materializeIndex).toBeGreaterThan(0);
    expect(downloadIndex).toBeGreaterThan(materializeIndex);
    expect(store).toContain(".from('cardforge_personal_library_items')");
    expect(store).toContain("provider: 'google-drive'");
  });

  it('uses the native Google Picker with multi-select for explicit file authorization', () => {
    const picker = read('src/features/project/client/googleDrivePicker.ts');
    const client = read('src/features/personal-library/client/personalLibraryClient.ts');
    expect(picker).toContain('MULTISELECT_ENABLED');
    expect(picker).toContain('enableFeature');
    expect(picker).toContain("setMode(picker.DocsViewMode.LIST)");
    expect(client).toContain('multiselect: true');
    expect(client).toContain('MAX_PERSONAL_LIBRARY_REGISTER_BATCH');
  });

  it('materializes selected connected art into the existing portable local asset lane', () => {
    const importer = read('src/features/personal-library/client/importPersonalLibraryAsset.ts');
    expect(importer).toContain('materializePersonalLibraryItemContent(item)');
    expect(importer).toContain('dataUrlForFile(storedFile)');
    expect(importer).toContain('writeProjectAssetListToStorage');
    expect(importer).toContain('connected-google-drive-${item.id}');
    expect(importer).not.toContain("url: '/api/personal-library");
  });

  it('keeps MCP search metadata-only until an explicit later materialization action', () => {
    const tools = read('src/features/personal-library/server/mcpPersonalLibraryTools.ts');
    expect(tools).toContain("'search_personal_library'");
    expect(tools).toContain('listPersonalLibraryItems');
    expect(tools).not.toContain('materializePersonalLibraryItem(');
    expect(tools).toContain('provider credentials and file bytes never enter model context');
  });
});
