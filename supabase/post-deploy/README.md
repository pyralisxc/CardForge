# Retired owner identity columns

The SQL in this directory is deliberately outside `supabase/migrations`. It is a
manual, destructive cleanup artifact and must not run as part of the additive
Gate 1 rollout.

It may be considered only after the Gate 1 code is deployed and live
verification succeeds.

Do not run before all of these steps are complete, in this exact order:

1. Apply the Gate 1 `business_identity_foundation` migration.
2. Confirm the singleton `cardforge_business_identity` row contains the approved
   CardForge Studio / Cameron Locke / Oregon identity.
3. Deploy the Gate 1 code that reads and writes only the new identity table.
4. Complete live verification of public operator copy, owner-console reads, and
   one version-checked owner identity update.
5. Confirm current backups and record the exact deployed commit and migration.
6. Run `drop_legacy_owner_identity_columns.sql` manually during a controlled
   maintenance window.
7. Re-run live verification and the production health check.

If any precondition fails, stop. The cleanup is not needed for the additive code
deployment and can remain staged until the retired columns have no consumers.

The SQL guard intentionally requires `assumed_business_name_status =
'unverified'`. If CardForge Studio later becomes `registered`, first retain the
documented verification for that registration, then update and re-review the SQL
guard as a separate controlled change. Do not silently broaden the current guard.
