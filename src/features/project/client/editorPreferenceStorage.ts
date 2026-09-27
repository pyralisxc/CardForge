import {
  readProjectPreferenceSafely,
  removeProjectPreference,
  writeProjectPreference,
} from '../persistence/preferences';

const EDITOR_PREFERENCES_STORAGE_KEY = 'editor-preferences:v1';
export const EDITOR_PREFERENCES_CHANGED_EVENT = 'cardforge:editor-preferences-change';

export interface StoredEditorPreferences {
  richTextHighlightColor: string;
}

export const DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR = '#ffd700';

const normalizeHighlightColor = (value: unknown): string => (
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR
);

const publishChange = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EDITOR_PREFERENCES_CHANGED_EVENT));
};

export const readEditorPreferenceStorage = async (): Promise<StoredEditorPreferences | null> => {
  const stored = await readProjectPreferenceSafely<Partial<StoredEditorPreferences>>(EDITOR_PREFERENCES_STORAGE_KEY);
  if (stored.kind !== 'available') return null;
  return { richTextHighlightColor: normalizeHighlightColor(stored.value.richTextHighlightColor) };
};

export const writeEditorPreferenceStorage = async (
  preferences: StoredEditorPreferences,
): Promise<void> => {
  await writeProjectPreference(EDITOR_PREFERENCES_STORAGE_KEY, {
    richTextHighlightColor: normalizeHighlightColor(preferences.richTextHighlightColor),
  });
  publishChange();
};

/**
 * One-way ownership migration from the v4 Project workspace.
 * Existing editor preference storage wins; unreadable preference storage is
 * never overwritten by a migration default.
 */
export const migrateLegacyEditorPreferences = async (
  legacyHighlightColor: unknown,
): Promise<void> => {
  const current = await readProjectPreferenceSafely<Partial<StoredEditorPreferences>>(EDITOR_PREFERENCES_STORAGE_KEY);
  if (current.kind !== 'missing') return;
  if (typeof legacyHighlightColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(legacyHighlightColor.trim())) return;
  await writeProjectPreference(EDITOR_PREFERENCES_STORAGE_KEY, {
    richTextHighlightColor: normalizeHighlightColor(legacyHighlightColor),
  });
  publishChange();
};

export const clearEditorPreferenceStorage = async (): Promise<void> => {
  await removeProjectPreference(EDITOR_PREFERENCES_STORAGE_KEY);
  publishChange();
};
