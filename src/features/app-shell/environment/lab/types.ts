import type { LucideIcon } from 'lucide-react';
import type { EnvironmentCollectionRecord, EnvironmentDetailRecord, EnvironmentSettingRecord, EnvironmentStatusTone } from '../presentation';

export type RecipeId = 'home' | 'collection' | 'profile' | 'queue' | 'studio';
export type StatusTone = EnvironmentStatusTone;
export type DetailRecord = EnvironmentDetailRecord;

export type CollectionItem = EnvironmentCollectionRecord;

export type SettingItem = EnvironmentSettingRecord;

export interface QueueItem extends DetailRecord {
  owner: string;
  updated: string;
  nextAction: string;
  permission: 'developer' | 'owner';
}

export interface StudioArtifact extends DetailRecord {
  icon: LucideIcon;
  imageSrc?: string;
}
