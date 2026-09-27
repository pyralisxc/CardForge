import {
  readProjectPreferenceSafely,
  removeProjectPreference,
  writeProjectPreference,
} from '../persistence/preferences';
import { getProjectPersistenceScope } from '../persistence/projectPersistenceScope';

const EDITOR_PREFERENCES_STORAGE_KEY = 'editor-preferences:v1';
type EditorPreferenceScope = ReturnType<typeof getProjectPersistenceScope>;
const editorPreferenceKey = (scope: EditorPreferenceScope = getProjectPersistenceScope()) =>
  `${EDITOR_PREFERENCES_STORAGE_KEY}:${scope}`;
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

const publishChange = (scope: EditorPreferenceScope) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EDITOR_PREFERENCES_CHANGED_EVENT, { detail: { scope } }));
  }
};

export const readEditorPreferenceStorage = async (
  scope: EditorPreferenceScope = getProjectPersistenceScope(),
): Promise<StoredEditorPreferences | null> => {
  const stored = await readProjectPreferenceSafely<Partial<StoredEditorPreferences>>(editorPreferenceKey(scope));
  if (stored.kind !== 'available') return null;
  return { richTextHighlightColor: normalizeHighlightColor(stored.value.richTextHighlightColor) };
};

export const writeEditorPreferenceStorage = async (
  preferences: StoredEditorPreferences,
  scope: EditorPreferenceScope = getProjectPersistenceScope(),
): Promise<void> => {
  await writeProjectPreference(editorPreferenceKey(scope), {
    richTextHighlightColor: normalizeHighlightColor(preferences.richTextHighlightColor),
  });
  publishChange(scope);
};

/**
 * One-way ownership migration from the v4 Project workspace.
 * Existing editor preference storage wins; unreadable preference storage is
 * never overwritten by a migration default.
 */
export const migrateLegacyEditorPreferences = async (
  legacyHighlightColor: unknown,
  scope: EditorPreferenceScope = getProjectPersistenceScope(),
): Promise<void> => {
  const current = await readProjectPreferenceSafely<Partial<StoredEditorPreferences>>(editorPreferenceKey(scope));
  if (current.kind !== 'missing') return;
  if (typeof legacyHighlightColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(legacyHighlightColor.trim())) return;
  await writeProjectPreference(editorPreferenceKey(scope), {
    richTextHighlightColor: normalizeHighlightColor(legacyHighlightColor),
  });
  publishChange(scope);
};

export const clearEditorPreferenceStorage = async (
  scope: EditorPreferenceScope = getProjectPersistenceScope(),
): Promise<void> => {
  await removeProjectPreference(editorPreferenceKey(scope));
  publishChange(scope);
};
