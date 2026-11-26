import { validateCleanOutputAccess } from './outputCleanAccess';
import { refreshReadyOutput, type ReadyOutput } from './outputReadyStorage';

/** Prepare one exact snapshot; a pinned source check is the final async check. */
export async function prepareReadyOutputHandoff(
  scope: string,
  output: ReadyOutput,
  isCurrent: () => boolean,
  validate?: () => Promise<void>,
): Promise<ReadyOutput | null> {
  if (output.clean) await validateCleanOutputAccess(scope);
  if (!isCurrent()) return null;
  const refreshed = await refreshReadyOutput(scope, output);
  if (!isCurrent()) return null;
  await validate?.();
  return isCurrent() ? refreshed : null;
}

/** Publication is not a handoff: recheck the pinned source after it completes. */
export async function publishReadyOutput(
  stage: { publish: () => Promise<ReadyOutput> },
  isCurrent: () => boolean,
  validate?: () => Promise<void>,
): Promise<{ ok: true; output: ReadyOutput } | { ok: false; output: ReadyOutput; error: unknown }> {
  const output = await stage.publish();
  try {
    await validate?.();
    if (!isCurrent()) throw new Error('The active workspace changed. Start the export again.');
    return { ok: true, output };
  } catch (error) { return { ok: false, output, error }; }
}
