export type StudioReturnTarget = {
  href: string;
  label: 'Set' | 'Library' | 'Desk';
  ariaLabel: string;
};

type StudioHrefOptions = {
  documentId?: string | null;
  revision?: string | number | null;
  returnTo?: string | null;
  tool?: 'output' | null;
};

type ContextualStudioHrefOptions = Pick<StudioHrefOptions, 'documentId' | 'revision' | 'returnTo'>;

const MAX_RETURN_PATH_LENGTH = 600;

export const normalizeStudioReturnTo = (value: string | null | undefined): string | null => {
  if (!value || value.length > MAX_RETURN_PATH_LENGTH || !value.startsWith('/account')) return null;
  try {
    const parsed = new URL(value, 'https://cardforge.local');
    if (parsed.origin !== 'https://cardforge.local' || parsed.pathname !== '/account') return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

export const createDeskReturnHref = (workId: string, returnContext?: string | null): string => {
  const params = new URLSearchParams({ focus: workId });
  if (returnContext) params.set('returnContext', returnContext);
  return `/account?${params.toString()}`;
};

export const createLibraryReturnHref = (scope: string = 'personal', returnContext?: string | null): string => {
  const params = new URLSearchParams({ section: 'library', scope });
  if (returnContext) params.set('returnContext', returnContext);
  return `/account?${params.toString()}`;
};

export const createStudioHref = ({ documentId, revision, returnTo, tool }: StudioHrefOptions = {}): string => {
  const params = new URLSearchParams();
  if (documentId) params.set('document', documentId);
  if (revision !== null && revision !== undefined && String(revision)) params.set('revision', String(revision));
  if (tool) params.set('tool', tool);
  const safeReturnTo = normalizeStudioReturnTo(returnTo);
  if (safeReturnTo) params.set('returnTo', safeReturnTo);
  const query = params.toString();
  return query ? `/studio?${query}` : '/studio';
};

export const createContextualStudioHref = ({
  documentId,
  revision,
  returnTo,
}: ContextualStudioHrefOptions = {}): string => {
  const params = new URLSearchParams({ tool: 'design' });
  if (documentId) params.set('document', documentId);
  if (revision !== null && revision !== undefined && String(revision)) params.set('revision', String(revision));
  const safeReturnTo = normalizeStudioReturnTo(returnTo);
  if (safeReturnTo) params.set('returnTo', safeReturnTo);
  return `/account?${params.toString()}`;
};

export const resolveStudioReturnTarget = ({
  activeSetId,
  activeSetName,
  requestedReturnTo,
}: {
  activeSetId: string;
  activeSetName: string;
  requestedReturnTo?: string | null;
}): StudioReturnTarget => {
  const safeReturnTo = normalizeStudioReturnTo(requestedReturnTo);
  if (safeReturnTo) {
    const params = new URL(safeReturnTo, 'https://cardforge.local').searchParams;
    if (params.get('section') === 'library') {
      const scope = params.get('scope');
      const scopeLabel = scope ? `${scope.charAt(0).toUpperCase()}${scope.slice(1)} Library` : 'Library';
      return { href: safeReturnTo, label: 'Library', ariaLabel: `Back to ${scopeLabel}` };
    }
    if (params.has('focus')) {
      return { href: safeReturnTo, label: 'Set', ariaLabel: `Back to ${activeSetName}` };
    }
    return { href: safeReturnTo, label: 'Desk', ariaLabel: 'Back to Desk' };
  }

  return {
    href: createDeskReturnHref(`set:${activeSetId}`),
    label: 'Set',
    ariaLabel: `Back to ${activeSetName}`,
  };
};
