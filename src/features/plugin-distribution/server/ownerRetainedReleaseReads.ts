import { AccountToolAccessError, getAccountToolAccessForUserId } from '@/features/account/server';
import {
  retainedPluginExactInput, retainedPluginHistory, retainedPluginScope,
  retainedPluginVerification, RetainedReleaseReadError,
} from '../model/retainedReleaseReadContract';
import { createRetainedReleaseStore } from './retainedReleaseStore';
import {
  endpointForRetainedRelease, findExactRetainedRelease, listRetainedReleases,
  readRetainedRelease, toRetainedReleaseMetadata,
} from './retainedReleaseCommands';

async function requireOwner(actorUserId: string) {
  const access = await getAccountToolAccessForUserId(actorUserId);
  if (!access.isOwner) throw new AccountToolAccessError('Owner access is required for retained plugin inspection.', 403);
}

export async function listOwnerRetainedPluginReleases(actorUserId: string, input: unknown) {
  await requireOwner(actorUserId);
  const parsed = retainedPluginScope.safeParse(input);
  if (!parsed.success) throw new RetainedReleaseReadError('Select an exact plugin product and environment.', 400);
  try {
    const { product, environment } = parsed.data;
    const rows = await listRetainedReleases(createRetainedReleaseStore(), product, environment);
    return retainedPluginHistory.parse({ product, environment, releases: rows.map(toRetainedReleaseMetadata), verification: 'metadata_only' });
  } catch {
    throw new RetainedReleaseReadError('Retained plugin history is unavailable or invalid; an empty history was not established.');
  }
}

export async function verifyOwnerRetainedPluginRelease(actorUserId: string, input: unknown) {
  await requireOwner(actorUserId);
  const parsed = retainedPluginExactInput.safeParse(input);
  if (!parsed.success) throw new RetainedReleaseReadError('Select exact product, environment, version and checksum.', 400);
  try {
    const { product, environment, version, checksum } = parsed.data;
    const store = createRetainedReleaseStore();
    const record = await findExactRetainedRelease(store, product, environment, version, checksum);
    await readRetainedRelease(store, record, endpointForRetainedRelease(product, environment));
    return retainedPluginVerification.parse({ release: toRetainedReleaseMetadata(record), verification: 'verified_original_stored_zip' });
  } catch (error) {
    if (error instanceof RetainedReleaseReadError && error.status === 404) throw error;
    // Storage failure, missing object and failed integrity are not interchangeable evidence.
    throw new RetainedReleaseReadError('The selected original stored ZIP could not be verified. Its availability or integrity is unconfirmed; no historical package was rebuilt.');
  }
}
