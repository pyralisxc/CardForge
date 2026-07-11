export type ContactRequestKind = 'support' | 'developer';

export interface ContactRequestInput {
  kind?: unknown;
  name?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
  pageUrl?: unknown;
}

export interface ContactRequest {
  kind: ContactRequestKind;
  name: string;
  email: string;
  subject: string;
  message: string;
  pageUrl: string;
}

export type ContactRequestInputResult =
  | { ok: true; value: ContactRequest }
  | { ok: false; message: string };

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

export interface SendResendEmailInput {
  apiKey: string;
  from: string;
  to: string;
  replyTo?: string | null;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
  fetcher?: typeof fetch;
}

export type SendResendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; message: string };

const normalizeText = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ').slice(0, maxLength) : '';

const normalizeMessage = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\r\n/g, '\n').slice(0, 4000) : '';

const normalizePageUrl = (value: unknown): string =>
  typeof value === 'string' && /^https?:\/\//i.test(value.trim()) ? value.trim().slice(0, 400) : '';

const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const normalizeContactRequestInput = (input: ContactRequestInput): ContactRequestInputResult => {
  const kind = input.kind === 'developer' ? 'developer' : 'support';
  const name = normalizeText(input.name, 120);
  const email = normalizeText(input.email, 254).toLowerCase();
  const subject = normalizeText(input.subject, 160);
  const message = normalizeMessage(input.message);
  const pageUrl = normalizePageUrl(input.pageUrl);

  if (!name || !isValidEmail(email) || !subject || !message) {
    return { ok: false, message: 'Name, valid email, subject, and message are required.' };
  }

  return {
    ok: true,
    value: {
      kind,
      name,
      email,
      subject,
      message,
      pageUrl,
    },
  };
};

export const buildContactRequestEmail = (request: ContactRequest): BuiltEmail => {
  const kindLabel = request.kind === 'developer' ? 'developer' : 'support';
  const subject = `[CardForge ${kindLabel}] ${request.subject}`;
  const pageLine = request.pageUrl ? `\nPage: ${request.pageUrl}` : '';
  const text = [
    `CardForge ${kindLabel} request`,
    `From: ${request.name} <${request.email}>${pageLine}`,
    '',
    request.message,
  ].join('\n');

  const html = `
    <main style="font-family:Arial,sans-serif;color:#1f2933;line-height:1.5">
      <h1>CardForge ${escapeHtml(kindLabel)} request</h1>
      <p><strong>From:</strong> ${escapeHtml(request.name)} &lt;${escapeHtml(request.email)}&gt;</p>
      ${request.pageUrl ? `<p><strong>Page:</strong> ${escapeHtml(request.pageUrl)}</p>` : ''}
      <p><strong>Subject:</strong> ${escapeHtml(request.subject)}</p>
      <hr />
      <p>${escapeHtml(request.message).replace(/\n/g, '<br />')}</p>
    </main>
  `.trim();

  return { subject, text, html };
};

export const sendResendEmail = async ({
  apiKey,
  from,
  to,
  replyTo,
  subject,
  text,
  html,
  idempotencyKey,
  fetcher = fetch,
}: SendResendEmailInput): Promise<SendResendEmailResult> => {
  if (!apiKey || !from || !to) {
    return { ok: false, message: 'Transactional email is not configured.' };
  }

  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to,
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      text,
      html,
    }),
  });

  const body = await response.json().catch(() => ({})) as { id?: string; message?: string; error?: string };
  if (!response.ok) {
    return { ok: false, message: body.message ?? body.error ?? 'Unable to send email.' };
  }

  return { ok: true, id: body.id ?? null };
};
