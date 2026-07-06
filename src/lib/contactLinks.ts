import { DEFAULT_OWNER_SETTINGS } from '@/lib/ownerConsole';

const normalizeRecipient = (recipient: string | null | undefined): string =>
  recipient?.trim() || DEFAULT_OWNER_SETTINGS.supportEmail;

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

export const createDeveloperRequestMailto = ({
  accountEmail,
  supportEmail,
}: {
  accountEmail: string | null;
  supportEmail?: string | null;
}) => createSupportMailto({
  recipient: supportEmail,
  subject: 'CardForge developer program request',
  lines: [
    'CardForge developer program request',
    '',
    `Account email: ${accountEmail ?? ''}`,
    'Portfolio or asset examples:',
    '',
    'Asset types I want to contribute:',
    '',
    'Notes:',
  ],
});

export const createRoadmapDeveloperRequestMailto = ({
  accountEmail,
  supportEmail,
}: {
  accountEmail: string | null;
  supportEmail?: string | null;
}) => createSupportMailto({
  recipient: supportEmail,
  subject: 'CardForge developer account request',
  lines: [
    'CardForge developer account request',
    '',
    `Account email: ${accountEmail ?? ''}`,
    'Reason for developer access:',
    '',
    'What I want to help test or build:',
    '',
    'Relevant links or notes:',
  ],
});
