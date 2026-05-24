export interface AccountDisplayInput {
  displayName?: string | null;
  email?: string | null;
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
  if (isSetupIncomplete) return 'Connect Clerk to test accounts';
  if (isAnonymous) return 'Your Forge is ready';

  const name = getAccountDisplayName({ displayName, email });
  if (!name) return `Your Forge: ${tierLabel}`;

  return `${toPossessiveName(name)} Forge: ${tierLabel}`;
}
