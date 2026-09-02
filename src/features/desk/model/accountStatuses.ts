import type { DeskAccountStatus } from './desk';

interface AccountStatusProjection {
  driveConnection?: { connected: boolean } | null;
  failures: readonly { id: string }[];
  loadingSources: boolean;
  sourceCounts: ReadonlyMap<string, number>;
}

interface DeskAccountStatusesOptions {
  accessStatus?: DeskAccountStatus;
  isSignedIn: boolean;
  projection: AccountStatusProjection;
  securityStatus?: DeskAccountStatus;
}

export function createDeskAccountStatuses({
  accessStatus,
  isSignedIn,
  projection,
  securityStatus,
}: DeskAccountStatusesOptions): DeskAccountStatus[] {
  return [
    ...(accessStatus ? [accessStatus] : []),
    {
      label: 'Storage',
      value: projection.failures.some((failure) => failure.id === 'workspace') ? 'Device unavailable' : 'Work available',
      detail: `${projection.sourceCounts.get('device') ?? 0} on this device`,
      href: '/account?section=library&tool=locations',
      action: 'Review',
    },
    {
      label: 'Connections',
      value: !isSignedIn
        ? 'Sign in to connect'
        : projection.loadingSources
          ? 'Checking'
          : projection.driveConnection?.connected
            ? 'Drive connected'
            : 'Not connected',
      detail: `${projection.sourceCounts.get('google-drive') ?? 0} connected work item${(projection.sourceCounts.get('google-drive') ?? 0) === 1 ? '' : 's'}`,
      href: '/account?section=library&tool=locations',
      action: 'Manage',
    },
    ...(securityStatus ? [securityStatus] : []),
  ];
}
