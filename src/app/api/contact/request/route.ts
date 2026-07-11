import {
  buildContactRequestEmail,
  normalizeContactRequestInput,
  sendResendEmail,
} from '@/lib/emailOperations';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';
import {
  getOwnerConsolePayload,
  markContactRequestEmailResult,
  recordContactRequest,
} from '@/lib/ownerConsoleStore';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const normalized = normalizeContactRequestInput(await request.json());
    if (!normalized.ok) {
      return createApiErrorResponse(400, 'contact_request_invalid', normalized.message);
    }

    const payload = await getOwnerConsolePayload();
    const supportEmail = payload.settings.supportEmail;
    const requestId = await recordContactRequest(normalized.value);

    const built = buildContactRequestEmail(normalized.value);
    const emailResult = await sendResendEmail({
      apiKey: process.env.RESEND_API_KEY ?? '',
      from: process.env.CARDFORGE_EMAIL_FROM ?? '',
      to: supportEmail,
      replyTo: normalized.value.email,
      subject: built.subject,
      text: built.text,
      html: built.html,
      idempotencyKey: requestId ? `contact-${requestId}` : `contact-${Date.now()}`,
    });

    await markContactRequestEmailResult({
      id: requestId,
      ok: emailResult.ok,
      resendEmailId: emailResult.ok ? emailResult.id : null,
    });

    if (!emailResult.ok) {
      return createApiErrorResponse(503, 'contact_request_failed', emailResult.message);
    }

    return createNoStoreJsonResponse({ ok: true, requestId, emailId: emailResult.id });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    console.error('Failed to submit contact request:', error);
    return createApiErrorResponse(500, 'contact_request_failed', 'Unable to submit request.');
  }
}
