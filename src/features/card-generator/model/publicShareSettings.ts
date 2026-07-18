export interface PublicShareSettings {
  message: string;
  homepageUrl: string;
  cameronUrl: string;
}

export const createPublicShareSettings = (
  message: string,
  siteUrl: string,
): PublicShareSettings => ({
  message,
  homepageUrl: new URL('/', siteUrl).toString(),
  cameronUrl: new URL('/cameron', siteUrl).toString(),
});
