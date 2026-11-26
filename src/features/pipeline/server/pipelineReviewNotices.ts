import { getCurrentAccountToolAccess } from '@/features/account/server';
import { hasContributionScope, readContributorCapabilities } from '@/features/contributor-access/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { fetchPipelineSubmissionPage } from '../lib/pipelineProjections';
import { isContributorPipelineVoteable } from '../lib/pipelineLibrary';
import { pipelineReviewNoticesSchema } from '../lib/pipelineReviewNotices';
import { PipelineStoreError } from '../lib/pipelineStoreError';

/** Read the existing review list without profile enrollment or notification writes. */
export async function readPipelineReviewNotices() {
  const account = await getCurrentAccountToolAccess();
  const access = await readContributorCapabilities(account);
  if (!access.active || !hasContributionScope(access.scopes, 'assets.review')) throw new PipelineStoreError('Contributor review access is required.', 403);
  const database = getSupabaseServerClient();
  if (!database) throw new PipelineStoreError('Pipeline review notices are unavailable.', 503);
  const settings = await database.from('cardforge_contributor_program_settings').select('review_notices_started_at,allow_contributor_self_voting').eq('id', 'default').single();
  if (settings.error || !settings.data || typeof settings.data.allow_contributor_self_voting !== 'boolean' || !Number.isFinite(Date.parse(settings.data.review_notices_started_at))) throw new PipelineStoreError('Pipeline review notices are unavailable.', 503);
  const cutoff = Date.parse(settings.data.review_notices_started_at);
  const items: Array<{ submissionId: string; lineageId: string; name: string; revisionNumber: number | null; submittedAt: string }> = [];
  let pageNumber = 1;
  for (;;) {
    const page = await fetchPipelineSubmissionPage({ currentUserId: account.user.id, profiles: [],
      includeRegistryRecipePayloads: false, allowSelfVoting: settings.data.allow_contributor_self_voting,
      query: { scope: 'review', trash: 'all', page: pageNumber, pageSize: 50 } });
    if (page.submissions.some(row => !Number.isFinite(Date.parse(row.submittedAt)))) throw new PipelineStoreError('Pipeline review notices are unavailable.', 503);
    const recent = page.submissions.filter(row => Date.parse(row.submittedAt) >= cutoff && row.lineageId && isContributorPipelineVoteable(row));
    if (recent.length) {
      // Authorship and the submitter differ for governed corrections. Read this only on the server.
      const identity = await database.from('cardforge_contributor_asset_submissions')
        .select('id,contributor_id,template_review_context,media_presentation').in('id', recent.map(row => row.id))
        .gte('submitted_at', settings.data.review_notices_started_at);
      if (identity.error || !identity.data) throw new PipelineStoreError('Pipeline review notices are unavailable.', 503);
      const actors = new Map(identity.data.map(row => {
        const context = row.template_review_context;
        const actor = context && typeof context === 'object' && typeof context.actorId === 'string' ? context.actorId
          : context || row.media_presentation ? null : row.contributor_id;
        return [row.id, actor] as const;
      }));
      items.push(...recent.filter(row => actors.has(row.id) && actors.get(row.id) !== account.user.id)
        .map(row => ({ submissionId: row.id, lineageId: row.lineageId!, name: row.name, revisionNumber: row.revisionNumber, submittedAt: row.submittedAt })));
    }
    if (page.submissions.length < 50 || page.submissions.some(row => Date.parse(row.submittedAt) < cutoff) || pageNumber * 50 >= page.total) break;
    pageNumber++;
  }
  return pipelineReviewNoticesSchema.parse({ items });
}
