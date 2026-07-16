import {
  buildContactRequestEmail,
  normalizeContactRequestInput,
  sendResendEmail,
} from '@/features/contact/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import {
  getOwnerConsolePayload,
  markContactRequestEmailResult,
  recordContactRequest,
} from '@/features/owner/server';
import {
  consumeRateLimit,
  getRequestClientAddress,
  RateLimitUnavailableError,
} from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.companyWebsite === 'string' && body.companyWebsite.trim()) {
      return createNoStoreJsonResponse({ ok: true });
    }
    const normalized = normalizeContactRequestInput(body);
    if (!normalized.ok) {
      return createApiErrorResponse(400, 'contact_request_invalid', normalized.message);
    }

    const clientAddress = getRequestClientAddress(request);
    const decisions = await Promise.all([
      consumeRateLimit({ action: 'contact-ip', identity: clientAddress, limit: 5, windowSeconds: 3600 }),
      consumeRateLimit({ action: 'contact-email', identity: normalized.value.email.toLowerCase(), limit: 10, windowSeconds: 86400 }),
    ]);
    if (decisions.some((decision) => !decision.allowed)) {
      return createApiErrorResponse(429, 'rate_limited', 'Too many contact requests. Please try again later.');
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
    if (error instanceof RateLimitUnavailableError) {
      return createApiErrorResponse(503, 'service_unavailable', error.message);
    }
    console.error('Failed to submit contact request:', error);
    return createApiErrorResponse(500, 'contact_request_failed', 'Unable to submit request.');
  }
}
