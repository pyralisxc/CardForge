export interface AccountDisplayInput {
  displayName?: string | null;
  email?: string | null;
}

export interface AccountAccessDisplayInput {
  isOwner: boolean;
  isContributor: boolean;
  accessExpiresAt: string | null;
  paidPlan: 'creator' | 'designer' | null;
  canExportClean: boolean;
}

export function formatAccountAccessExpiration(value: string | null, locale?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function getAccountAccessLabel(input: AccountAccessDisplayInput, locale?: string): string {
  if (input.isOwner) return 'Owner access';
  if (input.isContributor) return 'Contributor access';

  const expiration = formatAccountAccessExpiration(input.accessExpiresAt, locale);
  if (expiration) return `Creator Pass through ${expiration}`;
  if (input.paidPlan === 'designer') return 'Designer Pass';
  return input.canExportClean ? 'Creator Pass' : 'Free';
}

export function getAccountDisplayName({ displayName, email }: AccountDisplayInput): string | null {
  const cleanDisplayName = displayName?.trim();
  if (cleanDisplayName) {
    return cleanDisplayName.split(/\s+/)[0] ?? cleanDisplayName;
  }

  const cleanEmail = email?.trim();
  if (cleanEmail) {
    return cleanEmail.split('@')[0] || cleanEmail;
  }

  return null;
}

export function toPossessiveName(name: string): string {
  const cleanName = name.trim();
  return cleanName.endsWith('s') ? `${cleanName}'` : `${cleanName}'s`;
}

export function buildForgeTitle({
  displayName,
  email,
  tierLabel,
  isAnonymous,
  isSetupIncomplete,
}: AccountDisplayInput & {
  tierLabel: string;
  isAnonymous: boolean;
  isSetupIncomplete: boolean;
}): string {
  if (isSetupIncomplete) return 'Connect Clerk to enable accounts';
  if (isAnonymous) return 'Your CardForge account';

  const name = getAccountDisplayName({ displayName, email });
  if (!name) return `Your account: ${tierLabel}`;

  return `${toPossessiveName(name)} account: ${tierLabel}`;
}
