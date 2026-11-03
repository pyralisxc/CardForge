import { revalidatePath } from 'next/cache';
import { AccountToolAccessError, getAccountToolAccessForUserId } from '@/features/account/server';
import { fetchContributorSettings, commitPipelineProgramSettings, getPipelineProgramView, getPipelineContributorIds, getOwnerStudioRoutingPage, getOwnerStudioRoutingAsset, updateOwnerStudioRouting, revalidateCardForgeCatalog, PipelineStoreError, PipelineRegistryCommandError, pipelineSettingsReadInput, pipelineSettingsSaveInput, pipelineSettingsSnapshot, routingReadInput, routingSaveInput, routingItem, routingReadOutput, configurationReceipt } from '@/features/pipeline/server';
import { recordOwnerActivity } from './ownerActivityStore';
async function owner(actorUserId: string) {
  const access = await getAccountToolAccessForUserId(actorUserId);
  if (!access.isOwner) throw new AccountToolAccessError('Owner access is required for Pipeline configuration.', 403);
  return access;
}
const invalid = () => new PipelineRegistryCommandError('Provide one complete supported Pipeline configuration request; no CAS or operation key is accepted.', 400);
const isRejected = (error: unknown) => (error instanceof PipelineStoreError || error instanceof PipelineRegistryCommandError) && error.status < 500;
const uncertain = () => configurationReceipt.parse({ outcome: 'uncertain', committed: null, activityRecorded: null, refreshComplete: false, refreshFailures: [], warnings: ['The native configuration outcome is unconfirmed. Read exact current settings or the exact routing asset before any further write; do not replay automatically. Matching observed state is not proof this operation committed.'], retryable: false, nextAction: 'read' });
const completed = (failures: string[], activityRecorded: boolean) => configurationReceipt.parse({ outcome: 'committed', committed: true, activityRecorded, refreshComplete: failures.length === 0, refreshFailures: failures, warnings: failures.length || !activityRecorded ? ['Native configuration commit is confirmed; refresh/readback or audit activity is incomplete. Read current state rather than repeating the committed save.'] : [], retryable: false, nextAction: failures.length || !activityRecorded ? 'read' : 'none' });
export async function getOwnerPipelineProgramSettings(actorUserId: string, input: unknown) {
  await owner(actorUserId); if (!pipelineSettingsReadInput.safeParse(input).success) throw invalid();
  // configured:false explicitly denotes defaults, never observed persisted settings.
  return pipelineSettingsSnapshot.parse(await fetchContributorSettings());
}
export async function saveOwnerPipelineProgramSettings(actorUserId: string, input: unknown, options: { includeProgram?: boolean } = {}) {
  const access = await owner(actorUserId), parsed = pipelineSettingsSaveInput.safeParse(input); if (!parsed.success) throw invalid();
  try {
    // This existing native transaction saves rules AND performs a global governed rebalance.
    // Its integer acknowledgement may be zero; it is not a publication count or caller version.
    await commitPipelineProgramSettings(parsed.data.settings, access.user.id);
  } catch (error) { if (isRejected(error)) throw error; return { snapshot: null, program: null, receipt: uncertain() }; }
  const failures: string[] = []; let snapshot = null, program = null;
  try { if (!revalidateCardForgeCatalog()) failures.push('catalog_cache'); } catch { failures.push('catalog_cache'); }
  try { snapshot = pipelineSettingsSnapshot.parse(await fetchContributorSettings()); if (!snapshot.configured) failures.push('settings_not_observed'); } catch { failures.push('settings_readback'); }
  if (options.includeProgram) { try { program = await getPipelineProgramView(access.user.id, getPipelineContributorIds(access.user.id), { includeRegistryRecipePayloads: true }); } catch { failures.push('program_refresh'); } }
  let activityRecorded = false;
  try { activityRecorded = Boolean(await recordOwnerActivity({ actorUserId: access.user.id, actorEmail: access.email, action: 'pipeline.program-settings.update', targetType: 'contributor_program_settings', targetId: 'default', summary: 'Saved Contributor Pipeline rules and ran the governed global rebalance. Existing policy may change status, access, vote-driven Trash and registry publication; no enrollment or security grant was performed.' })); } catch { /* Native commit remains confirmed. */ }
  return { snapshot, program, receipt: completed(failures, activityRecorded) };
}
export async function getOwnerPipelineStudioRouting(actorUserId: string, input: unknown) {
  await owner(actorUserId); const parsed = routingReadInput.safeParse(input); if (!parsed.success) throw invalid();
  return routingReadOutput.parse(parsed.data.assetId ? { asset: await getOwnerStudioRoutingAsset(parsed.data.assetId), page: null } : { asset: null, page: await getOwnerStudioRoutingPage(parsed.data) });
}
export async function saveOwnerPipelineStudioRouting(actorUserId: string, input: unknown) {
  const access = await owner(actorUserId), parsed = routingSaveInput.safeParse(input); if (!parsed.success) throw invalid(); const value = parsed.data;
  try { await updateOwnerStudioRouting(value); }
  catch (error) { if (isRejected(error)) throw error; return { assetId: value.assetId, snapshot: null, receipt: uncertain() }; }
  const failures: string[] = []; let snapshot = null;
  try { if (!revalidateCardForgeCatalog()) failures.push('catalog_cache'); } catch { failures.push('catalog_cache'); }
  try { revalidatePath('/studio'); } catch { failures.push('studio_path'); }
  try { snapshot = routingItem.parse(await getOwnerStudioRoutingAsset(value.assetId)); } catch { failures.push('exact_asset_readback'); }
  let activityRecorded = false;
  try { activityRecorded = Boolean(await recordOwnerActivity({ actorUserId: access.user.id, actorEmail: access.email, action: 'pipeline.studio-routing.update', targetType: 'asset_registry', targetId: value.assetId, summary: value.mode === 'automatic' ? 'Restored automatic Studio placement for a Pipeline asset.' : 'Updated owner-controlled Studio placement for a Pipeline asset. No content approval or publication was performed.' })); } catch { /* Native commit remains confirmed. */ }
  return { assetId: value.assetId, snapshot, receipt: completed(failures, activityRecorded) };
}
