import { ownerContactRequest } from '../model/ownerInboxContract';
import type { ContactRequest } from '@/features/contact/model/contactRequest';
import { isMissingSupabaseTableError } from '@/infrastructure/database/supabaseErrors';
import {
  getSupabaseServerClient,
  getSupabaseServerConfigStatus,
} from '@/infrastructure/database/supabaseServer';

type ContactRequestRow = {
  id: string;
  kind: ContactRequest['kind'];
  name: string;
  email: string;
  subject: string;
  message: string;
  page_url: string | null;
  status: ContactRequest['status'];
  resend_email_id: string | null;
  created_at: string;
};

const mapContactRequestRow = (row: ContactRequestRow): ContactRequest => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  email: row.email,
  subject: row.subject,
  message: row.message,
  pageUrl: row.page_url,
  status: row.status,
  resendEmailId: row.resend_email_id,
  createdAt: row.created_at,
});

export class ContactRequestStoreError extends Error {
  constructor(message: string, public readonly status: number = 503) { super(message); this.name = 'ContactRequestStoreError'; }
}
const CONTACT_COLUMNS = 'id,kind,name,email,subject,message,page_url,status,resend_email_id,created_at';
const validateContactRow = (value: unknown): ContactRequest => {
  if (!value || typeof value !== 'object') throw new ContactRequestStoreError('Contact request data could not be verified.');
  const parsed = ownerContactRequest.safeParse(mapContactRequestRow(value as ContactRequestRow));
  if (!parsed.success) throw new ContactRequestStoreError('Contact request data could not be verified.');
  return parsed.data;
};
const requireContactStore = () => {
  const db = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !db) throw new ContactRequestStoreError('Owner inbox storage is unavailable; no empty or absent result was established.');
  return db;
};
export const getContactRequests = async (): Promise<ContactRequest[]> => {
  const { data, error } = await requireContactStore().from('cardforge_contact_requests').select(CONTACT_COLUMNS).order('created_at', { ascending: false }).limit(50);
  if (error || !Array.isArray(data)) throw new ContactRequestStoreError('Owner inbox is unavailable; an empty window was not established.');
  return data.map(validateContactRow);
};
export const getContactRequest = async (id: string): Promise<ContactRequest | null> => {
  const { data, error } = await requireContactStore().from('cardforge_contact_requests').select(CONTACT_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new ContactRequestStoreError('Exact contact request is unavailable; absence was not established.');
  if (data === null) return null;
  const request = validateContactRow(data);
  if (request.id !== id) throw new ContactRequestStoreError('Exact contact identity could not be verified; no other request was substituted.');
  return request;
};

export const recordContactRequest = async ({
  kind,
  name,
  email,
  subject,
  message,
  pageUrl,
}: {
  kind: ContactRequest['kind'];
  name: string;
  email: string;
  subject: string;
  message: string;
  pageUrl: string;
}): Promise<string | null> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return null;

  const { data, error } = await supabase.from('cardforge_contact_requests').insert({
    kind,
    name,
    email,
    subject,
    message,
    page_url: pageUrl || null,
  }).select('id').single();

  if (error) {
    if (!isMissingSupabaseTableError(error)) {
      console.error('Failed to record contact request:', error);
    }
    return null;
  }

  return typeof data?.id === 'string' ? data.id : null;
};

export const markContactRequestEmailResult = async ({
  id,
  ok,
  resendEmailId,
}: {
  id: string | null;
  ok: boolean;
  resendEmailId?: string | null;
}): Promise<void> => {
  if (!id) return;
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return;

  const { error } = await supabase.from('cardforge_contact_requests').update({
    status: ok ? 'emailed' : 'email_failed',
    resend_email_id: resendEmailId ?? null,
  }).eq('id', id);

  if (error && !isMissingSupabaseTableError(error)) {
    console.error('Failed to update contact request email status:', error);
  }
};

export const updateContactRequestStatus = async ({ id, status }: { id: string; status: 'received' | 'closed' }): Promise<{ id: string; status: 'received' | 'closed' }> => {
  const { data, error } = await requireContactStore().from('cardforge_contact_requests').update({ status }).eq('id', id).select('id,status').limit(1);
  if (error) throw new ContactRequestStoreError('Contact status outcome is unconfirmed. Read the exact request before any further write.');
  if (!Array.isArray(data)) throw new ContactRequestStoreError('Contact status acknowledgement could not be verified.');
  if (data.length === 0) throw new ContactRequestStoreError('The exact contact request was not found.', 404);
  if (data.length !== 1 || data[0]?.id !== id || data[0]?.status !== status) throw new ContactRequestStoreError('Exact contact status acknowledgement could not be verified.');
  return { id, status };
};
