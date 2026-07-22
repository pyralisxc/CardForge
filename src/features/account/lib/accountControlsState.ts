export type AccountControlsState = 'checking' | 'unavailable' | 'ready';

export const resolveAccountControlsState = ({
  authConfigured,
  isLoadingAccount,
}: {
  authConfigured: boolean;
  isLoadingAccount: boolean;
}): AccountControlsState => {
  if (isLoadingAccount) return 'checking';
  return authConfigured ? 'ready' : 'unavailable';
};
