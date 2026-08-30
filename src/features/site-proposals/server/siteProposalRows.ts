import type { SiteContentProposal } from '@/features/site-proposals/model';

export type SiteProposalRow = {
  id: string;
  contributor_id: string;
  contributor_email: string | null;
  contributor_name: string | null;
  slug: SiteContentProposal['slug'];
  base_body: string;
  proposed_body: string;
  rationale: string;
  status: SiteContentProposal['status'];
  review_note: string;
  reviewed_by: string | null;
  submitted_at: string | null;
  published_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export const PROPOSAL_COLUMNS = [
  'id', 'contributor_id', 'contributor_email', 'contributor_name', 'slug',
  'base_body', 'proposed_body', 'rationale', 'status', 'review_note',
  'reviewed_by', 'submitted_at', 'published_at', 'version', 'created_at',
  'updated_at',
].join(',');

export const readDatabaseRows = <Row>(value: unknown): Row[] => (
  Array.isArray(value) ? value as Row[] : []
);

export const mapProposalRow = (row: SiteProposalRow): SiteContentProposal => ({
  id: row.id,
  contributorId: row.contributor_id,
  contributorEmail: row.contributor_email,
  contributorName: row.contributor_name,
  slug: row.slug,
  baseBody: row.base_body,
  proposedBody: row.proposed_body,
  rationale: row.rationale,
  status: row.status,
  reviewNote: row.review_note,
  reviewedBy: row.reviewed_by,
  submittedAt: row.submitted_at,
  publishedAt: row.published_at,
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
