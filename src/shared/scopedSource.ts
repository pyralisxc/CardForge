import type { BoundaryFailureKind } from './boundaryFailure';

/**
 * A source-owned read snapshot. This is deliberately a small lifecycle helper,
 * not a cache or synchronisation owner: Drive, local folders, Pipeline, and
 * Studio drafts continue to own their own reads and identities.
 */
export type ScopedSourcePhase =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'unavailable'
  | 'permission-required'
  | 'expired'
  | 'incomplete';

export interface ScopedSourceSnapshot<Scope, Value, Failure = never> {
  scope: Scope;
  value: Value | null;
  phase: ScopedSourcePhase;
  failure: Failure | null;
}

export const sourcePhaseForFailure = (kind: BoundaryFailureKind): ScopedSourcePhase => {
  if (kind === 'authentication') return 'expired';
  if (kind === 'authorization') return 'permission-required';
  return 'unavailable';
};

/** Permission/identity denials are authoritative and must evict protected data. */
export const mustClearScopedSourceForFailure = (kind: BoundaryFailureKind): boolean => (
  kind === 'authentication' || kind === 'authorization' || kind === 'not_found'
);

export const beginScopedSource = <Scope, Value, Failure>(
  current: ScopedSourceSnapshot<Scope, Value, Failure> | null,
  scope: Scope,
): ScopedSourceSnapshot<Scope, Value, Failure> => ({
  scope,
  value: current?.scope === scope ? current.value : null,
  phase: 'loading',
  failure: null,
});

export const settleScopedSourceValue = <Scope, Value, Failure>(
  scope: Scope,
  value: Value | null,
  options: { empty?: boolean; incomplete?: boolean } = {},
): ScopedSourceSnapshot<Scope, Value, Failure> => ({
  scope,
  value,
  phase: options.incomplete ? 'incomplete' : options.empty ? 'empty' : 'ready',
  failure: null,
});

export const settleScopedSourceFailure = <Scope, Value, Failure extends { kind: BoundaryFailureKind }>(
  current: ScopedSourceSnapshot<Scope, Value, Failure> | null,
  scope: Scope,
  failure: Failure,
): ScopedSourceSnapshot<Scope, Value, Failure> => ({
  scope,
  value: mustClearScopedSourceForFailure(failure.kind)
    ? null
    : current?.scope === scope ? current.value : null,
  phase: sourcePhaseForFailure(failure.kind),
  failure,
});
