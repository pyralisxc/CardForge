import type { TemplateCardFormatSource } from '@/domain/card-formats';

/** Entry surfaces describe the task; the Design owner executes it. */
export type DesignToolIntent =
  | { kind: 'matching-back'; formatSource: TemplateCardFormatSource }
  | { kind: 'edit-back'; templateId: string }
  | { kind: 'manage-backs' };
