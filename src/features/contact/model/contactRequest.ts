export interface ContactRequest {
  id: string;
  kind: 'support' | 'developer' | 'business';
  name: string;
  email: string;
  subject: string;
  message: string;
  pageUrl: string | null;
  status: 'received' | 'emailed' | 'email_failed' | 'closed';
  resendEmailId: string | null;
  createdAt: string;
}
