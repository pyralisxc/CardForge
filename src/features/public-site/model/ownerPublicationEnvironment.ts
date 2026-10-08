export type OwnerPublicationEnvironment = 'production' | 'preview' | 'development';

export interface OwnerPublicationPresentation {
  badgeLabel: string;
  dialogDescription: string;
  publishActionLabel: string;
  publishingActionLabel: string;
  publishedTitle: string;
  publishedDescription: (label: string) => string;
}

export const resolveOwnerPublicationEnvironment = (
  vercelEnv?: string | null,
): OwnerPublicationEnvironment => {
  if (vercelEnv === 'production') return 'production';
  if (vercelEnv === 'preview') return 'preview';
  return 'development';
};

export const getOwnerPublicationPresentation = (
  environment: OwnerPublicationEnvironment,
): OwnerPublicationPresentation => {
  if (environment === 'production') {
    return {
      badgeLabel: 'Production — publishes live',
      dialogDescription: 'Only server-confirmed Owners receive these controls. Publishing updates the live CardForge public site through the canonical Owner state.',
      publishActionLabel: 'Publish live',
      publishingActionLabel: 'Publishing live…',
      publishedTitle: 'Published live',
      publishedDescription: (label) => `${label} is live on CardForge without a code deploy.`,
    };
  }
  if (environment === 'preview') {
    return {
      badgeLabel: 'Preview — staging only',
      dialogDescription: 'Only server-confirmed Owners receive these controls. Publishing here updates CardForge Preview/staging only and does not change production.',
      publishActionLabel: 'Publish to Preview',
      publishingActionLabel: 'Publishing to Preview…',
      publishedTitle: 'Published to Preview',
      publishedDescription: (label) => `${label} is published to Preview/staging only; production is unchanged.`,
    };
  }
  return {
    badgeLabel: 'Development — local only',
    dialogDescription: 'Only server-confirmed Owners receive these controls. Publishing here updates the local/development environment only.',
    publishActionLabel: 'Publish locally',
    publishingActionLabel: 'Publishing locally…',
    publishedTitle: 'Published locally',
    publishedDescription: (label) => `${label} is published to the local/development environment only.`,
  };
};