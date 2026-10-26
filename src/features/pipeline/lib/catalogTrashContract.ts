import { z } from 'zod';

// Browser and Studio MCP commands carry only native identities and the exact
// observed catalog state. Dependency evidence must come from the database,
// never from a caller's assertion that an asset is unused.
const timestamp = z.string().datetime({ offset: true }).refine(
  value => Number.isFinite(Date.parse(value)), 'Expected a finite timestamp',
);
export const catalogTrashIdentitySchema = z.object({
  lineageId: z.string().uuid(),
  submissionId: z.string().uuid(),
  registrySubmissionId: z.string().uuid().nullable(),
  revisionHighWater: z.number().int().nonnegative().max(2147483647),
}).strict();

export const catalogTrashExpectedStateSchema = z.object({
  identity: catalogTrashIdentitySchema,
  // Fence restore -> trash cycles even when the revision identity is unchanged.
  trashedAt: timestamp.nullable(),
  purgeAfter: timestamp.nullable(),
  held: z.boolean(),
}).strict().superRefine((state, context) => {
  if ((state.trashedAt === null) !== (state.purgeAfter === null)) {
    context.addIssue({ code: 'custom', message: 'Incomplete catalog recovery state' });
  }
  if (state.trashedAt && state.purgeAfter && Date.parse(state.purgeAfter) <= Date.parse(state.trashedAt)) {
    context.addIssue({ code: 'custom', message: 'Recovery deadline must follow Trash entry' });
  }
  if (!state.trashedAt && state.held) {
    context.addIssue({ code: 'custom', message: 'Only a trashed catalog can have a recovery hold' });
  }
});

export const catalogTrashCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('trash'), expected: catalogTrashExpectedStateSchema }).strict(),
  z.object({ action: z.literal('restore'), expected: catalogTrashExpectedStateSchema }).strict(),
  z.object({ action: z.literal('hold'), expected: catalogTrashExpectedStateSchema, held: z.boolean() }).strict(),
]).superRefine((command, context) => {
  if (command.action === 'trash' ? command.expected.trashedAt !== null : command.expected.trashedAt === null) {
    context.addIssue({ code: 'custom', message: 'Action does not match the observed catalog state' });
  }
});

export type CatalogTrashCommand = z.infer<typeof catalogTrashCommandSchema>;
export type CatalogTrashExpectedState = z.infer<typeof catalogTrashExpectedStateSchema>;

export const catalogTrashSnapshotSchema = z.object({
  name: z.string().min(1),
  state: catalogTrashExpectedStateSchema,
  retentionDays: z.number().int().positive(),
  reasons: z.array(z.string().min(1)),
  entryReasons: z.array(z.string().min(1)),
}).strict();
export type CatalogTrashSnapshot = z.infer<typeof catalogTrashSnapshotSchema>;
