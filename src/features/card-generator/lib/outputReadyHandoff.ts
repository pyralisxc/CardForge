import { validateCleanOutputAccess } from './outputCleanAccess';
import { refreshReadyOutput, type ReadyOutput } from './outputReadyStorage';

/** Prepare one exact snapshot; a pinned source check is the final async check. */
export async function prepareReadyOutputHandoff(
  scope: string,
  output: ReadyOutput,
  isCurrent: () => boolean,
  validate?: () => Promise<void>,
  timeoutMs = 15_000,
): Promise<ReadyOutput | null> {
  let waiting = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const current = () => waiting && isCurrent();
  const prepare = async () => {
    if (output.clean) await validateCleanOutputAccess(scope);
    if (!current()) return null;
    const refreshed = await refreshReadyOutput(scope, output);
    if (!current()) return null;
    await validate?.();
    return current() ? refreshed : null;
  };
  try {
    return await Promise.race([
      prepare(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Checking the prepared file took too long. Try Save again.')), timeoutMs); }),
    ]);
  } finally {
    waiting = false;
    if (timer !== undefined) clearTimeout(timer);
  }
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

/** One save/remove handoff at a time; stale completions cannot release a newer one. */
export function createReadyHandoffGuard() {
  let active: symbol | null = null;
  return {
    busy: () => active !== null,
    begin: () => {
      if (active) return null;
      active = Symbol('prepared output handoff');
      return active;
    },
    finish: (token: symbol) => {
      if (active !== token) return false;
      active = null;
      return true;
    },
    invalidate: () => { active = null; },
  };
}
