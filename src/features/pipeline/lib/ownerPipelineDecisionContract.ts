import { z } from 'zod/v4';
import { PIPELINE_STATUSES } from './pipelineItems';
const uuid = z.string().uuid(), text = z.string().nullable();
const version = z.number().int().min(0).max(2_147_483_647);
const editorialStatus = z.enum(['pending', 'approved', 'revise', 'quarantine', 'retire']);
export const ownerPipelineExactInput = z.object({ submissionId: uuid }).strict();
const facts = z.object({ technicalTrace: z.string().trim().min(1).max(2400), creatorFacts: z.string().trim().min(1).max(1200).nullable(), rightsFacts: z.string().trim().min(1).max(1200).nullable(), aiFacts: z.string().trim().min(1).max(1200).nullable(), aiDisclosurePublic: z.boolean().optional() }).strict();
export const ownerPipelineEvidenceInput = ownerPipelineExactInput.extend({ facts, expectedCandidateVersion: z.string().regex(/^[a-f0-9]{32}$/), expectedEvidenceVersion: version }).strict();
export const ownerPipelineEditorialInput = ownerPipelineExactInput.extend({ reviewStatus: editorialStatus, reviewNote: z.string().max(600), expectedEvidenceVersion: version.nullable() }).strict();
export const ownerPipelinePublicationInput = ownerPipelineExactInput.extend({ ownerStatusOverride: z.enum(['voting', 'publish_candidate', 'published', 'archived', 'rejected']).nullable().optional(), ownerAccessTierOverride: z.enum(['hidden', 'free', 'paid']).nullable().optional(), ownerNote: z.string().max(280) }).strict();
export const ownerPipelineEvidenceSnapshot = z.object({ submissionId: uuid, candidateVersion: z.string().regex(/^[a-f0-9]{32}$/), canRecord: z.boolean(), evidence: z.object({ schemaVersion: z.literal(1), version: version.min(1), facts, recordedBy: z.string().min(1), recordedAt: z.string().min(1) }).strict().nullable() }).strict();
const identity = { submissionId: uuid, lineageId: uuid.nullable(), name: z.string(), revisionNumber: z.number().int().nonnegative().nullable(), status: z.enum(PIPELINE_STATUSES), updatedAt: z.string().min(1) };
export const ownerPipelineEditorialSnapshot = z.object({ ...identity, reviewStatus: editorialStatus, reviewNote: z.string(), reviewedBy: text, reviewedAt: text, evidenceVersion: version,
  qualityStandard: z.object({ version: z.string(), role: z.string(), universal: z.array(z.string()), ai: z.array(z.string()), finish: z.array(z.string()), roleCriteria: z.object({ pass: z.string(), revise: z.string(), reject: z.string(), proof: z.string() }).strict() }).strict(),
}).strict();
export const ownerPipelinePublicationSnapshot = z.object({ ...identity, currentPublicationSubmissionId: uuid.nullable(), publishedAt: text, ownerStatusOverride: z.enum(PIPELINE_STATUSES).nullable(), ownerAccessTierOverride: z.enum(['hidden', 'free', 'paid']).nullable(), ownerNote: z.string(), calculatedAccessTier: z.enum(['hidden', 'free', 'paid', 'contributor']) }).strict();
export const ownerPipelineDecisionReceipt = z.object({ submissionId: uuid, outcome: z.enum(['committed', 'uncertain']), committed: z.boolean().nullable(), refreshComplete: z.boolean(), refreshFailures: z.array(z.string()), activityRecorded: z.boolean().nullable(), retryable: z.literal(false), nextAction: z.enum(['none', 'read']), message: z.string() }).strict();
export const ownerPipelineEvidenceResult = z.object({ snapshot: ownerPipelineEvidenceSnapshot.nullable(), receipt: ownerPipelineDecisionReceipt }).strict();
export const ownerPipelineEditorialResult = z.object({ snapshot: ownerPipelineEditorialSnapshot.nullable(), receipt: ownerPipelineDecisionReceipt }).strict();
export const ownerPipelinePublicationResult = z.object({ snapshot: ownerPipelinePublicationSnapshot.nullable(), receipt: ownerPipelineDecisionReceipt }).strict();
