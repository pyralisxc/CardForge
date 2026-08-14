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

export const getContactRequests = async (): Promise<ContactRequest[]> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return [];

  const { data, error } = await supabase
    .from('cardforge_contact_requests')
    .select('id,kind,name,email,subject,message,page_url,status,resend_email_id,created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    if (!isMissingSupabaseTableError(error)) {
      console.error('Failed to load contact requests:', error);
    }
    return [];
  }

  return (data ?? []).map((row) => mapContactRequestRow(row as ContactRequestRow));
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

export const updateContactRequestStatus = async ({
  id,
  status,
}: {
  id: string;
  status: 'received' | 'closed';
}): Promise<void> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    throw new Error('Contact request storage is not configured.');
  }
  const { data, error } = await supabase
    .from('cardforge_contact_requests')
    .update({ status })
    .eq('id', id)
    .select('id')
    .limit(1);
  if (error) {
    console.error('Failed to update contact request status:', error);
    throw new Error('Unable to update this contact request.');
  }
  if (!data?.[0]) throw new Error('Contact request not found.');
};
