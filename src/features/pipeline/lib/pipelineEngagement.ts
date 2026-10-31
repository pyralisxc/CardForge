import type { PipelineStatus, PipelineVoteValue } from './pipelineItems';

/** Read projection only. Native vote/heart commands remain the mutation authority. */
export interface PipelineEngagement {
  submissionId: string;
  lineageId: string | null;
  name: string;
  revisionNumber: number | null;
  status: PipelineStatus;
  trashedAt: string | null;
  purgeState: 'pending' | null;
  positiveVotes: number;
  negativeVotes: number;
  currentUserVote: PipelineVoteValue | null;
  voteIssue: string | null;
  heart: { count: number; hearted: boolean } | null;
  heartIssue: string | null;
}

export interface PipelineDesignSource {
  localTemplateId: string;
  submissionId: string;
}
