import { describe, expect, it, vi } from 'vitest';

import {
  buildContactRequestEmail,
  normalizeContactRequestInput,
  sendResendEmail,
} from '@/features/contact/lib/emailOperations';

describe('email operations', () => {
  it('normalizes public contact and developer request payloads', () => {
    expect(normalizeContactRequestInput({
      kind: 'developer',
      name: '  Ada  ',
      email: '  ada@example.test ',
      subject: '  Developer access ',
      message: ' I want to submit fonts. ',
      pageUrl: 'https://cardforge.example/developer',
    })).toEqual({
      ok: true,
      value: {
        kind: 'developer',
        name: 'Ada',
        email: 'ada@example.test',
        subject: 'Developer access',
        message: 'I want to submit fonts.',
        pageUrl: 'https://cardforge.example/developer',
      },
    });
  });

  it('rejects invalid contact request payloads before sending mail', () => {
    expect(normalizeContactRequestInput({
      kind: 'support',
      name: '',
      email: 'not-email',
      subject: '',
      message: '',
    })).toEqual({
      ok: false,
      message: 'Name, valid email, subject, and message are required.',
    });
  });

  it('builds owner-facing request email content without exposing secrets', () => {
    const email = buildContactRequestEmail({
      kind: 'support',
      name: 'Ada',
      email: 'ada@example.test',
      subject: 'Export help',
      message: 'The PDF export needs a look.',
      pageUrl: 'https://cardforge.example/account',
    });

    expect(email.subject).toBe('[CardForge support] Export help');
    expect(email.text).toContain('From: Ada <ada@example.test>');
    expect(email.text).toContain('Page: https://cardforge.example/account');
    expect(email.html).toContain('The PDF export needs a look.');
    expect(email.html).not.toContain('RESEND_API_KEY');
  });

  it('sends mail through Resend with a deterministic idempotency key', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ id: 'email_123' }), { status: 200 }));

    const result = await sendResendEmail({
      apiKey: 're_test',
      from: 'CardForge <support@example.test>',
      to: 'owner@example.test',
      replyTo: 'sender@example.test',
      subject: 'Hello',
      text: 'Plain',
      html: '<p>Plain</p>',
      idempotencyKey: 'contact-123',
      fetcher,
    });

    expect(result).toEqual({ ok: true, id: 'email_123' });
    expect(fetcher).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer re_test',
        'Idempotency-Key': 'contact-123',
      }),
      body: JSON.stringify({
        from: 'CardForge <support@example.test>',
        to: 'owner@example.test',
        reply_to: 'sender@example.test',
        subject: 'Hello',
        text: 'Plain',
        html: '<p>Plain</p>',
      }),
    }));
  });
});
