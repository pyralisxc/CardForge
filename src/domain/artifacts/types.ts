import type { StoredDisplayCard } from '@/domain/cards';

/**
 * Generic Set membership metadata shared by every authored-object type.
 * The type parameter keeps specializations discriminated without making the
 * current public creator promise support for an unshipped Artifact type.
 */
export interface ArtifactMetadata<TType extends string = string> {
  artifactId: string;
  artifactType: TType;
  setId: string;
}

export type ArtifactType = CardArtifact['artifactType'];
export type ArtifactIdentity = ArtifactMetadata<ArtifactType>;

export interface CardArtifact extends ArtifactMetadata<'card'> {
  artifactType: 'card';
  card: StoredDisplayCard;
}

/**
 * The internal authored-object seam. Cards are the first shipped
 * specialization; future Artifact types add another discriminated member
 * instead of optional fields to this card contract.
 */
export type AuthoredArtifact = CardArtifact;

export interface ArtifactPosition {
  x: number;
  y: number;
}
