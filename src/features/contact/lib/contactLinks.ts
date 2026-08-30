import { DEFAULT_BUSINESS_IDENTITY } from '@/features/business-identity/client';

const normalizeRecipient = (recipient: string | null | undefined): string =>
  recipient?.trim() || DEFAULT_BUSINESS_IDENTITY.supportEmail;

export const createSupportMailto = ({
  recipient,
  subject,
  lines,
}: {
  recipient?: string | null;
  subject: string;
  lines: string[];
}) => {
  const body = lines.join('\n');
  return `mailto:${normalizeRecipient(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

export const createContributorRequestMailto = ({
  accountEmail,
  supportEmail,
}: {
  accountEmail: string | null;
  supportEmail?: string | null;
}) => createSupportMailto({
  recipient: supportEmail,
  subject: 'CardForge Contributor program request',
  lines: [
    'CardForge Contributor program request',
    '',
    `Account email: ${accountEmail ?? ''}`,
    'Portfolio or asset examples:',
    '',
    'Asset types I want to contribute:',
    '',
    'Notes:',
  ],
});

export const createRoadmapFeedbackMailto = ({
  accountEmail,
  supportEmail,
}: {
  accountEmail: string | null;
  supportEmail?: string | null;
}) => createSupportMailto({
  recipient: supportEmail,
  subject: 'CardForge roadmap feedback',
  lines: [
    'CardForge roadmap feedback',
    '',
    `Account email: ${accountEmail ?? ''}`,
    'Page or workflow:',
    '',
    'What should improve:',
    '',
    'Why it matters:',
  ],
});
