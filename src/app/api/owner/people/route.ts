import {
  deleteOwnerPerson,
  getOwnerPeopleForCurrentOwner,
  ownerPeopleErrorFromUnknown,
  updateOwnerPerson,
} from '@/features/owner/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

const readPage = (value: string | null, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : fallback;
};

const ownerPeopleErrorResponse = (error: unknown) => {
  const known = ownerPeopleErrorFromUnknown(error);
  return known
    ? createApiErrorResponse(known.status, known.code, known.message)
    : null;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedFilter = url.searchParams.get('filter');
    const filter = requestedFilter === 'contributors' || requestedFilter === 'active' || requestedFilter === 'needs_attention'
      ? requestedFilter
      : 'all';
    const people = await getOwnerPeopleForCurrentOwner({
      query: url.searchParams.get('query') ?? '',
      filter,
      page: readPage(url.searchParams.get('page'), 1),
      pageSize: readPage(url.searchParams.get('pageSize'), 12),
    });
    return createNoStoreJsonResponse({ people });
  } catch (error) {
    const response = ownerPeopleErrorResponse(error);
    if (response) return response;
    console.error('Failed to load owner people directory:', error);
    return createApiErrorResponse(500, 'owner_people_unavailable', 'Unable to load people and contributor access.');
  }
}

export async function PATCH(request: Request) {
  try {
    const result = await updateOwnerPerson(await request.json());
    return createNoStoreJsonResponse(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    const response = ownerPeopleErrorResponse(error);
    if (response) return response;
    console.error('Failed to update owner person:', error);
    return createApiErrorResponse(500, 'owner_people_unavailable', 'Unable to update account and contributor access.');
  }
}

export async function DELETE(request: Request) {
  try {
    const result = await deleteOwnerPerson(await request.json());
    return createNoStoreJsonResponse(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    const response = ownerPeopleErrorResponse(error);
    if (response) return response;
    console.error('Failed to delete owner-managed account:', error);
    return createApiErrorResponse(500, 'owner_people_unavailable', 'Unable to delete this account.');
  }
}
