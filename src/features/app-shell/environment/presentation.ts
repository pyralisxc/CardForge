import type { LucideIcon } from 'lucide-react';

import type { ActionSourceContext } from './model';

export type EnvironmentStatusTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface EnvironmentDetailRecord {
  id: string;
  kind: string;
  eyebrow: string;
  title: string;
  summary: string;
  status: string;
  tone: EnvironmentStatusTone;
  actionSources: readonly ActionSourceContext[];
  meta: ReadonlyArray<readonly [string, string]>;
}

export interface EnvironmentCollectionRecord extends EnvironmentDetailRecord {
  location: string;
  updated: string;
  icon: LucideIcon;
}

export interface EnvironmentSettingRecord extends EnvironmentDetailRecord {
  value: string;
  icon: LucideIcon;
}
