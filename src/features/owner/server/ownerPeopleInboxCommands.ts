import { AccountToolAccessError, getAccountToolAccessForUserId } from '@/features/account/server';
import { getContactRequests, getContactRequest, updateContactRequestStatus, ContactRequestStoreError, ownerInboxReadInput, ownerInboxReadOutput, ownerInboxStatusInput, ownerInboxStatusResult } from '@/features/contact/server';
import { getOwnerPeople, getOwnerPerson } from './ownerPeopleStore';
import { OwnerPeopleOperationError } from './ownerPeopleOperations';
import { ownerPeopleReadInput, ownerPeopleReadOutput } from '../lib/ownerPeopleReadContract';
import { recordOwnerActivity } from './ownerActivityStore';
async function owner(actorUserId: string) {
  const access = await getAccountToolAccessForUserId(actorUserId);
  if (!access.isOwner) throw new AccountToolAccessError('Owner access is required for private People and Inbox data.', 403);
  return access;
}
export async function readOwnerPeople(actorUserId: string, input: unknown) {
  await owner(actorUserId); const parsed = ownerPeopleReadInput.safeParse(input); if (!parsed.success) throw new OwnerPeopleOperationError('Choose exact user ID or supported directory filters.', 400, 'owner_person_invalid');
  try {
    if (parsed.data.userId) {
      const person = await getOwnerPerson(parsed.data.userId);
      if (!person) throw new OwnerPeopleOperationError('The exact account and retained profile were not found; no other person was substituted.', 404, 'owner_person_unavailable');
      return ownerPeopleReadOutput.parse({ person, page: null });
    }
    return ownerPeopleReadOutput.parse({ person: null, page: await getOwnerPeople(parsed.data) });
  } catch (error) {
    if (error instanceof OwnerPeopleOperationError) throw error;
    throw new OwnerPeopleOperationError('The private People directory or exact identity is unavailable; absence was not established.', 503, 'owner_people_unavailable');
  }
}
export async function readOwnerInbox(actorUserId: string, input: unknown) {
  await owner(actorUserId); const parsed = ownerInboxReadInput.safeParse(input); if (!parsed.success) throw new ContactRequestStoreError('Choose exact request ID or supported latest-window filters.', 400);
  if (parsed.data.requestId) {
    const request = await getContactRequest(parsed.data.requestId);
    if (!request) throw new ContactRequestStoreError('The exact contact request was not found.', 404);
    return ownerInboxReadOutput.parse({ request, window: null });
  }
  const requests = await getContactRequests(), { query = '', kind = 'all', status = 'open', page = 1, pageSize = 8 } = parsed.data;
  const filtered = requests.filter(request => (kind === 'all' || request.kind === kind) && (status === 'all' || (status === 'closed' ? request.status === 'closed' : request.status !== 'closed')) && [request.name,request.email,request.subject,request.message].some(value => value.toLowerCase().includes(query.trim().toLowerCase())));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize)), safePage = Math.min(page,totalPages);
  return ownerInboxReadOutput.parse({ request: null, window: { scope: 'latest_50', windowLimit: 50, windowCount: requests.length, filteredCount: filtered.length, page: safePage, pageSize, totalPages, items: filtered.slice((safePage-1)*pageSize,safePage*pageSize) } });
}
export async function saveOwnerInboxStatus(actorUserId: string, input: unknown) {
  const access = await owner(actorUserId), parsed = ownerInboxStatusInput.safeParse(input); if (!parsed.success) throw new ContactRequestStoreError('Choose exact request ID and received or closed status only.', 400);
  const { requestId, status } = parsed.data;
  try { await updateContactRequestStatus({ id: requestId, status }); }
  catch (error) {
    if (error instanceof ContactRequestStoreError && error.status < 500) throw error;
    return ownerInboxStatusResult.parse({ requestId, status, snapshot: null, receipt: { outcome: 'uncertain', committed: null, activityRecorded: null, readbackComplete: false, warnings: ['Inbox status outcome is unconfirmed. Read the exact request before any further write; do not replay automatically. Matching later state is not proof this operation committed.'], retryable: false, nextAction: 'read' } });
  }
  const warnings: string[] = []; let snapshot = null;
  try { snapshot = await getContactRequest(requestId); if (!snapshot) warnings.push('Status commit is confirmed; exact request readback is unavailable.'); else if (snapshot.status !== status) warnings.push('Current status differs from the acknowledged update; another update may have followed. Read current state rather than repeating this committed operation.'); } catch { warnings.push('Status commit is confirmed; exact request readback is unavailable.'); }
  let activityRecorded = false;
  try { activityRecorded = Boolean(await recordOwnerActivity({ actorUserId: access.user.id, actorEmail: access.email, action: 'inbox.status.update', targetType: 'contact_request', targetId: requestId, summary: `Marked a contact request ${status === 'closed' ? 'closed' : 'open'}.`, metadata: { status } })); } catch { /* Confirmed status ACK remains authoritative. */ }
  if (!activityRecorded) warnings.push('Inbox status committed; Owner activity is incomplete. Read current state rather than repeating the update.');
  return ownerInboxStatusResult.parse({ requestId, status, snapshot, receipt: { outcome: 'committed', committed: true, activityRecorded, readbackComplete: snapshot !== null, warnings, retryable: false, nextAction: warnings.length ? 'read' : 'none' } });
}
