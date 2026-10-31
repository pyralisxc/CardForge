import { PipelineRegistryCommandError } from './pipelineRegistryCommandsError';

export const REVISION_RECOVERY_NEXT_ACTION = 'Read this exact revision and its retained Trash, hold and destructive claim state. Reconcile an uncertain Storage or command outcome before a newly confirmed action; do not automatically retry recovery.';

export class RevisionRecoveryError extends PipelineRegistryCommandError {
  readonly retryable = false;
  readonly nextAction = REVISION_RECOVERY_NEXT_ACTION;
}
