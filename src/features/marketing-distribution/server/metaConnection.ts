import { encryptMarketingToken } from './marketingTokenCrypto';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';

const META_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
] as const;

export const getMetaConfiguration = () => {
  const required = {
    CARDFORGE_META_APP_ID: process.env.CARDFORGE_META_APP_ID,
    CARDFORGE_META_APP_SECRET: process.env.CARDFORGE_META_APP_SECRET,
    CARDFORGE_META_LOGIN_CONFIGURATION_ID: process.env.CARDFORGE_META_LOGIN_CONFIGURATION_ID,
    CARDFORGE_META_GRAPH_API_VERSION: process.env.CARDFORGE_META_GRAPH_API_VERSION,
    CARDFORGE_SOCIAL_TOKEN_ENCRYPTION_KEY: process.env.CARDFORGE_SOCIAL_TOKEN_ENCRYPTION_KEY,
  };
  const missing = Object.entries(required).filter(([, value]) => !value?.trim()).map(([key]) => key);
  return {
    configured: missing.length === 0,
    publishingEnabled: process.env.CARDFORGE_META_PUBLISHING_ENABLED === 'true',
    missing,
    appId: required.CARDFORGE_META_APP_ID?.trim() ?? '',
    appSecret: required.CARDFORGE_META_APP_SECRET?.trim() ?? '',
    loginConfigurationId: required.CARDFORGE_META_LOGIN_CONFIGURATION_ID?.trim() ?? '',
    graphVersion: required.CARDFORGE_META_GRAPH_API_VERSION?.trim() ?? '',
    pageId: process.env.CARDFORGE_META_PAGE_ID?.trim() ?? '',
    redirectUri: `${getPublicAppUrl()}/api/owner/marketing/meta/callback`,
  };
};

export const buildMetaAuthorizationUrl = (state: string): string => {
  const config = getMetaConfiguration();
  if (!config.configured) throw new Error(`Meta is not configured: ${config.missing.join(', ')}.`);
  const url = new URL(`https://www.facebook.com/${config.graphVersion}/dialog/oauth`);
  url.searchParams.set('client_id', config.appId);
  url.searchParams.set('config_id', config.loginConfigurationId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  return url.toString();
};

type MetaPage = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id?: string; username?: string; name?: string };
};

const metaGet = async <Payload>(path: string, parameters: Record<string, string>): Promise<Payload> => {
  const config = getMetaConfiguration();
  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/${path}`);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  const response = await fetch(url, { cache: 'no-store' });
  const payload = await response.json().catch(() => ({})) as Payload & { error?: { message?: string } };
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? 'Meta connection request failed.');
  return payload;
};

const saveConnection = async ({
  actorId,
  service,
  accountId,
  displayName,
  accessToken,
}: {
  actorId: string;
  service: 'facebook' | 'instagram';
  accountId: string;
  displayName: string;
  accessToken: string;
}): Promise<string> => {
  const database = getSupabaseServerClient();
  if (!database) throw new Error('The marketing database is not configured.');
  const encrypted = encryptMarketingToken(accessToken);
  const { data, error } = await database.from('cardforge_marketing_connections').upsert({
    provider: 'meta',
    service,
    external_account_id: accountId,
    display_name: displayName,
    access_token_ciphertext: encrypted.ciphertext,
    access_token_iv: encrypted.iv,
    access_token_auth_tag: encrypted.authTag,
    granted_scopes: META_SCOPES,
    status: 'active',
    status_note: '',
    connected_by: actorId,
    last_verified_at: new Date().toISOString(),
  }, { onConflict: 'provider,service,external_account_id' }).select('id').limit(1);
  if (error || !data?.[0]?.id) {
    console.error('Unable to save Meta connection:', error);
    throw new Error('Unable to save the connected Meta account.');
  }
  return data[0].id as string;
};

const saveAutomaticDestination = async ({
  actorId,
  connectionId,
  service,
  accountId,
  displayName,
}: {
  actorId: string;
  connectionId: string;
  service: 'facebook' | 'instagram';
  accountId: string;
  displayName: string;
}) => {
  const database = getSupabaseServerClient();
  if (!database) throw new Error('The marketing database is not configured.');
  const { data: existing, error: lookupError } = await database
    .from('cardforge_marketing_destinations')
    .select('id')
    .eq('provider', 'meta')
    .eq('service', service)
    .eq('external_account_id', accountId)
    .limit(1);
  if (lookupError) throw new Error('Unable to check existing Meta destinations.');
  const row = {
    connection_id: connectionId,
    name: displayName,
    service,
    kind: 'owned',
    provider: 'meta',
    publishing_mode: 'automatic',
    external_account_id: accountId,
    active: true,
  };
  const result = existing?.[0]?.id
    ? await database.from('cardforge_marketing_destinations').update(row).eq('id', existing[0].id)
    : await database.from('cardforge_marketing_destinations').insert({ ...row, created_by: actorId });
  if (result.error) throw new Error('Unable to save the Meta destination.');
};

export const connectMetaAccounts = async (code: string, actorId: string) => {
  const config = getMetaConfiguration();
  if (!config.configured) throw new Error(`Meta is not configured: ${config.missing.join(', ')}.`);
  const shortToken = await metaGet<{ access_token: string }>('oauth/access_token', {
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: config.redirectUri,
    code,
  });
  const longToken = await metaGet<{ access_token: string }>('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: config.appId,
    client_secret: config.appSecret,
    fb_exchange_token: shortToken.access_token,
  });
  const pages = await metaGet<{ data?: MetaPage[] }>('me/accounts', {
    fields: 'id,name,access_token,instagram_business_account{id,username,name}',
    access_token: longToken.access_token,
  });
  if (!pages.data?.length) throw new Error('Meta did not return a Facebook Page that this account can manage.');
  const selectedPages = config.pageId
    ? pages.data.filter((page) => page.id === config.pageId)
    : pages.data.length === 1
      ? pages.data
      : [];
  if (!selectedPages.length) {
    throw new Error(config.pageId
      ? 'The configured CardForge Facebook Page was not returned by Meta.'
      : 'Meta returned multiple manageable Pages. Add CARDFORGE_META_PAGE_ID so CardForge stores only the intended Page.');
  }
  let connectionCount = 0;
  for (const page of selectedPages) {
    const facebookConnectionId = await saveConnection({
      actorId,
      service: 'facebook',
      accountId: page.id,
      displayName: page.name,
      accessToken: page.access_token,
    });
    await saveAutomaticDestination({ actorId, connectionId: facebookConnectionId, service: 'facebook', accountId: page.id, displayName: page.name });
    connectionCount += 1;
    const instagram = page.instagram_business_account;
    if (instagram?.id) {
      const displayName = instagram.username ? `@${instagram.username}` : instagram.name ?? `${page.name} Instagram`;
      const instagramConnectionId = await saveConnection({
        actorId,
        service: 'instagram',
        accountId: instagram.id,
        displayName,
        accessToken: page.access_token,
      });
      await saveAutomaticDestination({ actorId, connectionId: instagramConnectionId, service: 'instagram', accountId: instagram.id, displayName });
      connectionCount += 1;
    }
  }
  return { pageCount: selectedPages.length, connectionCount };
};
