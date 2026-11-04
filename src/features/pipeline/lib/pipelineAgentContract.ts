import { z } from 'zod/v4';
import { pipelineEngagementSchema as pipelineAgentEngagement } from './pipelineEngagement';
import { PIPELINE_STATUSES, PIPELINE_TYPES } from './pipelineItems';
const uuid = z.string().uuid();
const nullableText = z.string().nullable();
export const pipelineAgentListInput = z.object({
  scope: z.enum(['own', 'review', 'all', 'shared-trash']).default('own'),
  query: z.string().max(120).default(''), assetType: z.enum(['all', ...PIPELINE_TYPES]).default('all'),
  status: z.enum(['all', ...PIPELINE_STATUSES]).default('all'), trash: z.enum(['active', 'trashed', 'all']).default('active'),
  page: z.number().int().min(1).max(100000).default(1), pageSize: z.number().int().min(1).max(50).default(12),
}).strict();
export const pipelineAgentExactInput = z.object({ submissionId: uuid }).strict();
export const pipelineAgentVoteInput = pipelineAgentExactInput.extend({ voteValue: z.enum(['positive', 'negative']) }).strict();
export const pipelineAgentHeartInput = pipelineAgentExactInput.extend({ lineageId: uuid, hearted: z.boolean() }).strict();
export const pipelineAgentRevision = z.object({
  submissionId: uuid, lineageId: uuid.nullable(), name: z.string(), description: z.string(),
  assetType: z.enum(PIPELINE_TYPES), status: z.enum(PIPELINE_STATUSES), revisionNumber: z.number().int().nonnegative().nullable(),
  ownedByViewer: z.boolean(), trashActorRole: z.enum(['owner', 'contributor', 'voting']).nullable(), publicationRetained: z.boolean(), effectiveTrash: z.object({ trashed: z.boolean(), scope: z.enum(['revision', 'catalog']).nullable(),
    trashedAt: nullableText, purgeAfter: nullableText, held: z.boolean(), catalogSubmissionId: uuid.nullable() }).strict(),
}).strict();
export const pipelineAgentPage = z.object({ items: z.array(pipelineAgentRevision), total: z.number().int().nonnegative(), page: z.number().int().positive(), pageSize: z.number().int().positive() }).strict();
export { pipelineEngagementSchema as pipelineAgentEngagement } from './pipelineEngagement';
export const pipelineAgentHealth = z.object({ checkedCount: z.number().int().nonnegative(), errors: z.number().int().nonnegative(), warnings: z.number().int().nonnegative(), issues: z.array(z.object({
  code: z.string(), severity: z.enum(['error', 'warning']), objectId: nullableText, submissionId: uuid.optional(), objectName: z.string(), message: z.string(), repair: z.string(),
}).strict()) }).strict();
export const pipelineAgentMutationReceipt = z.object({
  submissionId: uuid, lineageId: uuid.nullable(), outcome: z.enum(['committed', 'uncertain']),
  engagement: pipelineAgentEngagement.nullable(), warnings: z.array(z.string()),
  nextAction: z.literal('Read exact engagement before any further write; never retry an uncertain mutation automatically.'),
}).strict();
