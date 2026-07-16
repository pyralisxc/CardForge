import { buildContactRequestEmail, sendResendEmail } from '@/features/contact/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getOwnerConsolePayload } from '@/features/owner/server';
import { getCurrentOwnerAccess } from '@/features/owner/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner) {
    return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
  }

  const payload = await getOwnerConsolePayload();
  const to = payload.settings.supportEmail || owner.email || process.env.CARDFORGE_EMAIL_REPLY_TO || '';
  const built = buildContactRequestEmail({
    kind: 'support',
    name: 'CardForge Owner Console',
    email: process.env.CARDFORGE_EMAIL_REPLY_TO || to,
    subject: 'Transactional email test',
    message: 'This confirms CardForge can send transactional email through the configured Resend route.',
    pageUrl: payload.settings.websiteUrl,
  });

  const result = await sendResendEmail({
    apiKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.CARDFORGE_EMAIL_FROM ?? '',
    to,
    replyTo: process.env.CARDFORGE_EMAIL_REPLY_TO || owner.email,
    subject: built.subject,
    text: built.text,
    html: built.html,
    idempotencyKey: `owner-test-${Date.now()}`,
  });

  if (!result.ok) {
    return createApiErrorResponse(503, 'owner_email_unavailable', result.message);
  }

  return createNoStoreJsonResponse({ ok: true, emailId: result.id, to });
}
