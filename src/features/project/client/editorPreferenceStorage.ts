import {
  readProjectPreferenceSafely,
  removeProjectPreference,
  writeProjectPreference,
} from '../persistence/preferences';
import { getProjectPersistenceScope } from '../persistence/projectPersistenceScope';
import { isStudioAutosaveDelaySeconds, type StudioAutosaveDelaySeconds } from '@/features/experience-settings/client';

const EDITOR_PREFERENCES_STORAGE_KEY = 'editor-preferences:v1';
type EditorPreferenceScope = ReturnType<typeof getProjectPersistenceScope>;
const editorPreferenceKey = (scope: EditorPreferenceScope = getProjectPersistenceScope()) =>
  `${EDITOR_PREFERENCES_STORAGE_KEY}:${scope}`;
export const EDITOR_PREFERENCES_CHANGED_EVENT = 'cardforge:editor-preferences-change';

export interface StoredEditorPreferences {
  richTextHighlightColor: string;
  googleDriveAutosaveEnabled: boolean;
  googleDriveAutosaveDelaySeconds: StudioAutosaveDelaySeconds | null;
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
  if (stored.kind === 'unavailable') throw new Error('Browser saving preferences could not be read. Existing preferences were left unchanged.');
  if (stored.kind === 'missing') return null;
  return {
    richTextHighlightColor: normalizeHighlightColor(stored.value?.richTextHighlightColor),
    googleDriveAutosaveEnabled: stored.value?.googleDriveAutosaveEnabled === true,
    googleDriveAutosaveDelaySeconds: isStudioAutosaveDelaySeconds(stored.value?.googleDriveAutosaveDelaySeconds)
      ? stored.value.googleDriveAutosaveDelaySeconds : null,
  };
};

export const writeEditorPreferenceStorage = async (
  preferences: StoredEditorPreferences,
  scope: EditorPreferenceScope = getProjectPersistenceScope(),
): Promise<void> => {
  await writeProjectPreference(editorPreferenceKey(scope), {
    richTextHighlightColor: normalizeHighlightColor(preferences.richTextHighlightColor),
    googleDriveAutosaveEnabled: preferences.googleDriveAutosaveEnabled === true,
    googleDriveAutosaveDelaySeconds: isStudioAutosaveDelaySeconds(preferences.googleDriveAutosaveDelaySeconds)
      ? preferences.googleDriveAutosaveDelaySeconds : null,
  }, { suppressWriteErrors: false });
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
  if (typeof legacyHighlightColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(legacyHighlightColor.trim())) return;
  const current = await readProjectPreferenceSafely<Partial<StoredEditorPreferences>>(editorPreferenceKey(scope));
  if (current.kind !== 'missing') return;
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
