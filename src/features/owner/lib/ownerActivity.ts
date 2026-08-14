export type OwnerActivityOutcome = 'succeeded' | 'partial' | 'failed';

export interface OwnerActivityEvent {
  id: string;
  actorUserId: string;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  outcome: OwnerActivityOutcome;
  metadata: Record<string, unknown>;
  createdAt: string;
}
