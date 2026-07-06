comment on table public.cardforge_developer_profiles is
  'Developer profile ledger. Rows are intentionally independent from Clerk/Auth user rows so contribution credit can remain after an account leaves or is deleted.';

comment on table public.cardforge_developer_asset_submissions is
  'Durable developer asset contribution history. Do not cascade-delete these rows on account deletion; archive or reject assets instead.';

comment on column public.cardforge_developer_asset_submissions.developer_id is
  'Snapshot of the contributor Clerk user id or system contributor id at submission time. Historical contribution identity, not a foreign key to a live account.';

comment on column public.cardforge_developer_asset_submissions.developer_email is
  'Contributor email snapshot for historical credit fallback after a profile or account is removed.';

comment on table public.cardforge_developer_asset_votes is
  'Durable developer vote ledger. Votes remain after developer account deletion and are only removed when the voted submission itself is deliberately deleted.';

comment on column public.cardforge_developer_asset_votes.developer_id is
  'Snapshot of the voting developer Clerk user id at vote time. Historical vote identity, not a foreign key to a live account.';
