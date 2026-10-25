import { z } from 'zod';

/** Reviewer observations never replace inherited creator/source statements. */
export const sourceReviewFactsSchema = z.object({
  technicalTrace: z.string().trim().min(1).max(2400),
  creatorFacts: z.string().trim().min(1).max(1200).nullable(),
  rightsFacts: z.string().trim().min(1).max(1200).nullable(),
  aiFacts: z.string().trim().min(1).max(1200).nullable(),
  // Only this explicit opt-in permits the AI text in public catalog projections.
  aiDisclosurePublic: z.boolean().optional(),
}).strict().refine((facts) => !facts.aiDisclosurePublic || Boolean(facts.aiFacts), {
  message: 'Public AI disclosure requires explicit AI-use text.', path: ['aiDisclosurePublic'],
});
export type SourceReviewFacts = z.infer<typeof sourceReviewFactsSchema>;
export const sourceReviewEvidenceSchema = z.object({
  schemaVersion: z.literal(1), version: z.number().int().positive().max(2_147_483_647), facts: sourceReviewFactsSchema,
  recordedBy: z.string().min(1), recordedAt: z.string().min(1),
}).strict();
export const sourceReviewSnapshotSchema = z.object({
  submissionId: z.string().uuid(), candidateVersion: z.string().regex(/^[a-f0-9]{32}$/u),
  evidence: sourceReviewEvidenceSchema.nullable(), canRecord: z.boolean(),
});
export type SourceReviewSnapshot = z.infer<typeof sourceReviewSnapshotSchema>;
export const getSourceReviewVersion = (value: unknown): number | null => {
  if (value == null) return 0;
  const parsed = sourceReviewEvidenceSchema.safeParse(value);
  return parsed.success ? parsed.data.version : null;
};

/** Never expose private trace, rights, creator or reviewer details by inference. */
export const getPublicAiDisclosure = (value: unknown): string | null => {
  const parsed = sourceReviewEvidenceSchema.safeParse(value);
  return parsed.success && parsed.data.facts.aiDisclosurePublic === true ? parsed.data.facts.aiFacts : null;
};
