"use client";

import { useEditorPreferences } from '../hooks/useEditorPreferences';
import { STUDIO_AUTOSAVE_DELAYS_SECONDS, type StudioAutosaveDelaySeconds } from '@/features/experience-settings/client';

import type { ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';

export function SavingPreferencesPanel({
  persistenceScope,
  defaultAutosaveDelaySeconds,
}: {
  persistenceScope: ProjectPersistenceScope;
  defaultAutosaveDelaySeconds: StudioAutosaveDelaySeconds;
}) {
  const preferences = useEditorPreferences(persistenceScope);
  return (
    <section aria-labelledby="saving-preferences-heading" className="mt-4 space-y-4 border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4">
      <div>
        <h2 id="saving-preferences-heading" className="font-serif text-xl text-[var(--cf-text-strong)]">Saving preferences</h2>
        <p className="mt-2 text-sm text-[var(--cf-text-muted)]">Manual Save is the default. These preferences are remembered for this account or guest workspace in this browser, not other devices or imported Sets. Other open tabs keep their current session choices.</p>
      </div>
      <fieldset disabled={!preferences.preferencesReady} className="space-y-4">
      <label className="flex items-start gap-3 text-sm text-[var(--cf-text-strong)]">
        <input type="checkbox" checked={preferences.googleDriveAutosaveEnabled} onChange={(event) => preferences.setGoogleDriveAutosaveEnabled(event.target.checked)} />
        <span>Autosave the focused, linked Set to Google Drive</span>
      </label>
      <label className="grid max-w-sm gap-2 text-sm text-[var(--cf-text-muted)]">
        <span>Save after edits stop for</span>
        <select className="border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-text-strong)]" value={preferences.googleDriveAutosaveDelaySeconds ?? ''} onChange={(event) => preferences.setGoogleDriveAutosaveDelaySeconds(event.target.value === '' ? null : Number(event.target.value) as StudioAutosaveDelaySeconds)}>
          <option value="">Owner default ({defaultAutosaveDelaySeconds} seconds)</option>
          {STUDIO_AUTOSAVE_DELAYS_SECONDS.map((delay) => <option key={delay} value={delay}>{delay} seconds</option>)}
        </select>
      </label>
      </fieldset>
      {preferences.preferenceReadError ? <div role="alert" className="space-y-2 text-sm text-[var(--cf-warning)]"><p>{preferences.preferenceReadError}</p><button type="button" className="underline" onClick={preferences.retryPreferenceRead}>Retry reading preferences</button></div> : null}
      {preferences.preferenceWriteError ? <p role="alert" className="text-sm text-[var(--cf-warning)]">{preferences.preferenceWriteError}</p> : null}
      <p className="text-sm text-[var(--cf-text-muted)]">Only a Set already linked to Drive can autosave while focused on Desk. Other destinations still require their explicit Save action. Browser recovery is not a confirmed Drive save or a backup. Turning autosave off cancels this tab’s pending saves, not an upload already sent to Drive.</p>
    </section>
  );
}
