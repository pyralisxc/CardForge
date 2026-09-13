import type { CardFace } from '@/domain/cards';
import type { TemplateCardFormatSource } from '@/domain/card-formats';

export type DesignToolIntent =
  | { kind: 'matching-back'; formatSource: TemplateCardFormatSource }
  | { kind: 'edit-back'; templateId: string }
  | { kind: 'manage-backs' }
  | { kind: 'artifact-design'; artifactIds: string[]; face: CardFace };
