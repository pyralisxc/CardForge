import { z } from 'zod';

const timestamp = z.string().datetime({ offset: true });
export const revisionRecoveryStateSchema = z.object({
  scope: z.literal('revision'),
  submissionId: z.string().uuid(),
  lineageId: z.string().uuid(),
  revisionNumber: z.number().int().nonnegative().nullable(),
  registrySubmissionId: z.string().uuid().nullable(),
  revisionHighWater: z.number().int().nonnegative(),
  recoveryVersion: z.string().regex(/^(0|[1-9][0-9]*)$/u).max(19),
  status: z.enum(['draft', 'submitted', 'voting', 'publish_candidate', 'published', 'archived', 'rejected']),
  updatedAt: timestamp,
  trashedAt: timestamp.nullable(),
  purgeAfter: timestamp.nullable(),
  held: z.boolean(),
}).strict();

export const revisionRecoveryCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('trash'), expected: revisionRecoveryStateSchema }).strict(),
  z.object({ action: z.literal('restore'), expected: revisionRecoveryStateSchema }).strict(),
  z.object({ action: z.literal('hold'), expected: revisionRecoveryStateSchema, held: z.boolean() }).strict(),
]).superRefine((command, context) => {
  if (command.action === 'trash' ? command.expected.trashedAt !== null : command.expected.trashedAt === null) {
    context.addIssue({ code: 'custom', message: 'Action does not match the observed revision Trash state.' });
  }
});

export const revisionRecoverySnapshotSchema = z.object({
  name: z.string().min(1),
  state: revisionRecoveryStateSchema,
  retentionDays: z.number().int().positive(),
  trashActor: z.enum(['owner', 'contributor']).nullable(),
  trashReasons: z.array(z.string()),
  restoreReasons: z.array(z.string()),
  canHold: z.boolean(),
  publicationRetained: z.boolean(),
}).strict();

export type RevisionRecoveryCommand = z.infer<typeof revisionRecoveryCommandSchema>;
export type RevisionRecoverySnapshot = z.infer<typeof revisionRecoverySnapshotSchema>;
